const test = require("node:test"),
  assert = require("node:assert/strict");
const vm = require("node:vm"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ab-desktop-main-")),
    handlers = new Map();
  let calls = 0,
    outcome = {};
  const window = {
    webContents: { mainFrame: {}, setWindowOpenHandler() {}, on() {} },
    loadFile() {},
    close() {},
    isMaximized() {
      return false;
    },
  };
  const app = {
    getPath: () => folder,
    getVersion: () => "0.4.0",
    setPath() {},
    setAppUserModelId() {},
    requestSingleInstanceLock: () => true,
    on() {},
    whenReady: () => ({ then: (f) => f() }),
    quit() {},
  };
  class HostConnection {
    async call(method, params) {
      calls++;
      if (outcome instanceof Error) throw outcome;
      if (typeof outcome === "function") return outcome(method, params);
      return outcome;
    }
    close() {}
  }
  class MachineRouter {
    constructor() {
      this.catalog = { machines: [{ machineId: "wsl-Ubuntu", kind: "wsl", distribution: "Ubuntu" }] };
      this.hosts = new Map();
      this.delegate = new HostConnection();
    }
    defaultMachine() { return this.catalog.machines[0]; }
    async machines() { return this.catalog.machines; }
    machine() { return this.defaultMachine(); }
    async prepare(method, params) { return { params: { ...params, machineId: params.machineId || "wsl-Ubuntu" } }; }
    call(method, params) { return this.delegate.call(method, params); }
    close() { this.delegate.close(); }
  }
  const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const service=createCoordinatorService({directory:folder,platform:'win32',version:'0.4.0',network:new MachineRouter()});
  handlers.set('bridge:call',(event,input)=>service.call(input));
  handlers.set('bridge:pending',()=>service.pending());
  handlers.set('bridge:recover-pending',()=>service.recoverPending());
  handlers.set('bridge:save-preferences',(event,value)=>service.savePreferences(value));
  const event = {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  };
  return {
    folder,
    calls: () => calls,
    outcome: (v) => {
      outcome = v;
    },
    invoke: (name, ...args) => handlers.get("bridge:" + name)(event, ...args),
    close: () => fs.rmSync(folder, { recursive: true, force: true }),
  };
}
test("transport uncertainty blocks a new ID and instance switch, permits readonly query, and keeps original journal", async () => {
  const f = fixture();
  try {
    f.outcome(
      Object.assign(new Error("lost reply"), { code: "DESKTOP_TRANSPORT" }),
    );
    let r = await f.invoke("call", {
      method: "ipc",
      params: { op: "submit", requestId: "original", message: "test" },
    });
    assert.equal(r.ok, false);
    r = await f.invoke("call", {
      method: "ipc",
      params: { op: "submit", requestId: "new", message: "test" },
    });
    assert.equal(r.error.code, "DESKTOP_UNCONFIRMED");
    assert.equal(f.calls(), 1);
    assert.throws(
      () =>
        f.invoke("save-preferences", {
          theme: "light",
          distribution: "Other",
          directory: "",
        }),
      /先查询原操作/,
    );
    f.invoke("save-preferences", {
      theme: "dark",
      distribution: "",
      directory: "",
    });
    f.outcome({ taskId: "task", requestId: "original", status: "running" });
    r = await f.invoke("call", {
      method: "ipc",
      params: { op: "request", requestId: "original" },
    });
    assert.equal(r.ok, true);
    assert.equal(f.invoke("pending").length, 0);
    r = await f.invoke("call", {
      method: "ipc",
      params: { op: "submit", requestId: "new", message: "test" },
    });
    assert.equal(r.ok, true);
    assert.equal(f.calls(), 3);
  } finally {
    f.close();
  }
});
test("pre-admission conversation rejection records a reason and does not lock further work", async()=>{
 const f=fixture();
 try {
  for(const code of ['CONVERSATION_BINDING','CONVERSATION_UNBOUND','CONVERSATION_CONFIG','CONVERSATION_BUSY']) {
   f.outcome(Object.assign(new Error('cannot continue this record'),{code}));
   const r=await f.invoke('call',{method:'ipc',params:{op:'continue',requestId:code,conversationId:'parent',message:'test'}});
   assert.equal(r.error.code,code);assert.equal(f.invoke('pending').length,0);
   const saved=JSON.parse(fs.readFileSync(path.join(f.folder,'pending.json'),'utf8')).find(r=>r.id===code);
   assert.equal(saved.state,'rejected');assert.equal(saved.result.error.code,code);
  }
 }finally{f.close();}
});
test("automatic receipt recovery preserves the original entry and records the reconciliation", async()=>{
 const f=fixture();
 try{
  f.outcome(Object.assign(new Error('lost reply'),{code:'DESKTOP_TRANSPORT'}));
  await f.invoke('call',{method:'ipc',params:{op:'submit',requestId:'original',message:'test'}});
  f.outcome({taskId:'task',requestId:'original',machineId:'wsl-Ubuntu'});
  const result=await f.invoke('recover-pending');assert.equal(result.resolved,1);assert.equal(f.invoke('pending').length,0);
  const original=JSON.parse(fs.readFileSync(path.join(f.folder,'pending.json'),'utf8'))[0];
  assert.equal(original.state,'confirmed');assert(original.reconciledAt);
 }finally{f.close();}
});
test("recovery does not overwrite a concurrently updated journal entry", async()=>{
 const f=fixture();
 try{
  f.outcome(Object.assign(new Error('lost'),{code:'DESKTOP_TRANSPORT'}));
  await f.invoke('call',{method:'ipc',params:{op:'submit',requestId:'original',message:'test'}});
  f.outcome(()=>{
   const file=path.join(f.folder,'pending.json'),rows=JSON.parse(fs.readFileSync(file,'utf8'));
   rows[0].time='newer';rows[0].params.message='newer receipt data';fs.writeFileSync(file,JSON.stringify(rows));
   return {requestId:'original',taskId:'task',machineId:'wsl-Ubuntu'};
  });
  const r=await f.invoke('recover-pending');assert.equal(r.resolved,0);
  const original=f.invoke('pending')[0];assert.equal(original.time,'newer');assert.equal(original.params.message,'newer receipt data');
 }finally{f.close();}
});
test("a rejection on retry cannot erase uncertainty from the original attempt", async()=>{
 const f=fixture();
 try{
  const params={op:'continue',requestId:'original',conversationId:'parent',message:'test'};
  f.outcome(Object.assign(new Error('lost'),{code:'DESKTOP_TRANSPORT'}));await f.invoke('call',{method:'ipc',params});
  f.outcome(Object.assign(new Error('changed'),{code:'CONVERSATION_CONFIG'}));await f.invoke('call',{method:'ipc',params});
  assert.equal(f.invoke('pending').length,1);assert.equal(f.invoke('pending')[0].state,'unknown');
 }finally{f.close();}
});
test("changing an unresolved request payload cannot replace its original journal", async()=>{
 const f=fixture();
 try{
  const params={op:'submit',requestId:'original',message:'first'};
  f.outcome(Object.assign(new Error('lost'),{code:'DESKTOP_TRANSPORT'}));await f.invoke('call',{method:'ipc',params});
  const r=await f.invoke('call',{method:'ipc',params:{...params,message:'other'}});
  assert.equal(r.error.code,'DESKTOP_UNCONFIRMED');assert.equal(f.calls(),1);assert.equal(f.invoke('pending')[0].params.message,'first');
 }finally{f.close();}
});
test("confirmed validation rejection remains editable and unknown records are not dropped by settled history retention", async () => {
  const f = fixture();
  try {
    f.outcome(Object.assign(new Error("busy"), { code: "AGENT_BUSY" }));
    await f.invoke("call", {
      method: "ipc",
      params: { op: "submit", requestId: "busy" },
    });
    assert.equal(f.invoke("pending").length, 0);
    const rows = [
      {
        id: "old",
        op: "submit",
        params: { requestId: "old" },
        state: "unknown",
      },
      ...Array.from({ length: 100 }, (_, i) => ({
        id: "settled" + i,
        state: "confirmed",
      })),
    ];
    fs.writeFileSync(path.join(f.folder, "pending.json"), JSON.stringify(rows));
    f.outcome(Object.assign(new Error("lost"), { code: "DESKTOP_TRANSPORT" }));
    await f.invoke("call", {
      method: "ipc",
      params: { op: "submit", requestId: "old" },
    });
    assert.equal(f.invoke("pending")[0].id, "old");
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(f.folder, "pending.json"))).length,
      101,
    );
  } finally {
    f.close();
  }
});
test("runtime evidence contains readonly counts and never agent credentials or native task contents", async () => {
  const f = fixture();
  try {
    f.outcome({
      configured: true,
      agents: { connected: true, items: [{ password: "secret" }] },
      tasks: [{ message: "private" }],
    });
    await f.invoke("call", { method: "snapshot", params: {} });
    const raw = fs.readFileSync(path.join(f.folder, "runtime.json"), "utf8");
    assert(!raw.includes("secret"));
    assert(!raw.includes("private"));
    assert.equal(JSON.parse(raw).connected, true);
  } finally {
    f.close();
  }
});
test("same request ID on two machines has separate receipts and query only settles its source", async () => {
  const f = fixture();
  try {
    f.outcome(Object.assign(new Error("lost"), { code: "DESKTOP_TRANSPORT" }));
    for (const machineId of ["windows", "wsl-Ubuntu"])
      await f.invoke("call", { method: "ipc", params: { op: "submit", requestId: "same", machineId } });
    assert.equal(f.invoke("pending").length, 2);
    f.outcome({ taskId: "original", requestId: "same", status: "running" });
    await f.invoke("call", { method: "ipc", params: { op: "request", requestId: "same", machineId: "windows" } });
    const pending = f.invoke("pending");
    assert.equal(pending.length, 1);
    assert.equal(pending[0].machineId, "wsl-Ubuntu");
  } finally { f.close(); }
});
test("legacy pending is bound to original WSL and cannot be settled by a Windows request", async () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.folder, "pending.json"), JSON.stringify([{ id: "legacy", state: "unknown", op: "submit", params: { requestId: "legacy" } }]));
    f.outcome({ taskId: "other", requestId: "legacy", status: "succeeded" });
    await f.invoke("call", { method: "ipc", params: { op: "request", requestId: "legacy", machineId: "windows" } });
    assert.equal(f.invoke("pending")[0].machineId, "wsl-Ubuntu");
    await f.invoke("call", { method: "ipc", params: { op: "request", requestId: "legacy", machineId: "wsl-Ubuntu" } });
    assert.equal(f.invoke("pending").length, 0);
  } finally { f.close(); }
});

test('form answers never enter the coordinator journal and original content fingerprint still prevents same-ID replacement',async()=>{
 const f=fixture(),answer='synthetic-sensitive-form-value';try{
  f.outcome(Object.assign(Error('lost'),{code:'DESKTOP_TRANSPORT'}));const params={op:'reply',taskId:'task',reply:{action:'form',taskId:'task',executionId:'execution',requestId:'form',operationId:'original-form',answer:{password:answer}}};
  await f.invoke('call',{method:'ipc',params});const raw=fs.readFileSync(path.join(f.folder,'pending.json'),'utf8');assert(!raw.includes(answer));assert(raw.includes('[redacted]'));
  const changed=await f.invoke('call',{method:'ipc',params:{...params,reply:{...params.reply,answer:{password:'changed'}}}});assert.equal(changed.error.code,'DESKTOP_UNCONFIRMED');
 }finally{f.close();}
});
test('a corrupt original pending journal cannot release occupancy or send a new native request',async()=>{
 const f=fixture();try{fs.writeFileSync(path.join(f.folder,'pending.json'),'broken');const r=await f.invoke('call',{method:'ipc',params:{op:'submit',requestId:'new',message:'must not execute'}});assert.equal(r.error.code,'DESKTOP_JOURNAL_INVALID');assert.equal(f.calls(),0);}finally{f.close();}
});

test('readonly missing or foreign task/control receipts cannot settle the original coordinator journal',async()=>{
 const f=fixture();try{
  f.outcome(Object.assign(Error('lost'),{code:'DESKTOP_TRANSPORT'}));
  await f.invoke('call',{method:'ipc',params:{op:'submit',requestId:'request-original',message:'work'}});
  for(const result of [{state:'not_found'},{taskId:'foreign',requestId:'foreign',status:'running'},{taskId:'foreign',requestId:'request-original',machineId:'other-machine',status:'running'}]){
   f.outcome(result);await f.invoke('call',{method:'ipc',params:{op:'request',requestId:'request-original'}});assert.equal(f.invoke('pending').length,1);
  }
  f.outcome({taskId:'task-original',requestId:'request-original',status:'running'});
  await f.invoke('call',{method:'ipc',params:{op:'request',requestId:'request-original'}});assert.equal(f.invoke('pending').length,0);
  f.outcome(Object.assign(Error('lost'),{code:'DESKTOP_TRANSPORT'}));
  await f.invoke('call',{method:'ipc',params:{op:'cancel',taskId:'task-original',operationId:'cancel-original'}});
  for(const result of [{operationId:'cancel-original',state:'not_found'},{operationId:'foreign',state:'confirmed'},{operationId:'cancel-original',taskId:'foreign',state:'confirmed'},{operationId:'cancel-original',state:'unknown'}]){
   f.outcome(result);await f.invoke('call',{method:'ipc',params:{op:'operation',taskId:'task-original',operationId:'cancel-original'}});assert.equal(f.invoke('pending').length,1);
  }
  f.outcome({operationId:'cancel-original',state:'rejected'});
  await f.invoke('call',{method:'ipc',params:{op:'operation',taskId:'task-original',operationId:'cancel-original'}});assert.equal(f.invoke('pending').length,0);
 }finally{f.close();}
});
