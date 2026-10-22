import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {httpClient}=require('../desktop/electron/opendesk-connection.cjs');
const {startCli}=require('../desktop/electron/opendesk-worker.cjs');
const executable=process.argv[2];
if(!executable||!path.isAbsolute(executable))throw Error('Pass the absolute path of an existing, unmodified installed OpenDesk CLI.');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-existing-probe-'));
const report={date:new Date().toISOString(),environment:'WSL / unmodified installed OpenDesk CLI / isolated native config',executableSha256:createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),modelCalls:0,checks:[]};
let service;
try{
 process.env.OPENDESK_CONFIG_DIRECTORY=path.join(root,'native');
 service=await startCli({executable,workspace:root},root);
 const {origin,password}=service;
 const c=await httpClient({origin,password},root);report.checks.push('existing serve starts and authenticated /global/health succeeds');
 const unauthorized=await fetch(origin+'/session');assert.equal(unauthorized.status,401);report.checks.push('existing HTTP Basic Auth rejects missing credentials');
 assert.deepEqual(await c.request('/session'),[]);report.checks.push('read-only session list is empty and creates no native task');
 await assert.rejects(c.request('/session/ses_missing_original'),{code:'OPENDESK_HTTP'});assert.deepEqual(await c.request('/session'),[]);report.checks.push('missing original session lookup remains read-only');
 const created=await c.request('/session',{title:'Bridge API probe'});assert.equal(created.directory,root);assert.equal(typeof created.id,'string');assert.deepEqual(await c.request('/session/'+created.id+'/message'),[]);report.checks.push('existing session create/read works without Prompt or model override');
 report.status='passed';
} catch(error){report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}
finally{
 if(service?.pid)try{process.kill(service.pid,'SIGTERM');await new Promise(r=>setTimeout(r,1000));try{process.kill(service.pid,0);process.kill(service.pid,'SIGKILL');}catch{}}catch{}
 const target=path.resolve(process.argv[3]||'artifacts/opendesk-existing/2026-10-21/native-cli-probe.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');fs.rmSync(root,{recursive:true,force:true});
}
