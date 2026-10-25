// Test-only packaged-main observer. Runs in an isolated diagnostic app copy.
// Records lifecycle stages; no UI automation, model, native configuration or business writes.
const fs=require('node:fs');
const {app,BrowserWindow,ipcMain}=require('electron');
const output=process.env.AGENTBRIDGE_LIFECYCLE_TRACE;
if(!output||!process.env.AGENTBRIDGE_DESKTOP_PROFILE)throw Error('Isolated trace and profile required');
const report={date:new Date().toISOString(),status:'running',scope:'Diagnostic app copy with exact production main/renderer; application-internal close, not ordinary EXE/user-input evidence',electron:process.versions.electron,node:process.version,modelCalls:0,events:[]};
const log=(event,data={})=>{report.events.push({event,ms:Math.round(performance.now()),...data});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(name,fn)=>handle(name,async(...args)=>{log('ipc-begin',{name});try{const result=await fn(...args);log('ipc-end',{name});return result;}catch(e){log('ipc-error',{name,code:e.code||'ERROR'});throw e;}});
const timer=setTimeout(()=>{report.status='failed';report.forcedDiagnosticExit=true;log('diagnostic-deadline');app.exit(23);},45000);
app.on('browser-window-created',(_event,window)=>{
 log('window-created');
 window.on('close',event=>{log('window-close',{defaultPrevented:event.defaultPrevented});queueMicrotask(()=>log('window-close-after-listeners',{defaultPrevented:event.defaultPrevented}));});
 window.on('closed',()=>{log('window-closed');});
 window.on('unresponsive',()=>log('window-unresponsive'));
 window.webContents.on('did-finish-load',()=>{log('did-finish-load');setTimeout(()=>{
  if(process.env.AGENTBRIDGE_LIFECYCLE_CLOSE_MODE==='system'){
   const handle=window.getNativeWindowHandle(),nativeHandle=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
   log('system-close-request');
   const command=`$owned=Get-Process -Id ${process.pid} -ErrorAction Stop;@{handle=$owned.MainWindowHandle.ToInt64().ToString();hasWindow=($owned.MainWindowHandle -ne 0);responding=$owned.Responding;accepted=$owned.CloseMainWindow()} | ConvertTo-Json -Compress`;
   require('node:child_process').execFile(require('node:path').join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000},(error,stdout)=>{
    if(error){log('system-close-error',{code:error.code||'ERROR'});return;}
    const result=JSON.parse(stdout);log('system-close-response',{nativeHandleMatchesObserved:result.handle===nativeHandle,accepted:result.accepted,responding:result.responding,hasWindow:result.hasWindow});
   });
  }else{log('application-close-request',{windowCount:BrowserWindow.getAllWindows().length});window.close();log('application-close-return');}
 },3000);});
 window.webContents.on('render-process-gone',(_e,d)=>log('render-process-gone',{reason:d.reason,exitCode:d.exitCode}));
 window.webContents.on('will-prevent-unload',()=>log('renderer-prevent-unload'));
 window.webContents.on('did-fail-load',(_e,code)=>log('did-fail-load',{code}));
});
app.on('window-all-closed',()=>log('window-all-closed'));
app.on('before-quit',()=>log('before-quit'));
app.on('will-quit',()=>{clearTimeout(timer);report.status='passed';log('will-quit');});
app.on('quit',(_e,exitCode)=>log('quit',{exitCode}));
require('./main.cjs');
