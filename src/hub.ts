import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { type HubConfig } from './config.js';
import { BridgeError, idSchema, terminal, type Agent, type Task, type Conversation } from './core.js';
import { envelope, wireSchema, interactionSchema, type WireMessage, type Interaction } from './protocol.js';
import { bearer, matchesToken, redactor } from './security.js';
import { HubStore } from './storage/hub-store.js';

const submissionSchema = z.object({ targetAgent: idSchema, requestId: idSchema, message: z.string(), verification: z.boolean().optional(), conversationId: idSchema.optional() }).strict();
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const raw of req) {
    const chunk = Buffer.from(raw); size += chunk.length;
    if (size > 524288) throw new BridgeError('BODY_LIMIT', 'HTTP body exceeds limit', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new BridgeError('INVALID_INPUT', 'Request must be UTF-8 JSON'); }
}
type User = HubConfig['users'][number];
interface Connection { ws: WebSocket; registered: Set<string>; lastSeen: number; ready: boolean; device?: string }
export interface HubHandle { port: number; store: HubStore; close(): Promise<void> }
export async function startHub(config: HubConfig, log: (message: string) => void = console.error): Promise<HubHandle> {
  const safe = redactor([...config.users, ...config.connectors].map(p => p.token));
  const store = new HubStore(config.dataDir, config.maxEventBytes, config.maxEventsPerTask);
  function conversationView(conversation: Conversation) {
    const last = conversation.lastTaskId ? store.get(conversation.lastTaskId) : undefined;
    const agent = store.agent(conversation.targetAgent);
    const canContinue = !!conversation.native && !!last && terminal(last.status) && !last.verification
      && conversation.turns < 1001 && !!conversation.configFingerprint
      && conversation.configFingerprint === agent?.configFingerprint && conversation.resourceKey === agent?.resourceKey;
    return { ...conversation, canContinue, kind: last?.verification ? 'verification' : 'task' };
  }

  try { store.recover(); } catch { store.close(); throw new BridgeError('STORAGE_UNAVAILABLE', 'Cannot recover Hub storage', 503); }
  const connections = new Map<string, Connection>();
  const interactions = new Map<string, { connectorId: string; resolve(data: unknown): void; reject(error: Error): void }>();
  let closing = false;
  let storageFailed = false;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1048576, perMessageDeflate: false });
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(safe(JSON.stringify(data)));
  };
  const failure = (error: unknown): BridgeError => {
    if (error instanceof BridgeError) return error;
    storageFailed = true;
    log('STORAGE_UNAVAILABLE: Hub stopped accepting writes');
    return new BridgeError('STORAGE_UNAVAILABLE', 'Hub storage operation failed', 503);
  };
  const disconnect = (connectorId: string, connection: Connection, reason: string) => {
    if (connections.get(connectorId) !== connection) return;
    connections.delete(connectorId);
    try { store.disconnect(connectorId, reason); } catch (e) { failure(e); }
  };
  const send = (ws: WebSocket, message: WireMessage) => {
    if (ws.readyState !== WebSocket.OPEN) throw new BridgeError('EDGE_DISCONNECTED', 'Edge connection is unavailable', 409);
    ws.send(JSON.stringify(message), error => {
      if (error) log('TRANSPORT_ERROR: WebSocket send failed');
    });
  };
  const taskView = (task: Task, user: User, includeEvents: boolean) => {
    return { ...task, ...(includeEvents && user.diagnostics ? { events: store.events(task.taskId) } : {}) };
  };
  const authorize = (req: IncomingMessage): User => {
    const credential = bearer(req.headers.authorization);
    const user = config.users.find(u => matchesToken(credential, u.token));
    if (!user) throw new BridgeError('UNAUTHORIZED', 'Valid user credential required', 401);
    return user;
  };
  const control = async (task: Task, input: Interaction): Promise<unknown> => {
    const agent = store.agent(task.targetAgent);
    const conn = agent ? connections.get(agent.connectorId) : undefined;
    if (!conn?.ready || conn.ws.readyState !== WebSocket.OPEN) throw new BridgeError('AGENT_OFFLINE', 'Agent is offline', 409);
    const message: Extract<WireMessage, { type: 'interaction.request' }> = { ...envelope(), type: 'interaction.request', payload: input };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { interactions.delete(message.messageId); reject(new BridgeError('OPERATION_UNKNOWN', '回复结果未知，请查询原操作；不能自动重试', 503)); }, 20000);
      interactions.set(message.messageId, { connectorId: agent!.connectorId, resolve(data) { clearTimeout(timer); interactions.delete(message.messageId); resolve(data); },
        reject(error) { clearTimeout(timer); interactions.delete(message.messageId); reject(error); } });
      try { send(conn.ws, message); } catch (e) { clearTimeout(timer); interactions.delete(message.messageId); reject(e); }
    });
  };
  const server = createServer((req, res) => { void (async () => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res, storageFailed ? 503 : 200, { ready: !storageFailed });
      const user = authorize(req);
      if (storageFailed) throw new BridgeError('STORAGE_UNAVAILABLE', 'Hub storage is unavailable', 503);
      if (req.method === 'GET' && url.pathname === '/v1/agents') {
        const items = store.agents().filter(a => user.allowedAgents.includes(a.agentId)).map(agent => {
          const conn = connections.get(agent.connectorId);
          const online = !!conn?.ready && conn.registered.has(agent.agentId) && Date.now() - conn.lastSeen <= config.heartbeatTimeoutMs;
          const task = store.occupied(agent.agentId, agent.resourceKey);
          return {
            ...agent, online, busy: !!task, available: agent.enabled !== false && online && agent.healthy && !task,
            ...(task ? { currentTask: task.owner === user.id ? {
              taskId: task.taskId, status: task.status, summary: task.lastSummary, uncertaintyReason: task.uncertaintyReason,
            } : { status: 'private', summary: 'Occupied by another user' } } : {}),
          };
        });
        return json(res, 200, { items, scope: 'Registered AgentBridge agents' });
      }
      if (req.method === 'GET' && url.pathname === '/v1/conversations') return json(res, 200, { items: store.conversations(user.id).map(conversationView) });
      const conversationMatch = /^\/v1\/conversations\/([a-zA-Z0-9_.:-]+)$/.exec(url.pathname);
      if (req.method === 'GET' && conversationMatch) {
        const conversation = store.conversation(conversationMatch[1]!);
        if (!conversation || conversation.owner !== user.id) throw new BridgeError('NOT_FOUND', '会话不存在', 404);
        return json(res, 200, { ...conversationView(conversation), items: store.turns(conversation.conversationId, user.id) });
      }
      const controlMatch = /^\/v1\/tasks\/([a-zA-Z0-9_.:-]+)\/(cancel|reconcile)$/.exec(url.pathname);
      if (req.method === 'POST' && controlMatch) {
        const task = store.get(controlMatch[1]!);
        if (!task || task.owner !== user.id) throw new BridgeError('NOT_FOUND', '任务不存在', 404);
        if (!user.allowedAgents.includes(task.targetAgent)) throw new BridgeError('FORBIDDEN', '无权控制此连接', 403);
        const parsed = interactionSchema.safeParse(await readBody(req));
        if (!parsed.success || parsed.data.action !== controlMatch[2] || parsed.data.taskId !== task.taskId || parsed.data.executionId !== task.executionId || parsed.data.requestId || parsed.data.answer || parsed.data.decision) throw new BridgeError('INVALID_INPUT', '控制身份或字段不匹配');
        const input = parsed.data;
        if (input.action === 'reconcile') {
          store.noteReconciliation(task.taskId, 'checking', '正在只读核对原会话');
          try {
            const receipt = await control(task, input) as { state: string; reason: string };
            store.noteReconciliation(task.taskId, receipt.state, receipt.reason); return json(res, 200, receipt);
          } catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('RECOVERY_UNKNOWN', '无法确认原执行', 503);
            store.noteReconciliation(task.taskId, 'unknown', error.message); throw error; }
        }
        if (store.operations.get(input.operationId)) return json(res, 200, store.operations.claim(input).operation);
        if (!task.native || !['running', 'unknown'].includes(task.status)) throw new BridgeError('STALE_TASK', '此轮已结束或尚未绑定原生输入', 409);
        const claim = store.operations.claim(input); if (!claim.fresh) return json(res, 200, claim.operation);
        try {
          const receipt = await control(task, input) as { state: 'confirmed' | 'unknown'; operationId: string; data?: unknown };
          if (!receipt?.state || receipt.operationId !== input.operationId) throw new BridgeError('INVALID_RECEIPT', '取消收据无效', 503);
          return json(res, 200, store.operations.finish(input.operationId, receipt.state, receipt.data));
        } catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('OPERATION_UNKNOWN', '取消结果待核对', 503);
          return json(res, 200, store.operations.finish(input.operationId, error.httpStatus < 500 ? 'rejected' : 'unknown', { code: error.code, message: error.message })); }
      }
      if (req.method === 'GET' && url.pathname === '/v1/tasks') {
        const cursor = Number(url.searchParams.get('cursor') || '0');
        const limit = Number(url.searchParams.get('limit') || '100');
        if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new BridgeError('INVALID_PAGE', 'Invalid pagination parameters');
        return json(res, 200, store.list(user.id, cursor, limit));
      }
      const requestMatch = /^\/v1\/requests\/([a-zA-Z0-9_.:-]+)$/.exec(url.pathname);
      if (req.method === 'GET' && requestMatch) {
        const task = store.byRequest(user.id, requestMatch[1]!);
        if (!task) throw new BridgeError('NOT_FOUND', 'Request not found', 404);
        return json(res, 200, taskView(task, user, true));
      }
      const interactionMatch = /^\/v1\/tasks\/([a-zA-Z0-9_.:-]+)\/(pending|reply|operations\/([a-zA-Z0-9_.:-]+))$/.exec(url.pathname);
      if (interactionMatch) {
        const task = store.get(interactionMatch[1]!);
        if (!task || task.owner !== user.id) throw new BridgeError('NOT_FOUND', 'Task not found', 404);
        if (!user.allowedAgents.includes(task.targetAgent)) throw new BridgeError('FORBIDDEN', 'Agent interaction is not allowed', 403);
        if (req.method === 'GET' && interactionMatch[3]) {
          if (!store.operations.belongs(interactionMatch[3], task.executionId)) throw new BridgeError('NOT_FOUND', 'Operation not found', 404);
          return json(res, 200, store.operations.get(interactionMatch[3]));
        }
        let replyInput: Interaction | undefined;
        if (req.method === 'POST' && interactionMatch[2] === 'reply') {
          const parsed = interactionSchema.safeParse(await readBody(req));
          if (!parsed.success || !['permission', 'form'].includes(parsed.data.action) || parsed.data.taskId !== task.taskId || parsed.data.executionId !== task.executionId || !parsed.data.requestId) throw new BridgeError('INVALID_INPUT', 'Invalid reply identity or fields');
          replyInput = parsed.data;
          if (store.operations.get(replyInput.operationId)) return json(res, 200, store.operations.claim(replyInput).operation);
        }
        if (!task.native || !['running', 'unknown'].includes(task.status)) throw new BridgeError('STALE_TASK', 'Task is not active with a native binding', 409);
        if (req.method === 'GET' && interactionMatch[2] === 'pending') return json(res, 200, await control(task, {
          taskId: task.taskId, executionId: task.executionId, operationId: envelope().messageId, action: 'pending',
        }));
        if (req.method === 'POST' && interactionMatch[2] === 'reply') {
          const input = replyInput!;
          const claim = store.operations.claim(input);
          if (!claim.fresh) return json(res, 200, claim.operation);
          try {
            const receipt = await control(task, input) as { state?: 'confirmed' | 'unknown'; operationId?: string };
            if (!receipt?.state || receipt.operationId !== input.operationId) throw new BridgeError('INVALID_RECEIPT', 'Edge reply receipt invalid', 503);
            return json(res, 200, store.operations.finish(input.operationId, receipt.state));
          } catch (e) {
            const error = e instanceof BridgeError ? e : new BridgeError('OPERATION_UNKNOWN', 'Reply outcome unknown', 503);
            return json(res, 200, store.operations.finish(input.operationId, error.httpStatus < 500 ? 'rejected' : 'unknown', { code: error.code, message: error.message }));
          }
        }
      }
      const taskMatch = /^\/v1\/tasks\/([a-zA-Z0-9_.:-]+)$/.exec(url.pathname);
      if (req.method === 'GET' && taskMatch) {
        const task = store.get(taskMatch[1]!);
        if (!task || task.owner !== user.id) throw new BridgeError('NOT_FOUND', 'Task not found', 404);
        if (url.searchParams.get('diagnostics') === 'true' && !user.diagnostics) throw new BridgeError('FORBIDDEN', 'Diagnostic access is not allowed', 403);
        return json(res, 200, taskView(task, user, true));
      }
      if (req.method === 'POST' && url.pathname === '/v1/tasks') {
        let length = 0;
        const chunks: Buffer[] = [];
        try {
          for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            length += buffer.length;
            if (length > 524288) throw new BridgeError('BODY_LIMIT', 'HTTP request body exceeds limit', 413);
            chunks.push(buffer);
          }
        } catch (e) {
          if (e instanceof BridgeError) throw e;
          throw new BridgeError('INPUT_INTERRUPTED', 'Request body was interrupted');
        }
        let raw: unknown;
        try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
        catch { throw new BridgeError('INVALID_INPUT', 'Request must be UTF-8 JSON'); }
        const parsed = submissionSchema.safeParse(raw);
        if (!parsed.success) throw new BridgeError('INVALID_INPUT', 'Invalid task fields');
        const { requestId, targetAgent, message, verification, conversationId } = parsed.data;
        if (!message.trim() || Buffer.byteLength(message) > config.maxMessageBytes) throw new BridgeError('INVALID_MESSAGE', 'Message is empty or exceeds configured UTF-8 byte limit');
        if (!user.allowedAgents.includes(targetAgent)) throw new BridgeError('FORBIDDEN', 'Agent invocation is not allowed', 403);
        const existing = store.byRequest(user.id, requestId);
        if (existing) {
          if (existing.targetAgent !== targetAgent || existing.message !== message || !!existing.verification !== !!verification || conversationId && existing.conversationId !== conversationId) throw new BridgeError('IDEMPOTENCY_CONFLICT', 'requestId is already bound to different input', 409);
          return json(res, 200, taskView(existing, user, false));
        }
        const agent = store.agent(targetAgent);
        if (!agent) throw new BridgeError('AGENT_NOT_FOUND', 'Agent not found', 404);
        if (agent.enabled === false) throw new BridgeError('AGENT_DISABLED', 'Agent is disabled', 409);
        const conn = connections.get(agent.connectorId);
        if (!conn?.ready || !conn.registered.has(targetAgent) || Date.now() - conn.lastSeen > config.heartbeatTimeoutMs || conn.ws.readyState !== WebSocket.OPEN) throw new BridgeError('AGENT_OFFLINE', 'Agent is offline', 409);
        if (!agent.healthy) throw new BridgeError('AGENT_UNHEALTHY', 'Agent is unhealthy', 409);
        const task = store.create(user.id, requestId, targetAgent, message, verification, conversationId);
        store.attempted(task.taskId);
        try {
          send(conn.ws, { ...envelope(), type: 'task.submit', payload: {
            taskId: task.taskId, executionId: task.executionId, conversationId: task.conversationId, targetAgent, message, ...(task.resumeNative ? { resumeNative: task.resumeNative } : {}), ...(verification ? { verification } : {}),
            ...(task.configFingerprint ? { configFingerprint: task.configFingerprint } : {}), ...(task.configRevision ? { configRevision: task.configRevision } : {}),
          } });
        } catch {
          store.unknown(task.taskId, 'Dispatch was attempted but could not be confirmed');
        }
        return json(res, 202, taskView(store.get(task.taskId)!, user, false));
      }
      throw new BridgeError('NOT_FOUND', 'Route not found', 404);
    } catch (e) {
      const error = failure(e);
      if (!res.headersSent) json(res, error.httpStatus, { error: { code: error.code, message: error.message } });
      else res.end();
    }
  })(); });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    const credential = bearer(req.headers.authorization);
    const connector = config.connectors.find(c => c.id === req.headers['x-connector-id'] && matchesToken(credential, c.token));
    if (url !== '/v1/connectors/ws' || !connector || storageFailed || closing) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return;
    }
    if (connections.has(connector.id)) {
      socket.end('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const connection: Connection = { ws, registered: new Set(), lastSeen: Date.now(), ready: false };
      connections.set(connector.id, connection);
      const handshake = setTimeout(() => { if (!connection.ready) ws.terminate(); }, config.handshakeTimeoutMs);
      ws.on('error', () => { log('TRANSPORT_ERROR: Connector socket error'); });
      ws.on('close', () => {
        clearTimeout(handshake);
        disconnect(connector.id, connection, 'Connector disconnected before terminal confirmation');
      });
      ws.on('message', (buffer, binary) => {
        let message: WireMessage | undefined;
        try {
          if (storageFailed || closing) throw new BridgeError('STORAGE_UNAVAILABLE', 'Hub cannot accept events', 503);
          if (binary) throw new BridgeError('INVALID_PROTOCOL', 'Only UTF-8 JSON frames are supported');
          let raw: unknown;
          try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer as Buffer)); }
          catch { throw new BridgeError('INVALID_PROTOCOL', 'Invalid JSON frame'); }
          const result = wireSchema.safeParse(raw);
          if (!result.success) throw new BridgeError('INVALID_PROTOCOL', 'Invalid protocol version or fields');
          message = result.data;
          if (message.type === 'agent.register') {
            if (connection.ready) throw new BridgeError('ALREADY_REGISTERED', 'Register only once per connection', 409);
            const ids = message.payload.agents.map(a => a.agentId);
            if (new Set(ids).size !== ids.length || ids.some(id => !connector.allowedAgents.includes(id))) throw new BridgeError('FORBIDDEN', 'Agent registration is not allowed', 403);
            const device = message.payload.device;
            connection.device = device;
            const agents: Agent[] = message.payload.agents.map(a => ({
              ...a, device, connectorId: connector.id, lastSeenAt: new Date().toISOString(),
              capabilities: { concurrency: 1, progress: true, cancel: a.adapter === 'opencode', nativeSessions: a.adapter === 'opencode' },
            }));
            store.register(agents);
            connection.registered = new Set(ids); connection.ready = true; connection.lastSeen = Date.now();
            clearTimeout(handshake);
          } else {
            if (!connection.ready) throw new BridgeError('NOT_REGISTERED', 'Register Agents before sending events');
            if (message.type === 'interaction.result') {
              const waiter = interactions.get(message.correlationId);
              // Responses must come from the connection to which the request was sent.
              if (waiter?.connectorId === connector.id) {
                const error = message.payload.error;
                if (error) waiter.reject(new BridgeError(error.code, error.message, error.status));
                else waiter.resolve(message.payload.data);
              }
            } else if (message.type === 'agent.update') {
              const ids = message.payload.agents.map(a => a.agentId);
              if (new Set(ids).size !== ids.length || ids.some(id => !connector.allowedAgents.includes(id))) throw new BridgeError('FORBIDDEN', 'Agent update is not allowed', 403);
              store.register(message.payload.agents.map(a => ({ ...a, device: connection.device!,
                connectorId: connector.id, lastSeenAt: new Date().toISOString(), capabilities: { concurrency: 1, progress: true, cancel: a.adapter === 'opencode', nativeSessions: a.adapter === 'opencode' } })));
              connection.registered = new Set(ids);
            } else if (message.type === 'agent.heartbeat') {
              const ids = message.payload.agents.map(a => a.agentId);
              if (new Set(ids).size !== ids.length || ids.some(id => !connection.registered.has(id))) throw new BridgeError('FORBIDDEN', 'Heartbeat contains an unauthorized Agent', 403);
              const updates = message.payload.agents.map(a => ({ ...store.agent(a.agentId)!, ...a, lastSeenAt: new Date().toISOString() }));
              store.register(updates); connection.lastSeen = Date.now();
            } else if (message.type === 'task.event') {
              const task = store.get(message.taskId);
              if (!task || !connection.registered.has(task.targetAgent) || store.agent(task.targetAgent)?.connectorId !== connector.id || task.executionId !== message.executionId) throw new BridgeError('FORBIDDEN', 'Execution event is not allowed', 403);
              store.acceptEvent(message.taskId, message.executionId, message.payload.seq, message.payload.event);
            } else if (message.type === 'message.ack') {
              return; // Transport receipt never changes Task state.
            } else throw new BridgeError('INVALID_DIRECTION', 'Message direction is not allowed');
          }
          send(ws, { ...envelope(), type: 'message.ack', payload: { ackedMessageId: message.messageId } });
        } catch (e) {
          const error = failure(e);
          try { send(ws, { ...envelope(), type: 'protocol.error', payload: {
            code: error.code, message: safe(error.message), ...(message ? { correlationId: message.messageId } : {}),
          } }); } catch { ws.terminate(); }
          if (storageFailed) ws.terminate();
        }
      });
    });
  });
  const heartbeat = setInterval(() => {
    for (const [id, conn] of connections) if (Date.now() - conn.lastSeen > config.heartbeatTimeoutMs) {
      disconnect(id, conn, 'Connector heartbeat expired before terminal confirmation');
      conn.ws.terminate();
    }
  }, Math.min(500, config.heartbeatTimeoutMs / 2));
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => { server.removeListener('error', reject); resolve(); });
    });
  } catch { clearInterval(heartbeat); wss.close(); store.close(); throw new BridgeError('LISTEN_FAILED', 'Hub listen address is unavailable', 503); }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unexpected server address');
  log(safe('Hub ready pid=' + process.pid + ' http://' + config.host + ':' + address.port));
  return {
    port: address.port, store,
    async close() {
      if (closing) return;
      closing = true; clearInterval(heartbeat);
      for (const waiter of interactions.values()) waiter.reject(new BridgeError('OPERATION_UNKNOWN', 'Hub stopped before reply confirmation', 503));
      interactions.clear();
      for (const [id, conn] of connections) {
        disconnect(id, conn, 'Hub stopped before terminal confirmation'); conn.ws.terminate();
      }
      await new Promise<void>(resolve => server.close(() => resolve()));
      wss.close(); store.close();
    },
  };
}
