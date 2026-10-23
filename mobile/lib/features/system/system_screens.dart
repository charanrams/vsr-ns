import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config.dart';
import '../../state/app_gate.dart';
import '../../widgets/common.dart';
import '../../widgets/status_screen.dart';

// Store listing used by update prompts. Replace with the published app IDs at release.
const _androidStore = 'https://play.google.com/store/apps/details?id=in.vsr.vsr_customer';
const _iosStore = 'https://apps.apple.com/in/search?term=VSR';
Future<void> openStore() => safeLaunch(Platform.isIOS ? _iosStore : _androidStore, external: true);

/// 3. App initialization / loading (shown while session + config load).
class AppLoadingScreen extends StatelessWidget {
  const AppLoadingScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ClipRRect(borderRadius: BorderRadius.circular(24), child: Image.asset('assets/images/logo.jpg', width: 120, height: 120)),
            const SizedBox(height: 24),
            const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
            const SizedBox(height: 12),
            Text('Getting things ready…', style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
      );
}

/// 8. Optional update prompt (dismissible dialog).
Future<void> showOptionalUpdate(BuildContext context, WidgetRef ref, String? latest) => showDialog(
      context: context,
      builder: (c) => AlertDialog(
        icon: const Icon(Icons.system_update_alt_rounded),
        title: const Text('Update available'),
        content: Text('VSR ${latest ?? ''} has new features and fixes. Update now for the best experience.'),
        actions: [
          TextButton(onPressed: () { ref.read(gateProvider.notifier).dismissOptional(); Navigator.pop(c); }, child: const Text('Later')),
          FilledButton(onPressed: () { ref.read(gateProvider.notifier).dismissOptional(); Navigator.pop(c); openStore(); }, style: FilledButton.styleFrom(minimumSize: const Size(100, 44)), child: const Text('Update')),
        ],
      ),
    );

/// 9. Required update.
class UpdateRequiredScreen extends ConsumerWidget {
  const UpdateRequiredScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = ref.watch(gateProvider);
    return StatusScreen(
      icon: Icons.system_update_rounded,
      tone: StatusTone.info,
      title: 'Update required',
      message: 'This version of VSR (${g.current ?? '-'}) is no longer supported for ordering. Please update to ${g.latest ?? 'the latest version'} to continue.',
      primaryLabel: 'Update VSR',
      onPrimary: openStore,
      secondaryLabel: 'I’ve updated — check again',
      onSecondary: () => ref.read(gateProvider.notifier).check(),
    );
  }
}

/// 10. Maintenance notice.
class MaintenanceScreen extends ConsumerWidget {
  const MaintenanceScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = ref.watch(gateProvider);
    return StatusScreen(
      icon: Icons.construction_rounded,
      tone: StatusTone.warning,
      title: 'We’ll be right back',
      message: g.message ?? 'VSR is undergoing scheduled maintenance. Your cart and orders are safe.',
      primaryLabel: 'Try again',
      busy: g.status == GateStatus.checking,
      onPrimary: () => ref.read(gateProvider.notifier).check(),
      secondaryLabel: 'Contact support',
      onSecondary: () => safeLaunch('tel:${AppConfig.supportPhone}', context: context),
    );
  }
}

/// 11. Unsupported app version.
class UnsupportedVersionScreen extends ConsumerWidget {
  const UnsupportedVersionScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = ref.watch(gateProvider);
    return StatusScreen(
      icon: Icons.phonelink_erase_rounded,
      tone: StatusTone.danger,
      title: 'Version not supported',
      message: 'VSR ${g.current ?? ''} can no longer connect securely. Install the latest version from the store to keep shopping.',
      primaryLabel: 'Get the latest version',
      onPrimary: openStore,
    );
  }
}

/// Server unreachable at launch (non-offline failure).
class ServiceUnavailableScreen extends ConsumerWidget {
  const ServiceUnavailableScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = ref.watch(gateProvider);
    return StatusScreen(
      icon: Icons.cloud_off_rounded,
      tone: StatusTone.warning,
      title: 'VSR is temporarily unavailable',
      message: 'We couldn’t reach our servers. Please try again in a moment.',
      primaryLabel: 'Retry',
      busy: g.status == GateStatus.checking,
      onPrimary: () => ref.read(gateProvider.notifier).check(),
    );
  }
}
