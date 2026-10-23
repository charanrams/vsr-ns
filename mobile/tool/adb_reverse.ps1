# Forwards the Android device/emulator's localhost:<Port> to this computer's localhost:<Port>,
# so the app can reach the dev API at http://localhost:5050 without using an IP address.
#
# Usage (from the mobile folder):  powershell -ExecutionPolicy Bypass -File tool\adb_reverse.ps1
# Re-run after reconnecting the device or restarting the emulator (the mapping is per connection).
param([int]$Port = 5050)

$ErrorActionPreference = 'Stop'

function Find-Adb {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($root in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
    if ($root) {
      $p = Join-Path $root 'platform-tools\adb.exe'
      if (Test-Path $p) { return $p }
    }
  }
  throw 'adb not found. Install Android SDK Platform-Tools or add platform-tools to PATH.'
}

$adb = Find-Adb
function Get-Devices { & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' } | ForEach-Object { ($_ -split "`t")[0] } }
$devices = Get-Devices

if (-not $devices) {
  # A stale adb server is the most common cause of "phone connected but not detected" — restart it once.
  Write-Host 'No device found; restarting adb…' -ForegroundColor DarkGray
  & $adb kill-server | Out-Null
  & $adb start-server | Out-Null
  Start-Sleep -Seconds 2
  $devices = Get-Devices
}

if (-not $devices) {
  $states = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\t' }
  if ($states -match 'unauthorized') {
    Write-Host 'Device is "unauthorized": unlock the phone and tap Allow on the "Allow USB debugging?" prompt (tick "Always allow").' -ForegroundColor Yellow
  } elseif ($states -match 'offline') {
    Write-Host 'Device is "offline": unplug and replug the cable, or toggle USB debugging off/on.' -ForegroundColor Yellow
  } else {
    Write-Host 'No Android device detected. Check: USB debugging is ON (Developer options), the cable supports data, and the phone''s USB mode is "File transfer".' -ForegroundColor Yellow
  }
  exit 1
}

foreach ($d in $devices) {
  & $adb -s $d reverse "tcp:$Port" "tcp:$Port" | Out-Null
  Write-Host "[$d] localhost:$Port -> computer localhost:$Port" -ForegroundColor Green
}

# Show active mappings so it's easy to confirm
foreach ($d in $devices) { & $adb -s $d reverse --list }
