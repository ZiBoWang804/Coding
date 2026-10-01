@echo off
setlocal

cd /d "%~dp0"

set "NPM_CMD=npm.cmd"
set "NODE_HOME="
set "NPM_OK="

if exist "%~dp0..\node-v24.14.0-win-x64\npm.cmd" (
  set "NODE_HOME=%~dp0..\node-v24.14.0-win-x64"
)

if not defined NODE_HOME if exist "%~dp0node-v24.14.0-win-x64\npm.cmd" (
  set "NODE_HOME=%~dp0node-v24.14.0-win-x64"
)

if defined NODE_HOME (
  set "PATH=%NODE_HOME%;%PATH%"
  set "NPM_CMD=%NODE_HOME%\npm.cmd"
  if exist "%NPM_CMD%" set "NPM_OK=1"
)

if not defined NPM_OK (
  where npm.cmd >nul 2>nul
  if not errorlevel 1 set "NPM_OK=1"
)

if not defined NPM_OK (
  echo npm.cmd was not found.
  echo Put node-v24.14.0-win-x64 next to the project folder or inside the project folder,
  echo or install Node.js and make sure npm.cmd is available in PATH.
  pause
  exit /b 1
)

if not exist ".env.local" if exist ".env.example" (
  copy /Y ".env.example" ".env.local" >nul
)

echo Starting the project in development mode...
echo Browser URL: http://localhost:3000
echo Use stop-dev.cmd or Ctrl+C in the server window to stop it.
echo.

start "youxiangji-dev" /D "%~dp0" "%ComSpec%" /k call "%NPM_CMD%" run dev

endlocal
