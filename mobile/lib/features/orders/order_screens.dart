import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

// ------------------------------------------------------------- My orders ----
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});
  static const _tabs = [
    ('all', 'All'),
    ('ongoing', 'Ongoing'),
    ('delivered', 'Delivered'),
    ('cancelled', 'Cancelled'),
  ];
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      !ref.watch(isSignedInProvider)
      ? Scaffold(
          appBar: AppBar(title: const Text('My Orders')),
          body: const GuestPrompt(
            icon: Icons.receipt_long_outlined,
            title: 'Log in to see your orders',
            message: 'Track deliveries, reorder and get help with past orders.',
          ),
        )
      : DefaultTabController(
          length: _tabs.length,
          child: Scaffold(
            appBar: AppBar(
              title: const Text('My Orders'),
              bottom: TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: [for (final t in _tabs) Tab(text: t.$2)],
              ),
            ),
            body: TabBarView(
              children: [for (final t in _tabs) _OrderList(tab: t.$1)],
            ),
          ),
        );
}

class _OrderList extends ConsumerWidget {
  const _OrderList({required this.tab});
  final String tab;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider(tab));
    return AsyncBody(
      value: orders,
      onRetry: () => ref.invalidate(ordersProvider(tab)),
      builder: (list) => list.isEmpty
          ? MessageView(
              icon: Icons.receipt_long_outlined,
              title: 'No orders here',
              message: tab == 'all'
                  ? 'Your orders will appear here once you place one.'
                  : null,
              action: tab == 'all' ? 'Start Shopping' : null,
              onAction: () => context.go('/'),
            )
          : RefreshIndicator(
              onRefresh: () async => ref.invalidate(ordersProvider(tab)),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.md, VsrSpace.gutter, VsrSpace.navClearance),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: VsrSpace.group),
                itemBuilder: (_, i) => _OrderCard(list[i]),
              ),
            ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard(this.o);
  final OrderSummary o;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final count = o.items.fold<int>(0, (s, i) => s + i.quantity);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/orders/${o.id}'),
        child: Padding(
          padding: const EdgeInsets.all(VsrSpace.lg),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 56,
              height: 56,
              child: Stack(children: [
                NetImage(o.items.firstOrNull?.image, width: 56, height: 56, radius: VsrRadius.sm),
                if (o.items.length > 1)
                  Positioned(
                    right: 3,
                    bottom: 3,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: VsrColors.brand900, borderRadius: BorderRadius.circular(6)),
                      child: Text('+${o.items.length - 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ]),
            ),
            const SizedBox(width: VsrSpace.md),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text('#${o.orderNumber}', style: t.titleSmall)),
                  Text(money(o.totals.grandTotal), style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800, fontFeatures: const [FontFeature.tabularFigures()])),
                ]),
                const SizedBox(height: VsrSpace.xxs),
                Text('${shortDate(o.createdAt)} · $count item${count == 1 ? '' : 's'}', style: t.bodySmall),
                const SizedBox(height: VsrSpace.sm),
                Row(children: [
                  StatusChip(o.status),
                  const Spacer(),
                  Icon(Icons.chevron_right_rounded, color: context.vsr.muted),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
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
          final t = Theme.of(context).textTheme;
          final terminal = o.status == 'cancelled' || o.status == 'rejected';
          final idx = _flow.indexOf(o.status);
          DateTime? at(String s) =>
              o.history.where((h) => h.to == s).firstOrNull?.at;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(orderProvider(widget.id)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(VsrSpace.lg),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('#${o.orderNumber}', style: t.titleMedium),
                              const SizedBox(height: VsrSpace.xxs),
                              Text(dateTime(o.createdAt), style: t.bodySmall),
                            ],
                          ),
                        ),
                        StatusChip(o.status),
                      ],
                    ),
                  ),
                ),
                if (o.deliveryCode != null) ...[
                  const SizedBox(height: VsrSpace.group),
                  Semantics(
                    label:
                        'Delivery code ${o.deliveryCode!.split('').join(' ')}. Share only with your delivery partner at your door.',
                    child: Container(
                      padding: const EdgeInsets.all(VsrSpace.lg + 4),
                      decoration: BoxDecoration(
                        color: VsrColors.brand900,
                        borderRadius: BorderRadius.circular(VsrRadius.lg),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.key_rounded,
                            color: VsrColors.accent,
                          ),
                          const SizedBox(width: VsrSpace.lg),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Delivery code',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: VsrSpace.xs),
                                Text(
                                  o.deliveryCode!,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 26,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 6,
                                  ),
                                ),
                                const SizedBox(height: VsrSpace.xs),
                                const Text(
                                  'Share only with your delivery partner at your door.',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: VsrSpace.group),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: terminal
                        ? Row(
                            children: [
                              Icon(
                                Icons.cancel_outlined,
                                color: context.vsr.danger,
                              ),
                              const SizedBox(width: VsrSpace.md),
                              Expanded(
                                child: Text(
                                  '${titleCase(o.status)}${o.rejectionReason != null ? ' — ${o.rejectionReason}' : ''}${o.paymentStatus.startsWith('refund') ? '\nRefund: ${titleCase(o.paymentStatus)}' : ''}',
                                ),
                              ),
                            ],
                          )
                        : Column(
                            children: [
                              for (final (i, s) in _steps.indexed)
                                _TimelineRow(
                                  icon: s.$3,
                                  label: s.$2,
                                  time:
                                      at(s.$1) ??
                                      (s.$1 == 'out_for_delivery'
                                          ? at('assigned')
                                          : null),
                                  done: idx >= _flow.indexOf(s.$1),
                                  current:
                                      o.status == s.$1 ||
                                      (s.$1 == 'out_for_delivery' &&
                                          o.status == 'assigned'),
                                  last: i == _steps.length - 1,
                                ),
                            ],
                          ),
                  ),
                ),
                if (o.partner != null) ...[
                  const SizedBox(height: VsrSpace.group),
                  Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundImage: o.partner!.avatar != null
                            ? NetworkImage(o.partner!.avatar!)
                            : null,
                        child: o.partner!.avatar == null
                            ? const Icon(Icons.person)
                            : null,
                      ),
                      title: Text(
                        o.partner!.name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        'Your delivery partner · ★ ${o.partner!.rating ?? '-'}',
                      ),
                      trailing: o.partner!.phone == null
                          ? null
                          : IconButton.filled(
                              tooltip: 'Call delivery partner',
                              onPressed: () => safeLaunch(
                                'tel:${o.partner!.phone}',
                                context: context,
                              ),
                              icon: const Icon(Icons.call),
                            ),
                    ),
                  ),
                ],
                const SizedBox(height: VsrSpace.group),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Items (${o.items.length})', style: t.titleMedium),
                        const SizedBox(height: VsrSpace.xs),
                        for (final it in o.items)
                          Padding(
                            padding: const EdgeInsets.only(top: VsrSpace.md),
                            child: Row(
                              children: [
                                NetImage(
                                  it.image,
                                  width: 48,
                                  height: 48,
                                  radius: 10,
                                ),
                                const SizedBox(width: VsrSpace.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        it.name,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      Text(
                                        '${it.unit} · ×${it.quantity}',
                                        style: t.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  money(it.lineTotal),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                TileGroup(children: [
                  if (o.address != null)
                    NavTile(
                      icon: Icons.location_on_outlined,
                      label: 'Delivering to ${o.address!.label}',
                      detail: '${o.address!.recipient} · ${o.address!.oneLine}',
                    ),
                  NavTile(
                    icon: Icons.payments_outlined,
                    label: o.paymentMethod == 'cod' ? 'Cash on Delivery' : o.paymentMethod.toUpperCase(),
                    trailing: StatusChip(o.paymentStatus),
                  ),
                ]),
                const SizedBox(height: VsrSpace.group),
                BillCard(
                  totals: o.totals,
                  count: o.items.fold<int>(0, (s, i) => s + i.quantity),
                ),
                const SizedBox(height: VsrSpace.xl),
                // Actions: primary first, destructive last, one consistent gap
                if (o.status == 'delivered' && o.rating == null) ...[
                  FilledButton.icon(
                    onPressed: () => context.push('/orders/${o.id}/rate'),
                    icon: const Icon(Icons.star_outline),
                    label: const Text('Rate & Review'),
                  ),
                  const SizedBox(height: VsrSpace.sm),
                ],
                if (!o.isActive) ...[
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _reorder(o),
                    icon: const Icon(Icons.replay),
                    label: const Text('Reorder'),
                  ),
                  const SizedBox(height: VsrSpace.sm),
                ],
                if (o.canCancel) ...[
                  OutlinedButton(
                    onPressed: _busy ? null : () => _cancel(o),
                    style: OutlinedButton.styleFrom(foregroundColor: context.vsr.danger, side: BorderSide(color: context.vsr.danger.withValues(alpha: 0.4))),
                    child: const Text('Cancel Order'),
                  ),
                  const SizedBox(height: VsrSpace.sm),
                ],
                Center(
                  child: TextButton.icon(
                    onPressed: () => context.push('/help?order=${o.id}'),
                    icon: const Icon(Icons.help_outline),
                    label: const Text('Need help with this order?'),
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

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.icon,
    required this.label,
    required this.time,
    required this.done,
    required this.current,
    required this.last,
  });
  final IconData icon;
  final String label;
  final DateTime? time;
  final bool done, current, last;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Column(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: done ? VsrColors.brand800 : context.vsr.lineSoft,
                shape: BoxShape.circle,
                border: current
                    ? Border.all(color: VsrColors.accent, width: 2)
                    : null,
              ),
              child: Icon(
                icon,
                size: 16,
                color: done ? Colors.white : context.vsr.muted,
              ),
            ),
            if (!last)
              Expanded(
                child: Container(
                  width: 2,
                  margin: EdgeInsets.symmetric(vertical: 2),
                  color: done ? context.vsr.brandText : context.vsr.line,
                ),
              ),
          ],
        ),
        const SizedBox(width: VsrSpace.md),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: 6, bottom: last ? 0 : VsrSpace.xl - 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontWeight: done || current
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: done || current ? null : context.vsr.muted,
                  ),
                ),
                Text(
                  time != null
                      ? dateTime(time)
                      : current
                      ? 'In progress'
                      : 'Pending',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
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
