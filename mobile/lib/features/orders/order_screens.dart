import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'invoice.dart';

// ------------------------------------------------------------- My orders ----
// Tabs group statuses the same way the API's `tab` filter does (web: shop/pages/Orders.tsx).
const _groups = {
  'ongoing': ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'],
  'delivered': ['delivered', 'return_requested', 'returned'],
  'cancelled': ['cancelled', 'rejected'],
};
bool _inTab(OrderSummary o, String tab) => tab == 'all' || (_groups[tab]?.contains(o.status) ?? false);

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});
  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  static const _tabs = [
    ('all', 'All', Icons.inventory_2_outlined),
    ('ongoing', 'Ongoing', Icons.local_shipping_outlined),
    ('delivered', 'Delivered', Icons.task_alt),
    ('cancelled', 'Cancelled', Icons.cancel_outlined),
  ];
  String _tab = 'all';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(isSignedInProvider)) {
      return Scaffold(
        appBar: AppBar(title: const Text('My Orders')),
        body: const GuestPrompt(
          icon: Icons.receipt_long_outlined,
          title: 'Log in to see your orders',
          message: 'Track deliveries, reorder and get help with past orders.',
        ),
      );
    }
    // One fetch; tabs, counts and search all work off it
    final orders = ref.watch(ordersProvider('all'));
    final all = orders.value ?? const <OrderSummary>[];
    final v = context.vsr;
    return Scaffold(
      appBar: AppBar(title: const Text('My Orders')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.md),
          child: TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by order no. or item'),
            onChanged: (s) => setState(() => _q = s.trim().toLowerCase()),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter),
            itemCount: _tabs.length,
            separatorBuilder: (_, _) => const SizedBox(width: VsrSpace.sm),
            itemBuilder: (_, i) {
              final (key, label, icon) = _tabs[i];
              final on = _tab == key;
              final n = all.where((o) => _inTab(o, key)).length;
              return Semantics(
                selected: on,
                button: true,
                child: Material(
                  color: on ? VsrColors.accent.withValues(alpha: 0.12) : v.surface,
                  shape: StadiumBorder(side: BorderSide(color: on ? VsrColors.accent : v.line)),
                  child: InkWell(
                    customBorder: const StadiumBorder(),
                    onTap: () => setState(() => _tab = key),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 8, 0),
                      child: Row(children: [
                        Icon(icon, size: 18, color: on ? VsrColors.accent : v.muted),
                        const SizedBox(width: VsrSpace.sm),
                        Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: on ? v.ink : v.muted)),
                        if (orders.hasValue) ...[
                          const SizedBox(width: VsrSpace.sm),
                          Container(
                            constraints: const BoxConstraints(minWidth: 24),
                            height: 24,
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            decoration: BoxDecoration(color: on ? VsrColors.accent : v.lineSoft, borderRadius: BorderRadius.circular(12)),
                            child: Text('$n', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: on ? Colors.white : v.muted, fontFeatures: const [FontFeature.tabularFigures()])),
                          ),
                        ],
                      ]),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: VsrSpace.md),
        Expanded(
          child: AsyncBody(
            value: orders,
            onRetry: () => ref.invalidate(ordersProvider('all')),
            builder: (list) {
              final shown = list
                  .where((o) => _inTab(o, _tab) && (_q.isEmpty || o.orderNumber.toLowerCase().contains(_q) || o.items.any((i) => i.name.toLowerCase().contains(_q))))
                  .toList();
              if (shown.isEmpty) {
                return MessageView(
                  icon: Icons.receipt_long_outlined,
                  title: _q.isNotEmpty ? 'No matching orders' : 'No orders here',
                  message: _q.isNotEmpty
                      ? 'Try an order number or an item name.'
                      : _tab == 'all'
                          ? 'Your orders will appear here once you place one.'
                          : null,
                  action: _tab == 'all' && _q.isEmpty ? 'Start Shopping' : null,
                  onAction: () => context.go('/'),
                );
              }
              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(ordersProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, 0, VsrSpace.gutter, VsrSpace.navClearance),
                  itemCount: shown.length,
                  separatorBuilder: (_, _) => const SizedBox(height: VsrSpace.lg),
                  itemBuilder: (_, i) => _OrderCard(shown[i]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

// Compact 4-stop tracker for the list; the detail screen keeps the full timeline
const _mini = [
  ('Placed', ['placed']),
  ('Packed', ['confirmed', 'picking', 'packed']),
  ('On the way', ['assigned', 'out_for_delivery', 'delivery_failed']),
  ('Delivered', ['delivered', 'return_requested', 'returned']),
];

class _OrderCard extends ConsumerStatefulWidget {
  const _OrderCard(this.o);
  final OrderSummary o;
  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  bool _busy = false;

  Future<void> _reorder() async {
    setState(() => _busy = true);
    try {
      final d = await ref.read(apiProvider).post('/store/me/orders/${widget.o.id}/reorder') as Json;
      ref.read(cartProvider.notifier).replace(CartView.fromJson(d));
      if (mounted) context.push('/cart');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final reason = await showModalBottomSheet<String>(context: context, showDragHandle: true, builder: (_) => const _CancelSheet());
    if (reason == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post('/store/me/orders/${widget.o.id}/cancel', {'reason': reason});
      ref.invalidate(orderProvider(widget.o.id));
      ref.invalidate(ordersProvider);
      if (mounted) showMessage(context, 'Order cancelled');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.o;
    final v = context.vsr;
    final count = o.items.fold<int>(0, (s, i) => s + i.quantity);
    final (fg, bg) = switch (o.status) {
      'delivered' || 'confirmed' || 'return_requested' || 'returned' => (v.success, v.successBg),
      'cancelled' || 'rejected' || 'delivery_failed' => (v.danger, v.dangerBg),
      'out_for_delivery' || 'assigned' => (v.info, v.infoBg),
      _ => (v.warning, v.warningBg),
    };
    final terminal = _groups['cancelled']!.contains(o.status);
    final stage = _mini.indexWhere((m) => m.$2.contains(o.status));
    DateTime? at(List<String> ss) =>
        o.history.where((h) => ss.contains(h.to)).lastOrNull?.at ?? (ss.contains('placed') ? o.createdAt : null);
    void open() => context.push('/orders/${o.id}');
    final first = o.items.firstOrNull;

    return Material(
      color: v.surface,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: v.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Status-tinted header
        InkWell(
          onTap: open,
          child: Container(
            color: bg.withValues(alpha: 0.6),
            padding: const EdgeInsets.fromLTRB(VsrSpace.lg, VsrSpace.md, VsrSpace.sm, VsrSpace.md),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('#${o.orderNumber}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('${shortDate(o.createdAt)} · $count item${count == 1 ? '' : 's'}', style: TextStyle(fontSize: 13, color: v.muted)),
                ]),
              ),
              StatusChip(o.status),
              Icon(Icons.chevron_right_rounded, color: v.muted),
            ]),
          ),
        ),
        // Items + total
        InkWell(
          onTap: open,
          child: Padding(
            padding: const EdgeInsets.all(VsrSpace.lg),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 80,
                height: 80,
                child: Stack(children: [
                  NetImage(first?.image, width: 80, height: 80, radius: VsrRadius.md),
                  if (o.items.length > 1)
                    Positioned(
                      right: 6,
                      bottom: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: VsrColors.brand900, borderRadius: BorderRadius.circular(10)),
                        child: Text('+${o.items.length - 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ),
                ]),
              ),
              const SizedBox(width: VsrSpace.lg),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: first?.name ?? ''),
                      if (o.items.length > 1) TextSpan(text: ' + ${o.items.length - 1} more', style: TextStyle(color: v.muted, fontWeight: FontWeight.w600)),
                    ]),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, height: 1.3),
                  ),
                  const SizedBox(height: VsrSpace.xs),
                  Text(o.paymentMethod == 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase(), style: TextStyle(fontSize: 13, color: v.muted)),
                ]),
              ),
              const SizedBox(width: VsrSpace.sm),
              Text(money(o.totals.grandTotal), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
            ]),
          ),
        ),
        // Progress or cancellation note
        Padding(
          padding: const EdgeInsets.fromLTRB(VsrSpace.lg, 0, VsrSpace.lg, VsrSpace.lg),
          child: terminal
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.md, vertical: 10),
                  decoration: BoxDecoration(color: v.dangerBg.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(VsrRadius.md)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.cancel_outlined, size: 18, color: v.danger),
                    const SizedBox(width: VsrSpace.sm),
                    Expanded(
                      child: Text(
                        '${o.status == 'cancelled' ? 'Cancelled' : 'Rejected'}'
                        '${(o.rejectionReason?.isNotEmpty ?? false) ? ' — ${o.rejectionReason}' : ''}'
                        '${o.paymentStatus.startsWith('refund') ? ' · Refund ${o.paymentStatus.replaceFirst('refund_', '')}' : ''}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ]),
                )
              : Semantics(
                  label: 'Order progress: ${stage >= 0 ? _mini[stage].$1 : 'Placed'}',
                  child: ExcludeSemantics(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      for (var i = 0; i < _mini.length; i++)
                        Expanded(
                          child: _MiniStop(
                            label: _mini[i].$1,
                            when: i <= stage ? at(_mini[i].$2) : null,
                            done: i <= stage,
                            first: i == 0,
                            last: i == _mini.length - 1,
                            nextDone: i + 1 <= stage,
                            color: fg,
                          ),
                        ),
                    ]),
                  ),
                ),
        ),
        // Actions
        Container(
          decoration: BoxDecoration(border: Border(top: BorderSide(color: v.line))),
          padding: const EdgeInsets.all(VsrSpace.sm),
          child: Row(children: [
            Expanded(
              child: o.isActive
                  ? OutlinedButton.icon(onPressed: open, icon: const Icon(Icons.local_shipping_outlined, size: 18), label: const Text('Track'))
                  : OutlinedButton.icon(onPressed: _busy ? null : _reorder, icon: const Icon(Icons.replay, size: 18), label: const Text('Buy again')),
            ),
            if (o.canCancel) ...[
              const SizedBox(width: VsrSpace.sm),
              Expanded(
                child: TextButton.icon(
                  onPressed: _busy ? null : _cancel,
                  style: TextButton.styleFrom(foregroundColor: v.danger),
                  icon: const Icon(Icons.cancel_outlined, size: 18),
                  label: const Text('Cancel'),
                ),
              ),
            ] else if (o.status == 'delivered' && o.rating == null) ...[
              const SizedBox(width: VsrSpace.sm),
              Expanded(child: TextButton.icon(onPressed: () => context.push('/orders/${o.id}/rate'), icon: const Icon(Icons.star_outline, size: 18), label: const Text('Rate'))),
            ],
            const SizedBox(width: VsrSpace.sm),
            Expanded(child: TextButton.icon(onPressed: () => context.push('/help?order=${o.id}'), icon: const Icon(Icons.help_outline, size: 18), label: const Text('Help'))),
          ]),
        ),
      ]),
    );
  }
}

class _MiniStop extends StatelessWidget {
  const _MiniStop({required this.label, required this.when, required this.done, required this.first, required this.last, required this.nextDone, required this.color});
  final String label;
  final DateTime? when;
  final bool done, first, last, nextDone;
  final Color color;
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    return Column(children: [
      SizedBox(
        height: 20,
        child: Stack(alignment: Alignment.center, children: [
          if (!first)
            Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.5, child: Container(height: 2, color: done ? color : v.line))),
          if (!last)
            Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerRight, widthFactor: 0.5, child: Container(height: 2, color: nextDone ? color : v.line))),
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(shape: BoxShape.circle, color: done ? color : v.surface, border: done ? null : Border.all(color: v.line, width: 2)),
            child: done ? const Icon(Icons.check, size: 13, color: Colors.white) : null,
          ),
        ]),
      ),
      const SizedBox(height: 6),
      Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: done ? v.ink : v.muted)),
      Text(when == null ? '—' : DateFormat('d MMM, h:mm a').format(when!.toLocal()), textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: v.muted)),
    ]);
  }
}

// --------------------------------------------------------- Order details ----
const _steps = [
  ('placed', 'Order Placed', Icons.receipt_long_outlined),
  ('confirmed', 'Confirmed', Icons.check_circle_outline),
  ('picking', 'Preparing', Icons.inventory_2_outlined),
  ('packed', 'Packed', Icons.all_inbox_outlined),
  ('out_for_delivery', 'Out for Delivery', Icons.delivery_dining_outlined),
  ('delivered', 'Delivered', Icons.home_outlined),
];
const _flow = [
  'placed',
  'confirmed',
  'picking',
  'packed',
  'assigned',
  'out_for_delivery',
  'delivered',
];

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _busy = false;
  Razorpay? _rzp;

  @override
  void dispose() {
    _rzp?.clear();
    super.dispose();
  }

  /// Unpaid online order: the server re-creates the Razorpay order from the order's own total
  /// (the app never sends an amount), then verification happens on the server too.
  Future<void> _pay(OrderSummary o) async {
    setState(() => _busy = true);
    try {
      final d = await ref.read(apiProvider).post('/store/me/orders/${o.id}/retry-payment') as Json;
      final r = d['razorpay'] as Json;
      final user = ref.read(sessionProvider).user;
      void refresh() {
        ref.invalidate(orderProvider(o.id));
        ref.invalidate(ordersProvider);
        if (mounted) setState(() => _busy = false);
      }

      _rzp?.clear();
      _rzp = Razorpay()
        ..on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse res) async {
          try {
            await ref.read(apiProvider).post('/store/me/payments/verify', {'razorpayOrderId': res.orderId, 'razorpayPaymentId': res.paymentId, 'razorpaySignature': res.signature});
          } catch (_) {
            // The webhook reconciles late/failed verifications
          }
          refresh();
          if (mounted) showMessage(context, 'Payment received. Thank you!');
        })
        ..on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse res) {
          refresh();
          if (mounted) showMessage(context, 'Payment not completed. You can try again anytime.', error: true);
        });
      _rzp!.open({
        'key': r['keyId'],
        'order_id': r['orderId'],
        'amount': r['amount'],
        'currency': 'INR',
        'name': 'VSR',
        'description': 'Order #${o.orderNumber}',
        'prefill': {'email': user?.email ?? '', 'contact': user?.phone ?? ''},
        'theme': {'color': '#0B3D2E'},
      });
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showMessage(context, errorText(e), error: true);
      }
    }
  }

  Future<void> _cancel(OrderSummary o) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => const _CancelSheet(),
    );
    if (reason == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post('/store/me/orders/${o.id}/cancel', {
        'reason': reason,
      });
      ref.invalidate(orderProvider(o.id));
      ref.invalidate(ordersProvider);
      if (mounted) showMessage(context, 'Order cancelled');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reorder(OrderSummary o) async {
    setState(() => _busy = true);
    try {
      final d =
          await ref.read(apiProvider).post('/store/me/orders/${o.id}/reorder')
              as Json;
      ref.read(cartProvider.notifier).replace(CartView.fromJson(d));
      if (mounted) context.push('/cart');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _buyItemAgain(LineItem it) async {
    setState(() => _busy = true);
    try {
      final currentCart = ref.read(cartProvider).value;
      final currentQty =
          currentCart?.qtyOf(it.productId, variantId: it.variantId) ?? 0;
      final targetQty =
          (currentQty > 0 ? currentQty + it.quantity : it.quantity).clamp(1, 50);
      await ref.read(cartProvider.notifier).setQty(
            it.productId,
            targetQty,
            variantId: it.variantId,
          );
      if (mounted) {
        showMessage(context, '${it.name} added to cart');
        context.push('/cart');
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _orderItemUnit(LineItem it) {
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
    return u;
  }

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(orderProvider(widget.id));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order Details'),
        actions: [
          IconButton(
            tooltip: 'Help with this order',
            onPressed: () => context.push('/help?order=${widget.id}'),
            icon: const Icon(Icons.support_agent),
          ),
        ],
      ),
      body: AsyncBody(
        value: order,
        onRetry: () => ref.invalidate(orderProvider(widget.id)),
        builder: (o) {
          final v = context.vsr;
          final terminal = o.status == 'cancelled' || o.status == 'rejected';
          final delivered = o.status == 'delivered';
          final idx = _flow.indexOf(o.status);
          final count = o.items.fold<int>(0, (s, i) => s + i.quantity);
          DateTime? at(String s) => o.history.where((h) => h.to == s).lastOrNull?.at;
          final lastAt = o.history.lastOrNull?.at;
          final (fg, bg) = switch (o.status) {
            'delivered' || 'confirmed' => (v.success, v.successBg),
            'cancelled' || 'rejected' || 'delivery_failed' => (v.danger, v.dangerBg),
            'out_for_delivery' || 'assigned' => (v.info, v.infoBg),
            _ => (v.warning, v.warningBg),
          };
          final (heroTitle, heroSub, heroIcon) = delivered
              ? ('Delivered successfully', 'Your order was delivered on ${dateTime(at('delivered') ?? lastAt)}.', Icons.inventory_rounded)
              : terminal
                  ? (
                      o.status == 'cancelled' ? 'Order cancelled' : 'Order rejected',
                      [
                        if (o.rejectionReason?.isNotEmpty ?? false) o.rejectionReason!,
                        if (o.paymentStatus.startsWith('refund')) 'Refund ${o.paymentStatus.replaceFirst('refund_', '')}',
                      ].join(' · ').ifEmpty('Updated ${dateTime(lastAt)}.'),
                      Icons.cancel_outlined,
                    )
                  : (o.status == 'out_for_delivery' || o.status == 'assigned')
                      ? ('On the way', 'Your order is out for delivery. Keep your delivery code ready.', Icons.local_shipping_outlined)
                      : o.status == 'delivery_failed'
                          ? ('Delivery attempt failed', 'We’ll try again soon. Need to change something? Get help below.', Icons.error_outline)
                          : ('Order in progress', 'We’re getting your order ready.', Icons.inventory_2_outlined);
          final cardShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg + 4), side: BorderSide(color: v.line));
          const gap = SizedBox(height: VsrSpace.group);

          Widget iconBox(IconData icon) => Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: v.brand100, borderRadius: BorderRadius.circular(VsrRadius.sm)),
                child: Icon(icon, size: 22, color: v.brandText),
              );

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(orderProvider(widget.id)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.xl),
              children: [
                // Header
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Order #${o.orderNumber}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text('Placed ${dateTime(o.createdAt)}', style: TextStyle(fontSize: 13, color: v.muted)),
                      Text.rich(
                        TextSpan(children: [
                          TextSpan(text: '$count item${count == 1 ? '' : 's'} · '),
                          TextSpan(text: money(o.totals.grandTotal), style: TextStyle(fontWeight: FontWeight.w700, color: v.ink)),
                        ]),
                        style: TextStyle(fontSize: 13, color: v.muted),
                      ),
                    ]),
                  ),
                  const SizedBox(width: VsrSpace.sm),
                  StatusChip(o.status),
                ]),
                if (o.deliveryCode != null) ...[
                  gap,
                  Semantics(
                    label: 'Delivery code ${o.deliveryCode!.split('').join(' ')}. Share only with your delivery partner at your door.',
                    child: ExcludeSemantics(
                      child: Container(
                        padding: const EdgeInsets.all(VsrSpace.lg + 4),
                        decoration: BoxDecoration(color: VsrColors.brand900, borderRadius: BorderRadius.circular(VsrRadius.lg + 4)),
                        child: Row(children: [
                          const Icon(Icons.key_rounded, color: VsrColors.accent),
                          const SizedBox(width: VsrSpace.lg),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('Delivery code', style: TextStyle(color: Colors.white70, fontSize: 13)),
                              const SizedBox(height: VsrSpace.xs),
                              Text(o.deliveryCode!, style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 6)),
                              const SizedBox(height: VsrSpace.xs),
                              const Text('Share only with your delivery partner at your door.', style: TextStyle(color: Colors.white70, fontSize: 12)),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ],
                gap,
                // Status banner + tracker
                Material(
                  color: v.surface,
                  shape: cardShape,
                  clipBehavior: Clip.antiAlias,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Container(
                      color: bg,
                      padding: const EdgeInsets.all(VsrSpace.lg + 4),
                      child: Row(children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(color: v.surface, borderRadius: BorderRadius.circular(VsrRadius.md)),
                          child: Icon(heroIcon, size: 28, color: fg),
                        ),
                        const SizedBox(width: VsrSpace.lg),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(heroTitle, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: fg, letterSpacing: -0.2)),
                            const SizedBox(height: 2),
                            Text(heroSub, style: TextStyle(fontSize: 14, color: v.ink.withValues(alpha: 0.8))),
                          ]),
                        ),
                      ]),
                    ),
                    if (!terminal)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: VsrSpace.xs, vertical: VsrSpace.lg + 4),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          for (final (i, s) in _steps.indexed)
                            Expanded(
                              child: _Stop(
                                // One short line per column keeps the row aligned on phones
                                label: switch (s.$1) { 'placed' => 'Placed', 'out_for_delivery' => 'On the way', _ => s.$2 },
                                when: at(s.$1) ?? (s.$1 == 'out_for_delivery' ? at('assigned') : s.$1 == 'placed' ? o.createdAt : null),
                                done: idx >= _flow.indexOf(s.$1),
                                nextDone: i + 1 < _steps.length && idx >= _flow.indexOf(_steps[i + 1].$1),
                                current: !delivered && (o.status == s.$1 || (s.$1 == 'out_for_delivery' && o.status == 'assigned')),
                                first: i == 0,
                                last: i == _steps.length - 1,
                                color: fg,
                              ),
                            ),
                        ]),
                      ),
                  ]),
                ),
                if (o.partner != null) ...[
                  gap,
                  Material(
                    color: v.surface,
                    shape: cardShape,
                    child: Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Row(children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: v.lineSoft,
                          backgroundImage: o.partner!.avatar != null ? NetworkImage(o.partner!.avatar!) : null,
                          child: o.partner!.avatar == null ? Icon(Icons.person, color: v.muted) : null,
                        ),
                        const SizedBox(width: VsrSpace.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: VsrSpace.sm, children: [
                              Text('${delivered ? 'Delivered by' : 'Delivering:'} ${o.partner!.name}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                              if (o.partner!.rating != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: v.warningBg, borderRadius: BorderRadius.circular(20)),
                                  child: Text('${o.partner!.rating} ★', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: v.warning)),
                                ),
                            ]),
                            Text('Your delivery partner', style: TextStyle(fontSize: 13, color: v.muted)),
                          ]),
                        ),
                        if (o.partner!.phone != null)
                          OutlinedButton.icon(
                            onPressed: () => safeLaunch('tel:${o.partner!.phone}', context: context),
                            icon: const Icon(Icons.call, size: 18),
                            label: const Text('Call'),
                          ),
                      ]),
                    ),
                  ),
                ],
                gap,
                // Items
                Material(
                  color: v.surface,
                  shape: cardShape,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(VsrSpace.lg, VsrSpace.lg, VsrSpace.lg, VsrSpace.xs),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(children: [
                        Expanded(child: Text('Items (${o.items.length})', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
                        if (!o.isActive)
                          OutlinedButton.icon(
                            onPressed: _busy ? null : () => _reorder(o),
                            icon: const Icon(Icons.replay, size: 18),
                            label: const Text('Buy again'),
                          ),
                      ]),
                      for (final (i, it) in o.items.indexed)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: VsrSpace.md),
                          decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: v.line))),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            InkWell(
                              onTap: () => context.push('/product/${it.productId}'),
                              borderRadius: BorderRadius.circular(VsrRadius.md),
                              child: SizedBox(
                                width: 76,
                                height: 76,
                                child: Stack(children: [
                                  NetImage(it.image, width: 76, height: 76, radius: VsrRadius.md),
                                  Positioned(
                                    right: 5,
                                    bottom: 5,
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(color: v.surface, shape: BoxShape.circle),
                                      child: Text('${it.quantity}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                    ),
                                  ),
                                ]),
                              ),
                            ),
                            const SizedBox(width: VsrSpace.md),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                InkWell(
                                  onTap: () => context.push('/product/${it.productId}'),
                                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(it.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, height: 1.3)),
                                        Text(
                                          [
                                            _orderItemUnit(it),
                                            '${it.quantity} × ${money(it.unitPrice)}',
                                          ].join(' · '),
                                          style: TextStyle(fontSize: 13, color: v.muted),
                                        ),
                                      ]),
                                    ),
                                    const SizedBox(width: VsrSpace.sm),
                                    Text(money(it.lineTotal), style: const TextStyle(fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
                                  ]),
                                ),
                                const SizedBox(height: VsrSpace.sm),
                                Wrap(
                                  spacing: VsrSpace.sm,
                                  runSpacing: VsrSpace.xs,
                                  children: [
                                    OutlinedButton.icon(
                                      onPressed: _busy ? null : () => _buyItemAgain(it),
                                      icon: const Icon(Icons.replay, size: 16),
                                      label: const Text('Buy again'),
                                      style: OutlinedButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      ),
                                    ),
                                    if (delivered)
                                      OutlinedButton.icon(
                                        onPressed: () => context.push('/product/${it.productId}/review'),
                                        icon: const Icon(Icons.star_outline, size: 16, color: VsrColors.accent),
                                        label: const Text('Write a review'),
                                        style: OutlinedButton.styleFrom(
                                          visualDensity: VisualDensity.compact,
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        ),
                                      ),
                                  ],
                                ),
                              ]),
                            ),
                          ]),
                        ),
                    ]),
                  ),
                ),
                gap,
                // Address
                if (o.address != null) ...[
                  Material(
                    color: v.surface,
                    shape: cardShape,
                    child: Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        iconBox(Icons.location_on_outlined),
                        const SizedBox(width: VsrSpace.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${delivered ? 'Delivered to' : 'Delivering to'} ${o.address!.label}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            const SizedBox(height: VsrSpace.xs),
                            Text('${o.address!.recipient}, ${o.address!.oneLine}', style: TextStyle(fontSize: 14, color: v.muted)),
                            if (o.address!.phone.isNotEmpty) Text('Mobile: ${o.address!.phone}', style: TextStyle(fontSize: 14, color: v.muted)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                  gap,
                ],
                // Payment
                Material(
                  color: v.surface,
                  shape: cardShape,
                  child: Padding(
                    padding: const EdgeInsets.all(VsrSpace.lg),
                    child: Row(children: [
                      iconBox(Icons.account_balance_wallet_outlined),
                      const SizedBox(width: VsrSpace.md),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('Payment method', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          Text(o.paymentMethod == 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase(), style: TextStyle(fontSize: 14, color: v.muted)),
                        ]),
                      ),
                      StatusChip(o.paymentStatus),
                    ]),
                  ),
                ),
                gap,
                BillCard(totals: o.totals, count: count),
                const SizedBox(height: VsrSpace.lg),
                if (o.status == 'placed' && o.paymentMethod != 'cod' && o.paymentStatus != 'paid') ...[
                  Container(
                    padding: const EdgeInsets.all(VsrSpace.lg),
                    decoration: BoxDecoration(color: context.vsr.warningBg, borderRadius: BorderRadius.circular(VsrRadius.lg)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text('Payment pending', style: TextStyle(fontWeight: FontWeight.w800, color: context.vsr.ink)),
                      const SizedBox(height: VsrSpace.xxs),
                      Text("This order is waiting for payment. It's confirmed once the payment goes through.", style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: VsrSpace.md),
                      FilledButton.icon(
                        onPressed: _busy ? null : () => _pay(o),
                        icon: const Icon(Icons.account_balance_wallet_outlined),
                        label: Text('Complete payment · ${money(o.totals.grandTotal)}'),
                      ),
                    ]),
                  ),
                  const SizedBox(height: VsrSpace.lg),
                ],
                // Actions: two-up grid, help card full width
                Wrap(spacing: VsrSpace.md, runSpacing: VsrSpace.md, children: [
                  for (final b in [
                    if (delivered) OutlinedButton.icon(onPressed: () => printInvoice(o), icon: const Icon(Icons.download_outlined, size: 18), label: const Text('Invoice')),
                    if (!o.isActive) OutlinedButton.icon(onPressed: _busy ? null : () => _reorder(o), icon: const Icon(Icons.replay, size: 18), label: const Text('Reorder')),
                    if (delivered && o.rating == null) OutlinedButton.icon(onPressed: () => context.push('/orders/${o.id}/rate'), icon: const Icon(Icons.star_outline, size: 18), label: const Text('Rate order')),
                    if (o.canCancel)
                      OutlinedButton.icon(
                        onPressed: _busy ? null : () => _cancel(o),
                        style: OutlinedButton.styleFrom(foregroundColor: v.danger, side: BorderSide(color: v.danger.withValues(alpha: 0.4))),
                        icon: const Icon(Icons.cancel_outlined, size: 18),
                        label: const Text('Cancel order'),
                      ),
                  ])
                    SizedBox(width: (MediaQuery.sizeOf(context).width - VsrSpace.gutter * 2 - VsrSpace.md) / 2, child: b),
                ]),
                const SizedBox(height: VsrSpace.md),
                Material(
                  color: v.surface,
                  shape: cardShape,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/help?order=${o.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Row(children: [
                        Icon(Icons.support_agent, color: v.brandText, size: 26),
                        const SizedBox(width: VsrSpace.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('Get help', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            Text('Need help with this order?', style: TextStyle(fontSize: 13, color: v.muted)),
                          ]),
                        ),
                        Icon(Icons.chevron_right_rounded, color: v.muted),
                      ]),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
}

/// One stop of the horizontal order tracker.
class _Stop extends StatelessWidget {
  const _Stop({required this.label, required this.when, required this.done, required this.nextDone, required this.current, required this.first, required this.last, required this.color});
  final String label;
  final DateTime? when;
  final bool done, nextDone, current, first, last;
  final Color color;
  @override
  Widget build(BuildContext context) {
    final v = context.vsr;
    return Semantics(
      label: '$label, ${done ? 'done' : current ? 'in progress' : 'pending'}${when != null ? ', ${dateTime(when)}' : ''}',
      child: ExcludeSemantics(
        child: Column(children: [
          SizedBox(
            height: 26,
            child: Stack(alignment: Alignment.center, children: [
              if (!first)
                Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: 0.5, child: Container(height: 2, color: done ? color : v.line))),
              if (!last)
                Positioned(left: 0, right: 0, child: FractionallySizedBox(alignment: Alignment.centerRight, widthFactor: 0.5, child: Container(height: 2, color: nextDone ? color : v.line))),
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? color : v.surface,
                  border: done ? null : Border.all(color: v.line, width: 2),
                  boxShadow: current ? [BoxShadow(color: VsrColors.accent.withValues(alpha: 0.3), spreadRadius: 4)] : null,
                ),
                child: done ? const Icon(Icons.check, size: 15, color: Colors.white) : null,
              ),
            ]),
          ),
          const SizedBox(height: 6),
          Text(label, textAlign: TextAlign.center, maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: TextStyle(fontSize: 11, height: 1.3, fontWeight: FontWeight.w700, color: done ? v.ink : v.muted)),
          const SizedBox(height: 2),
          Text(
            when == null ? (current ? 'Now' : '—') : DateFormat('d MMM,\nh:mm a').format(when!.toLocal()),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10.5, height: 1.25, color: v.muted),
          ),
        ]),
      ),
    );
  }
}


class _CancelSheet extends StatefulWidget {
  const _CancelSheet();
  @override
  State<_CancelSheet> createState() => _CancelSheetState();
}

class _CancelSheetState extends State<_CancelSheet> {
  static const _reasons = [
    'Ordered by mistake',
    'Want to change items',
    'Delivery time too long',
    'Found a better price',
    'Other',
  ];
  String? _r;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(VsrSpace.gutter + 4, 0, VsrSpace.gutter + 4, VsrSpace.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Why are you cancelling?',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: VsrSpace.xs),
          Text('Pick the closest reason. It helps us improve.', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: VsrSpace.md),
          RadioGroup<String>(
            groupValue: _r,
            onChanged: (v) => setState(() => _r = v),
            child: Column(
              children: [
                for (final r in _reasons)
                  RadioListTile<String>(
                    value: r,
                    title: Text(r),
                    contentPadding: EdgeInsets.zero,
                  ),
              ],
            ),
          ),
          const SizedBox(height: VsrSpace.lg),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: context.vsr.danger),
            onPressed: _r == null ? null : () => Navigator.pop(context, _r),
            child: Text('Cancel Order'),
          ),
        ],
      ),
    ),
  );
}

// ------------------------------------------------------------ Rate order ----
class RateOrderScreen extends ConsumerStatefulWidget {
  const RateOrderScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<RateOrderScreen> createState() => _RateOrderScreenState();
}

class _RateOrderScreenState extends ConsumerState<RateOrderScreen> {
  int _stars = 0;
  final _text = TextEditingController();
  bool _busy = false;
  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post('/store/me/orders/${widget.id}/review', {
        'rating': _stars,
        if (_text.text.trim().isNotEmpty) 'text': _text.text.trim(),
      });
      ref.invalidate(orderProvider(widget.id));
      if (mounted) {
        showMessage(context, 'Thanks for your review!');
        context.pop();
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Rate & Review')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xl, VsrSpace.gutter, VsrSpace.xl),
      children: [
        Text('How was your order?', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: VsrSpace.xs),
        Text('Rate the products and the delivery.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: VsrSpace.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                tooltip: '$i star${i > 1 ? 's' : ''}',
                iconSize: 44,
                onPressed: () => setState(() => _stars = i),
                icon: Icon(
                  i <= _stars ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: VsrColors.accent,
                ),
              ),
          ],
        ),
        const SizedBox(height: VsrSpace.xl),
        TextField(
          controller: _text,
          maxLines: 4,
          maxLength: 1000,
          decoration: const InputDecoration(
            hintText: 'Tell us about the quality and delivery…',
          ),
        ),
      ],
    ),
    bottomNavigationBar: BottomCta(
      child: FilledButton(
        onPressed: _stars == 0 || _busy ? null : _submit,
        child: _busy ? const Busy() : const Text('Submit Review'),
      ),
    ),
  );
}
