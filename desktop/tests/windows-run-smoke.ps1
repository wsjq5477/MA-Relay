$ProgressPreference='SilentlyContinue'
$ErrorActionPreference='Stop'
$repo='\\wsl.localhost\Ubuntu\home\jiqi\LLM\AgentBridge'
$test=Join-Path $repo 'desktop\tests\windows-smoke.cjs'
$exe='C:\Users\jiqi\.codex\visualizations\2026\10\08\01a119ed-c329-7e22-81df-0e3a4c62e86f\AgentBridge-Windows\AgentBridge.exe'
$p=Start-Process -FilePath 'D:\01_common\nodejs\node.exe' -ArgumentList @($test,$exe) -WorkingDirectory 'C:\Users\jiqi' -RedirectStandardOutput (Join-Path $repo 'artifacts\I04-windows-smoke-stdout.txt') -RedirectStandardError (Join-Path $repo 'artifacts\I04-windows-smoke-stderr.txt') -PassThru
if(!$p.WaitForExit(180000)){Write-Output ('Own desktop smoke timed out: '+$p.Id);$p.Kill();exit 2}
Write-Output 'Own Windows desktop smoke process completed'
