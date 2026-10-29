@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
echo AgentBridge isolated UI preview
echo Keep this window open while viewing http://127.0.0.1:4197
echo Press Ctrl+C to stop the preview.
call npm run desktop:preview
set "previewExitCode=%errorlevel%"
if not "%previewExitCode%"=="0" (
  echo Preview could not start. See the error above.
  pause
)
popd
exit /b %previewExitCode%
