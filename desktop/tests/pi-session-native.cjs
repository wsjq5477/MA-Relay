// Explicit model-free check against the unmodified npm Pi 1.4.0 bundle.
// node pi-session-native.cjs BRIDGE_ROOT PI_PACKAGE REPORT
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const [bridgeArg, nativeArg, reportArg] = process.argv.slice(2);
if (!reportArg) throw Error('Provide Bridge root, original Pi package and report path');
const bridge = path.resolve(bridgeArg), native = path.resolve(nativeArg), output = path.resolve(reportArg);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pi-session-native-'));
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = path.join(root, 'native-user');
const report = { date: new Date().toISOString(), environment: 'Windows / unmodified Pi 1.4.0 SessionManager / production Bridge session binding / controlled session files',
  status: 'running', modelCalls: 0, nativeExecutions: 0, checks: [] };
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(native, 'package.json'))).version, '1.4.0');
  const chunks = path.join(native, 'dist/bundle/chunks');
  const candidates = fs.readdirSync(chunks).filter(name => name.endsWith('.js')).map(name => path.join(chunks, name))
    .filter(file => [...fs.readFileSync(file, 'utf8').matchAll(/export\{([^}]+)\}/g)].some(match => match[1].split(',').includes('SessionManager')));
  assert.equal(candidates.length, 1, 'Require the exact original SessionManager export');
  const moduleFile = candidates[0], before = hash(moduleFile);
  const { SessionManager } = await import(pathToFileURL(moduleFile).href);
  const { piSessionFile, argumentsFor, profiles, createParser } = require(path.join(bridge, 'desktop/electron/native-cli-protocols.cjs'));
  const workspace = path.join(root, 'original'), foreign = path.join(root, 'foreign'), sessions = path.join(root, 'sessions');
  for (const directory of [workspace, foreign, sessions]) fs.mkdirSync(directory);
  const file = path.join(sessions, 'original.jsonl');
  const header = { type: 'session', version: 3, id: 'controlled-original-session', timestamp: new Date().toISOString(), cwd: workspace };
  const write = cwd => fs.writeFileSync(file, JSON.stringify({ ...header, cwd }) + '\n');
  write(workspace);
  let content = fs.readFileSync(file, 'utf8');
  let manager = SessionManager.open(file, sessions);
  assert.equal(manager.getCwd(), workspace);
  assert.equal(manager.getSessionId(), header.id);
  assert.equal(piSessionFile(sessions, header.id, workspace), file);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
  report.checks.push('Original native SessionManager and Bridge accept the same exact session and workspace without rewriting the file');
  write(foreign); content = fs.readFileSync(file, 'utf8');
  manager = SessionManager.open(file, sessions);
  assert.equal(manager.getCwd(), foreign);
  assert.equal(manager.getSessionId(), header.id);
  assert.throws(() => piSessionFile(sessions, header.id, workspace), { code: 'CONVERSATION_CONFIG' });
  assert.throws(() => argumentsFor({ adapter: 'pi', profile: profiles.pi, sessionDirectory: sessions, sessionId: header.id, workspace }), { code: 'CONVERSATION_CONFIG' });
  assert.equal(fs.readFileSync(file, 'utf8'), content);
  report.checks.push('Unmodified Pi restores a different persisted cwd for the same ID; Bridge refuses it before building continuation arguments');
  write(workspace);
  assert.equal(piSessionFile(sessions, header.id, workspace + path.sep + '.'), file);
  manager = SessionManager.open(file, sessions);
  assert.equal(manager.getSessionId(), header.id);
  assert.equal(manager.getCwd(), workspace);
  assert.equal(hash(moduleFile), before);
  report.checks.push('Restoring the original header and an equivalent directory spelling preserve the original session without replacement');
  const alias = path.join(root, 'workspace-alias');
  fs.symlinkSync(workspace, alias, process.platform === 'win32' ? 'junction' : 'dir');
  write(alias); content = fs.readFileSync(file, 'utf8');
  manager = SessionManager.open(file, sessions);
  assert.equal(manager.getCwd(), alias);
  assert.equal(manager.getSessionId(), header.id);
  assert.equal(piSessionFile(sessions, header.id, workspace), file);
  // Print mode emits SessionManager.getHeader() unchanged before prompting.
  const nativeHeader = manager.getHeader(), events = [];
  assert.equal(nativeHeader.cwd, alias);
  const parser = createParser({adapter: 'pi', workspace, sessionId: header.id}, event => events.push(event));
  parser.accept(nativeHeader);
  parser.accept({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'controlled terminal'}],stopReason:'stop'}});
  parser.accept({type:'agent_end',willRetry:false});
  assert.equal(parser.finish(0).succeeded, true);
  assert.equal(events.some(event => event.kind === 'binding_error'), false);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
  assert.equal(hash(moduleFile), before);
  report.checks.push('The original native header preserves a directory alias; Bridge accepts that actual header using the same real-directory check as dispatch (terminal events controlled, no prompt)');
  report.nativeVersion = '1.4.0'; report.nativeModuleSha256 = before; report.nativeSourceUnchanged = true;
  report.status = 'passed';
})().catch(error => {
  report.status = 'failed'; report.error = { code: error.code || 'ACCEPTANCE_FAILED', name: error.name };
  process.exitCode = 1;
}).finally(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
});
