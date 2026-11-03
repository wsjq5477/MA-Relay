'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {atomicWrite} = require('./graph-layout.cjs');
const {fail, identity, continuation} = require('./browser-protocol.cjs');
const fresh = () => ({version:1, revision:0, agents:[], tasks:[], conversations:[], requests:[], operations:[]});
function validate(state) {
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0) throw Error('Invalid state version.');
  for (const [collection, key] of [['agents','agentId'],['tasks','taskId'],['conversations','conversationId'],['requests','requestId'],['operations','operationId']]) {
    if (!Array.isArray(state[collection])) throw Error('Invalid state collection.');
    const seen = new Set();
    for (const row of state[collection]) {
      if (!row || !identity(row[key]) || seen.has(row[key])) throw Error('Invalid or duplicate identity.');
      seen.add(row[key]);
    }
  }
  for (const task of state.tasks) {
    for (const key of ['executionId','conversationId','targetAgent','requestId']) if (!identity(task[key])) throw Error('Invalid task identity.');
    if (!['accepted','running','unknown','succeeded','failed','cancelled'].includes(task.status) || !['prepared','creating','preparing','dispatching','submitted','terminal'].includes(task.phase) || !Number.isSafeInteger(task.browserSeq) || task.browserSeq < 0 || !Array.isArray(task.events) || !Array.isArray(task.browserHashes) || task.browserHashes.length !== task.browserSeq || task.lastSeq !== task.events.length) throw Error('Invalid task journal.');
    if (['succeeded','failed','cancelled'].includes(task.status) !== (task.phase === 'terminal') || !Number.isSafeInteger(task.leaseEpoch) || task.leaseEpoch < 1 || !Number.isSafeInteger(task.bindingRevision) || task.bindingRevision < 1 || !Number.isSafeInteger(task.outputRevision) || task.outputRevision < 0 || task.browserHashes.some(h => typeof h !== 'string' || !/^[a-f0-9]{64}$/.test(h))) throw Error('Invalid task fence or terminal state.');
    if (!state.agents.some(a => a.agentId === task.targetAgent) || !state.conversations.some(c => c.conversationId === task.conversationId) || !state.requests.some(r => r.requestId === task.requestId && r.taskId === task.taskId)) throw Error('Missing task owner or receipt.');
    if (task.events.some((e,i) => e.seq !== i+1)) throw Error('Invalid task event sequence.');
  }
  for (const row of state.requests) if (!state.tasks.some(t => t.taskId === row.taskId && t.requestId === row.requestId) || typeof row.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(row.fingerprint)) throw Error('Invalid request receipt.');
  for (const row of state.conversations) if (!state.agents.some(a => a.agentId === row.targetAgent) || !state.tasks.some(t => t.taskId === row.lastTaskId && t.conversationId === row.conversationId)) throw Error('Invalid conversation binding.');
  for(const row of state.conversations)if(row.closed!==undefined&&typeof row.closed!=='boolean'||row.closeState!==undefined&&!['unknown','confirmed','rejected'].includes(row.closeState))throw Error('Invalid session close state.');
  for(const row of [...state.tasks,...state.conversations])if(row.binding&&['transcriptFingerprint','assistantAnchor','historyRevision'].some(k=>row.binding[k]!==undefined)&&!continuation(Object.fromEntries(['transcriptFingerprint','assistantAnchor','historyRevision'].map(k=>[k,row.binding[k]]))))throw Error('Invalid continuation binding.');
  for(const row of state.operations)if(row.kind==='session.close'&&(!state.tasks.some(t=>t.taskId===row.taskId&&t.conversationId===row.conversationId)||!Number.isSafeInteger(row.expectedRevision)||row.expectedRevision<1||!['unknown','confirmed','rejected'].includes(row.state)||row.data?.closed!==(row.state==='confirmed')))throw Error('Invalid session close receipt.');
  for(const row of state.operations)if(row.proofMode!==undefined&&(row.kind!=='cancel'||row.proofMode!=='content-not-authorized-v1'||!['before-message-send','message-send-issued'].includes(row.senderFence)||!['unknown','confirmed','rejected'].includes(row.state)||!state.tasks.some(t=>t.taskId===row.taskId)||row.state==='confirmed'&&(row.data?.status!=='cancelled'||row.data?.proof!==row.proofMode)))throw Error('Invalid pre-content cancellation receipt.');
  for(const row of state.operations)if(row.proofMode!==undefined&&row.state==='confirmed'&&(!Number.isSafeInteger(row.data.sealedThroughSeq)||row.data.sealedThroughSeq<0||state.tasks.find(t=>t.taskId===row.taskId).browserSeq!==row.data.sealedThroughSeq))throw Error('Invalid cancellation event cursor.');
  return state;
}
class BrowserState {
  constructor(directory, options = {}) {
    this.file = path.join(directory, 'browser-state.json');
    this.writer = options.write || atomicWrite;
    this.maxBytes = options.maxBytes || 16 * 1024 * 1024;
    fs.mkdirSync(directory, {recursive:true, mode:0o700});
    try { this.state = validate(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') this.state = fresh(); else throw fail('BROWSER_STATE_INVALID', 'Browser journal cannot be verified; preserve the original data.'); }
  }
  read() { return structuredClone(this.state); }
  transact(change) {
    if (this.poisoned) throw fail('BROWSER_STORAGE_ERROR', 'Browser storage requires reopening and verification.');
    const next = this.read();
    const result = change(next);
    next.revision++;
    validate(next);
    if (Buffer.byteLength(JSON.stringify(next)) > this.maxBytes) throw fail('BROWSER_STORAGE_FULL', 'Browser journal is full; unresolved evidence was retained.');
    try { this.writer(this.file, next); }
    catch { this.poisoned = true; throw fail('BROWSER_STORAGE_ERROR', 'Browser journal commit failed; no acknowledgement is permitted.'); }
    this.state = next;
    return structuredClone(result);
  }
}
module.exports = {BrowserState, validate};
