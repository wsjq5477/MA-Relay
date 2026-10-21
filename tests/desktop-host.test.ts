import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { DesktopHost } from "../src/desktop-host.js";
import { SettingsStore } from "../src/settings.js";
import { ipc } from "../src/controller.js";
import { terminal, type Task } from "../src/core.js";
import { continuousFixture } from "./i03b-fixture.js";

test("desktop: first snapshot is passive; the host rejects arbitrary control and executable changes", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "ab-desktop-passive-"));
  const host = new DesktopHost(dir);
  const request = (method: string, params = {}) =>
    host.handle({ id: randomUUID(), method, params });
  try {
    const snapshot = (await request("snapshot")) as {
      configured: boolean;
      tasks: unknown[];
    };
    assert.equal(snapshot.configured, false);
    assert.equal(snapshot.tasks.length, 0);
    assert.equal(readdirSync(dir).length, 0);
    await assert.rejects(() => request("ipc", { op: "stop" }), /不能从桌面端/);
    await assert.rejects(() =>
      request("ipc", {
        op: "save",
        expectedRevision: 1,
        agent: { agentId: "x", executable: "/bad" },
      }),
    );
    await assert.rejects(() => request("shell", { command: "irrelevant" }));
    assert.equal(readdirSync(dir).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("desktop: UI host and CLI share conversations, request dedupe, permission cancellation and history", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "ab-desktop-host-"));
  const dir = resolve(root, "bridge");
  const native = await continuousFixture(root);
  const store = new SettingsStore(dir);
  const base = store.initialize();
  const secret = resolve(dir, "test.password");
  writeFileSync(secret, native.password, { mode: 0o600 });
  const agent = store.normalize(
    {
      adapter: "opencode",
      agentId: "desktop",
      name: "Desktop test",
      workspace: root,
      serverUrl: native.url,
      passwordFile: secret,
      managed: false,
      enabled: true,
      pollMs: 50,
    },
    base.deviceId,
  );
  store.write(
    {
      ...base,
      revision: base.revision + 1,
      agents: [agent],
      defaultAgent: agent.agentId,
    },
    base.revision,
  );
  const host = new DesktopHost(dir);
  const request = <T>(op: string, params = {}) =>
    host.handle({
      id: randomUUID(),
      method: "ipc",
      params: { op, ...params },
    }) as Promise<T>;
  async function until(check: () => Promise<Task>) {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      const t = await check();
      if (terminal(t.status)) return t;
      await delay(25);
    }
    throw new Error("Desktop task evidence timeout");
  }
  try {
    const snapshot = (await host.handle({
      id: randomUUID(),
      method: "snapshot",
    })) as {
      configured: boolean;
      agents: { items: { online: boolean; healthy: boolean }[] };
    };
    assert(snapshot.configured);
    assert(snapshot.agents.items[0]!.online);
    assert(snapshot.agents.items[0]!.healthy);
    assert.equal(native.counters().prompts, 0);
    const requestId = randomUUID();
    const body = {
      agentId: agent.agentId,
      message: "finish desktop first",
      requestId,
    };
    const first = await request<Task>("submit", body);
    const duplicate = await request<Task>("submit", body);
    assert.equal(duplicate.taskId, first.taskId);
    const done = await until(() =>
      request<Task>("task", { taskId: first.taskId }),
    );
    const ready = await request<{canContinue: boolean}>("conversation", {conversationId: done.conversationId});
    assert.equal(ready.canContinue, true, "Completed OpenCode conversation exposes continuation capability to the UI");
    const summaries = await request<{items: {conversationId: string; canContinue: boolean}[]}>("conversations", {});
    assert.equal(summaries.items.find(c => c.conversationId === done.conversationId)?.canContinue, true);
    const next = await request<Task>("continue", {
      conversationId: done.conversationId,
      requestId: randomUUID(),
      message: "finish desktop second",
    });
    const second = await until(() =>
      request<Task>("task", { taskId: next.taskId }),
    );
    assert.equal(second.native!.sessionId, done.native!.sessionId);
    assert.equal(second.result!.message, "finish desktop second");
    const waiting = await request<Task>("submit", {
      agentId: agent.agentId,
      requestId: randomUUID(),
      message: "wait desktop permission",
    });
    let active: Task | undefined;
    for (let i = 0; i < 200; i++) {
      active = await request<Task>("task", { taskId: waiting.taskId });
      if (active.waiting) break;
      await delay(25);
    }
    assert(active?.waiting);
    host.close();
    host.close();
    const afterClose = await request<Task>('task', {taskId: waiting.taskId});
    assert.equal(afterClose.taskId, waiting.taskId);
    assert.equal(afterClose.status, active.status);
    assert.equal(afterClose.native?.sessionId, active.native?.sessionId);
    assert.equal(native.counters().prompts, 3, 'Closing the facade never resubmits or cancels native work');
    await assert.rejects(() => host.handle({ id: randomUUID(), method: "setInstanceModel", params: {
      agentId: agent.agentId, expectedRevision: store.read().revision, model: { providerID: "test", id: "other" },
    } }), /运行、等待或 unknown/);
    assert.equal(store.read().agents[0]!.model, undefined);
    const pending = await request<{ permissions: unknown[] }>("pending", {
      taskId: waiting.taskId,
    });
    assert.equal(pending.permissions.length, 1);
    assert.equal((await request<{canContinue: boolean}>("conversation", {conversationId: waiting.conversationId})).canContinue, false,
      "Waiting task cannot expose a new continuation");
    await request("cancel", {
      taskId: waiting.taskId,
      operationId: randomUUID(),
    });
    assert.equal(
      (await until(() => request<Task>("task", { taskId: waiting.taskId })))
        .status,
      "cancelled",
    );
    const cliTask = await ipc<Task>(dir, { op: "task", taskId: first.taskId });
    assert.equal(cliTask.result!.message, done.result!.message);
    const history = await request<{ items: Task[] }>("conversation", {
      conversationId: done.conversationId,
    });
    assert.equal(history.items.length, 2);
    assert.deepEqual(native.counters(), {
      prompts: 3,
      creates: 2,
      interrupts: 1,
      replies: 0,
    });
    const priorRevision = store.read().revision;
    await host.handle({ id: randomUUID(), method: "setInstanceModel", params: {
      agentId: agent.agentId, expectedRevision: priorRevision, model: { providerID: "test", id: "override" },
    } });
    assert.deepEqual(store.read().agents[0]!.model, { providerID: "test", id: "override" });
    await assert.rejects(() => host.handle({ id: randomUUID(), method: "setInstanceModel", params: {
      agentId: agent.agentId, expectedRevision: priorRevision, model: null,
    } }), { code: "REVISION_CONFLICT" });
    await host.handle({ id: randomUUID(), method: "setInstanceModel", params: {
      agentId: agent.agentId, expectedRevision: store.read().revision, model: null,
    } });
    assert.equal(store.read().agents[0]!.model, undefined);
    assert.equal((await request<{ items: Task[] }>("conversation", { conversationId: done.conversationId })).items.length, 2);
    assert.equal(native.counters().prompts, 3);
  } finally {
    try {
      await ipc(dir, { op: "stop" });
    } catch {
      /* Test startup may fail before the controller starts. */
    }
    for (let i = 0; i < 200; i++) {
      try {
        await ipc(dir, { op: "status" });
        await delay(20);
      } catch {
        break;
      }
    }
    await native.close();
    rmSync(root, { recursive: true, force: true });
  }
});
