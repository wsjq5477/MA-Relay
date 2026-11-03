const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, "../tsconfig.json");
const { require: requireTsx } = require("tsx/cjs/api");
const {
  mcpConnectionView: view,
  mcpConnectionActions: actions,
  mcpDisplayMessage,
} = requireTsx("../src/mcp-connection-view.ts", __filename);
const now = Date.parse("2026-11-03T08:00:00Z");
const facts = {
  config: "present",
  authorization: "valid",
  nativeLoad: "loaded",
  connection: "connected",
  tools: "available",
  ownership: "bridge",
};
const status = (extra = {}) => ({
  nodeId: "fixture",
  adapter: "claude",
  installed: true,
  enabled: true,
  conflict: false,
  state: "installed",
  configPath: "/fixture/.claude.json",
  facts: { ...facts },
  evidence: {
    configPath: "/fixture/.claude.json",
    nativeProbe: { kind: "native-list", outcome: "connected" },
    observation: {
      freshness: "current",
      observedAt: new Date(now - 1000).toISOString(),
    },
  },
  ...extra,
});
const node = {
  nodeId: "fixture",
  adapter: "claude",
  connected: true,
  online: true,
  executionSupported: true,
  connectionCapabilities: { nativeMcpConfig: true, mcpClient: true },
  capabilitySource: { kind: "static-adapter", adapterId: "claude" },
};

test("all four summaries follow independent config, authorization and current native evidence", () => {
  assert.equal(
    view(
      status({
        installed: false,
        state: "absent",
        facts: { ...facts, config: "absent", authorization: "revoked" },
      }),
      now,
    ).summary,
    "unconfigured",
  );
  assert.equal(
    view(
      status({
        facts: {
          ...facts,
          nativeLoad: "unknown",
          connection: "unknown",
          tools: "unknown",
        },
      }),
      now,
    ).summary,
    "configured",
  );
  assert.equal(view(status(), now).summary, "ready");
  assert.equal(
    view(status({ facts: { ...facts, connection: "disconnected" } }), now)
      .summary,
    "failed",
  );
});
test("Bridge-side stdio tools never stand in for tools visible to the native Agent", () => {
  const original = status();
  original.evidence.toolsProbe = {
    kind: "bridge-stdio",
    outcome: "available",
    toolCount: 7,
  };
  const result = view(original, now);
  assert.equal(result.summary, "configured");
  assert.equal(result.facts.tools, "unknown");
  assert.equal(original.facts.tools, "available");
});
test("TTL, stale/unknown bindings, missing dates and future clocks cannot keep native success", () => {
  for (const observation of [
    undefined,
    { freshness: "stale", observedAt: new Date(now - 1).toISOString() },
    { freshness: "unknown", observedAt: new Date(now - 1).toISOString() },
    { freshness: "current" },
    { freshness: "current", observedAt: "bad-date" },
    { freshness: "current", observedAt: new Date(now - 60001).toISOString() },
    { freshness: "current", observedAt: new Date(now + 1).toISOString() },
  ]) {
    const result = view(status({ evidence: { observation } }), now);
    assert.equal(result.summary, "configured");
    assert.equal(result.facts.nativeLoad, "unknown");
    assert.equal(result.facts.connection, "unknown");
    assert.equal(result.facts.tools, "unknown");
  }
  assert.equal(view(status(), now + 60000).summary, "configured");
});
test("unknown/unavailable automatic probes are unverified, not falsely failed or ready", () => {
  for (const extra of [
    { nativeProbeSupported: false },
    { nativeSupport: false },
  ]) {
    const result = view(status(extra), now);
    assert.equal(result.summary, "configured");
    assert.equal(result.checks[2].value, "未验证");
    assert.equal(result.facts.tools, "unknown");
  }
  const legacy = view(status({ facts: undefined, evidence: undefined }), now);
  assert.equal(legacy.summary, "configured");
  assert(legacy.checks.every((x) => x.tone === "unknown"));
});
test("config changes and explicit revocation override formerly good native observations", () => {
  assert.equal(
    view(status({ nativeTargetChanged: true }), now).summary,
    "failed",
  );
  for (const config of ["conflict", "disabled"])
    assert.equal(
      view(status({ facts: { ...facts, config } }), now).summary,
      "failed",
    );
  assert.equal(
    view(
      status({ enabled: false, facts: { ...facts, authorization: "revoked" } }),
      now,
    ).summary,
    "failed",
  );
});
test("each remaining native failure requires current evidence, and input is never mutated", () => {
  for (const dimension of [
    { nativeLoad: "not_loaded" },
    { connection: "disconnected" },
    { tools: "unavailable" },
  ]) {
    const original = status({ facts: { ...facts, ...dimension } }),
      copy = structuredClone(original);
    assert.equal(view(original, now).summary, "failed");
    assert.equal(view(original, now + 60001).summary, "configured");
    assert.deepEqual(original, copy);
  }
});
test("capability, disabled config, target, external ownership and OpenDesk lifecycle gate actions", () => {
  const absent = status({
    installed: false,
    enabled: false,
    state: "absent",
    facts: { ...facts, config: "absent" },
  });
  assert.equal(actions(node, absent).canInstall, true);
  assert.equal(actions(node, status()).canInstall, false);
  assert.equal(
    actions(node, { ...absent, facts: { ...facts, config: "disabled" } })
      .canInstall,
    false,
  );
  assert.equal(
    actions(node, { ...absent, nativeTargetChanged: true }).canInstall,
    false,
  );
  assert.equal(actions(node, absent, true).canInstall, false);
  assert.equal(actions({ ...node, online: false }, absent).canInstall, false);
  assert.equal(
    actions(node, status({ facts: { ...facts, ownership: "external" } }))
      .canRemove,
    false,
  );
  assert.equal(
    actions(node, status({ facts: { ...facts, ownership: "external" } }))
      .canRevoke,
    true,
  );
  for (const value of [false, null]) {
    const n = { ...node, connectionCapabilities: { nativeMcpConfig: value } };
    assert.equal(actions(n, absent).canInstall, false);
    assert.equal(actions(n, absent).probeSupported, false);
  }
  const desk = {
    ...node,
    adapter: "opendesk-desktop",
    connected: false,
    capabilitySource: { kind: "static-adapter", adapterId: "opendesk-desktop" },
  };
  assert.equal(actions(desk, absent).canInstall, false);
  assert.equal(
    actions(desk, { ...absent, lifecycle: { safeToWrite: true } }).canInstall,
    true,
  );
  assert.equal(actions(desk, status()).probeSupported, false);
});
test("revocation without native cleanup keeps remove while a fully removed entry can be installed again", () => {
  const revoked = status({
    installed: false,
    enabled: false,
    state: "revoked_config_pending",
    facts: { ...facts, authorization: "revoked" },
  });
  assert.equal(actions(node, revoked).canRemove, true);
  assert.equal(actions(node, revoked).canRevoke, false);
  const removed = {
    ...revoked,
    state: "absent",
    facts: { ...revoked.facts, config: "absent" },
  };
  assert.equal(view(removed, now).summary, "unconfigured");
  assert.equal(actions(node, removed).canInstall, true);
});
test("diagnostic display redacts common native secret formats without altering a public path", () => {
  for (const text of [
    "Bearer fixture-secret-value",
    "token=fixture-secret-value",
    "password:fixture-secret-value",
    "https://fixture-user:fixture-secret-value@example.test",
    "sk-abcdefghijklmnopqrst",
  ])
    assert(
      !mcpDisplayMessage(text).includes("fixture-secret-value") &&
        !mcpDisplayMessage(text).includes("sk-abcdefghijklmnopqrst"),
    );
  assert.equal(
    mcpDisplayMessage("/fixture/.claude.json"),
    "/fixture/.claude.json",
  );
});
