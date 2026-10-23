import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vsr_customer/core/models.dart';
import 'package:vsr_customer/features/discovery/discovery_screens.dart';

import 'auth_flow_test.dart' show pumpScreen;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('search shows saved recent searches and popular chips', (t) async {
    SharedPreferences.setMockInitialValues({'vsr.recentSearches': ['tomato', 'ghee']});
    await pumpScreen(t, const SearchV2Screen());
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Recent Searches'), findsOneWidget);
    expect(find.text('tomato'), findsOneWidget);
    expect(find.text('Popular Searches'), findsOneWidget);
    await t.tap(find.text('Clear all'));
    await t.pump();
    expect(find.text('tomato'), findsNothing);
  });

  testWidgets('order notification detail links to My Orders', (t) async {
    SharedPreferences.setMockInitialValues({});
    final n = AppNotification(id: 'n1', title: 'Order #VSR20261021-00138', body: 'Your order is out for delivery.', kind: 'order', read: true, createdAt: DateTime(2026, 10, 21, 10));
    await pumpScreen(t, NotificationDetailScreen(notification: n));
    expect(find.text('Order update'), findsOneWidget);
    expect(find.text('View My Orders'), findsOneWidget);
  });
}
