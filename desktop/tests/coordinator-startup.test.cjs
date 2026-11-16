const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire, wrap } = require('node:module');
const { runInThisContext } = require('node:vm');
const test = require('node:test');
const { startCoordinator } = require('../electron/coordinator.cjs');

function loadDesktopModule(name, overrides) {
  const filename = path.resolve(__dirname, '../electron', name);
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const localRequire = createRequire(filename);
  const load = id => Object.hasOwn(overrides, id) ? overrides[id] : localRequire(id);
  runInThisContext(wrap(source), { filename })(module.exports, load, module, filename, path.dirname(filename));
  return module.exports;
}

test('startup IPC stays responsive during ACL preparation and explicit reconnect resumes reads of the original backend', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-coordinator-startup-'));
  const dispatched = [];
  const server = await startCoordinator({
    directory,
    version: 'fixture',
    service: {
      dispatch(method, input) {
        dispatched.push(method);
        if (method === 'call' && input.method === 'snapshot') return { ok: true, result: { machines: [{ machineId: 'original' }] } };
        if (method === 'preferences') return { version: 'fixture' };
        if (method === 'pending') return [{ id: 'original-request', state: 'unknown' }];
        throw new Error('Unexpected dispatch');
      },
      close() {},
    },
  });
  const identityFile = path.join(directory, 'coordinator-identity.json');
  const originalIdentity = fs.readFileSync(identityFile);
  const pendingFile = path.join(directory, 'pending.json');
  fs.writeFileSync(pendingFile, '[{"id":"original-request","state":"unknown"}]');
  const originalPending = fs.readFileSync(pendingFile);
  const timeout = Object.assign(new Error('后台私有目录权限初始化超时。'), { code: 'PRIVATE_DIRECTORY_TIMEOUT' });
  let rejectAcl;
  let failed = false;
  let attempts = 0;
  const acl = {
    ...require('../electron/private-directory.cjs'),
    async ensurePrivateDirectoryAsync(target) {
      assert.equal(target, directory);
      if (failed) throw timeout;
      if (++attempts > 1) return;
      return new Promise((resolve, reject) => {
        rejectAcl = () => { failed = true; reject(timeout); };
      });
    },
    retryPrivateDirectory(target) {
      if (target === directory) failed = false;
    },
  };
  const coordinator = loadDesktopModule('coordinator.cjs', { './private-directory.cjs': acl });
  const { CoordinatorClient } = loadDesktopModule('coordinator-client.cjs', {
    './coordinator.cjs': coordinator,
    './private-directory.cjs': acl,
  });
  const handlers = new Map();
  const events = new Map();
  let window;
  let minimized = false;
  const electron = {
    app: {
      getPath: () => directory,
      getVersion: () => 'fixture',
      requestSingleInstanceLock: () => true,
      setAppUserModelId() {},
      setPath() {},
      on: (name, handler) => events.set(name, handler),
      whenReady: () => ({ then: handler => handler() }),
    },
    BrowserWindow: class {
      constructor() { window = this; }
      webContents = { mainFrame: {}, on() {}, setWindowOpenHandler() {} };
      loadFile() {}
      minimize() { minimized = true; }
    },
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
  };
  t.after(async () => {
    events.get('before-quit')?.();
    await server.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  loadDesktopModule('main.cjs', { electron, './coordinator-client.cjs': { CoordinatorClient } });
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  const invoke = (method, input) => handlers.get(`bridge:${method}`)(event, input);
  const snapshot = () => invoke('call', { method: 'snapshot' });

  const initialSnapshot = snapshot();
  const initialPending = assert.rejects(invoke('pending'), { code: 'PRIVATE_DIRECTORY_TIMEOUT' });
  const initialPreferences = assert.rejects(invoke('preferences'), { code: 'PRIVATE_DIRECTORY_TIMEOUT' });
  assert.equal(attempts, 1);
  await invoke('window', 'minimize');
  assert.equal(minimized, true);
  assert.deepEqual(dispatched, []);
  rejectAcl();
  const first = await initialSnapshot;
  assert.deepEqual(first, { ok: false, error: { code: timeout.code, message: timeout.message } });
  await Promise.all([initialPending, initialPreferences]);
  assert.deepEqual(await snapshot(), first);
  assert.equal(attempts, 1);
  assert.throws(() => handlers.get('bridge:reconnect')({ ...event, senderFrame: {} }), /拒绝其他页面/);
  await invoke('reconnect');
  assert.equal(attempts, 2);
  assert.equal((await snapshot()).result.machines[0].machineId, 'original');
  assert.equal((await invoke('preferences')).version, 'fixture');
  assert.deepEqual(await invoke('pending'), [{ id: 'original-request', state: 'unknown' }]);
  assert.deepEqual(dispatched, ['call', 'preferences', 'pending']);
  assert.ok(fs.readFileSync(identityFile).equals(originalIdentity));
  assert.ok(fs.readFileSync(pendingFile).equals(originalPending));
});

test('closing the desktop during ACL preparation prevents a delayed attach or backend launch', async () => {
  let finishACL;
  const ACL = new Promise(resolve => { finishACL = resolve; });
  const { CoordinatorClient } = loadDesktopModule('coordinator-client.cjs', {
    './coordinator.cjs': {
      identityAsync: () => ACL,
      endpoint: () => assert.fail('Closed startup opened a socket'),
    },
    './coordinator-runtime.cjs': {
      coordinatorRuntime: () => assert.fail('Closed startup prepared runtime resources'),
    },
  });
  const client = new CoordinatorClient({ directory: 'unused' });
  const open = assert.rejects(client.open(), { code: 'COORDINATOR_TRANSPORT' });
  client.close();
  finishACL({});
  await open;
  assert.equal(client.socket, null);
});
