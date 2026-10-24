// Existing saved SSH target, frozen client, no hello fencing or deployment.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const [bridge, packageDirectory, output] = process.argv.slice(2);
if (process.platform !== "win32" || !output)
  throw Error("Windows/frozen bridge/Linux package/report required");
const { SshManager } = require(
  path.join(bridge, "desktop/electron/ssh-host.cjs"),
);
const { remoteExec, quote } = require(
  path.join(bridge, "desktop/electron/ssh-install.cjs"),
);
const profile =
  process.env.AGENTBRIDGE_EXISTING_PROFILE ||
  path.join(process.env.APPDATA, "agentbridge-desktop");
const parse = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const owner = parse(path.join(profile, "coordinator-identity.json"));
const report = {
  date: new Date().toISOString(),
  clientVersion: require("../package.json").version,
  status: "running",
  scope:
    "Actual existing saved SSH authentication / frozen packaged client / strict installed-file verification / non-fencing original daemon inspect; no deployment, native prompts or production connection-state writes",
  modelCalls: 0,
  checks: [],
};
let observerStateSaves = 0,
  manager;
class ReadOnlyObserver extends SshManager {
  save() {
    observerStateSaves++;
  }
}
const protectedKeys = [
  "connectionId",
  "revision",
  "name",
  "host",
  "port",
  "username",
  "authKind",
  "keyPath",
  "credentialRef",
  "autoReconnect",
  "machineId",
  "daemonId",
  "trustedFingerprint",
  "identity",
  "removed",
  "maintenance",
];
const sourceFile = path.join(profile, "ssh-connections.json");
const protectedState = () =>
  JSON.stringify(
    parse(sourceFile).connections.map((item) =>
      Object.fromEntries(
        protectedKeys
          .filter((k) => item[k] !== undefined)
          .map((k) => [k, item[k]]),
      ),
    ),
  );
const before = protectedState();
const record = () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
};
(async () => {
  manager = new ReadOnlyObserver({
    directory: profile,
    coordinatorId: owner.coordinatorId,
    packageDirectory: path.resolve(packageDirectory),
  });
  const connection = manager.connections.find(
    (v) =>
      !v.removed &&
      v.name === (process.env.AGENTBRIDGE_EXISTING_CONNECTION_NAME || "阿里云"),
  );
  assert(
    connection?.daemonId && connection.credentialRef,
    "An original saved target and credential are required",
  );
  connection.autoReconnect = false; // Observer copy only; never saved.
  report.phase = "authenticate_original";
  record();
  const client = await manager.authenticate(connection);
  report.authenticationPassed = true;
  report.phase = "strict_release_probe";
  record();
  const probe = await manager.installer.probe(client);
  report.daemonVersion = probe.daemonVersion;
  assert.equal(probe.reuseCompatible, true);
  assert.equal(probe.installNeeded, false);
  const selected = manager.installer.release(probe.daemonVersion);
  report.frozenManifestDigest = selected.digest;
  report.phase = "verify_original_files";
  record();
  const current = () =>
    remoteExec(
      client,
      "sha256sum " + quote(path.posix.join(probe.installPath, "current.json")),
    );
  const currentBefore = await current();
  const pidFile = path.posix.join(probe.stateDirectory, "daemon.pid");
  const pidBefore = JSON.parse(
    await remoteExec(client, "cat " + quote(pidFile)),
  );
  const installed = await manager.installer.install(
    client,
    probe,
    "readonly-existing-release-verification",
  );
  report.checks.push(
    "Saved credential authenticates the original trusted SSH host; installed version selects its exact pinned manifest and passes production per-file verification",
  );
  report.phase = "inspect_original_daemon";
  record();
  const inspect = () =>
    remoteExec(
      client,
      quote(installed.node) + " -",
      `const mod=require(${JSON.stringify(path.posix.join(installed.versionPath, "desktop/electron/machine-daemon.cjs"))});mod.inspectDaemon(${JSON.stringify({ stateDirectory: installed.stateDirectory, ownerCoordinatorId: owner.coordinatorId, profileId: installed.profileId, expectedDaemonId: connection.daemonId })}).then(v=>process.stdout.write(JSON.stringify(v)),()=>process.exit(1));`,
      { timeoutMs: 30000 },
    );
  const first = JSON.parse(await inspect()),
    second = JSON.parse(await inspect());
  assert.equal(first.daemonId, connection.daemonId);
  assert.equal(second.daemonId, first.daemonId);
  assert.equal(first.pid, pidBefore.pid);
  assert.equal(second.pid, first.pid);
  assert.equal(first.version, probe.daemonVersion);
  const pidAfter = JSON.parse(
    await remoteExec(client, "cat " + quote(pidFile)),
  );
  assert.deepEqual(pidAfter, pidBefore);
  assert.equal(await current(), currentBefore);
  assert.equal(protectedState(), before);
  report.checks.push(
    "Two non-fencing inspect calls retain the original daemon identity/PID and actual version; current.json and daemon.pid remain unchanged",
  );
  report.localProtectedStateUnchanged = true;
  report.remoteCurrentUnchanged = true;
  report.remotePidUnchanged = true;
  report.checks.push(
    "Original local connection configuration/ownership remains identical; only observer memory state changes, no hello, task, permission, cancellation or maintenance action",
  );
  report.status = "passed";
  report.phase = "complete";
})()
  .catch((error) => {
    report.status = "failed";
    report.error = {
      code: error.code || "VERIFY_FAILED",
      message:
        "Original saved SSH read-only verification did not pass; no replacement, deployment or task was issued",
    };
    process.exitCode = 1;
  })
  .finally(() => {
    manager?.close();
    report.observerStateSavesSuppressed = observerStateSaves;
    report.localProtectedStateUnchanged = protectedState() === before;
    record();
    console.log(JSON.stringify(report));
  });
