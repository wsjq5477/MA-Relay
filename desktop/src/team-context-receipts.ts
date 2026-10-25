export type ContextReceipt = {
  schema: 1; transferId: string; runId: string; packetId: string;
  senderId: string; senderName: string; targetAgentId: string; targetName: string;
  createdAt: string; stage: 'pending_receipt' | 'acknowledged'; acknowledgedAt?: string;
  recipientAuthorized: boolean; materials: Record<'documents' | 'tasks' | 'messages' | 'artifacts', number>;
  executionStarted: false; grantsAccess: false; businessAccepted: false;
  evidence: 'durable_packet' | 'recipient_acknowledgement';
};
export type ContextReceiptPage = { schema: 1; readOnly: true; runId: string; items: ContextReceipt[]; next: string | null; hasMore: boolean };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const id = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 150;
const date = (x: unknown) => typeof x === 'string' && Number.isFinite(Date.parse(x));
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).every(k => keys.includes(k));
function materials(x: unknown) {
  const keys = ['documents','tasks','messages','artifacts'];
  return object(x) && exact(x,keys) && keys.every(k => { const n=x[k]; return typeof n==='number' && Number.isSafeInteger(n) && n>=0 && n<=8; }) && keys.some(k => (x[k] as number)>0);
}
export function verifyContextReceipts(value: unknown, runId: string, after?: string): ContextReceiptPage {
  const invalid = () => { throw Error('传递审计响应无法匹配原工作与收据，未显示未核对内容。'); };
  if (!object(value) || !exact(value, ['schema','readOnly','runId','items','next','hasMore']) || value.schema !== 1 || value.readOnly !== true || value.runId !== runId ||
      !Array.isArray(value.items) || value.items.length > 20 || typeof value.hasMore !== 'boolean') return invalid();
  const seen = new Set<string>();
  for (const x of value.items) {
    if (!object(x) || !exact(x, ['schema','transferId','runId','packetId','senderId','senderName','targetAgentId','targetName','createdAt','stage','acknowledgedAt','recipientAuthorized','materials','executionStarted','grantsAccess','businessAccepted','evidence']) ||
        x.schema !== 1 || x.runId !== runId || !id(x.transferId) || seen.has(x.transferId) || x.transferId === after || !id(x.senderId) || !id(x.targetAgentId) ||
        typeof x.senderName !== 'string' || x.senderName.length > 100 || typeof x.targetName !== 'string' || x.targetName.length > 100 || !date(x.createdAt) ||
        typeof x.packetId !== 'string' || !/^[a-f0-9]{64}$/.test(x.packetId) || typeof x.recipientAuthorized !== 'boolean' ||
        x.executionStarted !== false || x.grantsAccess !== false || x.businessAccepted !== false ||
        (x.stage === 'pending_receipt' ? x.evidence !== 'durable_packet' || Object.hasOwn(x,'acknowledgedAt') :
          x.stage !== 'acknowledged' || x.evidence !== 'recipient_acknowledgement' || !date(x.acknowledgedAt)) ||
        !materials(x.materials)) return invalid();
    seen.add(x.transferId);
  }
  const last = value.items.at(-1) as ContextReceipt | undefined;
  if (value.next !== (last?.transferId || after || null) || (value.hasMore && !last)) return invalid();
  return value as ContextReceiptPage;
}
