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
  copy "%~dp0.env.example" "%~dp0.env" >nul
  echo A new .env file has been created.
  echo Please edit DATABASE_URL and USE_DEMO_DATA first, then run this script again.
  start "" notepad "%~dp0.env"
  pause
  exit /b 1
)

set "PATH=%~dp0node-v24.14.0-win-x64;%PATH%"

echo.
echo [1/3] Generating Prisma client...
call "%~dp0node-v24.14.0-win-x64\npm.cmd" run prisma:generate
if errorlevel 1 goto :failed

echo.
echo [2/3] Pushing schema to PostgreSQL...
call "%~dp0node-v24.14.0-win-x64\npm.cmd" run prisma:push
if errorlevel 1 goto :failed

echo.
echo [3/3] Importing seed data...
call "%~dp0node-v24.14.0-win-x64\npm.cmd" run seed
if errorlevel 1 goto :failed

echo.
echo Database initialization completed.
echo Admin account: admin@youxiangji.local / admin123456
echo Demo user:    demo@youxiangji.local / demo123456
pause
exit /b 0

:failed
echo.
echo Database initialization failed.
echo Please check PostgreSQL, DATABASE_URL in .env, and whether the database already exists.
pause
exit /b 1
