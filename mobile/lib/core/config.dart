/// Runtime configuration. Override at build time:
///   flutter run --dart-define=API_URL=https://api.vsr.in/api/v1
///
/// Development uses `localhost` on every target:
/// - Android (emulator or USB device): run `tool/adb_reverse.ps1` (or `tool/dev.ps1`)
///   so the device's localhost:5050 is forwarded to this computer's localhost:5050.
/// - iOS simulator: localhost already reaches the host machine.
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:5050/api/v1');
  static const supportPhone = '+919876543210';
  static const supportEmail = 'support@vsr.in';
}
