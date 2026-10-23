const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, '../tsconfig.json');
const { require: requireTsx } = require('tsx/cjs/api');
const { createRequire } = require('node:module');
const desktopRequire = createRequire(path.resolve(__dirname, '../package.json'));
const React = desktopRequire('react');
const { renderToStaticMarkup } = desktopRequire('react-dom/server');
const McpSettings = requireTsx('../src/McpSettings.tsx', __filename).default;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

// A DSH-style node whose backend projects the new three dimensions.
const node = {
  nodeId: 'node-dsh', adapter: 'dsh-web', name: 'DSH Web', machineId: 'machine',
  executable: '/fixture/dsh', connected: true, online: true, healthy: true, available: true,
  busy: false, executionSupported: true, activeTasks: 0, status: 'connected',
  connectionCapabilities: {
    execution: true, delegation: true, bridgeMcp: true,
    mcpClient: true, nativeMcpConfig: true, hostManagedTask: false,
    resume: true, cancellation: true, permissions: false, forms: false, verification: false,
  },
  capabilitySource: { kind: 'static-adapter', adapterId: 'dsh-web' },
};
const configPath = '/fixture/.dsh/mcp.yaml';
const base = {
  nodeId: 'node-dsh', adapter: 'dsh-web', configPath,
  enabled: true, installed: true, conflict: false, state: 'installed',
};
const factValue = (html, label) => {
  const match = new RegExp('<dt>' + label + '</dt><dd><span>([^<]*)</span>').exec(html);
  assert.ok(match, label + ' fact row must render as its own labelled row');
  return match[1];
};
test('Pi native disable is visible, keeps removal available and never offers re-enable through install', () => {
  const html = render(McpSettings, {node: {...node, adapter: 'pi', name: 'Pi', capabilitySource: {kind: 'static-adapter', adapterId: 'pi'}}, initialStatus: {
    ...base, adapter: 'pi', installed: false,
    facts: {config: 'disabled', nativeLoad: 'unknown', connection: 'unknown', tools: 'unknown', authorization: 'valid', ownership: 'bridge'},
  }});
  assert.equal(factValue(html, '配置'), '已禁用');
  assert.match(html, /<button[^>]*disabled=""[^>]*>添加 Bridge MCP/);
  assert.match(html, /<button[^>]*>移除 Bridge MCP/);
  assert.match(html, /不会静默重新启用/);
});
test('DSH Desktop shows the registered profile and native selection change without claiming foreign ownership', () => {
  const html = render(McpSettings, {node: {...node, adapter: 'dsh-desktop', name: 'DSH Desktop', capabilitySource: {kind: 'static-adapter', adapterId: 'dsh-desktop'}}, initialStatus: {
    ...base, adapter: 'dsh-desktop', state: 'conflict', installed: false, conflict: true,
    profile: 'original', nativeTargetChanged: true, currentConfigPath: '/other/profile/cordis.patch.yml',
    facts: {config: 'present', nativeLoad: 'unknown', connection: 'unknown', tools: 'unknown', authorization: 'valid', ownership: 'bridge'},
    evidence: {configPath, configError: {code: 'MCP_NATIVE_TARGET_CHANGED', message: 'DSH Desktop 已切换数据目录或 Profile；请先移除原接入配置。'}},
  }});
  assert.match(html, /接入的 DSH Desktop Profile：original/);
  assert.match(html, /已切换数据目录或 Profile/);
  assert.match(html, /移除仅清理原接入目标/);
  assert.match(html, /\/other\/profile\/cordis.patch.yml/);
  assert.doesNotMatch(html, /同名条目已存在或被外部修改/);
  assert.equal(factValue(html, '归属'), 'Bridge 管理');
});

test('a full facts payload renders six separate labelled rows without inventing native evidence', () => {
  const html = render(McpSettings, { node, initialStatus: {
    ...base,
    state: 'installed',
    facts: {
      config: 'present', nativeLoad: 'reload_required', connection: 'unknown',
      tools: 'unknown', authorization: 'valid', ownership: 'external',
    },
    evidence: {
      configPath,
      nativeProbe: { kind: 'cli-list', command: 'dsh mcp list', outcome: 'no-entry' },
      toolsProbe: { kind: 'bridge-stdio', outcome: 'not-run' },
    },
  } });
  assert.equal(factValue(html, '配置'), '存在');
  assert.equal(factValue(html, '原生加载'), '需重新加载/重开');
  assert.equal(factValue(html, '连接'), '未知');
  assert.equal(factValue(html, '工具'), '未知');
  assert.equal(factValue(html, '授权'), '有效');
  assert.equal(factValue(html, '归属'), '原生外部管理');
  assert.match(html, /未知：没有取得原生连接握手结果/);
  assert.match(html, /未知：未取得原生工具目录/);
  assert.match(html, /原生列表探测：使用该产品自身的 MCP 列表命令/);
  assert.match(html, /dsh mcp list/);
  assert.match(html, /Bridge 工具探测/);
  // A written config plus an unverified connection must never be rendered as connected/available.
  assert.doesNotMatch(html, /已连接/);
  assert.doesNotMatch(html, />可用</);
  // The MCP section offers the unified operations for any agent.
  assert.match(html, /AgentBridge MCP 操作/);
  assert.match(html, /添加 Bridge MCP/);
  assert.match(html, /重新探测原生列表/);
  assert.match(html, /撤销连接授权/);
});

test('a legacy payload without facts shows one honest upgrade line instead of per-fact claims', () => {
  const html = render(McpSettings, { node, initialStatus: { ...base } });
  assert.match(html, /当前后台只返回旧的配置与授权摘要/);
  assert.match(html, /没有逐项原生证据/);
  assert.match(html, /请升级后台后再核对原生可见性/);
  assert.doesNotMatch(html, /已连接/);
  assert.doesNotMatch(html, /MCP 状态事实/);
  assert.doesNotMatch(html, /<dt>原生加载<\/dt>/);
  // The legacy summary remains readable.
  assert.match(html, /已添加/);
  assert.match(html, /接入授权有效/);
});

test('historical probes show their timestamp and require a fresh native observation', () => {
  const html = render(McpSettings, { node, initialStatus: {
    ...base,
    facts: {config:'present',nativeLoad:'unknown',connection:'unknown',tools:'unknown',authorization:'valid',ownership:'bridge'},
    evidence: {observation:{observedAt:'2026-10-22T01:00:00.000Z',freshness:'stale',reason:'configuration_changed'}},
  } });
  assert.match(html, /2026-10-22T01:00:00.000Z/);
  assert.match(html, /重新探测/);
  assert.match(html, /服务端工具目录可用不代表原生Agent已连接或已获准委派/);
  assert.equal(factValue(html, '连接'), '未知');
  assert.equal(factValue(html, '工具'), '未知');
});

test('revoked_config_pending shows both the revoked authorization and the pending native cleanup', () => {
  const html = render(McpSettings, { node, initialStatus: {
    ...base, enabled: false, installed: false, state: 'revoked_config_pending',
    facts: {
      config: 'present', nativeLoad: 'not_loaded', connection: 'revoked',
      tools: 'unauthorized', authorization: 'revoked', ownership: 'bridge',
    },
  } });
  assert.match(html, /已撤销授权，原生配置待清理/);
  assert.match(html, /已撤销连接授权，原生配置仍存在，待清理/);
  assert.doesNotMatch(html, />已移除</);
  assert.doesNotMatch(html, /已连接/);
  assert.equal(factValue(html, '配置'), '存在');
  assert.equal(factValue(html, '连接'), '已撤销');
  assert.equal(factValue(html, '授权'), '已撤销');
  assert.equal(factValue(html, '工具'), '未授权');
  // Cleanup can be retried and the separate authorization action is already done.
  assert.match(html, /<button\b(?![^>]*disabled)[^>]*>移除 Bridge MCP/);
  // The authorization is already revoked; no second revoke action is offered.
  assert.doesNotMatch(html, /<button\b[^>]*>撤销连接授权/);
});

test('an unsupported native config shows the backend reason verbatim instead of a generic failure', () => {
  const reason = '当前产品未适配 Bridge 原生 MCP 配置，请在原生工具内手动添加。';
  const html = render(McpSettings, { node, initialStatus: {
    ...base, enabled: false, installed: false, state: 'unsupported',
    nativeSupport: false,
    nativeSupportCode: 'MCP_NATIVE_CONFIG_UNSUPPORTED',
    nativeSupportReason: reason,
    facts: {
      config: 'unsupported', nativeLoad: 'unsupported', connection: 'unknown',
      tools: 'unknown', authorization: 'unknown', ownership: 'unconfirmed',
    },
  } });
  assert.ok(html.includes(reason), 'the backend reason must be shown verbatim');
  assert.match(html, /MCP_NATIVE_CONFIG_UNSUPPORTED/);
  assert.doesNotMatch(html, /操作失败/);
  assert.equal(factValue(html, '配置'), '不支持');
  assert.equal(factValue(html, '原生加载'), '无法探测');
});
