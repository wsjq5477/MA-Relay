import assert from 'node:assert/strict';
import { createServer } from 'node:http';
// Contract fixture follows OpenCode 2.0.24 /openapi.json. It is NOT real-agent acceptance.
export async function fixture(workspace: string) {
  const password = 'native-fixture-private-password';
  const sessions = new Map<string, { id: string; model: unknown; prompt?: { id: string; text: string }; permitted: boolean; denied: boolean; form: boolean; polls: number }>();
  let modelId = 'fixture';
  let replyLost = false; let replies = 0; let submissions = 0; let broken = false; let modelAvailable = true; let authFailures = 0; let coldChecks = 0;
  const server = createServer((req, res) => { void (async () => {
    const send = (status: number, data?: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(data === undefined ? undefined : JSON.stringify(data)); };
    if (req.headers.authorization !== 'Basic ' + Buffer.from('opencode:' + password).toString('base64')) { authFailures++; send(401, { _tag: 'UnauthorizedError' }); return; }
    const url = new URL(req.url!, 'http://127.0.0.1');
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') { const chunks: Buffer[] = []; for await (const c of req) chunks.push(c); body = JSON.parse(Buffer.concat(chunks).toString()); }
    if (url.pathname === '/api/info') return send(200, { version: '2.0.24' });
    if (url.pathname === '/api/agent') return send(200, { data: [{ id: 'build', name: 'build' }] });
    if (url.pathname === '/api/model/default' || url.pathname === '/api/model') {
      if (url.searchParams.get('location[directory]') !== workspace) return send(400, { _tag: 'InvalidRequestError' });
      const model = { id: modelId, providerID: 'offline' };
      const ready = modelAvailable && coldChecks === 0;
      if (coldChecks > 0) coldChecks--;
      return send(200, { data: url.pathname.endsWith('/default') ? (ready ? model : null) : ready ? [model] : [] });
    }
    if (url.pathname === '/api/session' && req.method === 'POST') {
      assert.deepEqual(body.location, { directory: workspace });
      const id = body.id as string; sessions.set(id, { id, model: body.model || { id: modelId, providerID: 'offline' }, permitted: String(JSON.stringify(body.permissions)).includes('deny'), denied: String(JSON.stringify(body.permissions)).includes('deny'), form: false, polls: 0 });
      return send(200, { data: { id, location: { directory: workspace } } });
    }
    const match = /^\/api\/session\/([^/]+)(.*)$/.exec(url.pathname);
    const s = match ? sessions.get(match[1]!) : undefined;
    if (!s) return send(404, { _tag: 'SessionNotFoundError' });
    const path = match![2]!;
    if (path === '/prompt') {
      submissions++; s.form = String(body.text).includes('form'); s.prompt = { id: body.id as string, text: body.text as string };
      if (s.prompt.text === 'explicit rejection') return send(400, { _tag: 'InvalidRequestError' });
      if (s.prompt.text === 'ambiguous response') { req.socket.destroy(); return; }
      return send(200, { data: { id: s.prompt.id, sessionID: s.id } });
    }
    if (broken) { req.socket.destroy(); return; }
    const finished = !!s.prompt && s.permitted && s.polls >= 2;
    if (!path) return send(200, { data: { id: s.id, model: s.model, location: { directory: workspace }, ...(finished ? { outcome: s.prompt!.text === 'native failure' ? 'failed' : 'succeeded' } : {}) } });
    if (path === '/message') {
      s.polls++;
      const data: unknown[] = s.prompt ? [{ id: s.prompt.id, type: 'user', text: s.prompt.text }] : [];
      if (s.prompt) data.push({ id: 'msg_answer_' + s.id, type: 'assistant',
        ...(s.prompt.text === 'native failure' ? { error: { message: 'fixture model failed' } } : {}),
        content: [...(s.denied ? [] : [{ type: 'tool', id: 'tool_1', name: 'bash', state: { status: s.permitted ? 'completed' : 'running', input: { command: 'npm test' }, ...(s.permitted ? { content: [{ type: 'text', text: 'passed 1 test' }] } : {}) } }]),
          ...(s.permitted ? [{ type: 'text', text: s.prompt.text === 'long answer' ? '中文'.repeat(30000) : s.denied ? s.prompt.text.match(/AB_VERIFY_[a-f0-9]+/)?.[0] || 'denied answer' : 'Real-shaped fixture answer: ' + s.prompt.text }] : [])] });
      if (finished) data.push({ id: 'msg_idle_' + s.id, type: 'idle', outcome: s.prompt!.text === 'native failure' ? 'failed' : 'succeeded' });
      // Exercise pagination: the idle marker can live on the next page.
      if (finished && !url.searchParams.has('cursor')) return send(200, { data: data.slice(0, -1), cursor: { next: 'idle-page' } });
      return send(200, { data: url.searchParams.has('cursor') ? data.slice(-1) : data, cursor: { next: null } });
    }
    if (path === '/permission') return send(200, { data: s.prompt && !s.permitted && !s.form ? [{ id: 'per_fixture', sessionID: s.id, action: 'bash', resources: ['npm test'] }] : [] });
    if (path === '/form') return send(200, { data: s.form && !s.permitted ? [{ id: 'frm_fixture', sessionID: s.id, title: 'Text form', fields: [{ key: 'reply', type: 'string', title: 'Your reply', required: true }] }] : [] });
    if (path === '/form/frm_fixture/reply') { replies++; assert.equal((body.answer as { reply: string }).reply, 'hello'); s.permitted = true; return send(204); }
    if (path === '/permission/per_fixture/reply') { assert(['once', 'reject'].includes(String(body.decision))); replies++; s.permitted = true; if (replyLost) { replyLost = false; req.socket.destroy(); return; } return send(204); }
    send(404, { _tag: 'NotFound' });
  })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  return { url, password, sessions, count: () => submissions, replyCount: () => replies, authFailures: () => authFailures,
    break: () => { broken = true; }, noModel: () => { modelAvailable = false; },
    loseReply: () => { replyLost = true; },
    setModel: (id: string) => { modelId = id; },
    cold: () => { coldChecks = 2; },
    close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); } };
}
