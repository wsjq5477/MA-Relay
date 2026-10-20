const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHash}=require('node:crypto');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:tsx}=require('tsx/cjs/api');
const {verifyContextPacket,packetScope,staleTaskSelection}=tsx('../src/team-context-transfer.ts',__filename);
const {contextPacket}=require('../electron/team-context-packet.cjs');
const {digest}=require('../electron/graph-layout.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const context={run:{runId:'work',name:'工作',state:'active',revision:1,memberIds:['a'],goal:'目标',acceptance:'标准',charter:'约定'},members:[{agentId:'a',name:'成员',role:'leader',kind:'mcp',purpose:'职责',inputs:'输入',outputs:'交付',limitations:'边界',capabilitySource:'user_declared',revision:1}],documents:[{documentId:'d',runId:'work',title:'新版',content:'new-unselected',revision:2,history:[{revision:1,title:'旧版',content:'原文 😀\n<script>RAW</script>',authorId:'user',time:'2026-10-20'},{revision:2,title:'新版',content:'new-unselected',authorId:'user',time:'2026-10-20'}]}],workItems:[{workItemId:'t',title:'开发',description:'实现功能',ownerId:'a',kind:'delivery',state:'submitted',revision:3,round:1,dependsOn:[],currentReportId:'r',reports:[{reportId:'r',round:1,outcome:'submitted',summary:'成员声明',reporterId:'a',evidenceSource:'member_report',artifact:{artifactId:'artifact',version:'X',reference:'/never-read',producerId:'a',createdAt:'2026-10-20'}}]}],messages:[{messageId:'m',runId:'work',seq:1,senderId:'user',content:'选定消息',createdAt:'2026-10-20'}]};
 const selected={documents:[{documentId:'d',revision:1}],tasks:[{workItemId:'t',revision:3,round:1}],messages:[{messageId:'m',seq:1}],artifacts:[{artifactId:'artifact',version:'X'}]};
 const p=JSON.parse(JSON.stringify(contextPacket(context,{targetAgentId:'a',selections:selected})));
 return {context,selected,p,verify:(value=p,c=context,s=selected)=>verifyContextPacket(value,c,'a',s,c.messages)};
}
function rehash(p){const {packetId,markdown,...payload}=p;p.packetId=digest(payload);return p;}
test('production packet is independently verified, and exports regenerate Markdown from only validated structured material',async()=>{
 const f=fixture();f.p.markdown='unselected-backend-markdown';const p=await f.verify();
 assert.equal(p.documents[0].contentSha256,sha(f.context.documents[0].history[0].content));assert(p.markdown.includes('原文 😀\n<script>RAW</script>'));
 assert(!p.markdown.includes('unselected-backend-markdown'));assert(!p.markdown.includes('new-unselected'));assert(p.markdown.includes('未发送给目标'));assert.equal(p.artifacts[0].access,'reference-not-checked');
});
test('older servers, foreign work/target, additional materials or private fields cannot enable export even with a recomputed packet digest',async()=>{
 const mutations=[p=>delete p.packetId,p=>p.source.runId='foreign',p=>p.target.agentId='foreign',p=>p.boundaries.grantsAccess=true,p=>p.documents.push(p.documents[0]),p=>p.privateToken='must-not-export',p=>p.target.entryKey='must-not-export',p=>p.documents[0].history=[],p=>p.tasks[0].report.privateRequestId='must-not-export'];
 for(const mutate of mutations){const f=fixture();mutate(f.p);if(f.p.packetId)rehash(f.p);await assert.rejects(f.verify(),/核对/);}
});
test('pinned revisions and local source contents prevent substituted documents, messages, task states or artifact references',async()=>{
 const mutations=[p=>p.documents[0].revision=2,p=>{p.documents[0].content='substituted';p.documents[0].contentSha256=sha('substituted');},p=>p.documents[0].title='伪造标题',p=>p.messages[0].seq=2,p=>p.messages[0].content='伪造消息',p=>p.messages[0].acknowledged=true,p=>p.tasks[0].round=2,p=>p.tasks[0].state='completed',p=>p.tasks[0].report.summary='伪造报告',p=>p.tasks[0].report.evidenceSource='native_success',p=>p.tasks[0].report.artifactReference.version='Y',p=>p.artifacts[0].version='Y',p=>p.artifacts[0].reference='/substituted'];
 for(const mutate of mutations){const f=fixture();mutate(f.p);rehash(f.p);await assert.rejects(f.verify());}
});
test('task/member changes invalidate existing preview scope; ordinary message polling and preserved old document revisions do not silently select new material',async()=>{
 const f=fixture(),before=packetScope(f.context,f.selected);
 f.context.messages.push({...f.context.messages[0],messageId:'new-message',seq:2});f.context.documents[0].revision=3;
 assert.equal(packetScope(f.context,f.selected),before);
 f.context.workItems[0].revision++;assert.notEqual(packetScope(f.context,f.selected),before);assert.equal(staleTaskSelection(f.context,f.selected),true);await assert.rejects(f.verify());
 const g=fixture(),scope=packetScope(g.context,g.selected);g.context.members[0].revision++;assert.notEqual(packetScope(g.context,g.selected),scope);
 g.context.members=[];await assert.rejects(g.verify());
});
test('UTF-8 capacity and response digest failures refuse all exports instead of truncating or accepting cached text',async()=>{
 const f=fixture();f.p.markdown='中'.repeat(100000);await assert.rejects(f.verify());
 const g=fixture();g.p.packetId='0'.repeat(64);await assert.rejects(g.verify());
});
