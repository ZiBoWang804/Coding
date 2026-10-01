@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"
if errorlevel 1 (
  echo 无法进入项目目录：%ROOT%
  pause
  exit /b 1
)
call :resolve_node
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "%ROOT%\.next\BUILD_ID" (
  echo 未找到构建产物 .next。
  echo 请先在项目根目录执行 npm run build，然后再启动生产模式。
  pause
  exit /b 1
)
if not exist "%ROOT%\node_modules\next\dist\bin\next" (
  echo 未找到 Next.js。请先在项目根目录执行 npm install。
  pause
  exit /b 1
)

set "USE_DEMO_DATA=false"
set "APP_URL=http://localhost:3000"
echo 正在从项目目录启动生产模式：%ROOT%
echo 浏览器地址：http://localhost:3000
echo 数据库连接使用该目录下的 .env / .env.local。
"%NODE_EXE%" "%ROOT%\node_modules\next\dist\bin\next" start -p 3000
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0

:resolve_node
set "NODE_EXE="
set "NPM_CMD="
if exist "%ROOT%\node-v24.14.0-win-x64\node.exe" (
  set "NODE_EXE=%ROOT%\node-v24.14.0-win-x64\node.exe"
  set "NPM_CMD=%ROOT%\node-v24.14.0-win-x64\npm.cmd"
  set "PATH=%ROOT%\node-v24.14.0-win-x64;%PATH%"
  exit /b 0
)
if exist "%ROOT%\..\node-v24.14.0-win-x64\node.exe" (
  for %%I in ("%ROOT%\..\node-v24.14.0-win-x64") do (
    set "NODE_EXE=%%~fI\node.exe"
    set "NPM_CMD=%%~fI\npm.cmd"
    set "PATH=%%~fI;%PATH%"
  )
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。
  echo 请把 node-v24.14.0-win-x64 放在项目根目录，或安装 Node.js 并加入 PATH。
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo 已找到 node，但没有找到 npm。
  echo 请安装完整的 Node.js，或把 node-v24.14.0-win-x64 放在项目根目录。
  exit /b 1
)
set "NODE_EXE=node"
set "NPM_CMD=npm.cmd"
exit /b 0
