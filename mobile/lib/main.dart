import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme.dart';
import 'router.dart';
import 'state/providers.dart';
import 'state/realtime.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Safety net: an async error nobody awaited (e.g. a failed tap handler) is logged with its
  // stack instead of surfacing as an unhandled exception. Screens still show their own errors.
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Unhandled async error: $error\n$stack');
    return true;
  };

  runApp(const ProviderScope(child: VsrApp()));
}

class VsrApp extends ConsumerWidget {
  const VsrApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Keep the live-updates socket open for the whole app run
    ref.watch(realtimeProvider);
    return MaterialApp.router(
        title: 'VSR',
        debugShowCheckedModeBanner: false,
        // System by default; the user can pick Light/Dark in Profile → More. Splash, onboarding and
        // the login/sign-up flow are wrapped with alwaysLight() in the router.
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: ref.watch(themeModeProvider),
        routerConfig: ref.watch(routerProvider),
      );
  }
}
