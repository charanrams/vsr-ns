import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/api.dart';
import '../core/models.dart';
import 'providers.dart';

/// App-level gate checked on launch from `/store/config` (PRD 1.1 items 8–11).
enum GateStatus { checking, ok, optionalUpdate, updateRequired, unsupported, maintenance, unavailable }

class GateState {
  const GateState(this.status, {this.message, this.current, this.latest});
  final GateStatus status;
  final String? message, current, latest;
  bool get blocks => const [GateStatus.updateRequired, GateStatus.unsupported, GateStatus.maintenance, GateStatus.unavailable].contains(status);
}

/// Compares dotted versions: -1, 0, 1.
int compareVersions(String a, String b) {
  final pa = a.split('.').map((x) => int.tryParse(x.replaceAll(RegExp(r'\D'), '')) ?? 0).toList();
  final pb = b.split('.').map((x) => int.tryParse(x.replaceAll(RegExp(r'\D'), '')) ?? 0).toList();
  for (var i = 0; i < 3; i++) {
    final x = i < pa.length ? pa[i] : 0, y = i < pb.length ? pb[i] : 0;
    if (x != y) return x < y ? -1 : 1;
  }
  return 0;
}

class GateNotifier extends Notifier<GateState> {
  final listenable = ValueNotifier<int>(0);
  bool _optionalDismissed = false;

  @override
  GateState build() {
    // Run after build() returns: `state` can't be read while the provider is still initialising.
    Future.microtask(check);
    return const GateState(GateStatus.checking);
  }

  void _set(GateState s) {
    state = s;
    listenable.value++;
  }

  Future<void> check() async {
    if (state.status != GateStatus.checking) _set(const GateState(GateStatus.checking));
    String current = '1.0.0';
    try {
      current = (await PackageInfo.fromPlatform()).version;
    } catch (_) {}
    try {
      final cfg = await ref.read(apiProvider).get('/store/config') as Json;
      final maint = cfg['maintenance'] as Json?;
      if (maint?['enabled'] == true) return _set(GateState(GateStatus.maintenance, message: maint?['message'] as String?));
      final app = cfg['app'] as Json? ?? const {};
      final min = (app['minVersion'] ?? '0.0.0') as String;
      final latest = (app['latestVersion'] ?? current) as String;
      final unsupported = (app['unsupportedBelow'] ?? '0.0.0') as String;
      if (compareVersions(current, unsupported) < 0) return _set(GateState(GateStatus.unsupported, current: current, latest: latest));
      if (compareVersions(current, min) < 0) return _set(GateState(GateStatus.updateRequired, current: current, latest: latest));
      if (!_optionalDismissed && compareVersions(current, latest) < 0) return _set(GateState(GateStatus.optionalUpdate, current: current, latest: latest));
      _set(GateState(GateStatus.ok, current: current, latest: latest));
    } on ApiException catch (e) {
      // Offline at launch should not block browsing cached screens; a server outage does.
      if (e.isOffline) return _set(GateState(GateStatus.ok, current: current));
      _set(GateState(GateStatus.unavailable, message: e.message, current: current));
    } catch (_) {
      _set(GateState(GateStatus.ok, current: current));
    }
  }

  void dismissOptional() {
    _optionalDismissed = true;
    _set(GateState(GateStatus.ok, current: state.current, latest: state.latest));
  }
}

final gateProvider = NotifierProvider<GateNotifier, GateState>(GateNotifier.new);
