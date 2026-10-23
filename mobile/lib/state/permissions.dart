import 'package:geolocator/geolocator.dart';
import 'package:location/location.dart' as device;
import 'package:permission_handler/permission_handler.dart';

bool _asked = false;

/// For a signed-in customer, once each time the app is opened: location permission, then (if the
/// phone's location/GPS is switched off) the system "Turn on device location?" dialog, then
/// notifications. All are in-app system dialogs; never opens Settings. A permission the user
/// permanently denied is left alone (Android doesn't allow asking again).
Future<void> askStartupPermissions() async {
  if (_asked) return;
  _asked = true;
  try {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    final granted = perm == LocationPermission.always || perm == LocationPermission.whileInUse;
    // Only worth turning GPS on when we're allowed to use it
    if (granted && !await Geolocator.isLocationServiceEnabled()) await device.Location().requestService();
    if (await Permission.notification.isDenied) await Permission.notification.request();
  } catch (_) {
    // Plugin unavailable (tests/desktop) or a dialog already showing: permissions are optional
  }
}
