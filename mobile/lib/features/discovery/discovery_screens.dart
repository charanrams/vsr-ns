import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// Responsive product grid used by search, deals, campaigns, recently viewed and recommendations.
class ProductGrid extends StatelessWidget {
  const ProductGrid({super.key, required this.products, this.padding = const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), this.shrinkWrap = false});
  final List<Product> products;
  final EdgeInsets padding;
  final bool shrinkWrap;
  @override
  Widget build(BuildContext context) => GridView.builder(
        padding: padding,
        shrinkWrap: shrinkWrap,
        physics: shrinkWrap ? const NeverScrollableScrollPhysics() : null,
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 210, mainAxisExtent: 344, crossAxisSpacing: VsrSpace.group, mainAxisSpacing: VsrSpace.group),
        itemCount: products.length,
        itemBuilder: (_, i) => ProductTile(product: products[i], width: double.infinity),
      );
}

// ------------------------------------------------------- 46. Notification detail
class NotificationDetailScreen extends ConsumerStatefulWidget {
  const NotificationDetailScreen({super.key, required this.notification});
  final AppNotification notification;
  @override
  ConsumerState<NotificationDetailScreen> createState() => _NotificationDetailScreenState();
}

class _NotificationDetailScreenState extends ConsumerState<NotificationDetailScreen> {
  @override
  void initState() {
    super.initState();
    if (!widget.notification.read) {
      ref.read(apiProvider).post('/store/me/notifications/${widget.notification.id}/read').then((_) => ref.invalidate(notificationsProvider)).catchError((_) => null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.notification;
    final (icon, label, color) = switch (n.kind) {
      'order' => (Icons.local_shipping_outlined, 'Order update', context.vsr.info),
      'offer' => (Icons.local_offer_outlined, 'Offer', VsrColors.accent),
      _ => (Icons.info_outline, 'Update', context.vsr.brandText),
    };
    // Order notifications quote the order number (#VSR…); link to My Orders where it can be opened.
    final hasOrder = RegExp(r'#VSR\d{8}-\d+').hasMatch('${n.title} ${n.body}');
    return Scaffold(
      appBar: AppBar(title: const Text('Notification')),
      body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.lg, VsrSpace.gutter, VsrSpace.xl), children: [
        Row(children: [
          CircleAvatar(radius: 24, backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, color: color)),
          const SizedBox(width: VsrSpace.md),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: VsrSpace.xxs),
            Text(dateTime(n.createdAt), style: Theme.of(context).textTheme.bodySmall),
          ]),
        ]),
        const SizedBox(height: VsrSpace.xl),
        Text(n.title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: VsrSpace.md),
        Text(n.body, style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55)),
        const SizedBox(height: VsrSpace.xxl),
        if (hasOrder) FilledButton.icon(onPressed: () => context.go('/orders'), icon: const Icon(Icons.receipt_long_outlined), label: const Text('View My Orders')),
        if (n.link != null)
          FilledButton.icon(onPressed: () => context.push(n.link!), icon: const Icon(Icons.shopping_bag_outlined), label: const Text('View Product'))
        else if (n.kind == 'offer') FilledButton.icon(onPressed: () => context.push('/deals'), icon: const Icon(Icons.local_offer_outlined), label: const Text('See Offers & Deals')),
      ]),
    );
  }
}

// ---------------------------------------------- 47–53. Global search (+ recent, suggestions, filter, sort)
class SearchV2Screen extends ConsumerStatefulWidget {
  const SearchV2Screen({super.key, this.initial});
  final String? initial;
  @override
  ConsumerState<SearchV2Screen> createState() => _SearchV2ScreenState();
}

class _SearchV2ScreenState extends ConsumerState<SearchV2Screen> {
  late final _c = TextEditingController(text: widget.initial);
  final _focus = FocusNode();
  Timer? _debounce;
  String _typing = '';
  late SearchQuery _query = SearchQuery(q: widget.initial ?? '');
  bool _submitted = false;

  static const _sorts = [('popular', 'Popularity'), ('price_asc', 'Price: Low to High'), ('price_desc', 'Price: High to Low'), ('discount', 'Biggest Discount'), ('latest', 'Newest')];

  @override
  void initState() {
    super.initState();
    _submitted = (widget.initial ?? '').isNotEmpty;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _submit(String q) {
    final v = q.trim();
    if (v.length < 2) return;
    _c.text = v;
    _focus.unfocus();
    ref.read(recentSearchesProvider.notifier).add(v);
    setState(() {
      _submitted = true;
      _query = _query.copyWith(q: v);
    });
  }

  Future<void> _openSort() async {
    final v = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter + 4, 0, VsrSpace.gutter + 4, VsrSpace.sm), child: Text('Sort by', style: Theme.of(context).textTheme.titleLarge)),
          RadioGroup<String>(
            groupValue: _query.sort,
            onChanged: (v) => Navigator.pop(c, v),
            child: Column(children: [for (final s in _sorts) RadioListTile<String>(value: s.$1, title: Text(s.$2))]),
          ),
        ]),
      ),
    );
    if (v != null) setState(() => _query = _query.copyWith(sort: v));
  }

  Future<void> _openFilter() async {
    final v = await showModalBottomSheet<SearchQuery>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => _FilterSheet(initial: _query));
    if (v != null) setState(() => _query = v);
  }

  @override
  Widget build(BuildContext context) {
    final recent = ref.watch(recentSearchesProvider);
    final suggestions = !_submitted && _typing.length >= 2 ? ref.watch(searchProvider(SearchQuery(q: _typing))) : null;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: VsrSpace.gutter),
          child: TextField(
            controller: _c,
            focusNode: _focus,
            autofocus: (widget.initial ?? '').isEmpty,
            textInputAction: TextInputAction.search,
            onSubmitted: _submit,
            onTap: () => setState(() => _submitted = false),
            onChanged: (v) {
              setState(() => _submitted = false);
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () => setState(() => _typing = v.trim()));
            },
            decoration: InputDecoration(
              hintText: 'Search products, brands, foods…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _c.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() {
                        _c.clear();
                        _typing = '';
                        _submitted = false;
                        _focus.requestFocus();
                      }),
                    ),
            ),
          ),
        ),
      ),
      body: _submitted ? _results() : _idle(recent, suggestions),
    );
  }

  // 48 + 49: suggestions while typing, otherwise recent + popular searches.
  Widget _idle(List<String> recent, AsyncValue<List<Product>>? suggestions) {
    if (suggestions != null) {
      return suggestions.when(
        loading: () => const LinearProgressIndicator(minHeight: 2),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(searchProvider(SearchQuery(q: _typing)))),
        data: (items) => ListView(children: [
          ListTile(leading: const Icon(Icons.search), title: Text('Search for “$_typing”'), onTap: () => _submit(_typing)),
          for (final p in items.take(6))
            ListTile(
              leading: NetImage(p.image, width: 40, height: 40, radius: 8),
              title: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('${p.unit} · ${money(p.price)}'),
              trailing: const Icon(Icons.north_west, size: 18),
              onTap: () {
                ref.read(recentSearchesProvider.notifier).add(p.name);
                context.push('/product/${p.id}');
              },
            ),
        ]),
      );
    }
    return ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
      if (recent.isNotEmpty) ...[
        Row(children: [
          Expanded(child: Text('Recent Searches', style: Theme.of(context).textTheme.titleMedium)),
          TextButton(onPressed: () => ref.read(recentSearchesProvider.notifier).clear(), child: const Text('Clear all')),
        ]),
        for (final r in recent)
          ListTile(
            contentPadding: EdgeInsets.zero,
            minVerticalPadding: VsrSpace.sm,
            leading: Icon(Icons.history, color: context.vsr.muted),
            title: Text(r),
            onTap: () => _submit(r),
            trailing: IconButton(tooltip: 'Remove $r', icon: const Icon(Icons.close, size: 18), onPressed: () => ref.read(recentSearchesProvider.notifier).remove(r)),
          ),
        const SizedBox(height: VsrSpace.xl),
      ],
      Text('Popular Searches', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: VsrSpace.md),
      Wrap(spacing: VsrSpace.sm, runSpacing: VsrSpace.sm, children: [
        for (final s in ['Tomatoes', 'Milk', 'Rice', 'Biryani', 'Oil', 'Eggs', 'Honey', 'Shampoo'])
          ActionChip(avatar: const Icon(Icons.trending_up, size: 16), label: Text(s), onPressed: () => _submit(s)),
      ]),
    ]);
  }

  // 50–53: results with sort + filter bar; 51: no results.
  Widget _results() {
    final res = ref.watch(searchProvider(_query));
    final sortLabel = _sorts.firstWhere((s) => s.$1 == _query.sort).$2;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.md),
        child: Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: _openSort, icon: const Icon(Icons.sort, size: 18), label: Text(sortLabel, overflow: TextOverflow.ellipsis))),
          const SizedBox(width: VsrSpace.sm),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _openFilter,
              icon: Badge(isLabelVisible: _query.activeFilters > 0, label: Text('${_query.activeFilters}'), backgroundColor: VsrColors.accent, child: const Icon(Icons.tune, size: 18)),
              label: const Text('Filters'),
            ),
          ),
        ]),
      ),
      Expanded(
        child: AsyncBody(
          value: res,
          onRetry: () => ref.invalidate(searchProvider(_query)),
          builder: (items) => items.isEmpty
              ? MessageView(
                  icon: Icons.search_off_rounded,
                  title: 'No results for “${_query.q}”',
                  message: _query.activeFilters > 0 ? 'Try removing some filters.' : 'Check the spelling or try a broader term.',
                  action: _query.activeFilters > 0 ? 'Clear filters' : 'Browse categories',
                  onAction: () => _query.activeFilters > 0 ? setState(() => _query = SearchQuery(q: _query.q, sort: _query.sort)) : context.go('/categories'),
                )
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter), child: Text('${items.length} result${items.length == 1 ? '' : 's'}', style: Theme.of(context).textTheme.bodySmall)),
                  Expanded(child: ProductGrid(products: items)),
                ]),
        ),
      ),
    ]);
  }
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet({required this.initial});
  final SearchQuery initial;
  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late SearchQuery q = widget.initial;
  late final _min = TextEditingController(text: widget.initial.minPrice?.toString());
  late final _max = TextEditingController(text: widget.initial.maxPrice?.toString());

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider).value ?? const [];
    return Padding(
      padding: EdgeInsets.fromLTRB(VsrSpace.gutter + 4, 0, VsrSpace.gutter + 4, MediaQuery.of(context).viewInsets.bottom + VsrSpace.xl),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('Filters', style: Theme.of(context).textTheme.titleLarge)),
            TextButton(onPressed: () => Navigator.pop(context, SearchQuery(q: q.q, sort: q.sort)), child: const Text('Clear all')),
          ]),
          const SizedBox(height: VsrSpace.lg),
          Text('Price range (₹)', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: VsrSpace.sm),
          Row(children: [
            Expanded(child: TextField(controller: _min, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'Min'))),
            const SizedBox(width: VsrSpace.md),
            Expanded(child: TextField(controller: _max, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'Max'))),
          ]),
          const SizedBox(height: VsrSpace.md),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('In stock only'), value: q.inStock, onChanged: (v) => setState(() => q = q.copyWith(inStock: v))),
          SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Homemade food only'), value: q.type == 'homemade', onChanged: (v) => setState(() => q = v ? q.copyWith(type: 'homemade') : q.copyWith(clearType: true))),
          if (cats.isNotEmpty) ...[
            const SizedBox(height: VsrSpace.lg),
            Text('Category', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: VsrSpace.sm),
            Wrap(spacing: VsrSpace.sm, runSpacing: VsrSpace.sm, children: [
              ChoiceChip(label: const Text('All'), selected: q.category == null, onSelected: (_) => setState(() => q = q.copyWith(clearCategory: true))),
              for (final c in cats) ChoiceChip(label: Text(c.name), selected: q.category == c.id, onSelected: (_) => setState(() => q = q.copyWith(category: c.id))),
            ]),
          ],
          const SizedBox(height: VsrSpace.xl),
          FilledButton(
            onPressed: () {
              final min = int.tryParse(_min.text), max = int.tryParse(_max.text);
              if (min != null && max != null && min > max) return showMessage(context, 'Min price can’t be more than max price', error: true);
              Navigator.pop(context, SearchQuery(q: q.q, sort: q.sort, minPrice: min, maxPrice: max, inStock: q.inStock, type: q.type, category: q.category));
            },
            child: const Text('Apply Filters'),
          ),
        ]),
      ),
    );
  }
}

// ------------------------------------------------------------ 60. Offers & deals
class DealsScreen extends ConsumerWidget {
  const DealsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider).value;
    final deals = ref.watch(dealsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Offers & Deals')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dealsProvider);
          ref.invalidate(homeProvider);
        },
        child: ListView(children: [
          if (home != null && home.banners.isNotEmpty) ...[
            const SectionHeader('Campaigns'),
            SizedBox(
              height: 130,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter),
                itemCount: home.banners.length,
                separatorBuilder: (_, _) => const SizedBox(width: VsrSpace.group),
                itemBuilder: (_, i) => _CampaignCard(banner: home.banners[i]),
              ),
            ),
          ],
          if (ref.watch(isSignedInProvider)) ...[
            SectionHeader('Coupons', action: 'View all', onAction: () => context.push('/offers')),
            const _CouponStrip(),
          ],
          const SectionHeader('Top Deals'),
          deals.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(dealsProvider)),
            data: (items) => items.isEmpty
                ? const MessageView(icon: Icons.local_offer_outlined, title: 'No deals right now', message: 'Check back soon for fresh discounts.')
                : ProductGrid(products: items, shrinkWrap: true, padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, 0, VsrSpace.gutter, VsrSpace.xl)),
          ),
        ]),
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({required this.banner});
  final BannerItem banner;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 260,
        child: InkWell(
          borderRadius: BorderRadius.circular(VsrRadius.lg),
          onTap: () => context.push('/campaign', extra: banner),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(VsrRadius.lg),
            child: Stack(fit: StackFit.expand, children: [
              NetImage(banner.image, radius: 0),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.center, colors: [Color(0xCC0B3D2E), Color(0x000B3D2E)]))),
              Padding(
                padding: const EdgeInsets.all(VsrSpace.lg),
                child: Align(alignment: Alignment.bottomLeft, child: Text(banner.title, maxLines: 2, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
              ),
            ]),
          ),
        ),
      );
}

class _CouponStrip extends ConsumerWidget {
  const _CouponStrip();
  @override
  Widget build(BuildContext context, WidgetRef ref) => FutureBuilder(
        future: ref.read(apiProvider).get('/store/me/coupons'),
        builder: (_, snap) {
          if (!snap.hasData) return const LoadingView(rows: 1);
          final list = ((snap.data as Json)['coupons'] as List).cast<Json>();
          if (list.isEmpty) return Padding(padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter), child: Text('No coupons available right now.', style: Theme.of(context).textTheme.bodySmall));
          return SizedBox(
            height: 92,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(width: VsrSpace.group),
              itemBuilder: (_, i) {
                final c = list[i];
                final what = c['type'] == 'percent' ? '${c['value']}% OFF' : c['type'] == 'flat' ? '₹${c['value']} OFF' : 'FREE DELIVERY';
                return Container(
                  width: 200,
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg, vertical: VsrSpace.md),
                  decoration: BoxDecoration(color: context.vsr.accent50, borderRadius: BorderRadius.circular(VsrRadius.md), border: Border.all(color: VsrColors.accent.withValues(alpha: 0.4))),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(what, style: TextStyle(fontWeight: FontWeight.w800, color: Theme.of(context).brightness == Brightness.dark ? VsrColors.accent : VsrColors.accentDark)),
                    const SizedBox(height: VsrSpace.xxs),
                    Text('Code ${c['code']}', style: const TextStyle(fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    Text('Min order ₹${c['minOrder']}', style: Theme.of(context).textTheme.bodySmall),
                  ]),
                );
              },
            ),
          );
        },
      );
}

// --------------------------------------------------------- 61. Campaign details
class CampaignScreen extends ConsumerWidget {
  const CampaignScreen({super.key, required this.banner});
  final BannerItem banner;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = ref.watch(categoriesProvider).value;
    final cat = cats?.where((c) => c.name == banner.linkValue).firstOrNull;
    final products = ref.watch(productsProvider(cat != null ? ProductQuery(category: cat.id) : const ProductQuery(sort: 'popular')));
    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(fit: StackFit.expand, children: [
              NetImage(banner.image, radius: 0),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.center, colors: [Color(0xE60B3D2E), Color(0x000B3D2E)]))),
              Positioned(
                left: VsrSpace.gutter,
                right: VsrSpace.gutter,
                bottom: VsrSpace.xl,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(banner.title, style: const TextStyle(color: Colors.white, fontSize: 24, height: 1.2, fontWeight: FontWeight.w800)),
                  if (banner.subtitle != null) ...[
                    const SizedBox(height: VsrSpace.xs),
                    Text(banner.subtitle!, style: const TextStyle(color: Colors.white, height: 1.4)),
                  ],
                ]),
              ),
            ]),
          ),
        ),
        SliverToBoxAdapter(child: SectionHeader(cat != null ? 'Shop ${cat.name}' : 'Featured products')),
        products.when(
          loading: () => const SliverToBoxAdapter(child: LoadingView()),
          error: (e, _) => SliverToBoxAdapter(child: ErrorView(error: e, onRetry: () => ref.invalidate(productsProvider))),
          data: (items) => items.isEmpty
              ? const SliverToBoxAdapter(child: MessageView(icon: Icons.inventory_2_outlined, title: 'Products coming soon'))
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, 0, VsrSpace.gutter, VsrSpace.xl),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 210, mainAxisExtent: 344, crossAxisSpacing: VsrSpace.group, mainAxisSpacing: VsrSpace.group),
                    delegate: SliverChildBuilderDelegate((_, i) => ProductTile(product: items[i], width: double.infinity), childCount: items.length),
                  ),
                ),
        ),
      ]),
    );
  }
}

// --------------------------------------------- 58 + 62. Recommended / recently viewed
class ProductCollectionScreen extends ConsumerWidget {
  const ProductCollectionScreen({super.key, required this.kind});
  final String kind; // recommended | recent
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = kind == 'recent';
    final value = recent ? ref.watch(recentlyViewedProvider) : ref.watch(recommendationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(recent ? 'Recently Viewed' : 'Recommended for You'),
        actions: [if (recent) TextButton(onPressed: () => ref.read(recentlyViewedIdsProvider.notifier).clear(), child: const Text('Clear'))],
      ),
      body: AsyncBody(
        value: value,
        onRetry: () => ref.invalidate(recent ? recentlyViewedProvider : recommendationsProvider),
        builder: (items) => items.isEmpty
            ? MessageView(icon: recent ? Icons.history : Icons.auto_awesome_outlined, title: recent ? 'Nothing viewed yet' : 'No recommendations yet', message: recent ? 'Products you open will appear here.' : 'Shop a little and we’ll suggest products you’ll love.')
            : ProductGrid(products: items),
      ),
    );
  }
}
