import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vsr_customer/core/theme.dart';
import 'package:vsr_customer/features/onboarding/onboarding_screens.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);
  testWidgets('onboarding has bottom dots, no arrows, Start Shopping on last slide on an iQOO 13 sized screen', (t) async {
    t.view.physicalSize = const Size(1440, 3168);
    t.view.devicePixelRatio = 3.75;
    addTearDown(t.view.reset);
    await t.pumpWidget(ProviderScope(child: MaterialApp(theme: buildTheme(), home: const OnboardingScreen())));
    await t.pump(const Duration(milliseconds: 300));
    final screenH = 3168 / 3.75;
    final dots = t.getRect(find.bySemanticsLabel('Slide 1 of 3'));
    expect(dots.bottom, greaterThan(screenH - 140), reason: 'dots should sit in the bottom bar');
    expect(find.byIcon(Icons.arrow_forward), findsNothing, reason: 'no arrow buttons');
    expect(find.text('Skip'), findsOneWidget);
    // last slide shows Start Shopping and hides Skip
    await t.drag(find.byType(PageView), const Offset(-400, 0));
    await t.pumpAndSettle();
    await t.drag(find.byType(PageView), const Offset(-400, 0));
    await t.pumpAndSettle();
    expect(find.text('Start Shopping'), findsOneWidget);
    expect(find.text('Skip'), findsNothing);
  });
}
