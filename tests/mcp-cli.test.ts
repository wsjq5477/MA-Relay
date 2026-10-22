import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { main } from '../src/cli.js';

const { startCoordinator } = createRequire(import.meta.url)('../desktop/electron/coordinator.cjs') as {
  startCoordinator: (options: {
    directory: string;
    version: string;
    service: { dispatch(method: string, params?: unknown): unknown; close(): void };
  }) => Promise<{ close(): Promise<void>; server: { listening: boolean } }>;
};

interface StubCall { method: string; params: Record<string, unknown> }
interface StubState {
  calls: StubCall[];
  nodes: unknown[];
  responses: Record<string, unknown>;
}
interface RunResult { code: number; stdout: string; stderr: string }

// A controlled coordinator: the real JSON-lines server, a stub service. This is
// the same pattern as desktop/tests/coordinator.test.cjs, so no real machine or
// native product is touched. The temporary directory is always passed through
// --profile-dir; the user's real profile is never opened.
function stubService(state: StubState) {
  return {
    dispatch(method: string, params?: unknown) {
      if (method === 'shutdown') return { stopping: true };
      if (method !== 'call') return {};
      const input = params as { method?: unknown; params?: unknown };
      const name = typeof input?.method === 'string' ? input.method : '';
      const inner = input && typeof input.params === 'object' && input.params !== null
        ? input.params as Record<string, unknown>
        : {};
      state.calls.push({ method: name, params: inner });
      // Mirror the real coordinator-service dispatch envelope: {ok,result} or
      // {ok:false,error}; the CLI must unwrap it, never render it as status.
      if (name === 'snapshot') return { ok: true, result: { nodes: state.nodes } };
      const response = state.responses[name];
      if (response === undefined) return { ok: false, error: { code: 'UNEXPECTED_METHOD', message: 'stub 未配置响应：' + name } };
      if (response instanceof Error) return { ok: false, error: { code: (response as { code?: string }).code ?? 'STUB_ERROR', message: response.message } };
      return { ok: true, result: response };
    },
    close() { /* no resources */ },
  };
}

async function withCoordinator(state: StubState, body: (directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(resolve(tmpdir(), 'ab-mcp-cli-'));
  const server = await startCoordinator({ directory, version: '0.6.0-alpha.43-test', service: stubService(state) });
  try { await body(directory); }
  finally { await server.close(); rmSync(directory, { recursive: true, force: true }); }
}

async function runCli(argv: string[]): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...args: unknown[]) => { stdout.push(args.map(value => String(value)).join(' ')); };
  console.error = (...args: unknown[]) => { stderr.push(args.map(value => String(value)).join(' ')); };
  try { const code = await main(argv); return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') }; }
  finally { console.log = log; console.error = error; }
}

function fixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nodeId: 'node-1',
    adapter: 'claude',
    enabled: true,
    installed: true,
    conflict: false,
    configPath: '',
    state: 'installed',
    facts: { config: 'present', nativeLoad: 'loaded', connection: 'connected', tools: 'available', authorization: 'valid', ownership: 'bridge' },
    evidence: { configPath: '', nativeProbe: { kind: 'native-list', command: 'claude mcp list', outcome: 'connected' } },
    ...overrides,
  };
}

test('mcp status renders facts and the native config path for an explicit adapter', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    const configPath = resolve(directory, '.claude.json');
    state.responses['mcp.status'] = fixture({ configPath, connectionId: 'connection-1', evidence: { configPath, nativeProbe: { kind: 'native-list', command: 'claude mcp list', outcome: 'connected' } } });
    const result = await runCli(['mcp', 'status', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /节点：node-1/);
    assert.match(result.stdout, /适配器：claude（Claude Code）/);
    assert.match(result.stdout, /状态：已安装/);
    assert.match(result.stdout, /原生加载：已加载/);
    assert.match(result.stdout, /连接：已连接/);
    assert.match(result.stdout, /工具：可用/);
    assert.match(result.stdout, /接入授权：有效/);
    assert.match(result.stdout, /配置归属：Bridge 写入/);
    assert.ok(result.stdout.includes('原生配置：' + configPath));
    assert.match(result.stdout, /探查证据：native-list · connected/);
    assert.deepEqual(state.calls.map(call => call.method), ['mcp.status']);
    assert.equal(state.calls[0]!.params.nodeId, 'node-1');
    assert.equal(state.calls[0]!.params.adapter, 'claude');
  });
});

test('headless discovery, explicit attach and original operation query never replay a lost attach', async () => {
  const state:StubState={calls:[],nodes:[{nodeId:'new-node',machineId:'machine',adapter:'claude',name:'Claude',connected:false,healthy:true}],responses:{}};
  await withCoordinator(state,async directory=>{
    const nodes=await runCli(['mcp','nodes','--profile-dir',directory,'--json']);assert.equal(nodes.code,0);assert.match(nodes.stdout,/new-node/);
    state.responses.manageNode={operationId:'original-attach',state:'unknown'};
    const args=['--node','new-node','--operation-id','original-attach','--profile-dir',directory];
    const attached=await runCli(['mcp','attach',...args]);assert.equal(attached.code,3);assert.match(attached.stdout,/original-attach/);
    for(const status of ['not_found','unknown','confirmed']){
      state.responses.nodeOperation={operationId:'original-attach',state:status};
      const original=await runCli(['mcp','operation',...args]);assert.equal(original.code,status==='confirmed'?0:3);
    }
    state.responses['mcp.export']=fixture({nodeId:'new-node',state:'exported'});
    assert.equal((await runCli(['mcp','export','--node','new-node','--adapter','claude','--profile-dir',directory])).code,0);
    assert.equal(state.calls.filter(c=>c.method==='manageNode').length,1);assert.equal(state.calls.filter(c=>c.method==='nodeOperation').length,3);
    assert.equal(state.calls.some(c=>c.method==='nodeRequest'),false);
    assert.deepEqual(state.calls.find(c=>c.method==='manageNode')?.params,{nodeId:'new-node',operationId:'original-attach',action:'attach'});
    const missing=await runCli(['mcp','attach','--node','new-node','--profile-dir',directory]);assert.equal(missing.code,2);
  });
});

test('MCP CLI honors the same profile override as the desktop window', async () => {
  const state:StubState={calls:[],nodes:[],responses:{'mcp.status':fixture()}};
  await withCoordinator(state,async directory=>{
    const previous=process.env.AGENTBRIDGE_DESKTOP_PROFILE;process.env.AGENTBRIDGE_DESKTOP_PROFILE=directory;
    try{assert.equal((await runCli(['mcp','status','--node','node-1','--adapter','claude'])).code,0);}
    finally{if(previous===undefined)delete process.env.AGENTBRIDGE_DESKTOP_PROFILE;else process.env.AGENTBRIDGE_DESKTOP_PROFILE=previous;}
  });
});

test('mcp resolves an omitted adapter from the coordinator snapshot and never guesses', async () => {
  const state: StubState = { calls: [], nodes: [{ nodeId: 'node-1', adapter: 'codex', name: 'Codex' }], responses: {} };
  await withCoordinator(state, async directory => {
    state.responses['mcp.status'] = fixture({ adapter: 'codex' });
    const resolved = await runCli(['mcp', 'status', '--node', 'node-1', '--profile-dir', directory]);
    assert.equal(resolved.code, 0);
    assert.match(resolved.stdout, /适配器：codex（Codex）/);
    assert.deepEqual(state.calls.map(call => call.method), ['snapshot', 'mcp.status']);
    assert.equal(state.calls[1]!.params.adapter, 'codex');

    state.calls.length = 0;
    state.nodes = [];
    const unknown = await runCli(['mcp', 'status', '--node', 'missing-node', '--profile-dir', directory]);
    assert.equal(unknown.code, 2);
    assert.match(unknown.stderr, /NODE_NOT_FOUND/);
    assert.match(unknown.stderr, /未找到 Agent 节点：missing-node/);
    assert.deepEqual(state.calls.map(call => call.method), ['snapshot']);

    state.calls.length = 0;
    state.nodes = [{ nodeId: 'node-1', adapter: 'claude' }, { nodeId: 'node-1', adapter: 'codex' }];
    const ambiguous = await runCli(['mcp', 'status', '--node', 'node-1', '--profile-dir', directory]);
    assert.equal(ambiguous.code, 2);
    assert.match(ambiguous.stderr, /NODE_AMBIGUOUS/);
    assert.deepEqual(state.calls.map(call => call.method), ['snapshot']);
  });
});

test('mcp export and install print absolute fragment paths without leaking configuration or tokens', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    const configPath = resolve(directory, '.claude.json');
    const jsonFragment = resolve(directory, 'mcp-connections', 'fragment.json');
    const codexFragment = resolve(directory, 'mcp-connections', 'fragment.toml');
    const exported = fixture({
      state: 'exported', installed: false, configPath,
      facts: { config: 'absent', nativeLoad: 'not_loaded', connection: 'unknown', tools: 'unknown', authorization: 'valid', ownership: 'unconfirmed' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
      files: { json: jsonFragment, codex: codexFragment },
      configuration: { command: 'node', args: [resolve(directory, 'bridge-endpoint.json')], env: { AGENTBRIDGE_TOKEN: 'FAKE_EXPORT_TOKEN_VALUE' } },
      token: 'FAKE_TOP_LEVEL_TOKEN',
    });
    state.responses['mcp.export'] = exported;
    const human = await runCli(['mcp', 'export', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(human.code, 0);
    assert.match(human.stdout, /已生成标准配置片段，未写入原生配置/);
    assert.ok(human.stdout.includes('通用 MCP JSON：' + jsonFragment));
    assert.ok(human.stdout.includes('Codex TOML：' + codexFragment));
    assert.ok(human.stdout.includes('原生配置入口：' + configPath + '（未修改）'));
    assert.ok(!human.stdout.includes('FAKE_EXPORT_TOKEN_VALUE'));
    assert.ok(!human.stdout.includes('bridge-endpoint.json'));
    assert.ok(!human.stdout.includes('FAKE_TOP_LEVEL_TOKEN'));

    const json = await runCli(['mcp', 'export', '--node', 'node-1', '--adapter', 'claude', '--json', '--profile-dir', directory]);
    assert.equal(json.code, 0);
    assert.ok(!json.stdout.includes('FAKE_EXPORT_TOKEN_VALUE'));
    assert.ok(!json.stdout.includes('FAKE_TOP_LEVEL_TOKEN'));
    const parsed = JSON.parse(json.stdout) as { files: Record<string, string>; configuration: unknown; token: unknown; facts:{authorization:string} };
    assert.equal(parsed.files.json, jsonFragment);
    assert.equal(parsed.configuration, '[redacted]');
    assert.equal(parsed.token, '[redacted]');
    assert.equal(parsed.facts.authorization, 'valid');

    state.responses['mcp.install'] = fixture({ configPath, files: { json: jsonFragment } });
    const installed = await runCli(['mcp', 'install', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(installed.code, 0);
    assert.match(installed.stdout, /已写入原生配置，请在原生 Agent 重新加载或重开/);
    assert.ok(installed.stdout.includes('原生配置：存在（' + configPath + '）'));
    assert.ok(installed.stdout.includes('通用 MCP JSON：' + jsonFragment));
  });
});

test('mcp remove distinguishes revocation from native cleanup', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    const configPath = resolve(directory, '.claude.json');

    state.responses['mcp.remove'] = fixture({
      state: 'absent', enabled: false, installed: false, configPath,
      facts: { config: 'absent', nativeLoad: 'unknown', connection: 'revoked', tools: 'unauthorized', authorization: 'revoked', ownership: 'unconfirmed' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
    });
    const removed = await runCli(['mcp', 'remove', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(removed.code, 0);
    assert.match(removed.stdout, /接入授权：已撤销/);
    assert.match(removed.stdout, /原生配置：已移除/);
    assert.match(removed.stdout, /结果：已撤销授权并移除原生配置/);

    state.responses['mcp.remove'] = fixture({
      state: 'revoked_config_pending', enabled: false, installed: false, configPath,
      facts: { config: 'present', nativeLoad: 'unknown', connection: 'revoked', tools: 'unauthorized', authorization: 'revoked', ownership: 'bridge' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
      cleanupError: { code: 'MCP_CONFIG_CONFLICT', message: '原生配置文件被其他程序占用' },
    });
    const pending = await runCli(['mcp', 'remove', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(pending.code, 0);
    assert.match(pending.stdout, /接入授权：已撤销/);
    assert.match(pending.stdout, /原生配置：待清理/);
    assert.match(pending.stdout, /结果：已撤销授权，原生配置待清理/);
    assert.ok(!pending.stdout.includes('原生配置：已移除'));
    assert.match(pending.stdout, /清理错误：MCP_CONFIG_CONFLICT: 原生配置文件被其他程序占用/);

    state.responses['mcp.remove'] = fixture({
      state: 'conflict', enabled: false, installed: false, conflict: true, configPath,
      facts: { config: 'conflict', nativeLoad: 'unknown', connection: 'revoked', tools: 'unauthorized', authorization: 'revoked', ownership: 'external' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
    });
    const conflict = await runCli(['mcp', 'remove', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(conflict.code, 0);
    assert.match(conflict.stdout, /原生配置：保留/);
    assert.match(conflict.stdout, /结果：已撤销授权，原生配置未删除/);
  });
});

test('mcp revoke removes authorization only and reports retained or pending native entries', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    const configPath = resolve(directory, '.claude.json');
    state.responses['mcp.revoke'] = fixture({
      enabled: false, installed: false, configPath, state: 'revoked_config_pending',
      facts: { config: 'present', nativeLoad: 'unknown', connection: 'revoked', tools: 'unauthorized', authorization: 'revoked', ownership: 'bridge' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
    });
    const revoked = await runCli(['mcp', 'revoke', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(revoked.code, 0);
    assert.match(revoked.stdout, /接入授权：已撤销/);
    assert.match(revoked.stdout, /原生配置：保留（未删除）/);
    assert.match(revoked.stdout, /结果：已撤销授权，原生配置待清理/);
    assert.deepEqual(state.calls.map(call => call.method), ['mcp.revoke']);
    assert.equal(state.calls[0]!.params.adapter, 'claude');

    state.responses['mcp.revoke'] = fixture({
      enabled: false, installed: false, configPath, state: 'absent',
      facts: { config: 'absent', nativeLoad: 'unknown', connection: 'revoked', tools: 'unauthorized', authorization: 'revoked', ownership: 'unconfirmed' },
      evidence: { configPath, nativeProbe: { kind: 'none' } },
    });
    const alreadyGone = await runCli(['mcp', 'revoke', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(alreadyGone.code, 0);
    assert.match(alreadyGone.stdout, /原生配置：已不存在/);

    state.responses['mcp.revoke'] = Object.assign(new Error('这个节点还没有 Bridge 登记的 MCP 接入。'), { code: 'MCP_NOT_CONFIGURED' });
    const unregistered = await runCli(['mcp', 'revoke', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(unregistered.code, 2);
    assert.match(unregistered.stderr, /MCP_NOT_CONFIGURED/);
  });
});

test('mcp probe reports native load, connection and tool counts without tool names or secrets', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    const configPath = resolve(directory, '.claude.json');
    state.responses['mcp.probe'] = fixture({
      configPath,
      facts: { config: 'present', nativeLoad: 'loaded', connection: 'connected', tools: 'available', authorization: 'valid', ownership: 'bridge' },
      evidence: {
        configPath,
        nativeProbe: { kind: 'native-list', command: 'claude mcp list', outcome: 'connected', detail: 'agentbridge: connected' },
        toolsProbe: { kind: 'bridge-stdio', outcome: 'available', toolCount: 7 },
      },
      token: 'FAKE_PROBE_TOKEN',
    });
    const probed = await runCli(['mcp', 'probe', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(probed.code, 0);
    assert.match(probed.stdout, /原生加载：已加载/);
    assert.match(probed.stdout, /连接：已连接/);
    assert.match(probed.stdout, /工具：可用/);
    assert.match(probed.stdout, /7 个/);
    assert.match(probed.stdout, /探查证据：/);
    assert.ok(!probed.stdout.includes('FAKE_PROBE_TOKEN'));

    const json = await runCli(['mcp', 'probe', '--node', 'node-1', '--adapter', 'claude', '--json', '--profile-dir', directory]);
    assert.equal(json.code, 0);
    assert.ok(!json.stdout.includes('FAKE_PROBE_TOKEN'));
    const parsed = JSON.parse(json.stdout) as { token: unknown; facts: { tools: string } };
    assert.equal(parsed.token, '[redacted]');
    assert.equal(parsed.facts.tools, 'available');
    assert.deepEqual(state.calls.map(call => call.method), ['mcp.probe', 'mcp.probe']);

    state.responses['mcp.probe'] = fixture({
      adapter: 'hermes', state: 'unsupported', enabled: false, installed: false, configPath: '',
      nativeSupport: false, nativeSupportCode: 'MCP_NATIVE_CONFIG_UNSUPPORTED',
      nativeSupportReason: '尚未核对到该产品的原生 MCP 配置文件或接口，Bridge 不猜测路径。',
      facts: { config: 'unsupported', nativeLoad: 'unsupported', connection: 'unknown', tools: 'unknown', authorization: 'unknown', ownership: 'unconfirmed' },
      evidence: { configPath: '', nativeProbe: { kind: 'none' } },
    });
    const unsupported = await runCli(['mcp', 'probe', '--node', 'node-2', '--adapter', 'hermes', '--profile-dir', directory]);
    assert.equal(unsupported.code, 0);
    assert.match(unsupported.stdout, /状态：不支持（无可管理的原生配置路径）/);
    assert.match(unsupported.stdout, /原生配置路径：该产品暂无可管理的原生配置路径/);
    assert.match(unsupported.stdout, /说明：该产品未提供可核验的原生 MCP 配置/);
  });
});

test('mcp maps backend refusal codes to exit 4 and unsupported install to 4', async () => {
  const state: StubState = { calls: [], nodes: [], responses: {} };
  await withCoordinator(state, async directory => {
    state.responses['mcp.install'] = Object.assign(new Error('尚未核对到该产品的原生 MCP 配置文件或接口。'), { code: 'MCP_NATIVE_CONFIG_UNSUPPORTED' });
    const unsupported = await runCli(['mcp', 'install', '--node', 'node-1', '--adapter', 'hermes', '--profile-dir', directory]);
    assert.equal(unsupported.code, 4);
    assert.match(unsupported.stderr, /MCP_NATIVE_CONFIG_UNSUPPORTED/);

    state.responses['mcp.install'] = Object.assign(new Error('原配置已有其他 agentbridge 条目，已保留，请先处理冲突。'), { code: 'MCP_CONFIG_CONFLICT' });
    const conflict = await runCli(['mcp', 'install', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(conflict.code, 4);
    assert.match(conflict.stderr, /MCP_CONFIG_CONFLICT/);

    state.responses['mcp.remove'] = Object.assign(new Error('请先接入此 Agent。'), { code: 'NODE_DISCONNECTED' });
    const disconnected = await runCli(['mcp', 'remove', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', directory]);
    assert.equal(disconnected.code, 5);
    assert.match(disconnected.stderr, /NODE_DISCONNECTED/);
  });
});

test('mcp rejects missing and unknown options before contacting the backend', async () => {
  const missingNode = await runCli(['mcp', 'status', '--adapter', 'claude', '--profile-dir', resolve(tmpdir(), 'ab-mcp-cli-unused')]);
  assert.equal(missingNode.code, 2);
  assert.match(missingNode.stderr, /需要 --node NODE_ID/);

  const unknownOption = await runCli(['mcp', 'status', '--node', 'node-1', '--token', 'secret']);
  assert.equal(unknownOption.code, 2);
  assert.match(unknownOption.stderr, /COMMAND_FAILED/);

  const badSubcommand = await runCli(['mcp', 'installer', '--node', 'node-1']);
  assert.equal(badSubcommand.code, 2);
  assert.match(badSubcommand.stderr, /用法：agentbridge mcp status\|export\|install\|remove\|revoke\|probe/);
});

test('mcp fails with an actionable error when the desktop backend is not installed', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-mcp-cli-nobackend-'));
  const profile = mkdtempSync(resolve(tmpdir(), 'ab-mcp-cli-nobackend-profile-'));
  const previous = process.env.AGENTBRIDGE_BRIDGE_DIR;
  process.env.AGENTBRIDGE_BRIDGE_DIR = root;
  try {
    const result = await runCli(['mcp', 'status', '--node', 'node-1', '--adapter', 'claude', '--profile-dir', profile]);
    assert.equal(result.code, 5);
    assert.match(result.stderr, /DESKTOP_BACKEND_MISSING/);
    assert.match(result.stderr, /未找到 AgentBridge 桌面后台组件/);
    assert.match(result.stderr, /AGENTBRIDGE_BRIDGE_DIR/);
  } finally {
    if (previous === undefined) delete process.env.AGENTBRIDGE_BRIDGE_DIR;
    else process.env.AGENTBRIDGE_BRIDGE_DIR = previous;
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});
