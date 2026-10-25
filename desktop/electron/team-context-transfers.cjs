// Durable selected-context delivery. This table is independent of state version 3;
// old coordinators retain it, but cannot send or acknowledge packets.
const { randomUUID, randomBytes, timingSafeEqual } = require('node:crypto');
const { digest } = require('./graph-layout.cjs');
const { contextPacket, MAX_PACKET_BYTES } = require('./team-context-packet.cjs');
const fail = (code, message) => Object.assign(new Error(message), { code });
const methods = ['team.sendContext', 'team.contextTransfers', 'team.contextTransfer', 'team.ackContext'];
const MAX_TRANSFERS = 256, MAX_TRANSFER_BYTES = 8 * 1024 * 1024;
const validId = value => typeof value === 'string' && !!value.trim() && value.length <= 150;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function input(p, fields) {
  const allowed = new Set(['runId', 'operationId', ...fields]);
  if (Object.keys(p).some(k => !allowed.has(k)) || !validId(p.runId)) throw fail('TEAM_INPUT', '选材传递参数不合法，身份沿用原接入。');
}
function initialize(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS context_transfers (
    transfer_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, sender_id TEXT NOT NULL,
    target_id TEXT NOT NULL, body TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS context_transfers_run ON context_transfers(run_id);`);
}
function decode(row) {
  try {
    const x = JSON.parse(row.body), { packetId, markdown, ...projection } = x.packet;
    if (x.schema !== 1 || x.transferId !== row.transfer_id || x.runId !== row.run_id || x.senderId !== row.sender_id || x.targetAgentId !== row.target_id ||
        !validId(x.transferId) || !validId(x.senderId) || !validId(x.targetAgentId) || typeof x.senderName !== 'string' || typeof x.createdAt !== 'string' ||
        !hash(x.deliveryProof) || !hash(x.contentSha256) || !hash(packetId) || digest(projection) !== packetId || digest(x.packet) !== x.contentSha256 ||
        ['documents', 'tasks', 'messages', 'artifacts'].some(k => !Array.isArray(x.packet[k])) || x.packet.kind !== 'agentbridge.shared-context' || x.packet.source.runId !== x.runId || x.packet.target.agentId !== x.targetAgentId || typeof markdown !== 'string' ||
        Buffer.byteLength(JSON.stringify(x.packet)) > MAX_PACKET_BYTES ||
        (x.acknowledgement && (!validId(x.acknowledgement.sessionId) || typeof x.acknowledgement.createdAt !== 'string')))
      throw Error('Invalid original transfer');
    return x;
  } catch { throw fail('TEAM_CONTEXT_STATE', '原选材传递记录无法核对，请保留原记录排查；不会改用当前材料。'); }
}
function metadata(x, s) {
  const r = s.runs.find(r => r.runId === x.runId);
  return { schema: 1, transferId: x.transferId, runId: x.runId, packetId: x.packet.packetId,
    senderId: x.senderId, senderName: x.senderName, targetAgentId: x.targetAgentId, targetName: x.packet.target.name,
    createdAt: x.createdAt, stage: x.acknowledgement ? 'acknowledged' : 'pending_receipt',
    ...(x.acknowledgement ? { acknowledgedAt: x.acknowledgement.createdAt } : {}),
    recipientAuthorized: !!r && r.state === 'active' && r.memberIds.includes(x.targetAgentId) && s.agents.some(a => a.agentId === x.targetAgentId && !a.disabled),
    materials: Object.fromEntries(['documents', 'tasks', 'messages', 'artifacts'].map(k => [k, x.packet[k].length])),
    executionStarted: false, grantsAccess: false, businessAccepted: false,
    evidence: x.acknowledgement ? 'recipient_acknowledgement' : 'durable_packet' };
}
function visible(actor, row) { return actor.user || actor.agentId === row.sender_id || actor.agentId === row.target_id; }
function original(db, actor, p) {
  if (!validId(p.transferId)) throw fail('TEAM_INPUT', '请指定原传递ID。');
  const row = db.prepare('SELECT * FROM context_transfers WHERE transfer_id=? AND run_id=?').get(p.transferId, p.runId);
  if (!row || !visible(actor, row)) throw fail('TEAM_CONTEXT_TRANSFER', '原传递不在当前成员可读范围内。');
  return decode(row);
}
function save(db, x, insert) {
  const body = JSON.stringify(x), bytes = Buffer.byteLength(body);
  const usage = db.prepare('SELECT count(*) AS n, coalesce(sum(length(CAST(body AS BLOB))),0) AS bytes FROM context_transfers').get();
  const old = insert ? 0 : db.prepare('SELECT length(CAST(body AS BLOB)) AS bytes FROM context_transfers WHERE transfer_id=?').get(x.transferId)?.bytes;
  if ((insert && usage.n >= MAX_TRANSFERS) || !Number.isSafeInteger(old) || usage.bytes - old + bytes > MAX_TRANSFER_BYTES)
    throw fail('TEAM_CONTEXT_CAPACITY', '选材传递记录达到容量限制，原包与未确认收据保留。');
  if (insert) db.prepare('INSERT INTO context_transfers VALUES (?,?,?,?,?)').run(x.transferId, x.runId, x.senderId, x.targetAgentId, body);
  else db.prepare('UPDATE context_transfers SET body=? WHERE transfer_id=?').run(body, x.transferId);
}
function send(space, s, actor, p) {
  const r = space.run(s, p.runId);
  if (r.state !== 'active') throw fail('TEAM_CLOSED', '工作已结束或正在停止，不能新增传递。');
  if (!hash(p.packetId)) throw fail('TEAM_INPUT', '请提供预览的原packetId。');
  const view = space.view(s, r.runId, actor);
  const packet = contextPacket({ ...view, messages: s.messages.filter(m => m.runId === r.runId) }, p);
  if (packet.packetId !== p.packetId) throw fail('TEAM_CONTEXT_STALE', '原选材预览已变化，请重新读取核对；本次未传递。');
  const senderId = actor.user ? 'user' : actor.agentId;
  const x = { schema: 1, transferId: randomUUID(), runId: r.runId, senderId,
    senderName: actor.user ? '用户' : space.agent(s, senderId).name, targetAgentId: p.targetAgentId,
    createdAt: new Date().toISOString(), packet, contentSha256: digest(packet), deliveryProof: randomBytes(32).toString('hex') };
  save(space.db, x, true);
  return metadata(x, s);
}
function acknowledge(space, s, actor, p) {
  if (actor.user) throw fail('TEAM_FORBIDDEN', '接收收据只能由原目标成员提交。');
  const x = original(space.db, actor, p);
  if (actor.agentId !== x.targetAgentId) throw fail('TEAM_CONTEXT_TRANSFER', '只有原目标成员可确认接收。');
  if (!hash(p.deliveryProof) || !hash(p.packetId) || !hash(p.contentSha256) || p.packetId !== x.packet.packetId || p.contentSha256 !== x.contentSha256 ||
      !timingSafeEqual(Buffer.from(p.deliveryProof, 'hex'), Buffer.from(x.deliveryProof, 'hex')))
    throw fail('TEAM_CONTEXT_RECEIPT', '接收收据未匹配原包，请重新读取原传递，不创建替代传递。');
  if (!x.acknowledgement) {
    x.acknowledgement = { createdAt: new Date().toISOString(), sessionId: actor.sessionId };
    save(space.db, x, false);
  }
  return metadata(x, s);
}
function list(db, s, actor, p) {
  const limit = p.limit === undefined ? 20 : p.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (p.after !== undefined && !validId(p.after))) throw fail('TEAM_INPUT', '传递列表游标或分页不合法。');
  const rows = db.prepare('SELECT rowid AS position,* FROM context_transfers WHERE run_id=? ORDER BY rowid').all(p.runId).filter(row => visible(actor, row));
  const index = p.after === undefined ? -1 : rows.findIndex(row => row.transfer_id === p.after);
  if (p.after !== undefined && index < 0) throw fail('TEAM_CONTEXT_TRANSFER', '原传递游标不在当前可读范围内。');
  const selected = rows.slice(index + 1, index + 1 + limit);
  return { schema: 1, readOnly: true, runId: p.runId, items: selected.map(row => metadata(decode(row), s)),
    next: selected.at(-1)?.transfer_id || p.after || null, hasMore: index + 1 + selected.length < rows.length };
}
function call(space, method, p, actor) {
  const fields = {
    'team.sendContext': ['packetId', 'targetAgentId', 'selections'], 'team.ackContext': ['transferId', 'packetId', 'deliveryProof', 'contentSha256'],
    'team.contextTransfers': ['after', 'limit'], 'team.contextTransfer': ['transferId'],
  };
  input(p, fields[method]);
  if (method === 'team.sendContext' || method === 'team.ackContext')
    return space.mutate(actor, method, p, s => method === 'team.sendContext' ? send(space, s, actor, p) : acknowledge(space, s, actor, p), { sync: false });
  // One read snapshot covers both current authorization and the original packet.
  space.db.exec('BEGIN');
  try {
    const s = space.read(); space.authorize(s, actor, p.runId);
    let result;
    if (method === 'team.contextTransfers') result = list(space.db, s, actor, p);
    else {
      const x = original(space.db, actor, p);
      result = { ...metadata(x, s), readOnly: true, packet: x.packet,
        ...(!actor.user && actor.agentId === x.targetAgentId ? { deliveryProof: x.deliveryProof } : {}) };
    }
    space.db.exec('COMMIT'); return result;
  } catch (error) { space.db.exec('ROLLBACK'); throw error; }
}
module.exports = { methods, initialize, call, MAX_TRANSFERS, MAX_TRANSFER_BYTES };
