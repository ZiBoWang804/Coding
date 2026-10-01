@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0.") do set "ROOT=%%~fI"
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

if not exist "%ROOT%\node_modules\prisma" (
  echo 未找到项目依赖。请先在项目根目录执行 npm install。
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  copy "%ROOT%\.env.example" "%ROOT%\.env" >nul
  echo 已新建 .env。
  echo 请填写云数据库的 DATABASE_URL 和 DIRECT_URL，并把 USE_DEMO_DATA 改为 false，然后重新运行本脚本。
  start "" notepad "%ROOT%\.env"
  pause
  exit /b 1
)

echo.
echo [1/3] 正在生成 Prisma 客户端...
call "%NPM_CMD%" run prisma:generate
if errorlevel 1 goto :failed

echo.
echo [2/3] 正在把迁移应用到 PostgreSQL...
call "%NPM_CMD%" run prisma:deploy
if errorlevel 1 goto :failed

echo.
echo [3/3] 正在导入示例数据...
call "%NPM_CMD%" run seed
if errorlevel 1 goto :failed

echo.
echo 数据库初始化完成。
echo 管理员：admin@youxiangji.local / admin123456
echo 演示用户：demo@youxiangji.local / demo123456
pause
exit /b 0

:failed
echo.
echo 数据库初始化失败。
echo 请检查 .env 里的 DATABASE_URL、DIRECT_URL、SSL，以及云数据库白名单和数据库是否已创建。
pause
exit /b 1

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
