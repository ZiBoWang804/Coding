@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0node-v24.14.0-win-x64\node.exe" (
  echo Node runtime was not found in this folder.
  echo Please keep the whole project folder together and try again.
  pause
  exit /b 1
)

set "USE_DEMO_DATA=true"
set "APP_URL=http://localhost:3001"
set "PORT=3001"
set "PATH=%~dp0node-v24.14.0-win-x64;%PATH%"

echo Starting demo mode...
echo Open in browser: http://localhost:3001
echo Do not close this window while the project is running.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3001'"
call "%~dp0node-v24.14.0-win-x64\npm.cmd" run start

echo.
echo The project has stopped.
pause
