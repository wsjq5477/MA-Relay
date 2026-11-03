'use strict';

// Adapter-internal values only. This is not a new public router or model API.
const {digest} = require('./graph-layout.cjs');
const PROTOCOL = 'agentbridge-browser-v1';
const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const fail = (code, message) => Object.assign(new Error(message), {code});
function identity(value) { return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value); }
function requireIdentity(value, name) {
  if (!identity(value)) throw fail('INVALID_INPUT', 'Invalid browser ' + name + '.');
  return value;
}
function text(value, limit = 65536) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > limit)
    throw fail('INVALID_INPUT', 'Browser text is empty or exceeds the byte limit.');
  return value;
}
function continuation(value) {
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['transcriptFingerprint','assistantAnchor','historyRevision'].includes(k))&&typeof value.transcriptFingerprint==='string'&&/^[a-f0-9]{64}$/.test(value.transcriptFingerprint)&&identity(value.assistantAnchor)&&Number.isSafeInteger(value.historyRevision)&&value.historyRevision>=0;
}
function event(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('INVALID_INPUT', 'Invalid browser event.');
  const keys = ['requestId','taskId','executionId','bridgeSessionId','browserInstanceId','seq','kind','bindingRevision','leaseEpoch','text','revision','binding','continuation','error'];
  if (Object.keys(input).some(key => !keys.includes(key))) throw fail('INVALID_INPUT', 'Unknown browser event field.');
  for (const key of ['requestId','taskId','executionId','bridgeSessionId','browserInstanceId']) requireIdentity(input[key], key);
  if (!Number.isSafeInteger(input.seq) || input.seq < 1 || !Number.isSafeInteger(input.bindingRevision) || input.bindingRevision < 1 || !Number.isSafeInteger(input.leaseEpoch) || input.leaseEpoch < 1)
    throw fail('INVALID_INPUT', 'Invalid browser event sequence or fence.');
  if (!['submitted','output.snapshot','completed','failed','cancelled','unknown'].includes(input.kind)) throw fail('INVALID_INPUT', 'Invalid browser event kind.');
  if (['output.snapshot','completed'].includes(input.kind)) text(input.text, 262144);
  if (input.kind === 'output.snapshot' && (!Number.isSafeInteger(input.revision) || input.revision < 1)) throw fail('INVALID_INPUT', 'Invalid output revision.');
  if(input.continuation!==undefined&&(input.kind!=='completed'||!continuation(input.continuation)))throw fail('INVALID_INPUT','Invalid continuation proof.');
  if (input.kind === 'submitted') {
    const binding = input.binding;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding) || Object.keys(binding).some(k => !['sessionKey','userAnchor','documentId'].includes(k))) throw fail('INVALID_INPUT', 'Invalid page binding.');
    for (const key of ['sessionKey','userAnchor','documentId']) requireIdentity(binding[key], key);
  } else if (input.binding !== undefined) throw fail('INVALID_INPUT', 'Binding requires a submitted event.');
  if (input.error !== undefined && (!input.error || typeof input.error !== 'object' || Array.isArray(input.error) || Object.keys(input.error).some(k => !['code','message'].includes(k)) || !identity(input.error.code) || typeof input.error.message !== 'string' || Buffer.byteLength(input.error.message) > 4096)) throw fail('INVALID_INPUT', 'Invalid browser error.');
  if (input.text !== undefined && (typeof input.text !== 'string' || Buffer.byteLength(input.text) > 262144)) throw fail('INVALID_INPUT', 'Oversized output.');
  return structuredClone(input);
}
module.exports = {PROTOCOL, terminal, fail, identity, requireIdentity, text, event, digest, continuation};
