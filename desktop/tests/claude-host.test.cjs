const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ClaudeHost,
  cliCommand,
  windowsCandidates,
  writeJSON,
} = require("../electron/claude-host.cjs");

test("worker bootstrap exit is a failed unstarted task with persisted diagnostics", async t => {
  const f = fixture(t);
  const executable = path.join(f.directory, "broken-runtime");
  fs.writeFileSync(executable, `#!${process.execPath}\nconsole.error('bootstrap runtime unavailable');process.exit(42);\n`, { mode: 0o755 });
  const host = new ClaudeHost({ directory: path.join(f.directory, "state"), candidates: [f.executable], workerRuntime: () => executable });
  t.after(() => host.close());
  const connected = await host.call("connect", { executable: f.executable, workspace: f.directory });
  const task = await host.call("ipc", { op: "submit", agentId: connected.agentId, requestId: "bootstrap-failure", message: "hello" });
  const failed = await until(host, task.taskId, task => task.status === "failed");
  assert.equal(failed.error.code, "CLAUDE_WORKER_START");
  assert.equal(fs.existsSync(path.join(f.directory, "invocations.jsonl")), false);
  assert.match(fs.readFileSync(path.join(f.directory, "state/runs", task.taskId, "worker-console.log"), "utf8"), /bootstrap runtime unavailable/);
  const old = await host.call("ipc", { op: "conversation", conversationId: task.conversationId });
  assert.equal(old.canContinue, false);
  assert.equal(old.kind, "task");
  assert.match(old.continuationReason, /原生会话/);
  assert.equal((await host.call("ipc", { op: "conversations" })).items[0].canContinue, false);
  assert.equal((await host.call("snapshot")).conversations[0].canContinue, false);
  await assert.rejects(host.call("ipc", { op: "continue", conversationId: old.conversationId, requestId: "invalid-continue", message: "again" }), { code: "CONVERSATION_UNBOUND" });
  assert.equal(fs.existsSync(path.join(f.directory, "invocations.jsonl")), false);
  host.close();
  const reopened = f.host();
  const fresh = await reopened.call("ipc", { op: "submit", agentId: connected.agentId, requestId: "new-conversation", message: "hello" });
  assert.notEqual(fresh.conversationId, old.conversationId);
  await until(reopened, fresh.taskId, task => task.status === "succeeded");
  assert.equal((await reopened.call("ipc", { op: "conversation", conversationId: fresh.conversationId })).canContinue, true);
  assert.equal((await reopened.call("ipc", { op: "conversation", conversationId: old.conversationId })).canContinue, false);
});

function fixture(
  t,
  auth = { loggedIn: true, authMethod: "api_key" },
  environment = process.env,
) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "agentbridge-claude-"),
  );
  const executable = path.join(directory, "claude");
  const script = `#!${process.execPath}
const fs = require('node:fs');
const readline = require('node:readline');
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('2.1.290 (Claude Code)'); process.exit(0); }
if (args[0] === 'auth') { console.log(JSON.stringify(${JSON.stringify(auth)})); process.exit(0); }
const output = (value) => process.stdout.write(JSON.stringify(value)+'\\n');
const resume = args.find((a) => a.startsWith('--resume='));
const session = resume ? resume.slice(9) : args.find((a) => a.startsWith('--session-id=')).slice(13);
let prompt, permission, wait = false;
function result(text, extra={}) { output({type:'result',subtype:'success',is_error:false,session_id:session,result:text,...extra}); }
const input = readline.createInterface({input:process.stdin});
input.on('line', (line) => {
 const message = JSON.parse(line);
 if (message.type === 'control_request' && message.request.subtype === 'initialize') {
  output({type:'control_response',response:{subtype:'success',request_id:message.request_id,response:{}}}); return;
 }
 if (message.type === 'user') {
  prompt = message.message.content[0].text;
  fs.appendFileSync(${JSON.stringify(path.join(directory, "invocations.jsonl"))},JSON.stringify({args,prompt,session})+'\\n');
  output({type:'system',subtype:'init',session_id:session,model:'fixture'});
  if(prompt === 'wait') { wait=true; setInterval(()=>{},1000); return; }
  if(prompt === 'delayed') { setTimeout(()=>result('finished after reopening'),500); return; }
  if(prompt === 'permission') {
   permission='permission-1';
   output({type:'control_request',request_id:permission,request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'example.txt',new_string:'fixture'},description:'修改 example.txt'}});return;
  }
  if(prompt === 'denied') { result('I did not modify the requested file',{permission_denials:[{tool_name:'Edit'}]});return; }
  if(prompt === 'bad') { output({type:'result',subtype:'error_during_execution',is_error:true,session_id:session,result:'Provider failed'});return; }
  if(prompt === 'api-error') {
   output({type:'system',subtype:'session_state_changed',state:'running'});
   output({type:'assistant',session_id:session,message:{content:[{type:'text',text:'API Error: 400 invalid model'}]}});
   output({type:'result',subtype:'success',is_error:true,session_id:session,result:'API Error: 400 invalid model'});return;
  }
  if(prompt === 'missing-result') { process.exit(0);return; }
  if(prompt === 'form') { output({type:'control_request',request_id:'form-1',request:{subtype:'can_use_tool',tool_name:'AskUserQuestion',input:{questions:[]}}});return; }
  result(resume ? 'resumed:'+session : 'hello'); return;
 }
 if(message.type === 'control_response' && message.response.request_id === permission) {
  if(message.response.response.behavior==='allow') result('approved');
  else result('denied',{permission_denials:[{tool_name:'Edit'}]});
 }
 if(message.type === 'control_response' && message.response.request_id === 'form-1') result('form denied');
});
input.on('close',()=>{if(!wait)process.exit(0)});
`;
  fs.writeFileSync(executable, script, { mode: 0o755 });
  const hosts = [];
  const host = () => {
    const item = new ClaudeHost({
      directory: path.join(directory, "state"),
      candidates: [executable],
      environment,
    });
    hosts.push(item);
    return item;
  };
  t.after(async () => {
    for (const item of hosts) item.close();
    // Tests cancel their own running tasks before cleanup.
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, executable, host };
}
async function until(host, id, predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const task = await host.call("ipc", { op: "task", taskId: id });
    if (predicate(task)) return task;
    await new Promise((done) => setTimeout(done, 50));
  }
  assert.fail("Fixture task did not reach the expected state");
}
async function connect(host, f) {
  return host.call("connect", {
    executable: f.executable,
    workspace: f.directory,
    name: "测试项目",
  });
}

test('idle snapshots reuse Claude installation/auth checks while explicit checks remain available', async t => {
  const f = fixture(t), host = f.host();
  const connected = await connect(host, f);
  const agent = host.state.instances.find(a => a.agentId === connected.agentId);
  agent.check.time = '2000-01-01T00:00:00.000Z';
  const original = host.check.bind(host);
  let probes = 0;
  t.mock.method(host, 'check', async value => { probes++; return original(value); });
  for (let i = 0; i < 4; i++) {
    const snapshot = await host.call('snapshot');
    assert.equal(snapshot.agents.items[0].check.time, '2000-01-01T00:00:00.000Z');
    assert.equal(snapshot.agents.items[0].healthy, true);
  }
  assert.equal(probes, 0);
  await host.call('ipc', { op: 'check', agentId: connected.agentId });
  assert.equal(probes, 1);
  assert.equal(fs.existsSync(path.join(f.directory, 'invocations.jsonl')), false);
});

test("discovers executable, separates a shared tool connection from project instances, checks real installation/auth", async (t) => {
  const f = fixture(t),
    host = f.host();
  assert.equal((await host.call("snapshot")).configured, false);
  assert.equal((await host.call("discover")).items[0].version, "2.1.290");
  const first = await connect(host, f);
  assert.equal(first.check.authentication, "accepted");
  assert.equal(first.check.modelResponse, "not_checked");
  fs.mkdirSync(path.join(f.directory, "second"));
  const second = await host.call("connect", {
    executable: f.executable,
    workspace: path.join(f.directory, "second"),
  });
  assert.notEqual(first.agentId, second.agentId);
  assert.equal(first.connectionId, second.connectionId);
  const duplicate = await connect(host, f);
  assert.equal(duplicate.agentId, first.agentId);
  assert.equal(duplicate.reused, true);
  const snapshot = await host.call("snapshot");
  assert.equal(snapshot.connections.length, 1);
  assert.equal(snapshot.instances.length, 2);
  assert.equal(snapshot.agents.items[0].capabilities.forms, false);
  assert.equal(
    fs.existsSync(path.join(f.directory, "invocations.jsonl")),
    false,
  );
});

test("idempotent submission and native resume survive closing and reopening the observer", async (t) => {
  const f = fixture(t),
    first = f.host(),
    connection = await connect(first, f);
  const params = {
    op: "submit",
    agentId: connection.agentId,
    requestId: "first-request",
    message: "hello",
  };
  const task = await first.call("ipc", params);
  const repeated = await first.call("ipc", params);
  assert.equal(repeated.taskId, task.taskId);
  await assert.rejects(first.call("ipc", { ...params, message: "other" }), {
    code: "REQUEST_CONFLICT",
  });
  const finished = await until(
    first,
    task.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(finished.result.message, "hello");
  first.close();
  const reopened = f.host();
  assert.equal(
    (await reopened.call("ipc", { op: "request", requestId: "first-request" }))
      .taskId,
    task.taskId,
  );
  const continued = await reopened.call("ipc", {
    op: "continue",
    conversationId: task.conversationId,
    requestId: "second-request",
    message: "again",
  });
  const reply = await until(
    reopened,
    continued.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(reply.native.sessionId, finished.native.sessionId);
  assert.equal(reply.result.message, "resumed:" + finished.native.sessionId);
  const conversation = await reopened.call("ipc", {
    op: "conversation",
    conversationId: task.conversationId,
  });
  assert.equal(conversation.turns, 2);
  assert.equal(conversation.items.length, 2);
  assert.equal(conversation.canContinue, true);
  assert.equal(conversation.kind, "task");
  assert.equal(conversation.sessionId, undefined);
  const invocations = fs
    .readFileSync(path.join(f.directory, "invocations.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(invocations.length, 2);
  assert.equal(
    invocations[0].args.includes("--dangerously-skip-permissions"),
    false,
  );
  assert.equal(invocations[0].args.includes("bypassPermissions"), false);
  assert.equal(
    invocations[1].args.includes("--resume=" + finished.native.sessionId),
    true,
  );
});

test("detached execution completes while observer is closed and replay keeps its result", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  const task = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "background",
    message: "delayed",
  });
  await until(host, task.taskId, (task) => task.status === "running");
  host.close();
  await new Promise((done) => setTimeout(done, 700));
  const reopened = f.host();
  const finished = await until(
    reopened,
    task.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(finished.result.message, "finished after reopening");
});

test("permission prompts are visible, replies use the original control channel and replay an operation receipt", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  const task = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "approval-request",
    message: "permission",
  });
  await until(host, task.taskId, (task) => !!task.waiting);
  const pending = await host.call("ipc", {
    op: "pending",
    taskId: task.taskId,
  });
  assert.equal(pending.permissions[0].action, "Edit");
  const reply = {
    op: "reply",
    taskId: task.taskId,
    reply: {
      executionId: task.executionId,
      operationId: "approval-operation",
      action: "permission",
      requestId: pending.permissions[0].id,
      decision: "once",
    },
  };
  assert.equal((await host.call("ipc", reply)).state, "confirmed");
  assert.equal((await host.call("ipc", reply)).state, "confirmed");
  const finished = await until(
    host,
    task.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(finished.result.message, "approved");
  assert.equal(finished.waiting, undefined);
  await assert.rejects(
    host.call("ipc", {
      ...reply,
      reply: { ...reply.reply, decision: "reject" },
    }),
    { code: "REQUEST_CONFLICT" },
  );
});

test("denied tools, provider failures, missing result and unsupported forms never become successful tasks", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  for (const message of ["denied", "bad", "missing-result", "form"]) {
    const task = await host.call("ipc", {
      op: "submit",
      agentId: connection.agentId,
      requestId: message,
      message,
    });
    const finished = await until(
      host,
      task.taskId,
      (task) => task.status === "failed",
    );
    assert.ok(finished.error);
    if (["denied", "form"].includes(message))
      assert.equal(finished.error.code, "CLAUDE_PERMISSION_DENIED");
  }
});

test("cancellation is idempotent and final only after native process exit, preserving history", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  const task = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "wait-request",
    message: "wait",
  });
  await until(host, task.taskId, (task) => !!task.native);
  await assert.rejects(
    host.call("ipc", {
      op: "submit",
      agentId: connection.agentId,
      requestId: "busy",
      message: "hello",
    }),
    { code: "AGENT_BUSY" },
  );
  const params = {
    op: "cancel",
    taskId: task.taskId,
    operationId: "cancel-operation",
  };
  const cancelled = await host.call("ipc", params);
  assert.equal(cancelled.state, "confirmed");
  assert.equal(cancelled.data.nativeExited, true);
  assert.equal((await host.call("ipc", params)).state, "confirmed");
  assert.equal(
    (await host.call("ipc", { op: "task", taskId: task.taskId })).status,
    "cancelled",
  );
  host.close();
  const reopened = f.host();
  assert.equal(
    (await reopened.call("ipc", { op: "task", taskId: task.taskId })).status,
    "cancelled",
  );
});

test("npm Windows launchers bypass shell expansion, and discovery includes standard native/npm installs", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "claude-npm-"));
  try {
    const script = path.join(
      folder,
      "node_modules/@anthropic-ai/claude-code/cli.js",
    );
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, "");
    const launcher = path.join(folder, "claude.cmd");
    fs.writeFileSync(launcher, "");
    const command = cliCommand(launcher, ["--version"]);
    assert.equal(command.executable, process.execPath);
    assert.deepEqual(command.args, [script, "--version"]);
    assert.equal(command.env.ELECTRON_RUN_AS_NODE, "1");
    assert.ok(
      windowsCandidates(folder, { APPDATA: folder, PATH: folder }).includes(
        path.join(folder, "npm/claude.cmd"),
      ),
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("missing and unsupported authentication status never report a healthy Claude connection", async (t) => {
  for (const [auth, expected] of [
    [{ loggedIn: false }, "credential_missing"],
    [{ status: "unsupported" }, "not_checked"],
  ]) {
    const f = fixture(t, auth),
      host = f.host();
    const discovered = (await host.call("discover")).items[0];
    assert.equal(discovered.authentication, expected);
    assert.equal(discovered.healthy, false);
    assert.ok(discovered.error.message);
    const connection = await connect(host, f);
    assert.equal(connection.check.authentication, expected);
    const snapshot = await host.call("snapshot");
    assert.equal(snapshot.agents.items[0].healthy, false);
    assert.equal(snapshot.agents.items[0].available, false);
    if (expected === "credential_missing")
      await assert.rejects(
        host.call("ipc", {
          op: "submit",
          agentId: connection.agentId,
          requestId: "missing-login",
          message: "hello",
        }),
        { code: "AGENT_UNAVAILABLE" },
      );
    assert.equal(
      fs.existsSync(path.join(f.directory, "invocations.jsonl")),
      false,
    );
  }
});

test("independent project instances execute concurrently through their shared Claude installation", async (t) => {
  const f = fixture(t),
    host = f.host(),
    first = await connect(host, f);
  const workspace = path.join(f.directory, "another-project");
  fs.mkdirSync(workspace);
  const second = await host.call("connect", {
    executable: f.executable,
    workspace,
  });
  const [one, two] = await Promise.all([
    host.call("ipc", {
      op: "submit",
      agentId: first.agentId,
      requestId: "parallel-one",
      message: "delayed",
    }),
    host.call("ipc", {
      op: "submit",
      agentId: second.agentId,
      requestId: "parallel-two",
      message: "delayed",
    }),
  ]);
  const [completedOne, completedTwo] = await Promise.all([
    until(host, one.taskId, (task) => task.status === "succeeded"),
    until(host, two.taskId, (task) => task.status === "succeeded"),
  ]);
  assert.equal(completedOne.result.message, "finished after reopening");
  assert.equal(completedTwo.result.message, "finished after reopening");
  assert.notEqual(completedOne.native.sessionId, completedTwo.native.sessionId);
});

test("missing observer heartbeat preserves unknown outcome and project occupancy without replaying the request", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  host.close();
  const file = path.join(f.directory, "state/claude-state.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  state.tasks.push({
    taskId: "old-task",
    executionId: "old-execution",
    conversationId: "old-conversation",
    targetAgent: connection.agentId,
    requestId: "old-request",
    message: "old demand",
    status: "running",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
    lastSeq: 0,
    events: [],
    pending: [],
    worker: { offset: 0 },
  });
  fs.writeFileSync(file, JSON.stringify(state));
  const reopened = f.host();
  const old = await reopened.call("ipc", { op: "task", taskId: "old-task" });
  assert.equal(old.status, "unknown");
  assert.ok(old.uncertaintyReason);
  await assert.rejects(
    reopened.call("ipc", {
      op: "submit",
      agentId: connection.agentId,
      requestId: "new-request",
      message: "hello",
    }),
    { code: "AGENT_BUSY" },
  );
  assert.equal(
    (await reopened.call("ipc", { op: "reconcile", taskId: "old-task" })).state,
    "unknown",
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "invocations.jsonl")),
    false,
  );
});

test("per-instance model overrides pass to the CLI without changing global settings, and resume preserves the conversation snapshot", async (t) => {
  const f = fixture(t),
    firstHost = f.host();
  const modelOne = { providerID: "claude", id: "fixture-model-one" };
  const modelTwo = { providerID: "claude", id: "fixture-model-two" };
  const settingsFile = path.join(f.directory, ".claude/settings.json");
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  const originalSettings = JSON.stringify({ model: "global-model" });
  fs.writeFileSync(settingsFile, originalSettings);
  const inheritedEnvironmentModel = process.env.ANTHROPIC_MODEL;
  const first = await firstHost.call("connect", {
    executable: f.executable,
    workspace: f.directory,
    model: modelOne,
  });
  const workspaceTwo = path.join(f.directory, "model-project-two");
  fs.mkdirSync(workspaceTwo);
  const second = await firstHost.call("connect", {
    executable: f.executable,
    workspace: workspaceTwo,
    model: modelTwo,
  });
  assert.equal(first.check.modelConfiguration, "selected");
  const firstTask = await firstHost.call("ipc", {
    op: "submit",
    agentId: first.agentId,
    requestId: "model-one",
    message: "hello",
  });
  const secondTask = await firstHost.call("ipc", {
    op: "submit",
    agentId: second.agentId,
    requestId: "model-two",
    message: "hello",
  });
  await Promise.all([
    until(firstHost, firstTask.taskId, (task) => task.status === "succeeded"),
    until(firstHost, secondTask.taskId, (task) => task.status === "succeeded"),
  ]);
  await firstHost.call("connect", {
    executable: f.executable,
    workspace: f.directory,
    model: { providerID: "claude", id: "future-model" },
  });
  firstHost.close();
  const reopened = f.host();
  const snapshot = await reopened.call("snapshot");
  assert.equal(
    snapshot.agents.items.find((agent) => agent.agentId === first.agentId)
      .selectedModel.id,
    "future-model",
  );
  assert.deepEqual(
    snapshot.agents.items.find((agent) => agent.agentId === second.agentId)
      .selectedModel,
    modelTwo,
  );
  const continued = await reopened.call("ipc", {
    op: "continue",
    conversationId: firstTask.conversationId,
    requestId: "model-resume",
    message: "again",
  });
  const reply = await until(
    reopened,
    continued.taskId,
    (task) => task.status === "succeeded",
  );
  assert.deepEqual(reply.model, modelOne);
  const invocations = fs
    .readFileSync(path.join(f.directory, "invocations.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(invocations.length, 3);
  assert.ok(invocations[0].args.includes("--model=" + modelOne.id));
  assert.ok(invocations[1].args.includes("--model=" + modelTwo.id));
  assert.ok(invocations[2].args.includes("--model=" + modelOne.id));
  assert.ok(invocations[2].args.some((arg) => arg.startsWith("--resume=")));
  assert.equal(fs.readFileSync(settingsFile, "utf8"), originalSettings);
  assert.equal(process.env.ANTHROPIC_MODEL, inheritedEnvironmentModel);
  await assert.rejects(
    reopened.call("connect", {
      executable: f.executable,
      workspace: f.directory,
      model: { id: "" },
    }),
    { code: "INVALID_INPUT" },
  );
});

test("API error result with stale running state finishes failed after the native process exits", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  const task = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "api-error-request",
    message: "api-error",
  });
  const failed = await until(
    host,
    task.taskId,
    (task) => task.status === "failed",
  );
  assert.equal(failed.error.code, "CLAUDE_RESULT_ERROR");
  assert.equal(failed.error.message, "API Error: 400 invalid model");
  const completion = JSON.parse(
    fs.readFileSync(
      path.join(f.directory, "state/runs", task.taskId, "completion.json"),
      "utf8",
    ),
  );
  assert.equal(completion.nativeExited, true);
  assert.equal(completion.status, "failed");
  const result = JSON.parse(
    fs.readFileSync(
      path.join(f.directory, "state/runs", task.taskId, "result.json"),
      "utf8",
    ),
  );
  assert.equal(result.is_error, true);
});

test("Windows sharing violations retry an atomic replacement without discarding the JSON document", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claude-atomic-"));
  const original = fs.renameSync;
  let attempts = 0;
  try {
    fs.renameSync = (source, target) => {
      attempts++;
      if (attempts < 3)
        throw Object.assign(new Error("Windows sharing violation"), {
          code: "EPERM",
        });
      return original(source, target);
    };
    const file = path.join(directory, "state.json");
    writeJSON(file, { preserved: true });
    assert.equal(attempts, 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
      preserved: true,
    });
  } finally {
    fs.renameSync = original;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("heartbeat rename errors cannot crash the observer, and diagnostics redact credentials", async (t) => {
  const hookDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "claude-fault-"));
  const hook = path.join(hookDirectory, "heartbeat-hook.cjs");
  fs.writeFileSync(
    hook,
    `const fs=require('node:fs'); const original=fs.renameSync; let calls=0; fs.renameSync=(source,target)=>{ if(target.endsWith('heartbeat.json') && ++calls>1 && calls<14) throw Object.assign(new Error('sharing violation '+process.env.FIXTURE_API_KEY),{code:'EPERM'}); return original(source,target); };`,
  );
  t.after(() => fs.rmSync(hookDirectory, { recursive: true, force: true }));
  const secret = "fixture-sensitive-credential";
  const f = fixture(
    t,
    { loggedIn: true },
    {
      ...process.env,
      NODE_OPTIONS: "--require=" + hook,
      FIXTURE_API_KEY: secret,
    },
  );
  const host = f.host(),
    connection = await connect(host, f);
  const task = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "heartbeat-failure",
    message: "delayed",
  });
  const finished = await until(
    host,
    task.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(finished.result.message, "finished after reopening");
  const diagnostics = fs.readFileSync(
    path.join(
      f.directory,
      "state/runs",
      task.taskId,
      "worker-diagnostics.jsonl",
    ),
    "utf8",
  );
  assert.ok(diagnostics.includes("EPERM"));
  assert.equal(diagnostics.includes(secret), false);
  assert.ok(diagnostics.includes("[已隐藏]"));
});

test("instance model updates require the current revision, preserve old conversations and support restoring inheritance", async (t) => {
  const f = fixture(t),
    host = f.host(),
    connection = await connect(host, f);
  const initial = await host.call("snapshot");
  const selected = await host.call("setInstanceModel", {
    agentId: connection.agentId,
    expectedRevision: initial.agents.revision,
    model: { providerID: "claude", id: "selected-model" },
  });
  assert.equal(selected.model.id, "selected-model");
  assert.equal(selected.check.modelConfiguration, "selected");
  await assert.rejects(
    host.call("setInstanceModel", {
      agentId: connection.agentId,
      expectedRevision: initial.agents.revision,
      model: null,
    }),
    { code: "REVISION_CONFLICT" },
  );
  const first = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "frozen-model",
    message: "hello",
  });
  await until(host, first.taskId, (task) => task.status === "succeeded");
  const restored = await host.call("setInstanceModel", {
    agentId: connection.agentId,
    expectedRevision: selected.revision,
    model: null,
  });
  assert.equal(restored.model, null);
  assert.equal(restored.check.modelConfiguration, "inherited");
  const continued = await host.call("ipc", {
    op: "continue",
    conversationId: first.conversationId,
    requestId: "frozen-model-resume",
    message: "again",
  });
  const reply = await until(
    host,
    continued.taskId,
    (task) => task.status === "succeeded",
  );
  assert.equal(reply.model.id, "selected-model");
  const waiting = await host.call("ipc", {
    op: "submit",
    agentId: connection.agentId,
    requestId: "model-busy",
    message: "wait",
  });
  await until(host, waiting.taskId, (task) => !!task.native);
  await assert.rejects(
    host.call("setInstanceModel", {
      agentId: connection.agentId,
      expectedRevision: restored.revision,
      model: { providerID: "claude", id: "another" },
    }),
    { code: "AGENT_BUSY" },
  );
  await host.call("ipc", {
    op: "cancel",
    taskId: waiting.taskId,
    operationId: "model-busy-cancel",
  });
});


test('classic MCP permits the read-only delegation lookup without preauthorizing human permission replies',async t=>{
 const f=fixture(t),host=f.host(),a=await connect(host,f);
 const task=await host.call('ipc',{op:'submit',agentId:a.agentId,requestId:'delegation-list-permission',message:'hello',mcp:{command:process.execPath,args:['unused-controlled-client.cjs']}});
 const result=await until(host,task.taskId,t=>t.status==='succeeded');assert.equal(result.status,'succeeded');
 const {args}=JSON.parse(fs.readFileSync(path.join(f.directory,'invocations.jsonl'),'utf8').trim());
 assert(args.includes('mcp__agentbridge__list_delegations'));assert(!args.includes('mcp__agentbridge__reply_task'));assert(args.some(x=>x.includes('list_delegations 只读查找')));
});
