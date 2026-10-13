$ErrorActionPreference='Stop'
$repo='\\wsl.localhost\Ubuntu\home\jiqi\LLM\AgentBridge'
Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('AgentBridge.exe','node.exe')} | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress
$probe=Join-Path $repo 'desktop\tests\windows-node-probe.cjs'
$out=Join-Path $repo 'artifacts\I04-windows-probe-stdout.txt'
$err=Join-Path $repo 'artifacts\I04-windows-probe-stderr.txt'
$p=Start-Process -FilePath 'D:\01_common\nodejs\node.exe' -ArgumentList @($probe) -WorkingDirectory 'C:\Users\jiqi' -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
if(!$p.WaitForExit(15000)){Write-Output ('Node probe timed out; own PID '+$p.Id);$p.Kill()}else{Write-Output ('Node probe exit='+$p.ExitCode)}
