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
    environment: {},
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
  await assert.rejects(machine.call("mcp.remove", params), {
    code: "MCP_CONFIG_CONFLICT",
  });
  const status = await machine.call("mcp.status", params);
  assert.equal(status.enabled, false);
  assert.equal(status.conflict, true);
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
  await assert.rejects(
    machine.call("mcp.install", { nodeId: "unsupported", adapter: "hermes" }),
    { code: "MCP_UNSUPPORTED" },
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
