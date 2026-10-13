$ProgressPreference='SilentlyContinue'
$ErrorActionPreference='Stop'
$base='C:\Users\jiqi\.codex\visualizations\2026\10\08\01a119ed-c329-7e22-81df-0e3a4c62e86f'
$repo='\\wsl.localhost\Ubuntu\home\jiqi\LLM\AgentBridge'
$exe=Join-Path $base 'AgentBridge-0.4.0-Windows-x64.exe'
$desktopProfile=Join-Path $base 'I04-normal-startup-profile'
New-Item -ItemType Directory -Path $desktopProfile -Force | Out-Null
$utf8=New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $desktopProfile 'desktop.json'),'{"theme":"light","distribution":"Ubuntu","directory":""}',$utf8)
$runtime=Join-Path $desktopProfile 'runtime.json'
Remove-Item $runtime -ErrorAction SilentlyContinue
$previous=$env:AGENTBRIDGE_DESKTOP_PROFILE
$report=@{date=[DateTime]::UtcNow.ToString('o');status='running';debugPort=$false;checks=@{}}
$child=$null;$wrapper=$null
try {
 $env:AGENTBRIDGE_DESKTOP_PROFILE=$desktopProfile
 $started=[DateTime]::UtcNow
 $wrapper=Start-Process -FilePath $exe -WorkingDirectory $base -PassThru
 $env:AGENTBRIDGE_DESKTOP_PROFILE=$previous
 $end=[DateTime]::UtcNow.AddSeconds(120)
 while([DateTime]::UtcNow -lt $end){
  $child=Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq $wrapper.Id -and $_.Name -eq 'AgentBridge.exe'} | Select-Object -First 1
  if($child -and (Test-Path $runtime)){
   try {$snapshot=Get-Content $runtime -Raw | ConvertFrom-Json} catch {$snapshot=$null}
   if($snapshot -and $snapshot.connected -and $snapshot.platform -eq 'win32' -and [DateTime]::Parse($snapshot.time).ToUniversalTime() -ge $started){
    $window=Get-Process -Id $child.ProcessId
    if($window.MainWindowTitle -eq 'AgentBridge'){
     $report.snapshot=$snapshot;$report.windowTitle=$window.MainWindowTitle;$report.processId=$child.ProcessId;$report.wrapperId=$wrapper.Id;$report.elapsedMs=([DateTime]::UtcNow-$started).TotalMilliseconds
     $report.checks.normalPortableLaunch=$true;$report.checks.rendererReceivedRealSnapshot=$true;$report.checks.noDebugInterface=($child.CommandLine -notmatch 'remote-debugging|--inspect');$report.status='passed';break
    }
   }
  }
  Start-Sleep -Milliseconds 400
 }
 if($report.status -ne 'passed'){throw 'Normal startup timed out before real connected renderer snapshot'}
} catch {$report.status='failed';$report.error=$_.Exception.Message}
finally {
 $env:AGENTBRIDGE_DESKTOP_PROFILE=$previous
 if($child){$same=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.ProcessId);if($same -and $same.ParentProcessId -eq $wrapper.Id -and $same.ExecutablePath -eq $child.ExecutablePath){Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue}}
 [System.IO.File]::WriteAllText((Join-Path $repo 'artifacts\I04-windows-startup.json'),($report|ConvertTo-Json -Depth 6),$utf8)
 Write-Output ('Normal Windows portable startup: '+$report.status)
}
