import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

// ---------------------------------------------------------------- Profile ----
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You’ll need to sign in again to place orders.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text('Log out', style: TextStyle(color: context.vsr.danger)),
          ),
        ],
      ),
    );
    if (ok == true) await ref.read(sessionProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final signedIn = ref.watch(isSignedInProvider);
    final t = Theme.of(context).textTheme;
    NavTile tile(IconData i, String label, String route, {bool open = false}) => NavTile(
          icon: i,
          label: label,
          onTap: () {
            if (open || requireLogin(context, ref)) context.push(route);
          },
        );
    final initial = (user?.name.trim().isNotEmpty ?? false) ? user!.name.trim()[0].toUpperCase() : null;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.navClearance),
        children: [
          // Identity: sits on the page, not in a card, so it reads as the header of everything below
          Row(children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: context.vsr.brand100,
              backgroundImage: user?.avatar != null ? NetworkImage(user!.avatar!) : null,
              child: user?.avatar != null
                  ? null
                  : initial != null
                      ? Text(initial, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: context.vsr.brandText))
                      : Icon(Icons.person_outline_rounded, size: 30, color: context.vsr.brandText),
            ),
            const SizedBox(width: VsrSpace.lg),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(signedIn ? (user?.name ?? 'Your account') : 'Browsing as guest', maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleLarge),
                const SizedBox(height: VsrSpace.xxs),
                if (signedIn) ...[
                  if (user?.phone != null) Text(user!.phone!, style: t.bodySmall),
                  if (user?.email != null) Text(user!.email!, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall),
                ] else
                  Text('Log in to order, track deliveries and save favourites.', style: t.bodySmall),
              ]),
            ),
            if (signedIn) IconButton(tooltip: 'Edit profile', onPressed: () => context.push('/profile/edit'), icon: const Icon(Icons.edit_outlined)),
          ]),
          if (!signedIn) ...[
            const SizedBox(height: VsrSpace.lg),
            FilledButton(onPressed: () => context.push('/login'), child: const Text('Log in or sign up')),
          ],
          const SizedBox(height: VsrSpace.xl),
          TileGroup(title: 'Your account', children: [
            tile(Icons.receipt_long_outlined, 'My Orders', '/orders'),
            tile(Icons.location_on_outlined, 'My Addresses', '/addresses'),
            tile(Icons.favorite_border, 'My Wishlist', '/wishlist'),
            tile(Icons.local_offer_outlined, 'Offers & Coupons', '/offers'),
            tile(Icons.notifications_none, 'Notifications', '/notifications'),
          ]),
          const SizedBox(height: VsrSpace.xl),
          TileGroup(title: 'Support & app', children: [
            tile(Icons.support_agent, 'Help & Support', '/help'),
            tile(Icons.tune_rounded, 'Settings & legal', '/more', open: true),
          ]),
          if (signedIn) ...[
            const SizedBox(height: VsrSpace.xl),
            TileGroup(children: [NavTile(icon: Icons.logout_rounded, label: 'Log out', danger: true, onTap: () => _logout(context, ref))]),
          ],
        ],
      ),
    );
  }
}

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late final _name = TextEditingController(
    text: ref.read(sessionProvider).user?.name,
  );
  bool _busy = false;
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2) {
      return showMessage(context, 'Enter your name', error: true);
    }
    setState(() => _busy = true);
    try {
      final d = await ref.read(apiProvider).patch('/store/me/profile', {
        'name': _name.text.trim(),
      }) as Json;
      await ref
          .read(sessionProvider.notifier)
          .updateUser(AppUser.fromJson(d['user'] as Json));
      if (mounted) {
        showMessage(context, 'Profile updated');
        context.pop();
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = ref.watch(sessionProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.lg, VsrSpace.gutter, VsrSpace.xl),
        children: [
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Full Name'),
          ),
          const SizedBox(height: VsrSpace.lg),
          TextField(
            enabled: false,
            controller: TextEditingController(text: u?.email),
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: VsrSpace.lg),
          TextField(
            enabled: false,
            controller: TextEditingController(text: u?.phone),
            decoration: const InputDecoration(
              labelText: 'Phone',
              helperText: 'Contact support to change your email or phone.',
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomCta(
        child: FilledButton(
          onPressed: _busy ? null : _save,
          child: _busy ? const Busy() : const Text('Save Changes'),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------- Notifications ----
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              try {
                await ref
                    .read(apiProvider)
                    .post('/store/me/notifications/read-all');
                ref.invalidate(notificationsProvider);
              } catch (e) {
                if (context.mounted) {
                  showMessage(context, errorText(e), error: true);
                }
              }
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: AsyncBody(
        value: n,
        onRetry: () => ref.invalidate(notificationsProvider),
        builder: (items) => items.isEmpty
            ? const MessageView(
                icon: Icons.notifications_none,
                title: 'No notifications yet',
                message: 'Order updates and offers will appear here.',
              )
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(notificationsProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: VsrSpace.sm),
                  itemBuilder: (_, i) {
                    final x = items[i];
                    final icon = x.kind == 'order'
                        ? Icons.local_shipping_outlined
                        : x.kind == 'offer'
                        ? Icons.local_offer_outlined
                        : Icons.info_outline;
                    final t = Theme.of(context).textTheme;
                    return Card(
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => context.push('/notifications/${x.id}', extra: x),
                        child: Padding(
                          padding: const EdgeInsets.all(VsrSpace.lg),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            CircleAvatar(radius: 20, backgroundColor: context.vsr.brand50, child: Icon(icon, color: context.vsr.brandText, size: 20)),
                            const SizedBox(width: VsrSpace.md),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(child: Text(x.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: x.read ? FontWeight.w600 : FontWeight.w800))),
                                  if (!x.read) ...[
                                    const SizedBox(width: VsrSpace.sm),
                                    Semantics(label: 'Unread', child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: VsrColors.accent, shape: BoxShape.circle))),
                                  ],
                                ]),
                                const SizedBox(height: VsrSpace.xs),
                                Text(x.body, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.bodyMedium?.copyWith(color: context.vsr.muted)),
                                const SizedBox(height: VsrSpace.sm),
                                Text(ago(x.createdAt), style: t.bodySmall),
                              ]),
                            ),
                          ]),
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------- Support ----
class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key, this.orderId});
  final String? orderId;
  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.orderId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _newTicket());
    }
  }

  Future<void> _newTicket() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _TicketSheet(orderId: widget.orderId),
    );
    if (created == true && mounted) {
      ref.invalidate(ticketsProvider);
      showMessage(
        context,
        'Ticket created. Our team will get back to you soon.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tickets = ref.watch(ticketsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
        children: [
          TileGroup(title: 'Get in touch', children: [
            NavTile(icon: Icons.chat_bubble_outline, label: 'Raise a ticket', detail: 'Order, delivery, payment or return issues', onTap: _newTicket),
            NavTile(icon: Icons.call_outlined, label: 'Call support', detail: AppConfig.supportPhone, chevron: false, onTap: () => safeLaunch('tel:${AppConfig.supportPhone}', context: context)),
            NavTile(icon: Icons.mail_outline, label: 'Email us', detail: AppConfig.supportEmail, chevron: false, onTap: () => safeLaunch('mailto:${AppConfig.supportEmail}', context: context)),
          ]),
          const SizedBox(height: VsrSpace.xl),
          const TileGroup(title: 'Common questions', children: [
            _Faq('When will my order be confirmed?', 'VSR checks stock and payment for every order, usually within a few minutes. You’ll get a notification once it is confirmed.'),
            _Faq('What is the delivery code?', 'When your order is out for delivery, a 6-digit code appears on the order screen. Share it only with the delivery partner at your door.'),
            _Faq('How do refunds work?', 'Refunds go back to your original payment method after the payment provider confirms them. COD refunds are settled by bank transfer.'),
          ]),
          const SizedBox(height: VsrSpace.xl),
          tickets.when(
            loading: () => const LoadingView(rows: 2),
            error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(ticketsProvider)),
            data: (list) => list.isEmpty
                ? TileGroup(title: 'My tickets', children: [
                    Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Text('No tickets yet. Anything you raise shows up here with its status.', style: Theme.of(context).textTheme.bodySmall),
                    ),
                  ])
                : TileGroup(title: 'My tickets', children: [
                    for (final t in list)
                      ListTile(
                        title: Text(t.subject, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${t.number} · ${shortDate(t.createdAt)}'),
                        trailing: StatusChip(t.status),
                      ),
                  ]),
          ),
        ],
      ),
    );
  }
}

class _Faq extends StatelessWidget {
  const _Faq(this.q, this.a);
  final String q, a;
  @override
  Widget build(BuildContext context) => ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg),
        childrenPadding: const EdgeInsets.fromLTRB(VsrSpace.lg, 0, VsrSpace.lg, VsrSpace.lg),
        expandedAlignment: Alignment.centerLeft,
        title: Text(q, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        children: [Text(a, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.vsr.muted))],
      );
}

class _TicketSheet extends ConsumerStatefulWidget {
  const _TicketSheet({this.orderId});
  final String? orderId;
  @override
  ConsumerState<_TicketSheet> createState() => _TicketSheetState();
}

class _TicketSheetState extends ConsumerState<_TicketSheet> {
  static const _types = {
    'order': 'Order issue',
    'delivery': 'Delivery issue',
    'return_refund': 'Return / Refund',
    'product': 'Product quality',
    'payment': 'Payment issue',
    'other': 'Other',
  };
  String _type = 'order';
  final _subject = TextEditingController(), _desc = TextEditingController();
  bool _busy = false;
  @override
  void dispose() {
    _subject.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_subject.text.trim().length < 3 || _desc.text.trim().length < 5) {
      return showMessage(
        context,
        'Add a subject and a short description',
        error: true,
      );
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(apiProvider)
          .post(
            '/store/me/tickets',
            {
              'orderId': widget.orderId,
              'issueType': _type,
              'subject': _subject.text.trim(),
              'description': _desc.text.trim(),
            }..removeWhere((_, v) => v == null),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      VsrSpace.gutter + 4,
      0,
      VsrSpace.gutter + 4,
      MediaQuery.of(context).viewInsets.bottom + VsrSpace.xl,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Raise a ticket', style: Theme.of(context).textTheme.titleLarge),
        if (widget.orderId != null) ...[
          const SizedBox(height: VsrSpace.xs),
          Text('Linked to this order', style: Theme.of(context).textTheme.bodySmall),
        ],
        const SizedBox(height: VsrSpace.xl),
        DropdownButtonFormField<String>(
          initialValue: _type,
          decoration: const InputDecoration(labelText: 'Issue type'),
          items: [
            for (final e in _types.entries)
              DropdownMenuItem(value: e.key, child: Text(e.value)),
          ],
          onChanged: (v) => setState(() => _type = v ?? _type),
        ),
        const SizedBox(height: VsrSpace.lg),
        TextField(
          controller: _subject,
          maxLength: 120,
          decoration: const InputDecoration(labelText: 'Subject'),
        ),
        const SizedBox(height: VsrSpace.sm),
        TextField(
          controller: _desc,
          maxLines: 4,
          maxLength: 2000,
          decoration: const InputDecoration(labelText: 'Describe the issue'),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy ? const Busy() : const Text('Submit'),
        ),
      ],
    ),
  );
}

// --------------------------------------------------------- Wishlist / misc ----
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('My Wishlist')),
    body: AsyncBody(
      value: ref.watch(wishlistProvider),
      onRetry: () => ref.invalidate(wishlistProvider),
      builder: (items) => items.isEmpty
          ? const MessageView(
              icon: Icons.favorite_border,
              title: 'Your wishlist is empty',
              message: 'Tap the heart on any product to save it here.',
            )
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 200,
                mainAxisExtent: 344,
                crossAxisSpacing: VsrSpace.group,
                mainAxisSpacing: VsrSpace.group,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) =>
                  ProductTile(product: items[i], width: double.infinity),
            ),
    ),
  );
}

class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final f = ref.watch(couponsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Offers & Coupons')),
      body: AsyncBody(
        value: f,
        onRetry: () => ref.invalidate(couponsProvider),
        builder: (list) => list.isEmpty
            ? const MessageView(
                icon: Icons.local_offer_outlined,
                title: 'No offers right now',
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: VsrSpace.group),
                itemBuilder: (_, i) {
                  final c = list[i];
                  final what = c['type'] == 'percent'
                      ? '${c['value']}% OFF'
                      : c['type'] == 'flat'
                      ? '₹${c['value']} OFF'
                      : 'FREE DELIVERY';
                  final ends = c['endDate'] != null ? shortDate(DateTime.tryParse(c['endDate'] as String)) : null;
                  final t = Theme.of(context).textTheme;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(VsrSpace.lg),
                      child: Row(children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(color: context.vsr.accent50, borderRadius: BorderRadius.circular(VsrRadius.md)),
                          child: const Icon(Icons.confirmation_number_outlined, color: VsrColors.accent),
                        ),
                        const SizedBox(width: VsrSpace.lg),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(what, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: VsrSpace.xxs),
                            Text('Min order ₹${c['minOrder']}${ends != null ? ' · Ends $ends' : ''}', style: t.bodySmall),
                          ]),
                        ),
                        const SizedBox(width: VsrSpace.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: VsrSpace.md, vertical: VsrSpace.sm),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(VsrRadius.sm),
                            border: Border.all(color: context.vsr.brandText.withValues(alpha: 0.5)),
                          ),
                          child: Text('${c['code']}', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.5, color: context.vsr.brandText)),
                        ),
                      ]),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('More')),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
      children: [
        TileGroup(title: 'Appearance', children: [
          Padding(
            padding: const EdgeInsets.all(VsrSpace.lg),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<ThemeMode>(
                segments: const [
                  ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('System')),
                  ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
                  ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
                ],
                selected: {ref.watch(themeModeProvider)},
                onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
              ),
            ),
          ),
        ]),
        const SizedBox(height: VsrSpace.xl),
        TileGroup(title: 'Legal', children: [
          NavTile(icon: Icons.privacy_tip_outlined, label: 'Privacy Policy', onTap: () => context.push('/legal/privacy')),
          NavTile(icon: Icons.description_outlined, label: 'Terms & Conditions', onTap: () => context.push('/legal/terms')),
          NavTile(icon: Icons.receipt_long_outlined, label: 'Refunds & cancellations', onTap: () => context.push('/legal/refund-policy')),
          NavTile(icon: Icons.local_shipping_outlined, label: 'Delivery policy', onTap: () => context.push('/legal/delivery-policy')),
          NavTile(icon: Icons.quiz_outlined, label: 'FAQs', onTap: () => context.push('/faq')),
          NavTile(icon: Icons.info_outline, label: 'About VSR', detail: 'Shop · Eat · Live Better · v1.0.0', onTap: () => context.push('/about')),
        ]),
        if (ref.watch(isSignedInProvider)) ...[
          const SizedBox(height: VsrSpace.xl),
          TileGroup(children: [
            NavTile(
              icon: Icons.delete_forever_outlined,
              label: 'Request account deletion',
              danger: true,
              onTap: () async {
                try {
                  await ref.read(apiProvider).post('/store/me/tickets', {
                    'issueType': 'other',
                    'subject': 'Account deletion request',
                    'description': 'Please delete my VSR account and personal data.',
                  });
                  if (context.mounted) showMessage(context, 'Request received. Our team will confirm by email.');
                } catch (e) {
                  if (context.mounted) showMessage(context, errorText(e), error: true);
                }
              },
            ),
          ]),
        ],
      ],
    ),
  );
}
