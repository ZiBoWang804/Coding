$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $root

$bundledNode = Join-Path $root "node-v24.14.0-win-x64\node.exe"
$bundledDir = Join-Path $root "node-v24.14.0-win-x64"
$parentNode = Join-Path (Split-Path -Parent $root) "node-v24.14.0-win-x64\node.exe"
$parentDir = Join-Path (Split-Path -Parent $root) "node-v24.14.0-win-x64"

if (Test-Path -LiteralPath $bundledNode) {
  $node = $bundledNode
  $env:PATH = "$bundledDir;$env:PATH"
} elseif (Test-Path -LiteralPath $parentNode) {
  $node = $parentNode
  $env:PATH = "$parentDir;$env:PATH"
} else {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    $node = $command.Source
  } else {
    $node = $null
  }
}

if (-not $node) {
  Write-Host "未找到 Node.js。"
  Write-Host "请把 node-v24.14.0-win-x64 放在项目根目录，或安装 Node.js 并加入 PATH。"
  exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID"))) {
  Write-Host "未找到构建产物 .next。"
  Write-Host "请先在项目根目录执行 npm run build，然后再启动生产模式。"
  exit 1
}

$nextBin = Join-Path $root "node_modules\next\dist\bin\next"
if (-not (Test-Path -LiteralPath $nextBin)) {
  Write-Host "未找到 Next.js。请先在项目根目录执行 npm install。"
  exit 1
}

$env:USE_DEMO_DATA = "false"
$env:APP_URL = "http://localhost:3000"
Write-Host "正在从项目目录启动生产模式：$root"
Write-Host "浏览器地址：http://localhost:3000"
Write-Host "数据库连接使用该目录下的 .env / .env.local。"
& $node $nextBin start -p 3000
exit $LASTEXITCODE
