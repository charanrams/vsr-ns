import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vsr_customer/core/theme.dart';
import 'package:vsr_customer/features/auth/login_flow.dart';
import 'package:vsr_customer/features/onboarding/onboarding_screens.dart';

/// Renders a screen at a typical phone size inside a router so push/pop work.
Future<void> pumpScreen(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('root'))),
    GoRoute(path: '/s', builder: (_, _) => screen),
  ], initialLocation: '/s');
  await tester.pumpWidget(ProviderScope(child: MaterialApp.router(theme: buildTheme(), routerConfig: router)));
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  // Fonts can't be fetched in tests; ignore only those errors, surface everything else (e.g. overflow).
  void guard(WidgetTester t) {
    final prev = FlutterError.onError;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('GoogleFonts') || d.exceptionAsString().contains('google_fonts')) return;
      prev?.call(d);
    };
    addTearDown(() => FlutterError.onError = prev);
  }

  testWidgets('login entry enables Continue only for a valid email/phone', (t) async {
    guard(t);
    await pumpScreen(t, const LoginEntryScreen());
    expect(find.text('Continue'), findsOneWidget);
    final btn = find.ancestor(of: find.text('Continue'), matching: find.byType(FilledButton));
    expect(t.widget<FilledButton>(btn).onPressed, isNull);
    await t.enterText(find.byType(TextField), 'priya@gmail.com');
    await t.pump();
    expect(t.widget<FilledButton>(btn).onPressed, isNotNull);
  });

  testWidgets('password screen shows email, keep-logged-in and forgot link', (t) async {
    guard(t);
    await pumpScreen(t, const PasswordScreen(email: 'priya@gmail.com'));
    expect(find.textContaining('priya@gmail.com', findRichText: true), findsOneWidget);
    expect(find.text('Keep me logged in'), findsOneWidget);
    expect(find.text('Forgot Password?'), findsOneWidget);
  });

  testWidgets('OTP screen masks phone and fills six boxes', (t) async {
    guard(t);
    await pumpScreen(t, const LoginOtpScreen(args: OtpFlowArgs(identifier: '9876543210', purpose: 'reset')));
    expect(find.textContaining('+91 98765 43210', findRichText: true), findsOneWidget);
    await t.enterText(find.byType(TextField), '1234');
    await t.pump();
    expect(find.text('4'), findsOneWidget);
    expect(find.textContaining('Resend in'), findsOneWidget);
  });

  testWidgets('create password validates all rules', (t) async {
    guard(t);
    await pumpScreen(t, const CreatePasswordScreen(identifier: 'a@b.com', code: '123456'));
    final btn = find.ancestor(of: find.text('Update Password'), matching: find.byType(FilledButton));
    final fields = find.byType(TextField);
    await t.enterText(fields.at(0), 'Vsr@2026x');
    await t.enterText(fields.at(1), 'Vsr@2026x');
    await t.pump();
    expect(t.widget<FilledButton>(btn).onPressed, isNotNull);
    await t.enterText(fields.at(1), 'mismatch');
    await t.pump();
    expect(find.text('Passwords don’t match'), findsOneWidget);
    expect(t.widget<FilledButton>(btn).onPressed, isNull);
  });

  testWidgets('onboarding renders and auto-advances', (t) async {
    guard(t);
    await pumpScreen(t, const OnboardingScreen());
    expect(find.text('Skip'), findsOneWidget);
    await t.pump(const Duration(seconds: 4));
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('Electronics, fashion, home & living, beauty, kids, groceries, homemade food and more — all in one app.'), findsOneWidget);
  });
}
