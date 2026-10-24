const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {readMaintenanceInput,MAX_MAINTENANCE_INPUT_BYTES,digest}=require('../electron/remote-maintenance.cjs');
const {frozenCatalogueInput}=require('./maintenance-input-fixture.cjs');
test('complete frozen release catalogues above 8MiB round-trip every original field and fingerprint',async()=>{
 const input=frozenCatalogueInput(),bytes=Buffer.from(JSON.stringify(input));assert(bytes.length>8*1048576);
 const chunks=[];for(let offset=0;offset<bytes.length;offset+=32768)chunks.push(bytes.subarray(offset,offset+32768));
 const decoded=await readMaintenanceInput(Readable.from(chunks));
 assert.deepEqual(decoded,input);assert.equal(digest(decoded),digest(input));assert.equal(decoded.releases.length,input.releases.length);
 assert.equal(MAX_MAINTENANCE_INPUT_BYTES,64*1048576);
});
test('byte counting preserves split UTF-8 and rejects the first excess byte before JSON parsing',async()=>{
 const input=Buffer.from(JSON.stringify({operationId:'原操作',message:'中文'}));
 assert.deepEqual(await readMaintenanceInput(Readable.from([...input].map(v=>Buffer.from([v]))),input.length),JSON.parse(input));
 await assert.rejects(readMaintenanceInput(Readable.from([input]),input.length-1),{code:'INVALID_INPUT'});
});
test('malformed complete input is rejected before a maintenance action can be selected',async()=>{
 await assert.rejects(readMaintenanceInput(Readable.from([Buffer.from('{"action":')])) ,SyntaxError);
});
