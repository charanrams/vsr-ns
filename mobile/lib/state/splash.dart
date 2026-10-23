import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True once the launch video has finished (or was skipped) for this app run.
/// The router keeps the user on /splash until then; session/gate rules apply afterwards.
class SplashNotifier extends Notifier<bool> {
  final listenable = ValueNotifier<int>(0);

  @override
  bool build() => false;

  void finish() {
    if (state) return;
    state = true;
    listenable.value++;
  }
}

final splashDoneProvider = NotifierProvider<SplashNotifier, bool>(SplashNotifier.new);
