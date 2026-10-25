const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:load}=require('tsx/cjs/api'),req=createRequire(path.resolve(__dirname,'../package.json'));
const {verifyContextReceipts}=load('../src/team-context-receipts.ts',__filename);
const React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const Component=load('../src/TeamContextReceipts.tsx',__filename).default;
const item={schema:1,transferId:'original-transfer',runId:'original-run',packetId:'a'.repeat(64),senderId:'a',senderName:'发送者',targetAgentId:'b',targetName:'接收者',createdAt:'2026-10-25T00:00:00.000Z',stage:'pending_receipt',recipientAuthorized:true,materials:{documents:1,tasks:0,messages:0,artifacts:0},executionStarted:false,grantsAccess:false,businessAccepted:false,evidence:'durable_packet'};
const page=()=>({schema:1,readOnly:true,runId:'original-run',items:[structuredClone(item)],next:item.transferId,hasMore:false});
test('read-only receipt audit checks original work, evidence semantics, response shape and pagination',()=>{
 const p=page();assert.deepEqual(verifyContextReceipts(p,'original-run'),p);
 const confirmed=page();Object.assign(confirmed.items[0],{stage:'acknowledged',evidence:'recipient_acknowledgement',acknowledgedAt:'2026-10-25T01:00:00.000Z'});assert.deepEqual(verifyContextReceipts(confirmed,'original-run'),confirmed);
 for(const mutate of [p=>p.runId='foreign',p=>p.items[0].runId='foreign',p=>p.items[0].deliveryProof='private',p=>p.items[0].packet={},p=>p.items[0].businessAccepted=true,p=>p.items[0].stage='acknowledged',p=>p.items[0].evidence='recipient_acknowledgement',p=>p.items[0].materials.documents=9,p=>p.items[0].materials={},p=>p.items[0].materials.tasks='0',p=>p.next='foreign',p=>p.items.push(p.items[0]),p=>p.hasMore='true',p=>p.readOnly=false]){const p=page();mutate(p);assert.throws(()=>verifyContextReceipts(p,'original-run'),/审计响应/);}
 const empty={schema:1,readOnly:true,runId:'original-run',items:[],next:'original-cursor',hasMore:false};assert.deepEqual(verifyContextReceipts(empty,'original-run','original-cursor'),empty);empty.hasMore=true;assert.throws(()=>verifyContextReceipts(empty,'original-run','original-cursor'));
 assert.throws(()=>verifyContextReceipts(page(),'original-run',item.transferId));
});
test('collapsed audit presents receipt limits and only an explicit read action, no send or acknowledgement controls',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,{runId:'original-run'}));
 assert.match(html,/选材传递与接收审计/);assert.match(html,/接收确认不代表业务验收/);assert.match(html,/读取传递审计/);assert(!html.includes('<details open'));
 assert(!/发送材料|确认接收|deliveryProof|team_ack_context/.test(html));
});
