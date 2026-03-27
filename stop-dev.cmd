@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$pids = @(Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique);" ^
  "if (-not $pids -or $pids.Count -eq 0) { Write-Host 'No development server is listening on port 3000.'; exit 0 }" ^
  "foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped process ' + $id) }"

endlocal
