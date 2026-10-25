// A disposable acceptance helper retains the actual observed Process instance.
// Fresh .NET Process objects can select an untitled secondary Electron window.
// Read-only native checks verify owner/title before the existing CloseMainWindow
// call. No input, arbitrary command, private app data or force-close is exposed.
const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline');
function bindPortableWindow(pid){
 if(process.platform!=='win32'||!Number.isInteger(pid)||pid<=0)throw Error('Owned Windows process required');
 const command=`$ErrorActionPreference='Stop'
$owned=Get-Process -Id ${pid} -ErrorAction Stop
$caption=$owned.MainWindowTitle
$boundHandle=$owned.MainWindowHandle
if($caption -ne 'AgentBridge' -or $boundHandle -eq 0 -or $owned.ProcessName -ne 'AgentBridge'){@{stage='bound';verified=$false}|ConvertTo-Json -Compress;exit 0}
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class AcceptanceWindowRead {
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int limit);
 public static bool Matches(IntPtr window,uint expected){if(!IsWindow(window))return false;uint process;GetWindowThreadProcessId(window,out process);StringBuilder title=new StringBuilder(100);GetWindowText(window,title,100);return process==expected&&title.ToString()=="AgentBridge";}
}
'@
$verified=[AcceptanceWindowRead]::Matches($boundHandle,${pid})
@{stage='bound';verified=$verified}|ConvertTo-Json -Compress
[Console]::Out.Flush()
if(!$verified){exit 0}
$request=[Console]::ReadLine()
if($request -ne 'close'){exit 0}
$verified=(!$owned.HasExited -and [AcceptanceWindowRead]::Matches($boundHandle,${pid}) -and $owned.MainWindowHandle -eq $boundHandle)
$accepted=$false
if($verified){$accepted=$owned.CloseMainWindow()}
@{stage='closed';verified=$verified;accepted=$accepted}|ConvertTo-Json -Compress
`;
 const child=spawn(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['pipe','pipe','ignore']});
 const lines=readline.createInterface({input:child.stdout}),pending=new Map();let ended=false;
 function expect(stage){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(stage);reject(Object.assign(Error('Owned window binding timeout'),{code:'WINDOW_BINDING_TIMEOUT'}));},30000);pending.set(stage,{resolve,reject,timer});});}
 const bound=expect('bound');
 lines.on('line',line=>{let result;try{result=JSON.parse(line);}catch{return;}const job=pending.get(result.stage);if(!job)return;clearTimeout(job.timer);pending.delete(result.stage);job.resolve(result);});
 const fail=()=>{ended=true;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Object.assign(Error('Owned window binding ended'),{code:'WINDOW_BINDING_CLOSED'}));}pending.clear();};child.once('error',fail);child.once('exit',fail);
 const dispose=()=>{child.stdin.end();lines.close();};
 return bound.then(result=>{if(!result.verified){dispose();throw Object.assign(Error('Observed product window is no longer the current target'),{code:'WINDOW_TARGET_CHANGED'});}return {async close(){if(ended)throw Error('Owned window binding has ended');const reply=expect('closed');child.stdin.write('close\n');return reply;},dispose};},e=>{dispose();throw e;});
}
module.exports={bindPortableWindow};
