import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vsr_customer/core/models.dart';
import 'package:vsr_customer/features/location/location_screens.dart';

import 'auth_flow_test.dart' show pumpScreen;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('permission explanation offers allow + manual entry', (t) async {
    await pumpScreen(t, const LocationPermissionScreen());
    expect(find.text('Allow Location Access'), findsOneWidget);
    expect(find.text('Allow Location'), findsOneWidget);
    expect(find.text('Enter address manually'), findsOneWidget);
  });

  testWidgets('denied (permanent) points to app settings', (t) async {
    await pumpScreen(t, const LocationDeniedScreen(permanently: true));
    expect(find.text('Open App Settings'), findsOneWidget);
  });

  testWidgets('GPS off offers to turn location on inside the app', (t) async {
    await pumpScreen(t, const LocationUnavailableScreen(serviceOff: true));
    expect(find.text('Location is turned off'), findsOneWidget);
    expect(find.text('Turn On Location'), findsOneWidget);
  });

  testWidgets('not serviceable shows the PIN and alternatives', (t) async {
    final a = Address(id: '', label: 'Home', recipient: '', phone: '', line1: 'x', city: 'Delhi', state: 'DL', postalCode: '110001');
    await pumpScreen(t, NotServiceableScreen(address: a));
    expect(find.textContaining('110001'), findsOneWidget);
    expect(find.text('Change Location'), findsOneWidget);
    expect(find.text('Save address anyway'), findsOneWidget);
  });
}
