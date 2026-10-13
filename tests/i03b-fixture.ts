import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { NativeMessage } from '../src/drivers/opencode-client.js';

// Controlled OpenCode 2.0.24-shaped service. Fault/ordering evidence only, never real-agent acceptance.
export interface Session { id: string; agent: string; model: unknown; permissions?: unknown; directory: string; messages: NativeMessage[]; active?: string; waiting: boolean }
export async function continuousFixture(workspace: string) {
  const sessions = new Map<string, Session>(); const password = 'i03b-fixture-private-password';
  let prompts = 0, creates = 0, interrupts = 0, replies = 0, broken = false, loseCancel = false, race = false;
  const finish = (id: string, outcome = 'succeeded', answer = 'answer for ' + sessions.get(id)?.active) => {
    const s = sessions.get(id)!; if (!s.active) return;
    if (outcome !== 'interrupted') s.messages.push({ id: 'answer_' + randomUUID(), type: 'assistant', content: [{ type: 'text', text: answer }], ...(outcome === 'failed' ? { error: { message: 'fixture failure' } } : {}) });
    s.messages.push({ id: 'idle_' + randomUUID(), type: 'idle', outcome }); s.active = undefined; s.waiting = false;
  };
  const server = createServer((req, res) => { void (async () => {
    const send = (data: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.headers.authorization !== 'Basic ' + Buffer.from('opencode:' + password).toString('base64')) return send({}, 401);
    const url = new URL(req.url!, 'http://localhost');
    let body: Record<string, unknown> = {}; if (req.method === 'POST') { const chunks: Buffer[] = []; for await (const c of req) chunks.push(c); body = JSON.parse(Buffer.concat(chunks).toString()); }
    if (broken) { req.socket.destroy(); return; }
    if (url.pathname === '/api/info') return send({ version: '2.0.24' });
    if (url.pathname === '/api/model/default') return send({ data: { id: 'fixture', providerID: 'offline' } });
    if (url.pathname === '/api/model') return send({ data: [{ id: 'fixture', providerID: 'offline' }] });
    if (url.pathname === '/api/agent') return send({ data: [{ id: 'build' }] });
    if (url.pathname === '/api/session' && req.method === 'POST') {
      creates++; const s: Session = { id: String(body.id), agent: String(body.agent), model: body.model, permissions: body.permissions, directory: (body.location as { directory: string }).directory, messages: [], waiting: false };
      sessions.set(s.id, s); return send({ data: { id: s.id, location: { directory: s.directory }, agent: s.agent, model: s.model, permissions: s.permissions } });
    }
    const match = /^\/api\/session\/([^/]+)(.*)$/.exec(url.pathname); const s = sessions.get(match?.[1] || ''); if (!s) return send({}, 404);
    const path = match![2];
    if (path === '/prompt') {
      if (s.active) return send({}, 409);
      prompts++; s.active = String(body.id); s.messages.push({ id: s.active, type: 'user', text: String(body.text) }); s.waiting = String(body.text).includes('wait');
      const admitted = s.active; if (String(body.text).startsWith('finish')) finish(s.id, 'succeeded', String(body.text));
      return send({ data: { id: admitted, sessionID: s.id } });
    }
    if (path === '/interrupt') {
      interrupts++; if (race) { race = false; finish(s.id, 'succeeded', 'won completion race'); }
      const interrupted = !!s.active; if (interrupted) finish(s.id, 'interrupted');
      if (loseCancel) { loseCancel = false; req.socket.destroy(); return; }
      return send({ interrupted });
    }
    if (path === '/message') return send({ data: s.messages, cursor: { next: null } });
    if (path === '/permission') return send({ data: s.waiting ? [{ id: 'per_' + s.active, sessionID: s.id, action: 'edit', resources: [workspace + '/example.txt'] }] : [] });
    if (path === '/form') return send({ data: [] });
    if (path?.endsWith('/reply')) { replies++; finish(s.id); res.writeHead(204); res.end(); return; }
    if (!path) return send({ data: { id: s.id, agent: s.agent, model: s.model, permissions: s.permissions, location: { directory: s.directory }, ...(s.active ? {} : { outcome: s.messages.findLast(m => m.type === 'idle')?.outcome }) } });
    return send({}, 404);
  })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + (server.address() as { port: number }).port, password, sessions, finish,
    counters: () => ({ prompts, creates, interrupts, replies }), break: () => { broken = true; }, heal: () => { broken = false; },
    loseCancel: () => { loseCancel = true; }, race: () => { race = true; },
    close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); } };
}
