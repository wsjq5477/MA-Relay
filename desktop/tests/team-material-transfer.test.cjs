const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{createHash}=require('node:crypto');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:tsx}=require('tsx/cjs/api');
const {verifyPinnedDocument,documentMarkdown,materialFilename}=tsx('../src/team-material-transfer.ts',__filename);
const doc={runId:'work',documentId:'document',revision:1,currentRevision:2,title:'旧版材料',content:'原正文\n中文 😀',authorId:'user',time:'2026-10-19',contentSha256:createHash('sha256').update('原正文\n中文 😀').digest('hex')};
test('an older server or another work cannot be presented as an exact document revision',async()=>{
  for(const change of [{revision:2},{runId:'foreign'},{documentId:'foreign'},{currentRevision:0},{contentSha256:undefined}])
    await assert.rejects(verifyPinnedDocument({...doc,...change},'work','document',1),/未返回指定文档版本/);
});
test('document body must match the returned digest before copy or export becomes available',async()=>{
  assert.deepEqual(await verifyPinnedDocument(doc,'work','document',1),doc);
  await assert.rejects(verifyPinnedDocument({...doc,content:'changed'},'work','document',1),/摘要不一致/);
});
test('document export records the pinned version and preserves UTF-8 body without substituting current text',()=>{
  const text=documentMarkdown(doc);assert(text.includes('文档修订：1（读取时最新修订：2）'));
  assert(text.includes('team-document:document:1'));assert(text.endsWith(doc.content+'\n'));assert(text.includes(doc.contentSha256));
});
test('material download filenames remain one safe filename even for Windows device names and path-like titles',()=>{
  for(const title of ['../中文/资料?.md','NUL','COM1','a\\b:*?"<>|','']){
    const name=materialFilename(title,'第1版');assert(name.startsWith('公共材料-'));assert(name.endsWith('-第1版.md'));
    assert(!/[<>:"/\\|?*\x00-\x1f]/.test(name));assert(name.length<100);
  }
});
