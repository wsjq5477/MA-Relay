const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { McpConfig, nativeEntry } = require("../electron/mcp-config.cjs");
const { MachineHost } = require("../electron/machine-host.cjs");
const config = {
  command: "/runtime with spaces/node",
  args: ["/bridge/mcp-client.cjs", "/private/endpoint.json"],
  env: { ELECTRON_RUN_AS_NODE: "1" },
};
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ab-mcp-install-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
for (const adapter of ["claude", "codex", "opencode"])
  test(
    adapter +
      " native configuration preserves unrelated settings and refuses changed ownership",
    (t) => {
      const home = fixture(t),
        target = new McpConfig(adapter, home, {}),
        entry = nativeEntry(adapter, config);
      fs.mkdirSync(path.dirname(target.file), { recursive: true });
      const before =
        adapter === "codex"
          ? '# user comment\nmodel = "existing"\n[mcp_servers.other]\ncommand = "other"\n'
          : '// user comment\n{"model":"existing", "mcpServers":{"other":{"command":"other"}}, "mcp":{"servers":{"other":{"type":"local","command":["other"]}}}}\n';
      fs.writeFileSync(target.file, before);
      target.update(entry);
      assert.deepEqual(JSON.parse(JSON.stringify(target.inspect().entry)), entry);
      const installed = fs.readFileSync(target.file, "utf8");
      assert.match(installed, /user comment/);
      assert.match(installed, /existing/);
      assert.match(installed, /other/);
      target.update(entry, entry);
      assert.equal(fs.readFileSync(target.file, "utf8"), installed);
      const foreign =
        adapter === "opencode"
          ? { ...entry, command: ["foreign"] }
          : { ...entry, command: "foreign" };
      target.update(foreign, entry);
      assert.throws(() => target.update(undefined, entry), {
        code: "MCP_CONFIG_CONFLICT",
      });
      target.update(entry, foreign);
      target.update(undefined, entry);
      assert.equal(target.inspect().entry, undefined);
      if (adapter === "codex")
        assert.equal(fs.readFileSync(target.file, "utf8"), before);
    },
  );
test("invalid, dual OpenCode and symlink configurations remain untouched", (t) => {
  const home = fixture(t),
    target = new McpConfig("opencode", home, {});
  fs.mkdirSync(path.dirname(target.file), { recursive: true });
  fs.writeFileSync(target.file, "{invalid");
  assert.throws(() => target.update(nativeEntry("opencode", config)), {
    code: "MCP_CONFIG_INVALID",
  });
  assert.equal(fs.readFileSync(target.file, "utf8"), "{invalid");
  fs.writeFileSync(target.file, "{}");
  fs.writeFileSync(
    target.file.slice(0, -1),
    '{"mcp":{"servers":{"agentbridge":{"type":"local","command":["foreign"]}}}}',
  );
  assert.throws(() => target.inspect(), { code: "MCP_CONFIG_CONFLICT" });
  fs.rmSync(target.file.slice(0, -1));
  fs.rmSync(target.file);
  const linked = path.join(home, "linked.json");
  fs.writeFileSync(linked, "{}");
  fs.symlinkSync(linked, target.file);
  assert.throws(() => target.update(nativeEntry("opencode", config)), {
    code: "MCP_CONFIG_CONFLICT",
  });
  assert.equal(fs.readFileSync(linked, "utf8"), "{}");
});
test('OpenCode 1.x MCP install/export/remove uses its native layout and preserves unrelated JSONC', async t => {
  const directory=fixture(t),executable=path.join(directory,'opencode.cjs'),home=path.join(directory,'home');
  fs.writeFileSync(executable,"console.log('opencode 1.19.3');",{mode:0o700});
  const machine=new MachineHost({directory:path.join(directory,'bridge'),home,environment:{},
    candidates:{opencode:[executable],claude:[],codex:[],hermes:[],pi:[],dsh:[]},legacy:{close(){}},collaboration:async()=>({items:[]})});
  t.after(()=>machine.close());
  const target=new McpConfig('opencode',home,{},'v1');
  fs.mkdirSync(path.dirname(target.file),{recursive:true});fs.writeFileSync(target.file,'// keep comment\n{"model":"native/model","mcp":{"other":{"type":"local","command":["other"]}}}');
  const params={nodeId:'v1-node',adapter:'opencode'},result=await machine.call('mcp.install',params);
  assert.equal(result.installed,true);assert.equal(result.configuration.codemode,undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(result.files.opencode)).mcp.agentbridge,result.configuration);
  assert.deepEqual(target.inspect().entry,result.configuration);
  assert.match(fs.readFileSync(target.file,'utf8'),/keep comment/);
  assert.equal((await machine.call('mcp.status',params)).installed,true);
  assert.equal((await invoke({command:result.configuration.command[0],args:result.configuration.command.slice(1),env:result.configuration.environment})).result.items.length,0);
  await machine.call('mcp.remove',params);assert.equal(target.inspect().entry,undefined);
  assert.match(fs.readFileSync(target.file,'utf8'),/native\/model/);assert.match(fs.readFileSync(target.file,'utf8'),/other/);
});
test('OpenCode MCP rejects cross-generation entries instead of writing a duplicate',t=>{
  const home=fixture(t),target=new McpConfig('opencode',home,{},'v1');
  fs.mkdirSync(path.dirname(target.file),{recursive:true});
  const original='{"mcp":{"servers":{"agentbridge":{"command":["foreign"]}}}}';
  fs.writeFileSync(target.file,original);
  assert.throws(()=>target.update(nativeEntry('opencode',config,'v1')),{code:'MCP_CONFIG_CONFLICT'});
  assert.equal(fs.readFileSync(target.file,'utf8'),original);
});
test("Codex removal cannot erase extra settings inside managed markers", (t) => {
  const home = fixture(t),
    target = new McpConfig("codex", home, {}),
    entry = nativeEntry("codex", config);
  target.update(entry);
  const text = fs
    .readFileSync(target.file, "utf8")
    .replace("# END AgentBridge", "[other]\nvalue = 1\n# END AgentBridge");
  fs.writeFileSync(target.file, text);
  assert.throws(() => target.update(undefined, entry), {
    code: "MCP_CONFIG_CONFLICT",
  });
  assert.equal(fs.readFileSync(target.file, "utf8"), text);
});
function host(directory, calls) {
  return new MachineHost({
    directory: path.join(directory, "bridge"),
    home: path.join(directory, "home"),
    environment: {PATH:path.dirname(process.execPath)},
    observeOpenDesk:async()=>({state:'stopped'}),openDeskQuietMs:1,
    legacy: { close() {} },
    collaboration: async (scope, name, args) => {
      calls.push({ scope, name, args });
      return { items: [{ name: "allowed child" }] };
    },
  });
}
async function invoke(configuration) {
  const descriptor = JSON.parse(fs.readFileSync(configuration.args[1], "utf8"));
  const response = await fetch(descriptor.url, {
    method: "POST",
    headers: { authorization: "Bearer " + descriptor.token },
    body: JSON.stringify({
      name: "list_agents",
      args: { nodeId: "forged" },
      callId: "test",
    }),
  });
  return response.json();
}
test("persistent MCP exports authenticate, restore, revoke existing clients and rotate on reinstall", async (t) => {
  const directory = fixture(t),
    calls = [];
  let machine = host(directory, calls);
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "claude" };
  const installed = await machine.call("mcp.install", params);
  assert.equal(installed.installed, true);
  const json = JSON.parse(fs.readFileSync(installed.files.json));
  assert.deepEqual(json.mcpServers.agentbridge, installed.configuration);
  assert.equal(
    (await invoke(installed.configuration)).result.items[0].name,
    "allowed child",
  );
  assert.equal(calls[0].scope.nodeId, "leader");
  const secret = machine.broker.scopes[0].token;
  for (const file of Object.values(installed.files))
    assert(!fs.readFileSync(file, "utf8").includes(secret));
  machine.close();
  machine = host(directory, calls);
  await machine.mcpReady;
  assert.equal((await invoke(installed.configuration)).result.items.length, 1);
  await machine.call("mcp.remove", params);
  assert.equal(
    (await invoke(installed.configuration)).error.code,
    "MCP_REVOKED",
  );
  const next = await machine.call("mcp.install", params);
  assert.notEqual(next.connectionId, installed.connectionId);
  assert.equal(
    (await invoke(installed.configuration)).error.code,
    "MCP_REVOKED",
  );
  assert.equal((await invoke(next.configuration)).result.items.length, 1);
});
test("removal revokes authorization even when a user-edited native entry cannot be removed", async (t) => {
  const directory = fixture(t),
    machine = host(directory, []);
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "claude" };
  const installed = await machine.call("mcp.install", params),
    target = machine.mcp.config("claude");
  target.update(
    { ...installed.configuration, command: "foreign" },
    installed.configuration,
  );
  // Cleanup failure no longer hides the successful revocation: the caller gets
  // both facts in one status instead of a bare error.
  const removed = await machine.call("mcp.remove", params);
  assert.equal(removed.enabled, false);
  assert.equal(removed.installed, false);
  assert.equal(removed.conflict, true);
  assert.equal(removed.state, "revoked_config_pending");
  assert.equal(removed.facts.authorization, "revoked");
  assert.equal(removed.facts.config, "conflict");
  assert.ok(removed.cleanupError.code);
  assert.equal(
    (await invoke(installed.configuration)).error.code,
    "MCP_REVOKED",
  );
  assert.equal(target.inspect().entry.command, "foreign");
});

test("export does not install into native settings and serialized install/remove cannot restore revoked access", async (t) => {
  const directory = fixture(t),
    machine = host(directory, []);
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "codex" };
  const exported = await machine.call("mcp.export", params);
  assert.equal(exported.installed, false);
  assert.equal(exported.state, "exported");
  assert.equal(fs.existsSync(exported.configPath), false);
  const refreshed = await machine.call("mcp.status", params);
  assert.deepEqual(refreshed.files, exported.files);
  await Promise.all([
    machine.call("mcp.install", params),
    machine.call("mcp.remove", params),
  ]);
  assert.equal((await machine.call("mcp.status", params)).enabled, false);
  const descriptorConfig = JSON.parse(fs.readFileSync(exported.files.json))
    .mcpServers.agentbridge;
  assert.equal((await invoke(descriptorConfig)).error.code, "MCP_REVOKED");
  // OpenDesk CLI still has no native manager: export prepares a standard
  // fragment, install refuses and says why instead of guessing a file.
  const cliExport = await machine.call("mcp.export", { nodeId: "unsupported", adapter: "opendesk" });
  assert.equal(cliExport.exported, true);
  assert.equal(cliExport.nativeSupport, false);
  assert.equal(cliExport.facts.config, "unsupported");
  await assert.rejects(
    machine.call("mcp.install", { nodeId: "unsupported", adapter: "opendesk" }),
    { code: "MCP_NATIVE_CONFIG_UNSUPPORTED" },
  );
});

test("a failed endpoint restore cannot prevent removing and revoking a persisted connection", async (t) => {
  const directory = fixture(t),
    params = { nodeId: "leader", adapter: "claude" };
  let machine = host(directory, []);
  const installed = await machine.call("mcp.install", params);
  machine.close();
  const { McpIntegration } = require("../electron/mcp-integration.cjs"),
    configure = McpIntegration.prototype.configure;
  try {
    McpIntegration.prototype.configure = async () => {
      throw Object.assign(Error("controlled restore failure"), {
        code: "EACCES",
      });
    };
    machine = host(directory, []);
  } finally {
    McpIntegration.prototype.configure = configure;
  }
  t.after(() => machine.close());
  await assert.rejects(machine.mcpReady, { code: "EACCES" });
  const removed = await machine.call("mcp.remove", params);
  assert.equal(removed.enabled, false);
  assert.equal(removed.installed, false);
  assert.throws(
    () =>
      machine.mcp.authorize({
        nodeId: "leader",
        externalConnectionId: installed.connectionId,
      }),
    { code: "MCP_REVOKED" },
  );
});

test('Codex configuration with many valid comments round-trips while malformed text remains untouched',t=>{
 const home=fixture(t),target=new McpConfig('codex',home,{}),entry=nativeEntry('codex',config);
 fs.mkdirSync(path.dirname(target.file),{recursive:true});
 const before='# existing user comment\n'.repeat(20000)+'existing = true\n';fs.writeFileSync(target.file,before);
 assert.equal(target.inspect().entry,undefined);target.update(entry);assert.deepEqual(JSON.parse(JSON.stringify(target.inspect().entry)),entry);
 target.update(undefined,entry);assert.equal(fs.readFileSync(target.file,'utf8'),before);
 const invalid='[mcp_servers.agentbridge\ncommand = "bad"\n';fs.writeFileSync(target.file,invalid);
 assert.throws(()=>target.update(entry),{code:'MCP_CONFIG_INVALID'});assert.equal(fs.readFileSync(target.file,'utf8'),invalid);
});

// ---------------------------------------------------------------- I08-MCP02
// Bidirectional configuration, native facts and explicit revocation.
const YAML = require("yaml");
function probeHost(directory, calls = [], candidates = {}, environment = {}) {
  return new MachineHost({
    directory: path.join(directory, "bridge"),
    home: path.join(directory, "home"),
    environment:{PATH:process.env.PATH,...environment},
    observeOpenDesk:async()=>({state:'stopped'}),openDeskQuietMs:1,
    candidates,
    legacy: { close() {} },
    collaboration: async (scope, name, args) => {
      calls.push({ scope, name, args });
      return { items: [{ name: "allowed child" }] };
    },
  });
}
test('OpenDesk native default headers keep registered ownership across restart, reinstall and removal', async t => {
  const directory = fixture(t);
  let machine = probeHost(directory);
  t.after(() => machine.close());
  const params = {nodeId: 'desktop', adapter: 'opendesk-desktop'};
  const installed = await machine.call('mcp.install', params);
  const row = machine.mcp.rows.find(item => item.nodeId === params.nodeId);
  row.probe = {at: new Date().toISOString(), binding: machine.mcp.probeBinding(params, row), connection: 'connected', tools: 'available', nativeLoad: 'loaded'};
  machine.mcp.save();
  const data = JSON.parse(fs.readFileSync(installed.configPath, 'utf8'));
  data.theme = 'keep';
  data.applications.mcpmgr.servers.push({id: 'other', command: 'keep'});
  data.applications.mcpmgr.servers[0].headers = {};
  const nativeBytes = JSON.stringify(data);
  fs.writeFileSync(installed.configPath, nativeBytes);
  const status = await machine.call('mcp.status', params);
  assert.equal(status.installed, true);
  assert.equal(status.conflict, false);
  assert.equal(status.facts.ownership, 'bridge');
  assert.equal(status.facts.connection, 'unknown');
  assert.equal(status.facts.tools, 'unknown');
  assert.equal(status.evidence.observation.reason, 'configuration_changed');
  machine.close();
  machine = probeHost(directory);
  await machine.mcpReady;
  assert.equal((await machine.call('mcp.status', params)).installed, true);
  const reinstalled = await machine.call('mcp.install', params);
  assert.equal(reinstalled.connectionId, installed.connectionId);
  assert.equal(fs.readFileSync(installed.configPath, 'utf8'), nativeBytes);
  // Also accept old persisted registrations that already contain the default
  // when the native editor subsequently omits it.
  machine.mcp.rows[0].configuration.headers = {};
  machine.mcp.save();
  delete data.applications.mcpmgr.servers[0].headers;
  fs.writeFileSync(installed.configPath, JSON.stringify(data));
  assert.equal((await machine.call('mcp.status', params)).installed, true);
  await machine.call('mcp.revoke', params);
  assert.equal((await machine.call('mcp.status', params)).facts.ownership, 'bridge');
  const removed = await machine.call('mcp.remove', params);
  assert.equal(removed.facts.config, 'absent');
  assert.equal(removed.facts.authorization, 'revoked');
  const after = JSON.parse(fs.readFileSync(installed.configPath, 'utf8'));
  assert.equal(after.theme, 'keep');
  assert.deepEqual(after.applications.mcpmgr.servers, [{id: 'other', command: 'keep'}]);
});
test('OpenDesk default headers never adopt an unregistered entry or hide other changes', async t => {
  const directory = fixture(t), machine = probeHost(directory);
  t.after(() => machine.close());
  const params = {nodeId: 'desktop', adapter: 'opendesk-desktop'};
  const installed = await machine.call('mcp.install', params);
  const original = JSON.parse(fs.readFileSync(installed.configPath, 'utf8'));
  const changes = [
    {headers: {custom: 'changed'}}, {headers: null}, {headers: []}, {headers: ''},
    {headers: {}, command: 'foreign'}, {headers: {}, args: ['foreign']},
    {headers: {}, env: {CUSTOM: 'changed'}}, {headers: {}, enabled: false},
    {headers: {}, transport: 'streamableHttp'}, {headers: {}, cwd: '/foreign'},
    {headers: {}, name: 'changed'}, {headers: {}, unknownField: true},
  ];
  for (const change of changes) {
    const data = structuredClone(original);
    Object.assign(data.applications.mcpmgr.servers[0], change);
    const before = JSON.stringify(data);
    fs.writeFileSync(installed.configPath, before);
    assert.equal((await machine.call('mcp.status', params)).conflict, true);
    await assert.rejects(machine.call('mcp.install', params), {code: 'MCP_CONFIG_CONFLICT'});
    const removed = await machine.call('mcp.remove', params);
    assert.equal(removed.cleanupError.code, 'MCP_CONFIG_CONFLICT');
    assert.equal(removed.facts.authorization, 'revoked');
    assert.equal(fs.readFileSync(installed.configPath, 'utf8'), before);
  }
  const target = new McpConfig('opendesk-desktop', path.join(directory, 'home'), {});
  original.applications.mcpmgr.servers[0].headers = {};
  const foreignBytes = JSON.stringify(original);
  fs.writeFileSync(target.file, foreignBytes);
  assert.throws(() => target.update(nativeEntry('opendesk-desktop', config)), {code: 'MCP_CONFIG_CONFLICT'});
  const withoutDefault = {...original.applications.mcpmgr.servers[0]};
  delete withoutDefault.headers;
  assert.throws(() => target.update(withoutDefault), {code: 'MCP_CONFIG_CONFLICT'});
  assert.throws(() => target.update(undefined), {code: 'MCP_CONFIG_CONFLICT'});
  assert.equal(fs.readFileSync(target.file, 'utf8'), foreignBytes);
  const claude = new McpConfig('claude', path.join(directory, 'home'), {});
  const entry = nativeEntry('claude', config);
  claude.update({...entry, headers: {}});
  assert.throws(() => claude.update(undefined, entry), {code: 'MCP_CONFIG_CONFLICT'});
});
test("external deletion is never rewritten by restart, reinstall rotates identity", async (t) => {
  const directory = fixture(t);
  let machine = probeHost(directory);
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "claude" };
  const installed = await machine.call("mcp.install", params);
  assert.equal(installed.state, "installed");
  assert.equal(installed.facts.config, "present");
  assert.equal(installed.facts.ownership, "bridge");
  // The user deletes the entry in the native product's own configuration.
  const target = machine.mcp.config("claude");
  const edited = JSON.parse(fs.readFileSync(target.file, "utf8"));
  delete edited.mcpServers.agentbridge;
  fs.writeFileSync(target.file, JSON.stringify(edited, null, 2) + "\n");
  const afterDelete = await machine.call("mcp.status", params);
  assert.equal(afterDelete.installed, false);
  assert.equal(afterDelete.enabled, true);
  assert.equal(afterDelete.state, "exported");
  // Configuration absence and authorization are separate facts.
  assert.equal(afterDelete.facts.config, "absent");
  assert.equal(afterDelete.facts.authorization, "valid");
  machine.close();
  machine = probeHost(directory);
  t.after(() => machine.close());
  await machine.mcpReady;
  assert.equal(JSON.parse(fs.readFileSync(target.file, "utf8")).mcpServers.agentbridge, undefined);
  assert.equal((await machine.call("mcp.status", params)).state, "exported");
  // The untouched private endpoint still serves the originally installed entry.
  assert.equal((await invoke(installed.configuration)).result.items.length, 1);
  // Re-adding after an external deletion reuses the existing registration: the
  // user removed a configuration, not the authorization, and one node keeps one
  // identity. Only an explicit revoke/remove rotates the credential.
  const reinstalled = await machine.call("mcp.install", params);
  assert.equal(reinstalled.connectionId, installed.connectionId);
  assert.equal(reinstalled.state, "installed");
  assert.equal((await invoke(installed.configuration)).result.items.length, 1);
  await machine.call("mcp.remove", params);
  const rotated = await machine.call("mcp.install", params);
  assert.notEqual(rotated.connectionId, installed.connectionId);
  assert.equal((await invoke(installed.configuration)).error.code, "MCP_REVOKED");
});
test("explicit revoke keeps the native entry, blocks the old credential and reinstall rotates", async (t) => {
  const directory = fixture(t),
    machine = probeHost(directory);
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "codex" };
  const installed = await machine.call("mcp.install", params);
  const revoked = await machine.call("mcp.revoke", params);
  assert.equal(revoked.enabled, false);
  assert.equal(revoked.state, "revoked_config_pending");
  assert.equal(revoked.facts.authorization, "revoked");
  assert.equal(revoked.facts.config, "present");
  // Revocation is not presented as a global config removal.
  assert.equal(revoked.facts.ownership, "bridge");
  const target = machine.mcp.config("codex");
  assert.deepEqual(JSON.parse(JSON.stringify(target.inspect().entry)), installed.configuration);
  assert.equal((await invoke(installed.configuration)).error.code, "MCP_REVOKED");
  const probed = await machine.call("mcp.probe", params);
  assert.equal(probed.facts.tools, "unauthorized");
  const next = await machine.call("mcp.install", params);
  assert.notEqual(next.connectionId, installed.connectionId);
  assert.equal((await invoke(next.configuration)).result.items.length, 1);
  await assert.rejects(machine.call("mcp.revoke", { nodeId: "never-registered", adapter: "codex" }), { code: "MCP_NOT_CONFIGURED" });
});
test("DSH Web manages one insert row, preserves user comments and never reinstalls after external deletion", async (t) => {
  const directory = fixture(t),
    machine = probeHost(directory);
  t.after(() => machine.close());
  const params = { nodeId: "dsh", adapter: "dsh-web" };
  const target = machine.mcp.config("dsh-web");
  fs.mkdirSync(path.dirname(target.file), { recursive: true });
  const userLayer = "# user layer: keep this comment\n- id: my-plugin\n  name: \"@deepseek-ai/dsh-tool-web\"\n  config:\n    keep: true\n";
  fs.writeFileSync(target.file, userLayer);
  const installed = await machine.call("mcp.install", params);
  assert.equal(installed.state, "installed");
  assert.equal(installed.nativeSupport, true);
  // DSH applies the patch layer itself; Bridge reports the requirement, not a load.
  assert.equal(installed.facts.nativeLoad, "reload_required");
  const text = fs.readFileSync(target.file, "utf8");
  assert.match(text, /keep this comment/);
  assert.match(text, /my-plugin/);
  const parsed = YAML.parse(text);
  const row = parsed.flatMap(item => item.insert || []).find(item => item.id === "agentbridge-mcp");
  assert.deepEqual(row, installed.configuration);
  assert.equal(row.config.serverName, "agentbridge");
  assert.equal(row.name, "@deepseek-ai/dsh-mcp-client");
  // The user deletes the Bridge row in the native file.
  fs.writeFileSync(target.file, userLayer);
  const afterDelete = await machine.call("mcp.status", params);
  assert.equal(afterDelete.state, "exported");
  assert.equal(afterDelete.facts.config, "absent");
  assert.equal(afterDelete.facts.authorization, "valid");
  machine.close();
  const restarted = probeHost(directory);
  t.after(() => restarted.close());
  await restarted.mcpReady;
  assert.equal(fs.readFileSync(target.file, "utf8"), userLayer);
  assert.equal((await restarted.call("mcp.status", params)).state, "exported");
});
test("native list probe and bridge tool catalogue are reported as separate evidence", async (t) => {
  const directory = fixture(t), home = path.join(directory, "home"), executable = path.join(directory, "claude");
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(executable, "#!/bin/sh\necho 'agentbridge: /usr/bin/node /x/mcp-client.cjs /y/endpoint.json - ✓ Connected'\n", { mode: 0o700 });
  const machine = probeHost(directory, [], { claude: [executable] });
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "claude" };
  const installed = await machine.call("mcp.install", params);
  const before = fs.readFileSync(machine.mcp.config("claude").file, "utf8");
  const probed = await machine.call("mcp.probe", params);
  assert.equal(probed.facts.nativeLoad, "loaded");
  assert.equal(probed.facts.connection, "connected");
  assert.equal(probed.evidence.nativeProbe.kind, "native-list");
  assert.equal(probed.evidence.nativeProbe.outcome, "connected");
  assert.equal(probed.evidence.toolsProbe.kind, "bridge-stdio");
  assert.equal(probed.evidence.toolsProbe.outcome, "available");
  assert.ok(probed.evidence.toolsProbe.toolCount >= 1);
  // A read-only probe never rewrites the native configuration.
  fs.writeFileSync(executable, "#!/bin/sh\necho 'agentbridge: /usr/bin/node /x/mcp-client.cjs - ✘ Failed to connect'\n", { mode: 0o700 });
  const failed = await machine.call("mcp.probe", params);
  assert.equal(failed.facts.nativeLoad, "loaded");
  assert.equal(failed.facts.connection, "disconnected");
  assert.equal(fs.readFileSync(machine.mcp.config("claude").file, "utf8"), before);
  assert.equal(failed.state, "installed");
});
test("unnamed DSH CLI profiles stay export-only; the native entry is never written", async (t) => {
  const directory = fixture(t), machine = probeHost(directory);
  t.after(() => machine.close());
  for (const adapter of ["dsh"]) {
    const status = await machine.call("mcp.status", { nodeId: adapter, adapter });
    assert.equal(status.nativeSupport, false);
    assert.equal(status.nativeSupportReason.includes("DSH"), true);
    const expected = adapter === "dsh" ? "MCP_DSH_PROFILE_REQUIRED" : "MCP_NATIVE_CONFIG_UNSUPPORTED";
    assert.equal(status.nativeSupportCode, expected);
    const exported = await machine.call("mcp.export", { nodeId: adapter, adapter });
    assert.equal(exported.exported, true);
    assert.equal(fs.existsSync(exported.files.dsh), true);
    assert.equal(fs.readFileSync(exported.files.dsh, "utf8").includes("dsh-mcp-client"), true);
    await assert.rejects(machine.call("mcp.install", { nodeId: adapter, adapter }), { code: expected });
    if (adapter === "dsh") {
      // Explicit profile turns the same node into a manageable native entry.
      const profiles = path.join(directory, "home", ".dsh", "profiles", "headless");
      fs.mkdirSync(profiles, { recursive: true });
      fs.writeFileSync(path.join(profiles, "cordis.patch.yml"), "[]\n");
      const installed = await machine.call("mcp.install", { nodeId: adapter, adapter, profile: "headless" });
      assert.equal(installed.state, "installed");
    }
  }
});

test("native list probe resolves the product executable without a caller-supplied candidate list", async (t) => {
  const directory = fixture(t), home = path.join(directory, "home"), config = path.join(directory, "claude");
  const shim = path.join(directory, "bin", "claude");
  fs.mkdirSync(path.dirname(shim), { recursive: true });
  fs.writeFileSync(shim, "#!/bin/sh\necho 'agentbridge: node /x/mcp-client.cjs /y/endpoint.json - \u2714 Connected'\n", { mode: 0o700 });
  const previous = process.env.PATH;
  process.env.PATH = path.dirname(shim) + path.delimiter + (previous || "");
  t.after(() => { process.env.PATH = previous; });
  fs.mkdirSync(home, { recursive: true });
  // Production MachineHost shape: no `candidates`, environment from the backend.
  const machine = probeHost(directory, [], undefined, { CLAUDE_CONFIG_DIR: config });
  t.after(() => machine.close());
  const params = { nodeId: "leader", adapter: "claude" };
  await machine.call("mcp.export", params);
  const probed = await machine.call("mcp.probe", params);
  assert.equal(probed.evidence.nativeProbe.kind, "native-list");
  assert.equal(probed.evidence.nativeProbe.outcome, "connected");
  assert.equal(probed.facts.nativeLoad, "loaded");
  assert.equal(probed.facts.connection, "connected");
});
test("DSH Web install refuses to invent a missing native profile instead of creating one", async (t) => {
  const directory = fixture(t), machine = probeHost(directory);
  t.after(() => machine.close());
  // No $DSH_HOME/profiles/web: the native product was never started here.
  await assert.rejects(machine.call("mcp.install", { nodeId: "dsh", adapter: "dsh-web" }), { code: "MCP_PROFILE_MISSING" });
  assert.equal(fs.existsSync(path.join(directory, "home", ".dsh", "profiles", "web")), false);
  // An existing but empty/comments-only native layer is reported, never replaced.
  const target = machine.mcp.config("dsh-web");
  fs.mkdirSync(path.dirname(target.file), { recursive: true });
  fs.writeFileSync(target.file, "# only a comment\n");
  await assert.rejects(machine.call("mcp.install", { nodeId: "dsh", adapter: "dsh-web" }), { code: "MCP_CONFIG_INVALID" });
  assert.equal(fs.readFileSync(target.file, "utf8"), "# only a comment\n");
});
test("DSH CLI manages exactly the named native profile and never guesses one", async (t) => {
  const directory = fixture(t), machine = probeHost(directory);
  t.after(() => machine.close());
  const profiles = path.join(directory, "home", ".dsh", "profiles");
  for (const name of ["web", "tui"]) {
    fs.mkdirSync(path.join(profiles, name), { recursive: true });
    fs.writeFileSync(path.join(profiles, name, "cordis.patch.yml"), "[]\n");
  }
  // No profile named: the status says what is missing and writes nothing.
  const unknown = await machine.call("mcp.status", { nodeId: "dsh-cli", adapter: "dsh" });
  assert.equal(unknown.nativeSupport, false);
  assert.equal(unknown.nativeSupportCode, "MCP_DSH_PROFILE_REQUIRED");
  assert.equal(unknown.profile, null);
  await assert.rejects(machine.call("mcp.install", { nodeId: "dsh-cli", adapter: "dsh" }), { code: "MCP_DSH_PROFILE_REQUIRED" });
  // Explicit profile: only that profile's patch layer changes.
  const params = { nodeId: "dsh-cli", adapter: "dsh", profile: "tui" };
  const installed = await machine.call("mcp.install", params);
  assert.equal(installed.state, "installed");
  assert.equal(installed.profile, "tui");
  assert.equal(installed.facts.config, "present");
  assert.equal(installed.facts.nativeLoad, "reload_required");
  const tuiFile = path.join(profiles, "tui", "cordis.patch.yml");
  const webFile = path.join(profiles, "web", "cordis.patch.yml");
  assert.match(fs.readFileSync(tuiFile, "utf8"), /agentbridge-mcp/);
  assert.equal(fs.readFileSync(webFile, "utf8"), "[]\n");
  assert.equal(installed.configPath, tuiFile);
  // Status without a param uses the registered profile.
  assert.equal((await machine.call("mcp.status", { nodeId: "dsh-cli", adapter: "dsh" })).profile, "tui");
  // The recorded profile is what remove cleans; the other profile stays intact.
  const removed = await machine.call("mcp.remove", params);
  assert.equal(removed.state, "absent");
  assert.doesNotMatch(fs.readFileSync(tuiFile, "utf8"), /agentbridge-mcp/);
  assert.equal(fs.readFileSync(webFile, "utf8"), "[]\n");
  // A path-like profile is refused instead of escaping the profiles directory.
  for (const bad of ["../escape", "a/b", "", "Web", "-x"]) {
    await assert.rejects(machine.call("mcp.install", { nodeId: "dsh-cli", adapter: "dsh", profile: bad }), { code: "MCP_DSH_PROFILE_REQUIRED" });
  }
  assert.equal(fs.existsSync(path.join(directory, "home", ".dsh", "escape")), false);
});
test("OpenDesk CLI has no native MCP read surface while Desktop keeps a candidate write", async (t) => {
  const directory = fixture(t), machine = probeHost(directory);
  t.after(() => machine.close());
  const params = { nodeId: "od", adapter: "opendesk" };
  const status = await machine.call("mcp.status", params);
  assert.equal(status.nativeSupport, false);
  assert.equal(status.nativeSupportCode, "MCP_NATIVE_CONFIG_UNSUPPORTED");
  assert.match(status.nativeSupportReason, /0\.3\.8|插件清单/);
  await assert.rejects(machine.call("mcp.install", params), { code: "MCP_NATIVE_CONFIG_UNSUPPORTED" });
  // A standard fragment is still prepared for manual use in the native product.
  const exported = await machine.call("mcp.export", params);
  assert.equal(exported.exported, true);
  assert.equal(fs.existsSync(exported.files.opendesk), true);
  assert.equal(fs.readFileSync(exported.files.opendesk, "utf8").includes("mcpmgr"), true);
  // The Desktop surface still writes its candidate native entry.
  const desktop = { nodeId: "odd", adapter: "opendesk-desktop" };
  const installed = await machine.call("mcp.install", desktop);
  assert.equal(installed.state, "installed");
  const native = JSON.parse(fs.readFileSync(installed.configPath, "utf8"));
  assert.equal(native.applications.mcpmgr.servers[0].id, "agentbridge");
});
test("OpenDesk native entries prefer a real Node launcher over the Electron runtime", async (t) => {
  const directory = fixture(t), bin = path.join(directory, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const node = path.join(bin, process.platform === "win32" ? "node.exe" : "node");
  fs.writeFileSync(node, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  const machine = new MachineHost({
    directory: path.join(directory, "bridge"), home: path.join(directory, "home"),
    environment: { PATH: bin }, observeOpenDesk:async()=>({state:'stopped'}),openDeskQuietMs:1, legacy: { close() {} },
    collaboration: async () => ({ items: [] }),
  });
  t.after(() => machine.close());
  const desktop = { nodeId: "odd", adapter: "opendesk-desktop" };
  const installed = await machine.call("mcp.install", desktop);
  assert.equal(installed.launcher, "node");
  const native = JSON.parse(fs.readFileSync(installed.configPath, "utf8"));
  assert.equal(native.applications.mcpmgr.servers[0].command, node);
  // Native installation requires real Node; a manual export keeps its explicit fallback.
  const fallback = new MachineHost({
    directory: path.join(directory, "bridge2"), home: path.join(directory, "home2"),
    environment: { PATH: path.join(directory, "empty") }, observeOpenDesk:async()=>({state:'stopped'}),openDeskQuietMs:1, legacy: { close() {} },
    collaboration: async () => ({ items: [] }),
  });
  t.after(() => fallback.close());
  await assert.rejects(fallback.call("mcp.install", desktop), {code:"MCP_OPENDESK_NODE_REQUIRED"});
  const electronEntry = await fallback.call("mcp.export", desktop);
  assert.equal(electronEntry.launcher, "electron");
});

test('OpenDesk manual exports use the same Node launcher as the native entry and survive restore', async t => {
  const directory=fixture(t),bin=path.join(directory,'node-bin');fs.mkdirSync(bin);
  const node=path.join(bin,process.platform==='win32'?'node.exe':'node');fs.writeFileSync(node,'not executed');
  let machine=probeHost(directory,[],{}, {PATH:bin});t.after(()=>machine.close());
  const params={nodeId:'od-export',adapter:'opendesk-desktop'};
  const result=await machine.call('mcp.export',params);
  assert.equal(result.configuration.command,node);
  const entry=()=>JSON.parse(fs.readFileSync(result.files.opendesk)).applications.mcpmgr.servers[0];
  assert.equal(entry().command,node);assert.equal(JSON.parse(fs.readFileSync(result.files.json)).mcpServers.agentbridge.command,node);
  const bytes=fs.readFileSync(result.files.opendesk,'utf8');machine.close();
  machine=probeHost(directory,[],{}, {PATH:path.join(directory,'missing')});await machine.mcpReady;
  assert.equal(entry().command,node);assert.equal(fs.readFileSync(result.files.opendesk,'utf8'),bytes);
});

test('an exported OpenDesk stdio entry calls the scoped broker and loses access after revoke', async t => {
  const directory=fixture(t),calls=[];
  const machine=new MachineHost({directory:path.join(directory,'bridge'),home:path.join(directory,'home'),
    environment:{PATH:path.dirname(process.execPath)},legacy:{close(){}},
    collaboration:async(scope,name,args)=>{calls.push({scope,name,args});return {items:[]};}});
  t.after(()=>machine.close());
  const params={nodeId:'native-external',adapter:'opendesk-desktop'};
  const exported=await machine.call('mcp.export',params);
  const entry=JSON.parse(fs.readFileSync(exported.files.opendesk)).applications.mcpmgr.servers[0];
  const child=require('node:child_process').spawn(entry.command,entry.args,{env:{...process.env,...entry.env},stdio:['pipe','pipe','pipe']});
  t.after(()=>child.kill());
  const pending=new Map();let output='',sequence=0;
  child.stdout.on('data',chunk=>{output+=chunk;let i;while((i=output.indexOf('\n'))>=0){const row=JSON.parse(output.slice(0,i));output=output.slice(i+1);pending.get(row.id)?.(row);pending.delete(row.id);}});
  const request=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('stdio response timeout'));},8000);
    pending.set(id,row=>{clearTimeout(timer);resolve(row);});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });
  assert.equal((await request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'isolated-native',version:'1'}})).result.serverInfo.name,'agentbridge');
  assert.equal((await request('tools/list')).result.tools.length,10);
  const first=await request('tools/call',{name:'list_agents',arguments:{}});
  assert.deepEqual(JSON.parse(first.result.content[0].text),{items:[]});
  assert.equal(calls[0].scope.nodeId,params.nodeId);assert.equal(calls[0].scope.externalConnectionId,exported.connectionId);
  await machine.call('mcp.revoke',params);
  const revoked=await request('tools/call',{name:'list_agents',arguments:{}});
  assert.equal(revoked.result.isError,true);assert.equal(JSON.parse(revoked.result.content[0].text).error.code,'MCP_REVOKED');
  assert.equal(calls.length,1);
});

test('OpenCode array command reaches the actual stdio tools probe', async t => {
  const directory=fixture(t),file=path.join(directory,'stdio.cjs');
  fs.writeFileSync(file,`let b='';process.stdin.on('data',c=>{b+=c;let i;while((i=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,i));b=b.slice(i+1);if(m.id)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:m.method==='tools/list'?{tools:[{name:'read_only'}]}:{protocolVersion:'2025-06-18',capabilities:{}}})+'\\n');}});`);
  const {McpIntegration}=require('../electron/mcp-integration.cjs');
  const result=await McpIntegration.prototype.toolsProbe.call({}, {configuration:{command:[process.execPath,file],environment:{}}});
  assert.deepEqual(result,{outcome:'available',toolCount:1});
});

test('probe observations expire and are invalidated by native deletion or profile changes', async t => {
  const directory=fixture(t),exe=path.join(directory,'claude');
  fs.writeFileSync(exe,"#!/bin/sh\necho 'agentbridge: Connected'\n",{mode:0o700});
  const machine=probeHost(directory,[],{claude:[exe]});t.after(()=>machine.close());
  const params={nodeId:'stale-probe',adapter:'claude'};const installed=await machine.call('mcp.install',params);
  const probed=await machine.call('mcp.probe',params);assert.equal(probed.facts.connection,'connected');
  assert.equal(probed.evidence.observation.freshness,'current');assert(probed.evidence.observation.observedAt);
  machine.mcp.rows[0].probe.at=new Date(Date.now()-120000).toISOString();
  const expired=await machine.call('mcp.status',params);assert.equal(expired.facts.connection,'unknown');assert.equal(expired.evidence.observation.reason,'expired');
  await machine.call('mcp.probe',params);
  machine.mcp.config('claude').update(undefined,machine.mcp.rows[0].configuration);
  const removed=await machine.call('mcp.status',params);
  assert.equal(removed.facts.config,'absent');assert.equal(removed.facts.nativeLoad,'unknown');assert.equal(removed.facts.connection,'unknown');assert.equal(removed.facts.tools,'unknown');
  assert.equal(removed.evidence.observation.freshness,'stale');assert.equal(removed.evidence.observation.reason,'configuration_changed');
  assert.equal(removed.facts.authorization,'valid');assert.equal(fs.existsSync(installed.files.json),true);
  for(const profile of ['alpha','beta']){
    const location=path.join(directory,'home','.dsh','profiles',profile);fs.mkdirSync(location,{recursive:true});fs.writeFileSync(path.join(location,'cordis.patch.yml'),'[]\n');
  }
  const dsh={nodeId:'profile-probe',adapter:'dsh',profile:'alpha'};
  await machine.call('mcp.install',dsh);assert.equal((await machine.call('mcp.probe',dsh)).facts.tools,'available');
  const other=await machine.call('mcp.status',{...dsh,profile:'beta'});
  assert.equal(other.facts.tools,'unknown');assert.equal(other.evidence.observation.reason,'configuration_changed');
});
