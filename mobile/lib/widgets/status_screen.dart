import 'package:flutter/material.dart';

import '../core/theme.dart';

enum StatusTone { success, warning, danger, info, brand }

/// Full-screen outcome/notice page (success, failure, blocked, empty…) with up to two actions.
class StatusScreen extends StatelessWidget {
  const StatusScreen({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.tone = StatusTone.brand,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.showBack = false,
    this.footer,
    this.busy = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final StatusTone tone;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final bool showBack;
  final Widget? footer;
  final bool busy;

  Color _fg(BuildContext context) => switch (tone) {
        StatusTone.success => context.vsr.success,
        StatusTone.warning => context.vsr.warning,
        StatusTone.danger => context.vsr.danger,
        StatusTone.info => context.vsr.info,
        StatusTone.brand => context.vsr.brandText,
      };

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: showBack ? AppBar() : null,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(VsrSpace.xl, VsrSpace.lg, VsrSpace.xl, VsrSpace.lg),
          child: Column(children: [
            // Content scrolls on small phones / large text; actions stay pinned at the bottom
            Expanded(
              child: LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Semantics(
                        label: title,
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: MediaQuery.of(context).disableAnimations ? 1 : 0.7, end: 1),
                          duration: const Duration(milliseconds: 380),
                          curve: Curves.easeOutCubic,
                          builder: (_, s, child) => Transform.scale(scale: s, child: child),
                          child: Container(
                            width: 104,
                            height: 104,
                            decoration: BoxDecoration(color: _fg(context).withValues(alpha: 0.12), shape: BoxShape.circle),
                            child: Icon(icon, size: 52, color: _fg(context)),
                          ),
                        ),
                      ),
                      const SizedBox(height: VsrSpace.xxl),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 340),
                        child: Column(children: [
                          Text(title, textAlign: TextAlign.center, style: t.headlineSmall),
                          const SizedBox(height: VsrSpace.md),
                          Text(message, textAlign: TextAlign.center, style: t.bodyMedium?.copyWith(color: context.vsr.muted, height: 1.5)),
                          if (footer != null) ...[const SizedBox(height: VsrSpace.xl), footer!],
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            const SizedBox(height: VsrSpace.lg),
            if (primaryLabel != null)
              FilledButton(
                onPressed: busy ? null : onPrimary,
                child: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white)) : Text(primaryLabel!),
              ),
            if (secondaryLabel != null) ...[
              const SizedBox(height: VsrSpace.sm),
              TextButton(onPressed: busy ? null : onSecondary, child: Text(secondaryLabel!)),
            ],
          ]),
        ),
      ),
    );
  }
}

/// Blocking overlay used while a critical action runs (placing order, opening payment…).
class BlockingProgress extends StatelessWidget {
  const BlockingProgress({super.key, required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Positioned.fill(
        child: ColoredBox(
          color: Colors.black.withValues(alpha: 0.35),
          child: Center(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: VsrSpace.xxl, vertical: VsrSpace.xl),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const CircularProgressIndicator(strokeWidth: 2.5),
                  const SizedBox(height: VsrSpace.lg),
                  Text(label, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('Please don’t close the app.', style: Theme.of(context).textTheme.bodySmall),
                ]),
              ),
            ),
          ),
        ),
      );
}

/// Inline notice banner (info / warning / danger) used inside screens.
class NoticeBanner extends StatelessWidget {
  const NoticeBanner({super.key, required this.message, this.tone = StatusTone.warning, this.icon, this.action, this.onAction});
  final String message;
  final StatusTone tone;
  final IconData? icon;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (tone) {
      StatusTone.success => (context.vsr.success, context.vsr.successBg),
      StatusTone.danger => (context.vsr.danger, context.vsr.dangerBg),
      StatusTone.info => (context.vsr.info, context.vsr.infoBg),
      StatusTone.brand => (context.vsr.brandText, context.vsr.brand50),
      StatusTone.warning => (context.vsr.warning, context.vsr.warningBg),
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(VsrSpace.md, VsrSpace.md, VsrSpace.xs, VsrSpace.md),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(VsrRadius.md)),
      child: Row(children: [
        Icon(icon ?? Icons.info_outline, color: fg, size: 20),
        const SizedBox(width: VsrSpace.md),
        Expanded(child: Text(message, style: TextStyle(fontSize: 13, height: 1.35, color: context.vsr.ink))),
        if (action != null) TextButton(onPressed: onAction, child: Text(action!, style: TextStyle(color: fg))),
      ]),
    );
  }
}
