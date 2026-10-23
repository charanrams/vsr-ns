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

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final count = cart.value?.count ?? 0;
    return Scaffold(
      appBar: AppBar(
        title: Text(count > 0 ? 'My Cart ($count items)' : 'My Cart'),
        actions: [
          if (count > 0)
            TextButton(
              onPressed: () async {
                if (await _confirm('Clear cart?', 'All items will be removed from your cart.', 'Clear')) {
                  try {
                    await ref.read(cartProvider.notifier).clear();
                  } catch (e) {
                    if (context.mounted) showMessage(context, errorText(e), error: true);
                  }
                }
              },
              child: Text('Clear All', style: TextStyle(color: context.vsr.danger)),
            ),
        ],
      ),
      body: AsyncBody(
        value: cart,
        onRetry: () => ref.invalidate(cartProvider),
        builder: (c) {
          if (c.items.isEmpty) {
            return MessageView(icon: Icons.shopping_bag_outlined, title: 'Your cart is empty', message: 'Add fresh groceries, essentials or homemade food to get started.', action: 'Start Shopping', onAction: () => context.go('/'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(cartProvider),
            child: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
              for (final w in c.warnings)
                Container(
                  margin: const EdgeInsets.only(bottom: VsrSpace.group),
                  padding: const EdgeInsets.all(VsrSpace.md),
                  decoration: BoxDecoration(color: context.vsr.warningBg, borderRadius: BorderRadius.circular(VsrRadius.md)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Icons.warning_amber_rounded, color: context.vsr.warning, size: 20), const SizedBox(width: VsrSpace.md), Expanded(child: Text(w, style: TextStyle(fontSize: 13, height: 1.4, color: context.vsr.ink)))]),
                ),
              Card(
                clipBehavior: Clip.antiAlias,
                child: Column(children: [
                  for (final (i, it) in c.items.indexed) ...[
                    // Divider starts where the item text starts
                    if (i > 0) const Divider(indent: VsrSpace.lg + 64 + VsrSpace.md, endIndent: VsrSpace.lg),
                    Dismissible(
                      key: ValueKey(it.key),
                      direction: DismissDirection.endToStart,
                      confirmDismiss: (_) => _confirm('Remove item?', 'Remove ${it.name} from your cart?', 'Remove'),
                      onDismissed: (_) => _set(it, 0),
                      background: Container(alignment: Alignment.centerRight, padding: EdgeInsets.only(right: 20), color: context.vsr.dangerBg, child: Icon(Icons.delete_outline, color: context.vsr.danger)),
                      child: Padding(
                        padding: const EdgeInsets.all(VsrSpace.lg),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          InkWell(onTap: () => context.push('/product/${it.productId}'), borderRadius: BorderRadius.circular(VsrRadius.sm), child: NetImage(it.image, width: 64, height: 64, radius: VsrRadius.sm)),
                          const SizedBox(width: VsrSpace.md),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(it.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.3)),
                              const SizedBox(height: VsrSpace.xxs),
                              Text(it.variantName != null ? 'Size: ${it.variantName}' : it.unit, style: Theme.of(context).textTheme.bodySmall),
                              const SizedBox(height: VsrSpace.sm),
                              Row(children: [
                                Expanded(
                                  child: Text.rich(TextSpan(children: [
                                    TextSpan(text: money(it.lineTotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                                    if (it.quantity > 1) TextSpan(text: '  ${money(it.unitPrice)} each', style: Theme.of(context).textTheme.bodySmall),
                                  ])),
                                ),
                                QtyStepper(
                                  compact: true,
                                  qty: it.quantity,
                                  busy: _busy.contains(it.key),
                                  max: (it.available ?? 50).toInt().clamp(1, 50),
                                  onChanged: (q) async {
                                    if (q == 0 && !await _confirm('Remove item?', 'Remove ${it.name} from your cart?', 'Remove')) return;
                                    _set(it, q);
                                  },
                                ),
                              ]),
                              if (it.outOfStock) ...[
                                const SizedBox(height: VsrSpace.xs),
                                Text('Only ${it.available} available', style: TextStyle(color: context.vsr.danger, fontSize: 12, fontWeight: FontWeight.w600)),
                              ],
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ]),
              ),
              const SizedBox(height: VsrSpace.group),
              TileGroup(children: [
                ListTile(
                  leading: const Icon(Icons.local_offer_outlined, color: VsrColors.accent),
                  title: Text(c.couponCode == null ? 'Apply coupon' : 'Coupon ${c.couponCode} applied'),
                  subtitle: c.totals.discount > 0 ? Text('You save ${money(c.totals.discount)}', style: TextStyle(color: context.vsr.success, fontWeight: FontWeight.w600)) : null,
                  trailing: Icon(Icons.chevron_right_rounded, color: context.vsr.muted),
                  onTap: () => _coupon(c),
                ),
              ]),
              const SizedBox(height: VsrSpace.group),
              BillCard(totals: c.totals, count: c.count),
              const SizedBox(height: VsrSpace.md),
              Text('Prices and availability are confirmed again when you place the order.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
            ]),
          );
        },
      ),
      bottomNavigationBar: (cart.value?.items.isNotEmpty ?? false)
          ? BottomCta(
              leading: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Total', style: Theme.of(context).textTheme.bodySmall),
                Text(money(cart.value!.totals.grandTotal), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
              ]),
              child: FilledButton(
                onPressed: cart.value!.items.any((i) => i.outOfStock) ? null : () => context.push('/checkout/address'),
                child: const Text('Proceed to Checkout'),
              ),
            )
          : null,
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
    return Scaffold(
      appBar: AppBar(title: Text(widget.select ? 'Select Delivery Address' : 'My Addresses')),
      body: AsyncBody(
        value: list,
        onRetry: () => ref.invalidate(addressesProvider),
        builder: (items) {
          final selected = _picked ?? items.where((a) => a.isDefault).firstOrNull?.id ?? items.firstOrNull?.id;
          return ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
            OutlinedButton.icon(
              onPressed: () => context.push('/address/new'),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: context.vsr.brandText, side: BorderSide(color: context.vsr.brandText.withValues(alpha: 0.5))),
              icon: const Icon(Icons.add),
              label: const Text('Add New Address'),
            ),
            const SizedBox(height: VsrSpace.lg),
            if (items.isEmpty) const MessageView(icon: Icons.location_off_outlined, title: 'No saved addresses', message: 'Add an address to see delivery options.'),
            for (final a in items)
              Padding(
                padding: const EdgeInsets.only(bottom: VsrSpace.group),
                child: Card(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg), side: BorderSide(color: widget.select && selected == a.id ? context.vsr.brandText : context.vsr.line, width: widget.select && selected == a.id ? 1.6 : 1)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(VsrRadius.lg),
                    onTap: widget.select ? () => setState(() => _picked = a.id) : () => context.push('/address/${a.id}', extra: a),
                    child: Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: context.vsr.brand50, borderRadius: BorderRadius.circular(VsrRadius.sm)),
                          child: Icon(a.label == 'Work' ? Icons.business_outlined : a.label == 'Home' ? Icons.home_outlined : Icons.location_on_outlined, color: context.vsr.brandText, size: 22),
                        ),
                        const SizedBox(width: VsrSpace.md),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Text(a.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                              if (a.isDefault) ...[const SizedBox(width: 8), const StatusChip('default')],
                            ]),
                            const SizedBox(height: VsrSpace.xs),
                            Text('${a.recipient} · ${a.phone}', style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: VsrSpace.xxs),
                            Text(a.oneLine, maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                          ]),
                        ),
                        if (widget.select)
                          Icon(selected == a.id ? Icons.check_circle : Icons.radio_button_unchecked, color: selected == a.id ? context.vsr.brandText : context.vsr.muted)
                        else
                          IconButton(tooltip: 'Edit address', onPressed: () => context.push('/address/${a.id}', extra: a), icon: const Icon(Icons.edit_outlined, size: 20)),
                      ]),
                    ),
                  ),
                ),
              ),
          ]);
        },
      ),
      bottomNavigationBar: widget.select && (list.value?.isNotEmpty ?? false)
          ? BottomCta(
              child: FilledButton(
                onPressed: () {
                  final items = list.value!;
                  final id = _picked ?? items.where((a) => a.isDefault).firstOrNull?.id ?? items.first.id;
                  context.push('/checkout/payment', extra: items.firstWhere((a) => a.id == id));
                },
                child: const Text('Deliver to this Address'),
              ),
            )
          : null,
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
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.existing == null ? 'Add Delivery Address' : 'Edit Address'), actions: [if (widget.existing != null) IconButton(tooltip: 'Delete address', onPressed: _delete, icon: Icon(Icons.delete_outline, color: context.vsr.danger))]),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
            Text('Save address as', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: VsrSpace.sm),
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'Home', label: Text('Home'), icon: Icon(Icons.home_outlined)), ButtonSegment(value: 'Work', label: Text('Work'), icon: Icon(Icons.business_outlined)), ButtonSegment(value: 'Other', label: Text('Other'))],
              selected: {_label},
              onSelectionChanged: (s) => setState(() => _label = s.first),
            ),
            const SizedBox(height: VsrSpace.xl),
            TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Recipient name'), validator: _req),
            const SizedBox(height: VsrSpace.lg),
            TextFormField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number'), validator: (v) => isPhone(v ?? '') ? null : 'Enter a valid mobile number'),
            const SizedBox(height: VsrSpace.lg),
            TextFormField(controller: _line1, decoration: const InputDecoration(labelText: 'Flat / House no., Building'), validator: _req),
            const SizedBox(height: VsrSpace.lg),
            TextFormField(controller: _area, decoration: const InputDecoration(labelText: 'Area / Locality'), validator: _req),
            const SizedBox(height: VsrSpace.lg),
            TextFormField(controller: _landmark, decoration: const InputDecoration(labelText: 'Landmark (optional)')),
            const SizedBox(height: VsrSpace.lg),
            Row(children: [
              Expanded(child: TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'City'), validator: _req)),
              const SizedBox(width: VsrSpace.md),
              Expanded(child: TextFormField(controller: _pin, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)], decoration: const InputDecoration(labelText: 'PIN code'), validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '') ? null : '6 digits')),
            ]),
            const SizedBox(height: VsrSpace.lg),
            TextFormField(controller: _state, decoration: const InputDecoration(labelText: 'State'), validator: _req),
            const SizedBox(height: VsrSpace.sm),
            SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Set as default address'), value: _default, onChanged: (v) => setState(() => _default = v)),
          ]),
        ),
        bottomNavigationBar: BottomCta(child: FilledButton(onPressed: _busy ? null : _save, child: _busy ? const Busy() : const Text('Save Address'))),
      );
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
    ('upi', Icons.account_balance_wallet_outlined, 'UPI', 'PhonePe, GPay, Paytm'),
    ('card', Icons.credit_card, 'Credit / Debit Card', 'Visa, Mastercard, RuPay'),
    ('netbanking', Icons.account_balance_outlined, 'Net Banking', 'All major banks'),
    ('wallet', Icons.wallet_outlined, 'Wallets', 'Paytm, Amazon Pay'),
    ('cod', Icons.payments_outlined, 'Cash on Delivery', 'Pay when you receive'),
  ];

  @override
  void dispose() {
    _rzp?.clear();
    _note.dispose();
    super.dispose();
  }

  Future<void> _place() async {
    setState(() => _busy = true);
    try {
      final d = await ref.read(apiProvider).post(
        '/store/me/orders',
        {'addressId': widget.address.id, 'paymentMethod': _method, if (_note.text.trim().isNotEmpty) 'instructions': _note.text.trim()},
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
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Method')),
      body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
        Card(
          child: ListTile(
            leading: Icon(Icons.location_on_outlined, color: context.vsr.brandText),
            title: Text('Deliver to ${widget.address.label}', style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(widget.address.oneLine, maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: TextButton(onPressed: () => context.pop(), child: const Text('Change')),
          ),
        ),
        const SizedBox(height: VsrSpace.xl),
        Text('Choose how to pay', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: VsrSpace.md),
        Card(
          child: RadioGroup<String>(
            groupValue: _method,
            onChanged: (v) => setState(() => _method = v ?? _method),
            child: Column(children: [
              for (final (i, m) in _methods.indexed) ...[
                if (i > 0) const Divider(indent: VsrSpace.lg + 24 + 14),
                RadioListTile<String>(
                  value: m.$1,
                  enabled: allowed.contains(m.$1),
                  secondary: Icon(m.$2, color: allowed.contains(m.$1) ? context.vsr.brandText : context.vsr.muted),
                  title: Text(m.$3, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(allowed.contains(m.$1) ? m.$4 : 'Not available right now'),
                  controlAffinity: ListTileControlAffinity.trailing,
                ),
              ],
            ]),
          ),
        ),
        const SizedBox(height: VsrSpace.xl),
        TextField(controller: _note, maxLength: 300, decoration: const InputDecoration(labelText: 'Delivery instructions (optional)', hintText: 'e.g. Call before delivery')),
        const SizedBox(height: VsrSpace.sm),
        if (cart != null && cart.items.isNotEmpty) BillCard(totals: cart.totals, count: cart.count),
        const SizedBox(height: VsrSpace.lg),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(Icons.lock_outline, size: 16, color: context.vsr.muted)),
          const SizedBox(width: VsrSpace.sm),
          Expanded(child: Text('Payments are processed securely by Razorpay. VSR never stores your card details.', style: Theme.of(context).textTheme.bodySmall)),
        ]),
      ]),
      bottomNavigationBar: BottomCta(
        child: FilledButton(
          onPressed: _busy || cart == null || cart.items.isEmpty ? null : _place,
          child: _busy ? const Busy() : Text(_method == 'cod' ? 'Place Order · ${money(cart?.totals.grandTotal)}' : 'Pay ${money(cart?.totals.grandTotal)}'),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------- Order success ----
class OrderSuccessScreen extends ConsumerWidget {
  const OrderSuccessScreen({super.key, required this.orderId});
  final String orderId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(orderProvider(orderId));
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(VsrSpace.xl, VsrSpace.sm, VsrSpace.xl, VsrSpace.xl),
          child: Column(children: [
            Align(alignment: Alignment.centerLeft, child: IconButton(tooltip: 'Home', onPressed: () => context.go('/'), icon: const Icon(Icons.home_outlined))),
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
            FilledButton(onPressed: () => context.go('/orders/$orderId'), child: const Text('Track Order')),
            const SizedBox(height: VsrSpace.sm),
            TextButton(onPressed: () => context.go('/'), child: const Text('Continue Shopping')),
          ]),
        ),
      ),
    );
  }
}
