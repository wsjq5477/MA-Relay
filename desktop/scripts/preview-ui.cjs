// Local design preview: production renderer, disposable controlled coordinator,
// synthetic task history. It cannot execute native Agent/model requests.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { graphFixture } = require("../tests/i06b-ui-fixture.cjs");

async function startPreview({ port = 4197, baseline } = {}) {
  const fixture = await graphFixture();
  const root = path.resolve(__dirname, "../dist");
  const nodes = fixture.nodes;
  const stamp = new Date().toISOString();
  const messages = [
    "梳理桌面端的信息结构和交互流程",
    "核对 Linux 后台的连接恢复",
    "为协作工作流补充验收记录",
    "检查构建结果与发布清单",
  ];
  const states = ["running", "unknown", "succeeded", "failed"];
  const tasks = nodes.length
    ? messages.map((message, index) => {
        const node = nodes[index % nodes.length];
        return {
          taskId: "preview-task-" + index,
          executionId: "preview-execution-" + index,
          conversationId: "preview-conversation-" + index,
          requestId: "preview-request-" + index,
          targetAgent: "preview-agent-" + index,
          nodeId: node.nodeId,
          machineId: node.machineId,
          workspace:
            node.adapter === "claude"
              ? "C:/Projects/AgentBridge"
              : "/home/demo/agentbridge",
          message,
          status: states[index],
          createdAt: stamp,
          updatedAt: stamp,
          turn: 1,
          lastSeq: 1,
          lastSummary:
            index === 0
              ? "正在整理页面和组件，已有检查结果会持续保存。"
              : index === 1
                ? "连接中断，等待沿原请求核对执行结果。"
                : "",
          ...(index === 2
            ? {
                result: {
                  message:
                    "已整理机器接入、任务执行与原请求恢复三个流程。\n\n验收记录包含每个场景的实际结果、证据来源和未测边界。后续可以从同一会话继续补充。",
                },
              }
            : {}),
          ...(index === 3
            ? {
                error: {
                  code: "PREVIEW_EXAMPLE",
                  message: "示例：构建检查失败，详细原因和原执行记录保留。",
                },
              }
            : {}),
          events: [
            {
              seq: 1,
              timestamp: stamp,
              event: {
                kind: "progress",
                text: "界面预览样例；未运行真实模型。",
              },
            },
          ],
        };
      })
    : [];
  const conversations = tasks.map((task) => ({
    conversationId: task.conversationId,
    targetAgent: task.targetAgent,
    machineId: task.machineId,
    nodeId: task.nodeId,
    title: task.message,
    workspace: task.workspace,
    turns: 1,
    updatedAt: stamp,
    canContinue: false,
    continuationReason: "这是隔离界面预览，不发送真实需求。",
    items: [task],
  }));
  let preferences = {
    theme: "light",
    platform: "win32",
    version: "0.6.0-alpha.28 · UI 预览",
    directory: "C:/AgentBridge/Preview",
    distribution: "",
  };
  function bootstrap() {
    const rpc = (method, params = {}) =>
      fetch("/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, params }),
      }).then((response) => response.json());
    window.agentbridge = {
      call: (method, params) => rpc(method, params),
      preferences: () =>
        rpc("preview.preferences").then((reply) => reply.result),
      savePreferences: (params) =>
        rpc("preview.savePreferences", params).then((reply) => reply.result),
      pending: async () => [],
      runtimes: async () => ({ platform: "win32", distributions: ["Ubuntu"] }),
      pickFolder: async () => null,
      window: async () => {},
    };
  }
  const server = http.createServer(async (req, res) => {
    if (req.url === "/preview-preload.js" && req.method === "GET") {
      res.setHeader("content-type", "text/javascript");
      res.setHeader("cache-control", "no-store");
      res.end(`(${bootstrap.toString()})()`);
      return;
    }
    if (req.url === "/rpc" && req.method === "POST") {
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1048576) throw Error("preview body limit");
        }
        const { method, params = {} } = JSON.parse(body);
        let reply;
        if (method === "preview.preferences")
          reply = { ok: true, result: preferences };
        else if (method === "preview.savePreferences") {
          preferences = {
            ...preferences,
            theme: ["light", "dark", "system"].includes(params.theme)
              ? params.theme
              : preferences.theme,
          };
          reply = { ok: true, result: preferences };
        } else if (
          method === "nodeRequest" ||
          (method === "ipc" && !["conversation", "task"].includes(params.op)) ||
          method === "team.execute" ||
          method === "team.configureAutomation"
        )
          reply = {
            ok: false,
            error: {
              code: "PREVIEW_ONLY",
              message: "这是隔离界面预览。请在桌面程序中发送真实需求。",
            },
          };
        else if (
          method === "ipc" &&
          params.op === "conversation" &&
          conversations.some(
            (item) => item.conversationId === params.conversationId,
          )
        )
          reply = {
            ok: true,
            result: conversations.find(
              (item) => item.conversationId === params.conversationId,
            ),
          };
        else if (
          method === "ipc" &&
          params.op === "task" &&
          tasks.some((item) => item.taskId === params.taskId)
        )
          reply = {
            ok: true,
            result: tasks.find((item) => item.taskId === params.taskId),
          };
        else {
          reply = await fixture.call(method, params);
          if (method === "snapshot" && reply.ok)
            reply.result = {
              ...reply.result,
              directory: "C:/AgentBridge/Preview",
              tasks,
              conversations,
            };
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(reply));
      } catch {
        res.writeHead(400).end("Invalid preview request");
      }
      return;
    }
    const url = new URL(req.url, "http://localhost");
    const before = baseline && url.pathname.startsWith("/__before/");
    const directory = before ? path.resolve(baseline) : root;
    const relative = decodeURIComponent(
      before ? url.pathname.slice("/__before/".length) : url.pathname.slice(1),
    );
    const file = path.resolve(directory, relative || "index.html");
    if (!file.startsWith(directory + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const content = fs.readFileSync(file);
      const html = file.endsWith(".html");
      res.setHeader("cache-control", "no-store");
      res.setHeader(
        "content-type",
        html
          ? "text/html; charset=utf-8"
          : file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "application/octet-stream",
      );
      res.end(
        html
          ? content
              .toString()
              .replace(
                "</head>",
                '<script src="/preview-preload.js"></script></head>',
              )
          : content,
      );
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    fixture,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      fixture.close();
    },
  };
}
module.exports = { startPreview };
if (require.main === module)
  startPreview({
    port: Number(process.env.AGENTBRIDGE_UI_PREVIEW_PORT || 4197),
    baseline: process.env.AGENTBRIDGE_UI_BASELINE,
  })
    .then((preview) => {
      console.log(
        "Isolated UI preview: " +
          preview.url +
          " (synthetic history; model calls disabled)",
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () => {
          void preview.close().then(() => process.exit());
        });
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
