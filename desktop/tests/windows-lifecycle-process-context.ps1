# Read-only process context. No handles, account names, SIDs or tokens are returned.
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class LifecycleProcessContext {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool inside);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out uint data, uint length, out uint returned);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, out int data, uint length, out uint returned);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static object TokenFlag(IntPtr token, int kind) {int value;uint length;return GetTokenInformation(token,kind,out value,4,out length)?(object)(value!=0):"unknown";}
 public static Dictionary<string,object> Read() {
  Dictionary<string,object> result=new Dictionary<string,object>();bool inside;uint flags,length;
  result["jobQuerySucceeded"]=IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out inside);result["inJob"]=inside;
  bool ok=QueryInformationJobObject(IntPtr.Zero,4,out flags,4,out length);result["uiRestrictionQuerySucceeded"]=ok;result["uiRestrictionQueryError"]=ok?0:Marshal.GetLastWin32Error();result["uiRestrictions"]=ok?(object)flags:"unknown";
  IntPtr token;if(OpenProcessToken(GetCurrentProcess(),8,out token)){try{result["elevated"]=TokenFlag(token,20);result["uiAccess"]=TokenFlag(token,26);result["appContainer"]=TokenFlag(token,29);}finally{CloseHandle(token);}}else result["tokenQueryError"]=Marshal.GetLastWin32Error();
  return result;
 }
}
'@
[LifecycleProcessContext]::Read()|ConvertTo-Json -Compress
