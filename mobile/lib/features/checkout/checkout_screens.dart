import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

// ------------------------------------------------------------------- Cart ----
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});
  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final Set<String> _busy = {};

  Future<void> _set(LineItem it, int q) async {
    setState(() => _busy.add(it.key));
    try {
      await ref.read(cartProvider.notifier).setQty(it.productId, q, variantId: it.variantId);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(it.key));
    }
  }

  Future<bool> _confirm(String title, String body, String cta) async =>
      await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Keep')), TextButton(onPressed: () => Navigator.pop(c, true), child: Text(cta, style: TextStyle(color: context.vsr.danger)))],
        ),
      ) ??
      false;

  Future<void> _coupon(CartView cart) async {
    final code = await showModalBottomSheet<String?>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => _CouponSheet(current: cart.couponCode));
    if (code == null) return;
    try {
      await ref.read(cartProvider.notifier).applyCoupon(code.isEmpty ? null : code);
      if (mounted) showMessage(context, code.isEmpty ? 'Coupon removed' : 'Coupon $code applied');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  /// "Save for later" = move to the wishlist (added if not there yet), then out of the cart.
  Future<void> _saveForLater(LineItem it) async {
    setState(() => _busy.add(it.key));
    try {
      final saved = (await ref.read(wishlistProvider.future)).any((p) => p.id == it.productId);
      if (!saved) await ref.read(apiProvider).post('/store/me/wishlist/${it.productId}');
      await ref.read(cartProvider.notifier).setQty(it.productId, 0, variantId: it.variantId);
      ref.invalidate(wishlistProvider);
      if (mounted) showMessage(context, '${it.name} moved to your wishlist');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(it.key));
    }
  }

  Future<void> _remove(LineItem it) async {
    if (await _confirm('Remove item?', 'Remove ${it.name} from your cart?', 'Remove')) await _set(it, 0);
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final c0 = cart.value;
    final count = c0?.count ?? 0;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          const Text('My Cart'),
          if (count > 0) Text('$count item${count == 1 ? '' : 's'} in your cart', style: t.bodySmall),
        ]),
      ),
      body: AsyncBody(
        value: cart,
        onRetry: () => ref.invalidate(cartProvider),
        builder: (c) {
          if (c.items.isEmpty) {
            return MessageView(icon: Icons.shopping_bag_outlined, title: 'Your cart is empty', message: 'Add fresh groceries, essentials or homemade food to get started.', action: 'Start Shopping', onAction: () => context.go('/'));
          }
          final inCart = c.items.map((i) => i.productId).toSet();
          final recs = (ref.watch(recommendationsProvider).value ?? const <Product>[]).where((p) => !inCart.contains(p.id)).take(10).toList();
          // Everything saved on this order: MRP vs price, coupon, and delivery when it's free
          final mrpSaved = c.items.fold<num>(0, (s, i) => s + i.savings);
          final deliverySaved = c.totals.deliveryFee == 0 ? c.standardDeliveryFee : 0;
          final saved = mrpSaved + c.totals.discount + deliverySaved;
          Widget gutter(Widget w) => Padding(padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter), child: w);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(cartProvider),
            child: ListView(padding: const EdgeInsets.fromLTRB(0, VsrSpace.sm, 0, VsrSpace.xl), children: [
              for (final w in c.warnings)
                gutter(Container(
                  margin: const EdgeInsets.only(bottom: VsrSpace.md),
                  padding: const EdgeInsets.all(VsrSpace.md),
                  decoration: BoxDecoration(color: context.vsr.warningBg, borderRadius: BorderRadius.circular(VsrRadius.md)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.warning_amber_rounded, color: context.vsr.warning, size: 20), const SizedBox(width: VsrSpace.md), Expanded(child: Text(w, style: TextStyle(fontSize: 13, height: 1.4, color: context.vsr.ink)))]),
                )),
              gutter(_FreeDeliveryBar(cart: c)),
              const SizedBox(height: VsrSpace.md),
              for (final it in c.items)
                gutter(Padding(
                  padding: const EdgeInsets.only(bottom: VsrSpace.md),
                  child: Dismissible(
                    key: ValueKey(it.key),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) => _confirm('Remove item?', 'Remove ${it.name} from your cart?', 'Remove'),
                    onDismissed: (_) => _set(it, 0),
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 24),
                      decoration: BoxDecoration(color: context.vsr.dangerBg, borderRadius: BorderRadius.circular(VsrRadius.lg)),
                      child: Icon(Icons.delete_outline, color: context.vsr.danger),
                    ),
                    child: _CartItemCard(
                      item: it,
                      busy: _busy.contains(it.key),
                      onQty: (q) async {
                        if (q == 0) return _remove(it);
                        await _set(it, q);
                      },
                      onRemove: () => _remove(it),
                      onSaveForLater: () => _saveForLater(it),
                    ),
                  ),
                )),
              gutter(_CouponCard(cart: c, onTap: () => _coupon(c))),
              const SizedBox(height: VsrSpace.md),
              gutter(BillCard(totals: c.totals, count: c.count, standardDeliveryFee: c.standardDeliveryFee)),
              if (saved > 0) ...[
                const SizedBox(height: VsrSpace.md),
                gutter(Container(
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg, vertical: VsrSpace.md),
                  decoration: BoxDecoration(color: context.vsr.successBg, borderRadius: BorderRadius.circular(VsrRadius.md)),
                  child: Row(children: [
                    Icon(Icons.savings_outlined, color: context.vsr.success, size: 22),
                    const SizedBox(width: VsrSpace.md),
                    Expanded(
                      child: Text.rich(TextSpan(style: TextStyle(color: context.vsr.ink, fontWeight: FontWeight.w600), children: [
                        const TextSpan(text: 'You are saving '),
                        TextSpan(text: money(saved), style: TextStyle(color: context.vsr.success, fontWeight: FontWeight.w800)),
                        const TextSpan(text: ' on this order'),
                      ])),
                    ),
                  ]),
                )),
              ],
              if (recs.isNotEmpty) ...[
                const SectionHeader('You might also like'),
                ProductRail(products: recs),
              ],
              const SizedBox(height: VsrSpace.md),
              gutter(Text('Prices and availability are confirmed again when you place the order.', textAlign: TextAlign.center, style: t.bodySmall)),
            ]),
          );
        },
      ),
      bottomNavigationBar: (c0?.items.isNotEmpty ?? false)
          ? BottomCta(
              leading: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    money(c0!.totals.grandTotal),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      height: 1.15,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$count item${count == 1 ? '' : 's'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: t.bodySmall?.copyWith(fontSize: 12, height: 1.15),
                  ),
                ],
              ),
              child: FilledButton(
                onPressed: c0.items.any((i) => i.outOfStock)
                    ? null
                    : () => context.push('/checkout/address'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Checkout',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(width: VsrSpace.sm),
                    Icon(Icons.arrow_forward_rounded, size: 20),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}

/// "Add ₹X more for FREE delivery" with progress, or a tick once the order qualifies.
class _FreeDeliveryBar extends StatelessWidget {
  const _FreeDeliveryBar({required this.cart});
  final CartView cart;
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    final free = cart.totals.deliveryFee == 0;
    final above = cart.freeDeliveryAbove;
    final left = max<num>(0, above - cart.totals.itemTotal);
    final progress = above <= 0 ? 1.0 : (cart.totals.itemTotal / above).clamp(0, 1).toDouble();
    return Container(
      padding: const EdgeInsets.all(VsrSpace.lg),
      decoration: BoxDecoration(
        color: free ? v.successBg : v.surface,
        borderRadius: BorderRadius.circular(VsrRadius.lg),
        border: Border.all(color: free ? v.success.withValues(alpha: 0.35) : v.line),
      ),
      child: Row(children: [
        Icon(Icons.local_shipping_outlined, color: free ? v.success : v.brandText, size: 28),
        const SizedBox(width: VsrSpace.md),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (free) ...[
              Text('Free delivery', style: TextStyle(fontWeight: FontWeight.w800, color: v.ink)),
              const SizedBox(height: 2),
              Text(
                cart.totals.couponCode != null && cart.totals.itemTotal < above ? 'Unlocked with ${cart.totals.couponCode}' : 'Your order qualifies for free delivery',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ] else ...[
              Text.rich(TextSpan(style: TextStyle(fontWeight: FontWeight.w600, color: v.ink), children: [
                const TextSpan(text: 'Add '),
                TextSpan(text: money(left), style: TextStyle(fontWeight: FontWeight.w800, color: v.brandText)),
                const TextSpan(text: ' more for FREE delivery'),
              ])),
              const SizedBox(height: VsrSpace.sm),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(value: progress, minHeight: 6, backgroundColor: v.lineSoft, color: v.brandText, semanticsLabel: 'Progress to free delivery'),
              ),
            ],
          ]),
        ),
        if (free) ...[const SizedBox(width: VsrSpace.sm), Icon(Icons.check_circle_rounded, color: v.success)],
      ]),
    );
  }
}

String _cartItemUnit(LineItem it) {
  if (it.variantName != null && it.variantName!.trim().isNotEmpty) {
    return it.variantName!.trim();
  }
  final u = it.unit.trim();
  if (u.isEmpty) return '${it.quantity} pc${it.quantity == 1 ? '' : 's'}';
  final pcMatch = RegExp(r'^(\d+)?\s*(pc|piece|pcs|pieces)$', caseSensitive: false).firstMatch(u);
  if (pcMatch != null) {
    final baseCount = int.tryParse(pcMatch.group(1) ?? '1') ?? 1;
    final total = baseCount * it.quantity;
    return '$total pc${total == 1 ? '' : 's'}';
  }
  if (it.quantity > 1) {
    return '${it.quantity} × $u';
  }
  return u;
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({required this.item, required this.busy, required this.onQty, required this.onRemove, required this.onSaveForLater});
  final LineItem item;
  final bool busy;
  final ValueChanged<int> onQty;
  final VoidCallback onRemove, onSaveForLater;

  @override
  Widget build(BuildContext context) {
    final it = item;
    final v = context.vsr;
    final t = Theme.of(context).textTheme;
    final avail = it.available?.toInt();
    final (stockText, stockFg) = it.outOfStock
        ? ('Only ${avail ?? 0} available', v.danger)
        : avail != null && avail <= 5
            ? ('Only $avail left', v.warning)
            : ('In stock', v.success);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(VsrSpace.md, VsrSpace.md, VsrSpace.xs, VsrSpace.xs),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Semantics(
            button: true,
            label: 'Open ${it.name}',
            child: InkWell(
              onTap: () => context.push('/product/${it.productId}'),
              borderRadius: BorderRadius.circular(VsrRadius.md),
              child: NetImage(it.image, width: 84, height: 84, radius: VsrRadius.md),
            ),
          ),
          const SizedBox(width: VsrSpace.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(it.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.25)),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove ${it.name}',
                  onPressed: busy ? null : onRemove,
                  visualDensity: VisualDensity.compact,
                  icon: Icon(Icons.delete_outline_rounded, size: 20, color: v.muted),
                ),
              ]),
              Text.rich(TextSpan(style: t.bodySmall, children: [
                TextSpan(text: _cartItemUnit(it)),
                const TextSpan(text: ' · '),
                TextSpan(text: stockText, style: TextStyle(color: stockFg, fontWeight: FontWeight.w700)),
              ])),
              const SizedBox(height: VsrSpace.sm),
              Padding(
                padding: const EdgeInsets.only(right: VsrSpace.sm),
                child: Row(children: [
                  Expanded(
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: money(it.lineTotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, fontFeatures: [FontFeature.tabularFigures()])),
                      if (it.mrp > it.unitPrice)
                        TextSpan(text: '  ${money(it.mrp * it.quantity)}', style: t.bodySmall?.copyWith(decoration: TextDecoration.lineThrough)),
                      if (it.quantity > 1) TextSpan(text: '\n${money(it.unitPrice)} each', style: t.bodySmall),
                    ])),
                  ),
                  QtyStepper(compact: true, qty: it.quantity, busy: busy, max: (it.available ?? 50).toInt().clamp(1, 50), onChanged: onQty),
                ]),
              ),
              TextButton.icon(
                onPressed: busy ? null : onSaveForLater,
                style: TextButton.styleFrom(
                  foregroundColor: v.brandText,
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.xs),
                  minimumSize: const Size(0, 40),
                  textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                icon: const Icon(Icons.favorite_border_rounded, size: 17),
                label: const Text('Save for later'),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _CouponCard extends StatelessWidget {
  const _CouponCard({required this.cart, required this.onTap});
  final CartView cart;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    final applied = cart.couponCode != null;
    return Material(
      color: applied ? v.successBg : VsrColors.accent.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(VsrRadius.lg),
        side: BorderSide(color: (applied ? v.success : VsrColors.accent).withValues(alpha: 0.35)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(VsrRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(VsrSpace.md),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: applied ? v.success : VsrColors.accent, borderRadius: BorderRadius.circular(VsrRadius.sm)),
              child: Icon(applied ? Icons.check_rounded : Icons.percent_rounded, color: Colors.white),
            ),
            const SizedBox(width: VsrSpace.md),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(applied ? '${cart.couponCode} applied' : 'Apply coupon', style: TextStyle(fontWeight: FontWeight.w800, color: v.ink)),
                const SizedBox(height: 2),
                Text(
                  applied
                      ? (cart.totals.discount > 0 ? 'You save ${money(cart.totals.discount)}' : 'Free delivery unlocked')
                      : 'Get discounts on your order',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: applied ? v.success : null, fontWeight: applied ? FontWeight.w600 : null),
                ),
              ]),
            ),
            Text(applied ? 'Change' : 'View offers', style: TextStyle(fontWeight: FontWeight.w700, color: applied ? v.success : VsrColors.accentDark)),
            Icon(Icons.chevron_right_rounded, color: applied ? v.success : VsrColors.accentDark),
          ]),
        ),
      ),
    );
  }
}

class _CouponSheet extends ConsumerStatefulWidget {
  const _CouponSheet({this.current});
  final String? current;
  @override
  ConsumerState<_CouponSheet> createState() => _CouponSheetState();
}

class _CouponSheetState extends ConsumerState<_CouponSheet> {
  final _c = TextEditingController();
  late final _coupons = ref.read(apiProvider).get('/store/me/coupons');
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(VsrSpace.gutter + 4, 0, VsrSpace.gutter + 4, MediaQuery.of(context).viewInsets.bottom + VsrSpace.xl),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Apply Coupon', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: VsrSpace.lg),
          Row(children: [
            Expanded(child: TextField(controller: _c, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'Enter coupon code'))),
            const SizedBox(width: VsrSpace.sm),
            SizedBox(width: 96, height: 54, child: FilledButton(onPressed: () => Navigator.pop(context, _c.text.trim().toUpperCase()), child: const Text('Apply'))),
          ]),
          const SizedBox(height: VsrSpace.lg),
          FutureBuilder(
            future: _coupons,
            builder: (_, snap) {
              if (!snap.hasData) return const LoadingView(rows: 2);
              final list = ((snap.data as Json)['coupons'] as List).cast<Json>();
              return Column(children: [
                for (final c in list)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.confirmation_number_outlined, color: VsrColors.accent),
                    title: Text(c['code'] as String, style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)),
                    subtitle: Text('${c['type'] == 'percent' ? '${c['value']}% off' : c['type'] == 'flat' ? '₹${c['value']} off' : 'Free delivery'} · Min order ₹${c['minOrder']}'),
                    trailing: TextButton(onPressed: () => Navigator.pop(context, c['code'] as String), child: const Text('APPLY')),
                  ),
              ]);
            },
          ),
          if (widget.current != null) TextButton(onPressed: () => Navigator.pop(context, ''), child: Text('Remove applied coupon', style: TextStyle(color: context.vsr.danger))),
        ]),
      );
}

// -------------------------------------------------------------- Addresses ----
/// Used both for checkout selection (select=true) and profile management.
class AddressesScreen extends ConsumerStatefulWidget {
  const AddressesScreen({super.key, this.select = false});
  final bool select;
  @override
  ConsumerState<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends ConsumerState<AddressesScreen> {
  String? _picked;
  @override
  Widget build(BuildContext context) {
    final list = ref.watch(addressesProvider);
    final v = context.vsr;
    return Scaffold(
      appBar: AppBar(title: Text(widget.select ? 'Delivery Address' : 'My Addresses')),
      body: AsyncBody(
        value: list,
        onRetry: () => ref.invalidate(addressesProvider),
        builder: (items) {
          final selected = _picked ?? items.where((a) => a.isDefault).firstOrNull?.id ?? items.firstOrNull?.id;
          return ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.xl), children: [
            if (widget.select) ...[const CheckoutSteps(at: 1), const SizedBox(height: VsrSpace.xl)],
            // Add new address: dashed-feel accent card
            Material(
              color: v.accent50,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: VsrColors.accent.withValues(alpha: 0.4), width: 1.5)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.push('/address/new'),
                child: Padding(
                  padding: const EdgeInsets.all(VsrSpace.lg),
                  child: Row(children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(color: VsrColors.accent.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(VsrRadius.md)),
                      child: const Icon(Icons.add, color: VsrColors.accentDark, size: 26),
                    ),
                    const SizedBox(width: VsrSpace.lg),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Add New Address', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        Text('Save a new delivery address', style: TextStyle(fontSize: 14, color: v.muted)),
                      ]),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: VsrColors.accentDark),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: VsrSpace.xl),
            if (items.isEmpty)
              const MessageView(icon: Icons.location_off_outlined, title: 'No saved addresses', message: 'Add an address to see delivery options.')
            else ...[
              Row(children: [
                const Expanded(child: Text('Saved Addresses', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                Text('${items.length} address${items.length == 1 ? '' : 'es'}', style: TextStyle(fontSize: 14, color: v.muted)),
              ]),
              const SizedBox(height: VsrSpace.md),
              for (final a in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: VsrSpace.group),
                  child: _AddressTile(
                    a: a,
                    selectable: widget.select,
                    selected: widget.select && selected == a.id,
                    onTap: widget.select ? () => setState(() => _picked = a.id) : () => context.push('/address/${a.id}', extra: a),
                    onEdit: () => context.push('/address/${a.id}', extra: a),
                  ),
                ),
            ],
          ]);
        },
      ),
      bottomNavigationBar: widget.select && (list.value?.isNotEmpty ?? false)
          ? BottomCta(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: VsrColors.accent, foregroundColor: Colors.white),
                onPressed: () {
                  final items = list.value!;
                  final id = _picked ?? items.where((a) => a.isDefault).firstOrNull?.id ?? items.first.id;
                  context.push('/checkout/payment', extra: items.firstWhere((a) => a.id == id));
                },
                icon: const Icon(Icons.local_shipping_outlined),
                label: const Text('Deliver to this Address'),
              ),
            )
          : null,
    );
  }
}

class _AddressTile extends StatelessWidget {
  const _AddressTile({required this.a, required this.selectable, required this.selected, required this.onTap, required this.onEdit});
  final Address a;
  final bool selectable, selected;
  final VoidCallback onTap, onEdit;
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    final muted = TextStyle(fontSize: 14, color: v.muted);
    return Semantics(
      selected: selectable ? selected : null,
      inMutuallyExclusiveGroup: selectable,
      child: Material(
        color: selected ? v.brand50 : v.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: selected ? v.brandText : v.line, width: selected ? 1.6 : 1)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(VsrSpace.lg),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(color: selected ? v.surface : v.brand50, borderRadius: BorderRadius.circular(VsrRadius.md)),
                  child: Icon(a.label == 'Work' ? Icons.business_outlined : a.label == 'Home' ? Icons.home_outlined : Icons.location_on_outlined, color: v.brandText, size: 28),
                ),
                const SizedBox(width: VsrSpace.md),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: VsrSpace.sm, children: [
                      Text(a.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                      if (a.isDefault) const StatusChip('default'),
                    ]),
                    const SizedBox(height: VsrSpace.xs),
                    Wrap(spacing: VsrSpace.lg, runSpacing: 2, children: [
                      Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.person_outline, size: 16, color: v.muted), const SizedBox(width: 4), Text(a.recipient, style: muted)]),
                      Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.call_outlined, size: 16, color: v.muted), const SizedBox(width: 4), Text(a.phone, style: muted)]),
                    ]),
                    const SizedBox(height: 2),
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(padding: const EdgeInsets.only(top: 2), child: Icon(Icons.location_on_outlined, size: 16, color: v.muted)),
                      const SizedBox(width: 4),
                      Expanded(child: Text(a.oneLine, maxLines: 3, overflow: TextOverflow.ellipsis, style: muted)),
                    ]),
                  ]),
                ),
                if (selectable)
                  Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: selected ? v.brandText : v.muted)
                else
                  IconButton(tooltip: 'Edit address', onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 20)),
              ]),
              if (selectable) ...[
                const SizedBox(height: VsrSpace.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Edit')),
                ),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// Checkout progress: Cart → Address → Payment. Done steps get a tick, the current one is orange.
class CheckoutSteps extends StatelessWidget {
  const CheckoutSteps({super.key, required this.at});
  final int at;
  static const _steps = [('Cart', Icons.shopping_cart_outlined), ('Address', Icons.location_on_outlined), ('Payment', Icons.credit_card)];
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    return Semantics(
      label: 'Checkout step ${at + 1} of 3: ${_steps[at].$1}',
      child: ExcludeSemantics(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final (i, s) in _steps.indexed)
            Expanded(
              child: Column(children: [
                SizedBox(
                  height: 48,
                  child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
                    if (i > 0)
                      Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.5, child: Container(height: 2, color: i <= at ? v.success : v.line))),
                    if (i < _steps.length - 1)
                      Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerRight, widthFactor: 0.5, child: Container(height: 2, color: i + 1 <= at ? v.success : v.line))),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: i == at ? VsrColors.accent : i < at ? v.successBg : v.lineSoft),
                      child: Icon(s.$2, size: 22, color: i == at ? Colors.white : i < at ? v.success : v.muted),
                    ),
                    if (i < at)
                      Positioned(
                        top: -2,
                        right: 0,
                        left: 34,
                        child: Center(
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(color: v.success, shape: BoxShape.circle, border: Border.all(color: v.bg, width: 2)),
                            child: const Icon(Icons.check, size: 12, color: Colors.white),
                          ),
                        ),
                      ),
                  ]),
                ),
                const SizedBox(height: 6),
                Text(s.$1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: i == at ? VsrColors.accentDark : i < at ? v.ink : v.muted)),
              ]),
            ),
        ]),
      ),
    );
  }
}

class AddressFormScreen extends ConsumerStatefulWidget {
  const AddressFormScreen({super.key, this.existing, this.prefill});
  final Address? existing;
  /// Pre-filled from a confirmed map pin (new address only).
  final Address? prefill;
  @override
  ConsumerState<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends ConsumerState<AddressFormScreen> {
  final _form = GlobalKey<FormState>();
  late String _label = widget.existing?.label ?? 'Home';
  late bool _default = widget.existing?.isDefault ?? false;
  late final _name = TextEditingController(text: widget.existing?.recipient ?? ref.read(sessionProvider).user?.name);
  late final _phone = TextEditingController(text: widget.existing?.phone ?? ref.read(sessionProvider).user?.phone);
  late final _line1 = TextEditingController(text: widget.existing?.line1 ?? widget.prefill?.line1);
  late final _area = TextEditingController(text: widget.existing?.line2 ?? widget.prefill?.line2);
  late final _landmark = TextEditingController(text: widget.existing?.landmark);
  late final _city = TextEditingController(text: widget.existing?.city ?? widget.prefill?.city ?? 'Hyderabad');
  late final _state = TextEditingController(text: widget.existing?.state ?? widget.prefill?.state ?? 'Telangana');
  late final _pin = TextEditingController(text: widget.existing?.postalCode ?? widget.prefill?.postalCode);
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _phone, _line1, _area, _landmark, _city, _state, _pin]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    // Warn (don't block) when the PIN is outside the delivery area.
    try {
      final r = await ref.read(apiProvider).get('/store/serviceability', query: {'pincode': _pin.text.trim()}) as Json;
      if (r['serviceable'] != true && mounted) {
        final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            icon: Icon(Icons.wrong_location_outlined, color: context.vsr.warning),
            title: const Text('We don’t deliver here yet'),
            content: Text('PIN ${_pin.text.trim()} is outside our delivery area. You can save it, but orders can’t be delivered there right now.'),
            actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Change')), TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save anyway'))],
          ),
        );
        if (ok != true) {
          if (mounted) setState(() => _busy = false);
          return;
        }
      }
    } catch (_) {
      // Serviceability is advisory here; checkout enforces it.
    }
    final body = Address(id: '', label: _label, recipient: _name.text.trim(), phone: _phone.text.trim(), line1: _line1.text.trim(), line2: _area.text.trim(), landmark: _landmark.text.trim(), city: _city.text.trim(), state: _state.text.trim(), postalCode: _pin.text.trim(), isDefault: _default, lat: widget.existing?.lat ?? widget.prefill?.lat, lng: widget.existing?.lng ?? widget.prefill?.lng).toJson();
    try {
      final api = ref.read(apiProvider);
      if (widget.existing == null) {
        await api.post('/store/me/addresses', body);
      } else {
        await api.put('/store/me/addresses/${widget.existing!.id}', body);
      }
      ref.invalidate(addressesProvider);
      if (mounted) {
        showMessage(context, 'Address saved');
        final inCheckout = GoRouter.of(context).routerDelegate.currentConfiguration.matches.any((m) => m.matchedLocation == '/checkout/address');
        // Saved → Home, except mid-checkout (back to the address picker to continue)
        if (inCheckout) {
          context.pop();
        } else {
          context.go('/');
        }
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(title: Text('Delete address?'), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Cancel')), TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Delete', style: TextStyle(color: context.vsr.danger)))]),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).delete('/store/me/addresses/${widget.existing!.id}');
      ref.invalidate(addressesProvider);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  String? _req(String? v) => (v ?? '').trim().isEmpty ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    const gap = SizedBox(height: VsrSpace.lg);
    // Grouped sections (web: AddressForm in shop/pages/Checkout.tsx)
    Widget section({required IconData? icon, required String title, required List<Widget> children}) => Container(
          padding: const EdgeInsets.all(VsrSpace.lg),
          decoration: BoxDecoration(color: v.surface, borderRadius: BorderRadius.circular(VsrRadius.lg + 4), border: Border.all(color: v.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              if (icon != null) ...[Icon(icon, size: 20, color: v.brandText), const SizedBox(width: VsrSpace.sm)],
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ]),
            const SizedBox(height: VsrSpace.lg),
            ...children,
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Add Delivery Address' : 'Edit Address')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
          section(icon: null, title: 'Save address as', children: [
            Row(children: [
              for (final (i, (l, ic)) in const [('Home', Icons.home_outlined), ('Work', Icons.business_outlined), ('Other', Icons.location_on_outlined)].indexed) ...[
                if (i > 0) const SizedBox(width: VsrSpace.sm),
                Expanded(
                  child: Semantics(
                    selected: _label == l,
                    inMutuallyExclusiveGroup: true,
                    child: Material(
                      color: _label == l ? v.brand50 : v.surface,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.md), side: BorderSide(color: _label == l ? v.brandText : v.line, width: _label == l ? 1.6 : 1)),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => setState(() => _label = l),
                        child: SizedBox(
                          height: 48,
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(ic, size: 18, color: _label == l ? v.brandText : v.muted),
                            const SizedBox(width: 6),
                            Text(l, style: TextStyle(fontWeight: FontWeight.w700, color: _label == l ? v.ink : v.muted)),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ]),
          ]),
          const SizedBox(height: VsrSpace.group),
          section(icon: Icons.person_outline, title: 'Contact details', children: [
            TextFormField(controller: _name, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Recipient name'), validator: _req),
            gap,
            TextFormField(controller: _phone, textInputAction: TextInputAction.next, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number'), validator: (v) => isPhone(v ?? '') ? null : 'Enter a valid mobile number'),
          ]),
          const SizedBox(height: VsrSpace.group),
          section(icon: Icons.location_on_outlined, title: 'Address', children: [
            TextFormField(controller: _line1, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Flat / House no., Building'), validator: _req),
            gap,
            TextFormField(controller: _area, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Area / Locality'), validator: _req),
            gap,
            TextFormField(controller: _landmark, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Landmark (optional)', hintText: 'e.g. Near metro station')),
            gap,
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: TextFormField(controller: _city, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'City'), validator: _req)),
              const SizedBox(width: VsrSpace.md),
              Expanded(child: TextFormField(controller: _pin, textInputAction: TextInputAction.next, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)], decoration: const InputDecoration(labelText: 'PIN code'), validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '') ? null : '6 digits')),
            ]),
            gap,
            TextFormField(controller: _state, decoration: const InputDecoration(labelText: 'State'), validator: _req),
          ]),
          const SizedBox(height: VsrSpace.group),
          Container(
            decoration: BoxDecoration(color: v.surface, borderRadius: BorderRadius.circular(VsrRadius.lg + 4), border: Border.all(color: v.line)),
            child: SwitchListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg, vertical: VsrSpace.xs),
              title: const Text('Set as default address', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('Used first at checkout'),
              value: _default,
              onChanged: (v) => setState(() => _default = v),
            ),
          ),
          if (widget.existing != null) ...[
            const SizedBox(height: VsrSpace.lg),
            Center(
              child: TextButton.icon(
                onPressed: _delete,
                style: TextButton.styleFrom(foregroundColor: v.danger),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete this address'),
              ),
            ),
          ],
        ]),
      ),
      bottomNavigationBar: BottomCta(child: FilledButton(onPressed: _busy ? null : _save, child: _busy ? const Busy() : const Text('Save Address'))),
    );
  }
}

// ---------------------------------------------------------------- Payment ----
class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key, required this.address});
  final Address address;
  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  String _method = 'cod';
  bool _busy = false;
  final _note = TextEditingController();
  // One key per checkout attempt → retries/double taps never create duplicate orders
  final String _idem = '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
  Razorpay? _rzp;
  String? _orderId;

  static const _methods = [
    ('upi', Icons.phone_iphone, 'UPI', 'Pay using PhonePe, Google Pay, Paytm and more'),
    ('card', Icons.credit_card, 'Credit / Debit Card', 'Visa, Mastercard, RuPay & more'),
    ('netbanking', Icons.account_balance_outlined, 'Net Banking', 'All major banks'),
    ('wallet', Icons.account_balance_wallet_outlined, 'Wallets', 'Paytm, Amazon Pay & more'),
    ('cod', Icons.payments_outlined, 'Cash on Delivery', 'Pay with cash at the time of delivery'),
  ];

  @override
  void dispose() {
    _rzp?.clear();
    _note.dispose();
    super.dispose();
  }

  Future<void> _place(String method) async {
    setState(() => _busy = true);
    try {
      final d = await ref.read(apiProvider).post(
        '/store/me/orders',
        {'addressId': widget.address.id, 'paymentMethod': method, if (_note.text.trim().isNotEmpty) 'instructions': _note.text.trim()},
        {'Idempotency-Key': _idem},
      ) as Json;
      final order = d['order'] as Json;
      _orderId = order['_id'] as String;
      ref.invalidate(cartProvider);
      ref.invalidate(ordersProvider);
      final rzp = d['razorpay'] as Json?;
      if (rzp != null) {
        _openRazorpay(rzp, order['orderNumber'] as String);
      } else if (mounted) {
        context.go('/order-success/$_orderId');
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
      setState(() => _busy = false);
    }
  }

  void _openRazorpay(Json r, String orderNumber) {
    final user = ref.read(sessionProvider).user;
    _rzp = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse res) async {
        try {
          await ref.read(apiProvider).post('/store/me/payments/verify', {'razorpayOrderId': res.orderId, 'razorpayPaymentId': res.paymentId, 'razorpaySignature': res.signature});
        } catch (_) {
          // Webhook reconciles late/failed verifications; the order screen shows the live state.
        }
        if (mounted) context.go('/order-success/$_orderId');
      })
      ..on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse res) {
        if (!mounted) return;
        setState(() => _busy = false);
        showMessage(context, 'Payment not completed. Your order is saved; you can retry from My Orders or contact support.', error: true);
        context.go('/orders/$_orderId');
      });
    _rzp!.open({
      'key': r['keyId'],
      'order_id': r['orderId'],
      'amount': r['amount'],
      'currency': 'INR',
      'name': 'VSR',
      'description': 'Order #$orderNumber',
      'prefill': {'email': user?.email ?? '', 'contact': user?.phone ?? ''},
      'theme': {'color': '#0B3D2E'},
    });
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(paymentConfigProvider);
    final cart = ref.watch(cartProvider).value;
    final allowed = ((cfg.value?['paymentMethods'] as List?) ?? const ['cod']).cast<String>();
    // Never leave an unavailable method selected
    final method = allowed.contains(_method) ? _method : (allowed.contains('cod') ? 'cod' : allowed.firstOrNull ?? 'cod');
    final v = context.vsr;
    final a = widget.address;
    final total = money(cart?.totals.grandTotal);
    final cardShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: v.line));
    final tints = {
      'upi': (VsrColors.accentDark, v.accent50),
      'card': (v.warning, v.warningBg),
      'netbanking': (v.info, v.infoBg),
      'wallet': (v.danger, v.dangerBg),
      'cod': (v.success, v.successBg),
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Payment')),
      body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.xl), children: [
        const CheckoutSteps(at: 2),
        const SizedBox(height: VsrSpace.xl),
        Material(
          color: v.surface,
          shape: cardShape,
          child: Padding(
            padding: const EdgeInsets.all(VsrSpace.lg),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: v.accent50, borderRadius: BorderRadius.circular(VsrRadius.md)),
                child: const Icon(Icons.location_on, color: VsrColors.accent, size: 26),
              ),
              const SizedBox(width: VsrSpace.md),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Deliver to ${a.label}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 2),
                  Text('${a.recipient}, ${a.oneLine}', style: TextStyle(fontSize: 14, color: v.muted)),
                  if (a.phone.isNotEmpty) Text('Mobile: ${a.phone}', style: TextStyle(fontSize: 14, color: v.muted)),
                ]),
              ),
              TextButton(
                onPressed: () => context.pop(),
                style: TextButton.styleFrom(backgroundColor: v.brand50, foregroundColor: v.brandText, shape: const StadiumBorder()),
                child: const Text('Change'),
              ),
            ]),
          ),
        ),
        const SizedBox(height: VsrSpace.xl),
        Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, runSpacing: VsrSpace.xs, children: [
          const Text('Choose payment method', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.verified_user, size: 16, color: v.success),
            const SizedBox(width: 4),
            Text('100% Secure Payments', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: v.success)),
          ]),
        ]),
        const SizedBox(height: VsrSpace.md),
        for (final m in _methods)
          Padding(
            padding: const EdgeInsets.only(bottom: VsrSpace.md),
            child: Builder(builder: (_) {
              final ok = allowed.contains(m.$1);
              final on = method == m.$1;
              final (fg, bg) = tints[m.$1]!;
              return Semantics(
                selected: on,
                inMutuallyExclusiveGroup: true,
                enabled: ok,
                child: Opacity(
                  opacity: ok ? 1 : 0.55,
                  child: Material(
                    color: on ? v.brand50 : v.surface,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: on ? v.brandText : v.line, width: on ? 1.6 : 1)),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: ok ? () => setState(() => _method = m.$1) : null,
                      child: Padding(
                        padding: const EdgeInsets.all(VsrSpace.lg),
                        child: Row(children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(VsrRadius.md)),
                            child: Icon(m.$2, color: fg, size: 24),
                          ),
                          const SizedBox(width: VsrSpace.lg),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(m.$3, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                              Text(ok ? m.$4 : 'Not available right now', style: TextStyle(fontSize: 14, color: v.muted)),
                            ]),
                          ),
                          const SizedBox(width: VsrSpace.sm),
                          Icon(on ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: on ? v.brandText : v.muted),
                        ]),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        const SizedBox(height: VsrSpace.md),
        TextField(
          controller: _note,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Delivery instructions (optional)', hintText: 'e.g. Call before delivery', prefixIcon: Icon(Icons.chat_bubble_outline)),
        ),
        const SizedBox(height: VsrSpace.sm),
        if (cart != null && cart.items.isNotEmpty) BillCard(totals: cart.totals, count: cart.count),
      ]),
      bottomNavigationBar: BottomCta(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: VsrColors.accent, foregroundColor: Colors.white),
            onPressed: _busy || cart == null || cart.items.isEmpty ? null : () => _place(method),
            child: _busy
                ? const Busy()
                : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(method == 'cod' ? 'Place Order · $total' : 'Pay $total'),
                    const SizedBox(width: VsrSpace.sm),
                    const Icon(Icons.arrow_forward, size: 20),
                  ]),
          ),
          const SizedBox(height: VsrSpace.sm),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.lock_outline, size: 14, color: v.muted),
            const SizedBox(width: 4),
            Flexible(child: Text('Secure payments by Razorpay. VSR never stores your card details.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: v.muted))),
          ]),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------- Order success ----
class OrderSuccessScreen extends ConsumerStatefulWidget {
  const OrderSuccessScreen({super.key, required this.orderId});
  final String orderId;
  @override
  ConsumerState<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends ConsumerState<OrderSuccessScreen> {
  // Celebrate briefly, then open the order (go: Back must not return here)
  int _left = 3;
  Timer? _timer;
  String get orderId => widget.orderId;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_left <= 1) {
        t.cancel();
        context.go('/orders/$orderId');
      } else {
        setState(() => _left--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(orderProvider(orderId));
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(VsrSpace.xl, VsrSpace.sm, VsrSpace.xl, VsrSpace.xl),
          child: Column(children: [
            const Spacer(),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: MediaQuery.of(context).disableAnimations ? 1 : 0.6, end: 1),
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutBack,
              builder: (_, s, child) => Transform.scale(scale: s, child: child),
              child: Container(width: 112, height: 112, decoration: const BoxDecoration(color: VsrColors.success, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, color: Colors.white, size: 64)),
            ),
            const SizedBox(height: VsrSpace.xxl),
            Text('Order Placed Successfully!', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: VsrSpace.lg),
            order.when(
              data: (o) => Column(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg, vertical: VsrSpace.sm),
                  decoration: BoxDecoration(color: context.vsr.surface, borderRadius: BorderRadius.circular(VsrRadius.pill), border: Border.all(color: context.vsr.line)),
                  child: Text('Order #${o.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                const SizedBox(height: VsrSpace.lg),
                Text(
                  o.paymentStatus == 'paid' || o.paymentMethod == 'cod'
                      ? 'VSR will confirm your order shortly. We’ll notify you at every step.'
                      : 'We’re confirming your payment. Your order will be reviewed once payment is verified.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ]),
              loading: () => const SizedBox(height: 60),
              error: (_, _) => const SizedBox(height: 60),
            ),
            const Spacer(),
            FilledButton(onPressed: () { _timer?.cancel(); context.go('/orders/$orderId'); }, child: const Text('Track Order')),
            const SizedBox(height: VsrSpace.sm),
            TextButton(onPressed: () { _timer?.cancel(); context.go('/'); }, child: const Text('Continue Shopping')),
            const SizedBox(height: VsrSpace.xs),
            Semantics(liveRegion: true, child: Text('Opening your order in ${_left}s…', style: TextStyle(fontSize: 13, color: context.vsr.muted))),
          ]),
        ),
      ),
    );
  }
}
