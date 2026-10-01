@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0node-v24.14.0-win-x64\node.exe" (
  echo Node runtime was not found in this folder.
  echo Please keep the whole project folder together and try again.
  pause
  exit /b 1
)

if not exist "%~dp0.env" (
  echo .env was not found.
  echo Please run 2-初始化数据库-完整版.cmd first.
  pause
  exit /b 1
)

set "USE_DEMO_DATA=false"
set "APP_URL=http://localhost:3000"
set "PORT=3000"
set "PATH=%~dp0node-v24.14.0-win-x64;%PATH%"

echo Starting full database mode...
echo This window still opens the site on this computer.
echo Spot, user and community data come from DATABASE_URL in .env.
echo Open in browser: http://localhost:3000
echo Do not close this window while the project is running.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3000'"
call "%~dp0node-v24.14.0-win-x64\npm.cmd" run dev

echo.
echo The project has stopped.
pause
