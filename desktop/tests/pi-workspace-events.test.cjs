const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createParser, piSessionFile} = require('../electron/native-cli-protocols.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pi-workspace-'));
  t.after(() => fs.promises.rm(root, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}));
  const workspace = path.join(root, 'workspace'), alias = path.join(root, 'alias'), foreign = path.join(root, 'foreign');
  fs.mkdirSync(workspace); fs.mkdirSync(foreign);
  fs.symlinkSync(workspace, alias, process.platform === 'win32' ? 'junction' : 'dir');
  return {root, workspace, alias, foreign};
}
function parse(workspace, cwd, sessionId = 'original-session') {
  const events = [], parser = createParser({adapter: 'pi', workspace, sessionId: 'original-session'}, event => events.push(event));
  parser.accept({type: 'session', id: sessionId, cwd});
  parser.accept({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'answer'}], stopReason: 'stop'}});
  parser.accept({type: 'agent_end', willRetry: false});
  return {events, result: parser.finish(0)};
}

test('Pi persisted file and native session event accept the same real directory through a junction or symlink', t => {
  const f = fixture(t), file = path.join(f.root, 'session.jsonl');
  fs.writeFileSync(file, JSON.stringify({type: 'session', id: 'original-session', cwd: f.alias}) + '\n');
  assert.equal(piSessionFile(f.root, 'original-session', f.workspace), file);
  const {events, result} = parse(f.workspace, f.alias);
  assert.equal(result.succeeded, true);
  assert.equal(result.sessionId, 'original-session');
  assert.equal(events.some(event => event.kind === 'binding_error'), false);
  assert.equal(parse(f.alias, f.workspace).result.succeeded, true);
});

test('Pi rejects unavailable, non-directory, relative and missing session cwd even with a successful native terminal', t => {
  const f = fixture(t), file = path.join(f.root, 'file'); fs.writeFileSync(file, 'test');
  for (const cwd of [f.foreign, path.join(f.root, 'missing'), file, '.', '', undefined, null, 42, {}]) {
    const {events, result} = parse(f.workspace, cwd);
    assert.equal(result.succeeded, false, String(cwd));
    assert(events.some(event => event.kind === 'binding_error'), String(cwd));
  }
  assert.equal(parse(path.join(f.root, 'missing'), f.workspace).result.succeeded, false);
});

test('Pi directory aliases cannot hide a different Session ID or repair a binding error later in the stream', t => {
  const f = fixture(t);
  assert.equal(parse(f.workspace, f.alias, 'foreign-session').result.succeeded, false);
  const events = [], parser = createParser({adapter: 'pi', workspace: f.workspace, sessionId: 'original-session'}, event => events.push(event));
  parser.accept({type: 'session', id: 'original-session', cwd: f.alias});
  fs.unlinkSync(f.alias);
  fs.symlinkSync(f.foreign, f.alias, process.platform === 'win32' ? 'junction' : 'dir');
  parser.accept({type: 'session', id: 'original-session', cwd: f.alias});
  parser.accept({type: 'session', id: 'original-session', cwd: f.workspace});
  parser.accept({type: 'message_end', message: {role: 'assistant', content: [], stopReason: 'stop'}});
  parser.accept({type: 'agent_end', willRetry: false});
  assert.equal(parser.finish(0).succeeded, false);
  assert(events.some(event => event.kind === 'binding_error'));
});
