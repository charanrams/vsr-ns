import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import 'common.dart';

/// Floating "View Cart" bar shown above the bottom navigation while the cart has items.
/// Tap anywhere (or View Cart) to open the cart; ✕ hides it until the cart changes.
/// [compact] is the slimmer version shown in the nav bar's place while the page scrolls down.
class FloatingCartBar extends ConsumerWidget {
  const FloatingCartBar({super.key, required this.onDismiss, this.compact = false});
  final VoidCallback onDismiss;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider).value;
    if (cart == null || cart.items.isEmpty) return const SizedBox.shrink();
    final first = cart.items.first;
    final others = cart.items.length - 1;
    final p = context.vsr;
    return Semantics(
      container: true,
      label: 'Cart, ${cart.count} item${cart.count == 1 ? '' : 's'}, ${money(cart.totals.grandTotal)}',
      child: Material(
        color: p.surface,
        elevation: 10,
        shadowColor: Colors.black.withValues(alpha: 0.25),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(compact ? 18 : 20), side: BorderSide(color: p.line)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/cart'),
          child: Padding(
            padding: compact ? const EdgeInsets.fromLTRB(6, 4, 2, 4) : const EdgeInsets.fromLTRB(6, 6, 2, 6),
            child: Row(children: [
              NetImage(first.image, width: compact ? 32 : 40, height: compact ? 32 : 40, radius: 10),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(
                    others > 0 ? '${first.name} + $others more' : first.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink),
                  ),
                  const SizedBox(height: 2),
                  Text(money(cart.totals.grandTotal), style: TextStyle(color: p.muted, fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              ),
              const SizedBox(width: 8),
              Material(
                color: VsrColors.accent,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => context.push('/cart'),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: compact ? 6 : 7),
                    child: compact
                        ? Text('View Cart · ${cart.count}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14))
                        : Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('View Cart', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                      Text('${cart.count} item${cart.count == 1 ? '' : 's'}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Hide cart bar',
                onPressed: onDismiss,
                icon: Icon(Icons.close, color: p.muted, size: 20),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Floating rounded bottom navigation (Categories · Home · Orders · Profile).
class FloatingNavBar extends StatelessWidget {
  const FloatingNavBar({super.key, required this.index, required this.onTap});
  final int index;
  final ValueChanged<int> onTap;

  static const _items = [
    (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Categories'),
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.receipt_long_outlined, Icons.receipt_long, 'Orders'),
    (Icons.person_outline, Icons.person, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final p = context.vsr;
    return Material(
      color: p.surface,
      elevation: 10,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32), side: BorderSide(color: p.line)),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(children: [
          for (var i = 0; i < _items.length; i++)
            Expanded(
              child: Semantics(
                selected: i == index,
                button: true,
                label: _items[i].$3,
                child: InkWell(
                  borderRadius: BorderRadius.circular(26),
                  onTap: () => onTap(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    height: 52,
                    decoration: BoxDecoration(color: i == index ? p.brand100 : Colors.transparent, borderRadius: BorderRadius.circular(26)),
                    child: ExcludeSemantics(
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(i == index ? _items[i].$2 : _items[i].$1, color: i == index ? p.brandText : p.muted, size: 22),
                        const SizedBox(height: 2),
                        Text(
                          _items[i].$3,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11.5, fontWeight: i == index ? FontWeight.w800 : FontWeight.w600, color: i == index ? p.ink : p.muted),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}
