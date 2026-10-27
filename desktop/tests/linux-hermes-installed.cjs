// Explicit Linux acceptance against an original installed Hermes CLI; no model,
// account setup, source patch, SSH deployment or persistent native MCP change.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), {execFileSync} = require('node:child_process');
const [bridgeArg, nativeArg, executableArg, outputArg] = process.argv.slice(2);
if (process.platform !== 'linux' || !outputArg) throw Error('Provide Bridge root, installed Hermes source/CLI and output directory on Linux');
const bridge = path.resolve(bridgeArg), nativeRoot = path.resolve(nativeArg), executable = path.resolve(executableArg), output = path.resolve(outputArg);
fs.mkdirSync(output, {recursive: true});
const report = {date: new Date().toISOString(), status: 'running', version: require('../package.json').version, platform: process.platform, node: process.version, modelCalls: 0, checks: []};
const {scanTools} = require(path.join(bridge, 'desktop/electron/tool-discovery.cjs'));
const candidates = Object.fromEntries(['claude','codex','opencode','pi','dsh'].map(id => [id, []]));
const run = (file, args, extra = {}) => execFileSync(file, args, {env: process.env, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024, ...extra});
(async () => {
  const expected = fs.realpathSync(executable);
  const first = await scanTools({candidates});
  const installed = first.find(row => row.adapter === 'hermes'); assert(installed);
  assert.equal(installed.healthy, true); assert.equal(installed.version, '0.22.5'); assert.equal(installed.executable, expected);
  report.nativeVersion = installed.version;
  report.nativeSource = run('git', ['-C',nativeRoot,'rev-parse','HEAD']).trim();
  assert.equal(report.nativeSource, 'bf0203a794a07aac3ff764972ab9087baa4e4f4e');
  report.checks.push('Actual Linux published wrapper passes the native --version probe and keeps the canonical original installation');
  const minimal = {...process.env, PATH: '/usr/bin:/bin'};
  const second = await scanTools({candidates, environment: minimal});
  assert.equal(second[0].healthy, true); assert.equal(second[0].executable, expected);
  report.checks.push('The same original installation remains discoverable with a detached daemon PATH and independent HERMES_INSTALL_DIR');
  const resolver = "import json; from pathlib import Path; from pm.environments import committed_venv; print(json.dumps(str(committed_venv(Path("+JSON.stringify(nativeRoot)+")) / 'bin' / 'python')))";
  const python = JSON.parse(run(executable, ['--run-module','code','-c',resolver]).trim());
  assert(path.isAbsolute(python) && fs.statSync(python).isFile());
  report.checks.push('The original launcher resolves its committed Python dependency generation without a provider API or an interpreter substitution');
  run(process.execPath, [path.join(__dirname,'hermes-native-mcp.cjs'),bridge,nativeRoot,python,executable,path.join(output,'native-mcp.json')], {timeout: 180000});
  const mcp = JSON.parse(fs.readFileSync(path.join(output,'native-mcp.json'),'utf8'));
  assert.equal(mcp.status, 'passed'); assert.equal(mcp.expectedTools, 10); assert.equal(mcp.checks.length, 5); assert.equal(mcp.modelCalls, 0);
  report.checks.push('Original installed Linux Hermes CLI/config/MCPServerTask complete all five ten-tool lifecycle groups in disposable native Profiles');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code || 'ACCEPTANCE_FAILED', message: error.code === 'ERR_ASSERTION' ? 'Installed Linux Hermes did not satisfy the expected contract' : String(error.message).slice(0, 1000)}; process.exitCode = 1;})
  .finally(() => {fs.writeFileSync(path.join(output,'installed.json'), JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));});
