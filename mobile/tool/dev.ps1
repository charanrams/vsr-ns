# One command for local development on Android: set up adb reverse, then flutter run.
# Usage (from the mobile folder):  powershell -ExecutionPolicy Bypass -File tool\dev.ps1
# Extra arguments are passed to flutter run, e.g.  tool\dev.ps1 -d emulator-5554
param([int]$Port = 5050, [Parameter(ValueFromRemainingArguments = $true)] $FlutterArgs)

& (Join-Path $PSScriptRoot 'adb_reverse.ps1') -Port $Port
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

flutter run --dart-define=API_URL=http://localhost:$Port/api/v1 @FlutterArgs
