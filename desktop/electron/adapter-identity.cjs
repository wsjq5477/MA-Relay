'use strict';
const {createHash}=require('node:crypto');
const {adapters}=require('./builtin-adapters.cjs');
const {identity,fail}=require('./browser-protocol.cjs');
const isBrowser=row=>adapters.get(typeof row==='string'?row:row?.adapter)?.driver==='browser-extension';
function installation(machine,row) {
  if(isBrowser(row)) {
    if(!identity(row.browserInstanceId))throw fail('BROWSER_IDENTITY','Browser discovery requires its original profile identity.');
    return 'browser:'+row.adapter+':'+row.browserInstanceId;
  }
  if(typeof row.executable!=='string'||!row.executable)throw fail('DISCOVERY_IDENTITY','Executable discovery identity is missing.');
  return machine.kind==='windows'?row.executable.toLowerCase():row.executable;
}
function connectionId(machine,row) {
  return (isBrowser(row)?'browser-':'tool-')+createHash('sha256').update(machine.machineId+':'+installation(machine,row)).digest('hex').slice(0,20);
}
function sameInstallation(a,b) {
  return isBrowser(a)||isBrowser(b)?isBrowser(a)&&isBrowser(b)&&a.adapter===b.adapter&&identity(a.browserInstanceId)&&a.browserInstanceId===b.browserInstanceId:a.executable===b.executable;
}
function executionResource(machine,row) {
  if(isBrowser(row))return machine.machineId+':'+installation(machine,row);
  return require('./machine-router.cjs').workspaceKey(machine,row.workspace);
}
module.exports={isBrowser,installation,connectionId,sameInstallation,executionResource};
