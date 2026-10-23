#!/usr/bin/env sh
# Forwards the Android device/emulator's localhost:PORT to this computer's localhost:PORT,
# so the app reaches the dev API at http://localhost:5050 without an IP address.
# Usage: sh tool/adb_reverse.sh [port]   (re-run after reconnecting the device)
set -e
PORT="${1:-5050}"

ADB="$(command -v adb || true)"
for root in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" "$LOCALAPPDATA/Android/Sdk"; do
  [ -z "$ADB" ] && [ -n "$root" ] && [ -x "$root/platform-tools/adb" ] && ADB="$root/platform-tools/adb"
  [ -z "$ADB" ] && [ -n "$root" ] && [ -x "$root/platform-tools/adb.exe" ] && ADB="$root/platform-tools/adb.exe"
done
[ -z "$ADB" ] && { echo "adb not found. Install Android SDK Platform-Tools or add it to PATH."; exit 1; }

DEVICES="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
[ -z "$DEVICES" ] && { echo "No Android device or emulator connected."; exit 1; }

for d in $DEVICES; do
  "$ADB" -s "$d" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null
  echo "[$d] localhost:$PORT -> computer localhost:$PORT"
done
