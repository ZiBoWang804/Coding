$databaseUrlLine = (Get-Content "D:\Codex\remote-coding\.env.local" | Select-String '^DATABASE_URL=').Line
$env:DATABASE_URL = $databaseUrlLine -replace '^DATABASE_URL="?(.*?)"?$', '$1'
$env:USE_DEMO_DATA = "false"
$env:APP_URL = "http://localhost:3000"

& "D:\Codex\node-v24.14.0-win-x64\node.exe" "D:\Codex\remote-coding\node_modules\next\dist\bin\next" start -p 3000
