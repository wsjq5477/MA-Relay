import { createInterface } from "node:readline";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { z } from "zod";
import { BridgeError } from "./core.js";
import { ensureController, ipc, type IpcRequest } from "./controller.js";
import { discoverOpenCode } from "./discovery.js";
import { SettingsStore, stateDirectory } from "./settings.js";
import { safeTerminal } from "./terminal.js";

const methods = [
  "snapshot",
  "discover",
  "connect",
  "ipc",
  "environment",
  "setInstanceModel",
] as const;
const schema = z
  .object({
    id: z.string().min(1).max(128),
    method: z.enum(methods),
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const allowed = new Set([
  "status",
  "start",
  "agents",
  "default",
  "check",
  "verify",
  "submit",
  "task",
  "tasks",
  "pending",
  "reply",
  "operation",
  "request",
  "conversations",
  "conversation",
  "continue",
  "cancel",
  "reconcile",
]);
const presentation = z
  .object({
    op: z.literal("save"),
    expectedRevision: z.number().int(),
    agent: z
      .object({
        agentId: z.string(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

export class DesktopHost {
  readonly directory: string;
  private readonly store: SettingsStore;
  constructor(directory?: string) {
    this.directory = stateDirectory(directory);
    this.store = new SettingsStore(this.directory);
  }
  call(method:string,params:Record<string,unknown>={}) { return this.handle({id:'host',method,params}); }
  async handle(input: unknown): Promise<unknown> {
    const request = schema.parse(input);
    const params = request.params;
    const environment = {
        platform: process.platform,
        home: homedir(),
        directory: this.directory,
        cwd: process.cwd(),
        node: process.version,
        desktopHostVersion: 1,
      };
    if (request.method === "environment") return environment;
    if (request.method === "discover")
      return { items: await discoverOpenCode() };
    if (request.method === "setInstanceModel") {
      const value = z.object({ agentId: z.string(), expectedRevision: z.number().int(),
        model: z.object({ providerID: z.string().min(1), id: z.string().min(1), variant: z.string().optional() }).strict().nullable() }).strict().parse(params);
      await ensureController(this.directory);
      return ipc(this.directory, { op: "save", expectedRevision: value.expectedRevision, agent: { agentId: value.agentId, model: value.model } });
    }
    if (request.method === "snapshot") {
      if (!this.store.exists())
        return {
          configured: false,
          directory: this.directory,
          agents: { items: [], revision: 0, connected: false },
          tasks: [],
          conversations: [],
          environment,
        };
      await ensureController(this.directory);
      const settings = this.store.read();
      let status = await ipc<{ connected: boolean; connectionState: string }>(
        this.directory,
        { op: "status" },
      );
      if (
        settings.agents.some((a) => a.enabled) &&
        status.connectionState === "stopped"
      ) {
        await ipc(this.directory, { op: "start" });
        status = await ipc(this.directory, { op: "status" });
      }
      const agents = await ipc<{ items: unknown[] }>(this.directory, {
        op: "agents",
      });
      const [tasks, conversations] = settings.agents.length
        ? await Promise.all([
            ipc<{ items: unknown[] }>(this.directory, { op: "tasks" }),
            ipc<{ items: unknown[] }>(this.directory, { op: "conversations" }),
          ])
        : [{ items: [] }, { items: [] }];
      return {
        configured: settings.agents.length > 0,
        directory: this.directory,
        status,
        agents,
        tasks: tasks.items,
        conversations: conversations.items,
        environment,
      };
    }
    if (request.method === "connect") {
      const chosen = z
        .object({
          executable: z.string(),
          workspace: z.string().min(1),
          name: z.string().min(1).max(100).default("OpenCode"),
          model: z.object({ providerID: z.string().min(1), id: z.string().min(1), variant: z.string().optional() }).strict().optional(),
          inheritNativeCli: z.literal(true).optional(),
        })
        .strict()
        .parse(params);
      const installed = await discoverOpenCode({ executable: chosen.executable });
      if (!installed.some((a) => a.executable === chosen.executable))
        throw new BridgeError(
          "DISCOVERY_CHANGED",
          "这个 OpenCode 已不可用，请重新扫描",
        );
      this.store.initialize();
      await ensureController(this.directory);
      const views = await ipc<{
        revision: number;
        items: { agentId: string; workspace: string }[];
      }>(this.directory, { op: "agents" });
      const agentId = "opencode-" + randomBytes(3).toString("hex");
      const port = await new Promise<number>((done, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          const n = typeof address === "object" && address ? address.port : 0;
          server.close((error) => (error ? reject(error) : done(n)));
        });
      });
      await ipc(this.directory, {
        op: "save",
        expectedRevision: views.revision,
        agent: {
          agentId,
          name: chosen.name,
          adapter: "opencode",
          executable: chosen.executable,
          workspace: chosen.workspace,
          serverUrl: "http://127.0.0.1:" + port,
          passwordFile: resolve(this.directory, agentId + ".password"),
          nativeAgent: "build",
          ...(chosen.model ? { model: chosen.model } : {}),
          ...(chosen.inheritNativeCli ? {inheritNativeCli:true} : {}),
          managed: true,
          enabled: true,
          permissions: [{ action: "edit", resource: "*", effect: "ask" }],
        },
      });
      await ipc(this.directory, { op: "start" });
      const ready = await ipc<{items: {agentId: string; startupError?: {code: string; message: string}}[]}>(this.directory, {op:'agents'});
      const startupError = ready.items.find(a => a.agentId === agentId)?.startupError;
      if (startupError) throw new BridgeError(startupError.code, startupError.message);
      const check = await ipc<{code?: string; message?: string; connection: string}>(this.directory, { op: "check", agentId });
      if (check.connection !== 'connected') throw new BridgeError(check.code || 'AGENT_UNHEALTHY', check.message || 'OpenCode 原生 API 尚未就绪，需求未派发。');
      return { agentId, check };
    }
    if (request.method === "ipc") {
      if (params.op === "save")
        return ipc(this.directory, presentation.parse(params));
      if (typeof params.op !== "string" || !allowed.has(params.op))
        throw new BridgeError("DESKTOP_METHOD", "此操作不能从桌面端执行");
      if (!this.store.exists())
        throw new BridgeError("NOT_CONFIGURED", "请先发现并连接 OpenCode");
      await ensureController(this.directory);
      return ipc(this.directory, params as IpcRequest);
    }
    throw new BridgeError("DESKTOP_METHOD", "不支持的桌面操作");
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const legacy = new DesktopHost(process.argv[2]);
  const require = createRequire(import.meta.url);
  const { MachineHost } = require('../desktop/electron/machine-host.cjs');
  const bridgeCalls=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>();
  const collaboration=(scope:unknown,name:string,args:unknown,callId:string)=>new Promise((resolve,reject)=>{
    const id='mcp-'+randomBytes(12).toString('hex');
    const timer=setTimeout(()=>{bridgeCalls.delete(id);reject(new BridgeError('COLLABORATION_TIMEOUT','协作回应未知，请核对原请求。'));},60000);
    bridgeCalls.set(id,{resolve,reject,timer});process.stdout.write(JSON.stringify({id,bridgeTool:true,scope,name,args,callId})+'\n');
  });
  const host = process.argv.includes('--opencode-only') ? legacy : new MachineHost({directory:legacy.directory,legacy,collaboration,openCode:(directory:string)=>{
    const leaf=new DesktopHost(directory);return {call:(method:string,params:Record<string,unknown>)=>leaf.handle({id:'context',method,params})};
  }});
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on("line", (line) => {
    void (async () => {
      let id: unknown;
      try {
        if (Buffer.byteLength(line) > 1048576)
          throw new BridgeError("DESKTOP_LIMIT", "桌面请求过长");
        const input = JSON.parse(line) as { id?: unknown; method?:string; params?:Record<string,unknown>;bridgeReply?:string;result?:unknown;error?:{code:string;message:string} };
        if(input.bridgeReply){const pending=bridgeCalls.get(input.bridgeReply);if(pending){bridgeCalls.delete(input.bridgeReply);clearTimeout(pending.timer);if(input.error)pending.reject(new BridgeError(input.error.code,input.error.message));else pending.resolve(input.result);}return;}
        id = input.id;
        const result = host === legacy ? await legacy.handle(input) : await host.call(input.method, (input as {params?:Record<string,unknown>}).params || {});
        process.stdout.write(JSON.stringify({ id, result }) + "\n");
      } catch (error) {
        const e =
          error instanceof BridgeError
            ? error
            : error instanceof Error && 'code' in error && typeof error.code === 'string' && /^[A-Z_]{2,40}$/.test(error.code)
              ? new BridgeError(error.code, error.message)
            : new BridgeError(
                "DESKTOP_REQUEST",
                "请求格式不正确或本机服务不可用",
              );
        process.stdout.write(
          JSON.stringify({
            id,
            error: { code: e.code, message: safeTerminal(e.message) },
          }) + "\n",
        );
      }
    })();
  });
}
