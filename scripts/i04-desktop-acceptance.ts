import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { SettingsStore } from "../src/settings.js";
import { ipc } from "../src/controller.js";
import { parseNativeModel } from "../src/config.js";
import { OpenCodeClient } from "../src/drivers/opencode-client.js";
import { type Task } from "../src/core.js";

// This test edits only a copied example, with an isolated Bridge and desktop profile.
const base =
  "/mnt/c/Users/jiqi/.codex/visualizations/2026/10/08/01a119ed-c329-7e22-81df-0e3a4c62e86f";
const windows = (p: string) =>
  "C:" + p.slice("/mnt/c".length).replaceAll("/", "\\");
const root = mkdtempSync(resolve(tmpdir(), "ab-i04-real-")),
  dir = resolve(root, "bridge"),
  project = resolve(root, "project");
cpSync("examples/opencode-project", project, { recursive: true });
const profile = resolve(base, "I04-test-profile-" + randomUUID().slice(0, 8));
mkdirSync(profile, { recursive: true });
writeFileSync(
  resolve(profile, "desktop.json"),
  JSON.stringify({ theme: "light", distribution: "Ubuntu", directory: dir }),
);
const stageFile = resolve("artifacts/I04-windows-real-stage.json");
rmSync(stageFile, { force: true });
const store = new SettingsStore(dir),
  marker = "AB_I04_" + randomUUID().slice(0, 8);
const report: Record<string, unknown> = {
  date: new Date().toISOString(),
  kind: "I04-real-Windows-desktop-acceptance",
  status: "running",
  model: "csi-provider/DeepSeek-V4.1-Flash",
  checks: {},
  observation: {},
  tasks: [],
};
const checks = report.checks as Record<string, unknown>;
const stage = () =>
  existsSync(stageFile)
    ? (JSON.parse(readFileSync(stageFile, "utf8")) as { stage: string }).stage
    : "";
async function until<T>(
  fn: () => T | false | Promise<T | false>,
  timeout = 180000,
): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (childExit !== undefined && childExit !== 0)
      throw new Error("Windows test process exited " + childExit);
    if (stage() === "failed")
      throw new Error(
        "Windows UI acceptance failed; see artifacts/I04-windows-real.json",
      );
    const r = await fn();
    if (r !== false) return r;
    await delay(60);
  }
  throw new Error("I04 acceptance timed out");
}
const repo = "\\\\wsl.localhost\\Ubuntu\\home\\jiqi\\LLM\\AgentBridge";
const argumentsWin = [
  repo + "\\desktop\\tests\\windows-real.cjs",
  windows(resolve(base, "AgentBridge-Windows/AgentBridge.exe")),
  windows(profile),
  project,
  marker,
  repo + "\\artifacts\\I04-windows-real-stage.json",
];
const psQuote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const script = `$ProgressPreference='SilentlyContinue'\n$p=Start-Process -FilePath 'D:\\01_common\\nodejs\\node.exe' -ArgumentList @(${argumentsWin.map(psQuote).join(",")}) -WorkingDirectory 'C:\\Users\\jiqi' -RedirectStandardOutput ${psQuote(repo + "\\artifacts\\I04-windows-real-stdout.txt")} -RedirectStandardError ${psQuote(repo + "\\artifacts\\I04-windows-real-stderr.txt")} -PassThru\nif(!$p.WaitForExit(600000)){$p.Kill();exit 2}\nexit $p.ExitCode`;
const child = spawn(
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64"),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let stderr = "";
child.stderr.on("data", (b) => (stderr += b.toString()));
let childExit: number | null | undefined;
const exited = new Promise<number | null>((done) =>
  child.once("close", (code) => {
    childExit = code;
    done(code);
  }),
);
const sourceHash = () =>
  createHash("sha256")
    .update(readFileSync(resolve(project, "src/calculator.js")))
    .digest("hex");
try {
  await until(() => stage() === "connected");
  checks.readonlyDiscoveryAndConnectionPrompts = 0;
  const a = store.read().agents[0]!;
  await ipc(dir, {
    op: "save",
    expectedRevision: store.read().revision,
    agent: {
      agentId: a.agentId,
      model: parseNativeModel(String(report.model)),
    },
  });
  await until(() => stage() === "latency", 300000);
  const content = readFileSync(resolve(project, "src/calculator.js"), "utf8");
  assert.match(content, /return a \* b/);
  assert(!content.includes("I04 cancel proof"));
  checks.permissionEditAndCancelFileEvidence = true;
  const result = await import("node:child_process").then(
    ({ execFile }) =>
      new Promise<{ code: number; stdout: string }>((done) =>
        execFile(process.execPath, ["--test"], { cwd: project }, (error, out) =>
          done({ code: error ? 1 : 0, stdout: out }),
        ),
      ),
  );
  assert.equal(result.code, 0, result.stdout);
  checks.exampleTestsPassed = true;
  const samples: {
    confirmedAt: string;
    displayedAt: string;
    delayMs: number;
  }[] = [];
  for (let i = 0; i < 20; i++) {
    await ipc(dir, {
      op: "save",
      expectedRevision: store.read().revision,
      agent: { agentId: a.agentId, name: "I04_OBSERVE_" + i },
    });
    const db = new DatabaseSync(resolve(dir, "hub-data/hub.sqlite"), {
      readOnly: true,
    });
    let confirmedAt: string;
    try {
      confirmedAt = (
        JSON.parse(
          (
            db.prepare("SELECT data FROM agents WHERE id=?").get(a.agentId) as {
              data: string;
            }
          ).data,
        ) as { lastSeenAt: string }
      ).lastSeenAt;
    } finally {
      db.close();
    }
    const observed = await until(() => {
      const s = stage();
      return s.startsWith("observed:" + i + ":")
        ? Number(s.split(":")[2])
        : false;
    }, 15000);
    samples.push({
      confirmedAt,
      displayedAt: new Date(observed).toISOString(),
      delayMs: Math.max(0, observed - Date.parse(confirmedAt)),
    });
    const temporary = stageFile + "." + process.pid + ".tmp";
    writeFileSync(temporary, JSON.stringify({ stage: "ack:" + i }));
    renameSync(temporary, stageFile);
  }
  await until(() => stage() === "finished");
  assert.equal(await exited, 0, stderr);
  const ui = JSON.parse(
    readFileSync("artifacts/I04-windows-real.json", "utf8"),
  ) as { status: string; checks: Record<string, unknown>; tasks: Task[] };
  assert.equal(ui.status, "passed");
  assert.equal(ui.checks.initialConnectionPrompts, 0);
  Object.assign(checks, ui.checks);
  report.tasks = ui.tasks;
  const native = new OpenCodeClient(store.read().agents[0]!);
  const first = ui.tasks[0]!;
  const messages = await native.messages(first.native!.sessionId);
  assert.equal(messages.filter((m) => m.type === "user").length, 2);
  checks.reentryAdditionalPrompts = 0;
  for (const t of ui.tasks) {
    const same = await ipc<Task>(dir, { op: "task", taskId: t.taskId });
    assert.equal(same.status, t.status);
    assert.equal(same.result?.message, t.result?.message);
  }
  checks.cliAndUIDatabaseMatch = true;
  const db = new DatabaseSync(resolve(dir, "edge-data/edge.sqlite"), {
    readOnly: true,
  });
  try {
    report.executions = db
      .prepare("SELECT task_id,invocations,phase FROM executions")
      .all();
    assert(
      (report.executions as { invocations: number }[]).every(
        (e) => e.invocations === 1,
      ),
    );
  } finally {
    db.close();
  }
  const p95 = samples.map((s) => s.delayMs).sort((a, b) => a - b)[18]!;
  report.observation = { samples, p95Ms: p95, targetMs: 2000 };
  assert(p95 <= 2000, "UI refresh p95 exceeds 2s");
  report.projectContent = content;
  report.projectHash = sourceHash();
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  try {
    await ipc(dir, { op: "stop" });
    await delay(500);
  } catch {
    /* Isolated test controller only. */
  }
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/I04-acceptance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (report.status === "passed") {
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  } else {
    console.error("Retained isolated evidence: " + root);
  }
  console.log("I04 acceptance: " + report.status);
}
