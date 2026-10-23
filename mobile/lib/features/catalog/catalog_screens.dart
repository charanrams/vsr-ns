import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../core/api.dart';
import '../../widgets/common.dart';
import 'product_extras.dart';

// ------------------------------------------------------------------- Home ----
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider);
    final user = ref.watch(sessionProvider).user;
    final addr = ref.watch(addressesProvider).value;
    final def = addr == null || addr.isEmpty
        ? null
        : addr.firstWhere((a) => a.isDefault, orElse: () => addr.first);
    final unread = ref.watch(unreadCountProvider);
    final recent = ref.watch(recentlyViewedProvider).value ?? const [];
    final recommended = ref.watch(recommendationsProvider).value ?? const [];
    final topPad = MediaQuery.of(context).padding.top;
    // Light illustration behind the status bar → dark status-bar icons in both themes
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        // Header draws under the status bar (illustration), so no top SafeArea here
        body: RefreshIndicator(
          edgeOffset: topPad + _HomeHeader.minBody,
          onRefresh: () async {
            ref.invalidate(recommendationsProvider);
            ref.invalidate(notificationsProvider);
            ref.invalidate(homeProvider);
            await ref.read(homeProvider.future);
          },
          child: CustomScrollView(
            slivers: [
              // Illustrated header (location, bell, greeting) collapses on scroll; the search bar stays pinned.
              SliverPersistentHeader(
                pinned: true,
                delegate: _HomeHeader(
                  topPad: topPad,
                  label: def?.label ?? 'Deliver to',
                  line: def == null ? 'Add delivery address' : def.shortLine,
                  name: (user != null && user.name.trim().isNotEmpty)
                      ? user.name.trim().split(' ').first
                      : null,
                  unread: unread,
                  bg: Theme.of(context).scaffoldBackgroundColor,
                  onLocation: () => ref.read(isSignedInProvider)
                      ? context.push('/location')
                      : requireLogin(
                          context,
                          ref,
                          reason: 'Log in to set your delivery address',
                        ),
                  onBell: () => context.push('/notifications'),
                  onSearch: () => context.push('/search'),
                ),
              ),
              ...home.when(
                loading: () => [
                  const SliverFillRemaining(child: LoadingView()),
                ],
                error: (e, _) => [
                  SliverFillRemaining(
                    child: ErrorView(
                      error: e,
                      onRetry: () => ref.invalidate(homeProvider),
                    ),
                  ),
                ],
                data: (d) => [
                  if (d.banners.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _BannerCarousel(banners: d.banners),
                    ),
                  // Rows in the order, with the titles and visibility set in Admin → Home Screen
                  for (final sec in d.sections)
                    ..._homeSection(
                      context,
                      sec,
                      d,
                      user != null && recommended.isNotEmpty
                          ? recommended
                          : d.recommended,
                      recent,
                    ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: VsrSpace.navClearance + 60),
                  ), // clears nav + cart bar
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

List<Widget> _homeSection(
  BuildContext context,
  HomeSection sec,
  HomeData d,
  List<Product> recommended,
  List<Product> recent,
) {
  if (sec.key == 'categories') {
    if (d.categories.isEmpty) return const [];
    return [
      SliverToBoxAdapter(
        child: SectionHeader(
          sec.title,
          subtitle: 'Explore our wide range of essentials',
          action: 'See All',
          onAction: () => context.go('/categories'),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(
          VsrSpace.gutter,
          VsrSpace.xs,
          VsrSpace.gutter,
          0,
        ),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 96,
            mainAxisExtent: 112,
            crossAxisSpacing: VsrSpace.md,
            mainAxisSpacing: VsrSpace.lg,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, i) => _CategoryCell(d.categories[i]),
            childCount: d.categories.length,
          ),
        ),
      ),
    ];
  }
  final (items, route, subtitle) = switch (sec.key) {
    'deals' => (
      d.deals,
      '/products?title=${Uri.encodeComponent(sec.title)}&sort=discount',
      'Limited time offers just for you',
    ),
    'bestSellers' => (
      d.bestSellers,
      '/products?title=${Uri.encodeComponent(sec.title)}&sort=popular',
      'Most loved products by our customers',
    ),
    'recommended' => (
      recommended,
      '/recommended',
      'Curated picks tailored for you',
    ),
    'homemade' => (
      d.homemade,
      '/products?title=${Uri.encodeComponent(sec.title)}&type=homemade',
      'Freshly prepared in local kitchens',
    ),
    'recent' => (recent, '/recently-viewed', 'Pick up where you left off'),
    'category' => (
      sec.items,
      '/category/${sec.categoryId}?name=${Uri.encodeComponent(sec.title)}',
      null,
    ),
    _ => (const <Product>[], '', null),
  };
  if (items.isEmpty) return const [];
  return [
    SliverToBoxAdapter(
      child: SectionHeader(
        sec.title,
        subtitle: subtitle,
        action: 'See All',
        onAction: () => context.push(route),
      ),
    ),
    SliverToBoxAdapter(child: ProductRail(products: items)),
  ];
}

/// Home app bar from the design: illustration background, location + bell, greeting, and a search bar.
/// Collapses as you scroll until only the search bar is left, pinned under the status bar.
class _HomeHeader extends SliverPersistentHeaderDelegate {
  _HomeHeader({
    required this.topPad,
    required this.label,
    required this.line,
    required this.name,
    required this.unread,
    required this.bg,
    required this.onLocation,
    required this.onBell,
    required this.onSearch,
  });
  final double topPad;
  final String label, line;
  final String? name;
  final int unread;
  final Color bg;
  final VoidCallback onLocation, onBell, onSearch;

  static const minBody = 166.0;
  static const maxBody = 166.0;
  // The illustration is always light, so header text uses fixed dark ink in both themes
  static const _ink = VsrColors.ink;
  static const _sub = Color(0xFF4A524E);

  @override
  double get minExtent => topPad + minBody;
  @override
  double get maxExtent => topPad + maxBody;
  @override
  bool shouldRebuild(covariant _HomeHeader o) =>
      o.topPad != topPad ||
      o.label != label ||
      o.line != line ||
      o.name != name ||
      o.unread != unread ||
      o.bg != bg;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final t = (shrinkOffset / (maxExtent - minExtent + 0.001)).clamp(0.0, 1.0);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeInk = Color.lerp(_ink, isDark ? Colors.white : _ink, t)!;
    final activeSub = Color.lerp(
      _sub,
      isDark ? const Color(0xFFA6B2AC) : _sub,
      t,
    )!;

    return SizedBox.expand(
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: Color.lerp(VsrColors.cream, bg, t)!),
          Opacity(
            opacity: 0.95,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/images/home_hero.jpg',
                  fit: BoxFit.cover,
                  alignment: Alignment.centerRight,
                  excludeFromSemantics: true,
                ),
                // Soft cream wash on the left keeps the greeting readable over the artwork
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Color(0xE6FBF7EE),
                        Color(0x99FBF7EE),
                        Color(0x00FBF7EE),
                      ],
                      stops: [0, 0.45, 0.75],
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Subtle border line at bottom
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            child: ColoredBox(
              color: isDark ? const Color(0xFF2A2A2E) : VsrColors.line,
            ),
          ),
          // Content: Column with spacing identical to web (px-4 pt-2.5 pb-3)
          Positioned(
            left: VsrSpace.gutter,
            right: VsrSpace.gutter,
            top: topPad + 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Row 1: Location & Bell
                Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        button: true,
                        label: 'Delivery location, $label, $line',
                        child: InkWell(
                          onTap: onLocation,
                          borderRadius: BorderRadius.circular(VsrRadius.sm),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 1),
                            child: ExcludeSemantics(
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.location_on,
                                    size: 22,
                                    color: VsrColors.accent,
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Flexible(
                                              child: Text(
                                                label,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 16,
                                                  height: 1.15,
                                                  color: activeInk,
                                                ),
                                              ),
                                            ),
                                            Icon(
                                              Icons.keyboard_arrow_down,
                                              size: 18,
                                              color: activeInk,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 1),
                                        Text(
                                          line,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 12,
                                            height: 1.15,
                                            color: activeSub,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: unread > 0
                          ? 'Notifications, $unread unread'
                          : 'Notifications',
                      padding: const EdgeInsets.all(4),
                      constraints: const BoxConstraints(),
                      visualDensity: VisualDensity.compact,
                      style: IconButton.styleFrom(
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: const EdgeInsets.all(4),
                      ),
                      onPressed: onBell,
                      icon: Badge(
                        isLabelVisible: unread > 0,
                        label: Text('$unread'),
                        backgroundColor: VsrColors.danger,
                        child: Icon(
                          Icons.notifications_none_rounded,
                          color: activeInk,
                          size: 24,
                        ),
                      ),
                    ),
                  ],
                ),
                // Gap between Location and Greeting: identical to web mt-1.5 (6px)
                const SizedBox(height: 6),
                // Row 2: Greeting (Hi Charan 👋 / What would you like to shop today?)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Hi ${name ?? 'Charan'} 👋',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 20,
                        height: 1.15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: activeInk,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'What would you like to shop today?',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.15,
                        color: activeSub,
                      ),
                    ),
                  ],
                ),
                // Gap between Greeting and Search Bar: identical to web mb-2 (8px)
                const SizedBox(height: 8),
                // Row 3: Search Bar (h-11 = 44px pill)
                SizedBox(
                  height: 44,
                  child: Semantics(
                    button: true,
                    label: 'Search products',
                    child: Material(
                      color: Colors.white,
                      elevation: 2,
                      shadowColor: Colors.black.withValues(alpha: 0.08),
                      shape: const StadiumBorder(),
                      child: InkWell(
                        onTap: onSearch,
                        customBorder: const StadiumBorder(),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            children: [
                              Icon(Icons.search, color: _ink, size: 20),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Search for “biryani”, “milk”…',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Color(0xFF7A837E),
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerCarousel extends StatefulWidget {
  const _BannerCarousel({required this.banners});
  final List<BannerItem> banners;
  @override
  State<_BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<_BannerCarousel> {
  // Re-created per width so each banner's edges sit exactly on the page gutter
  PageController _pc = PageController();
  double _w = 0;
  static const _gap = VsrSpace.sm;
  int _i = 0;
  Timer? _t;
  @override
  void initState() {
    super.initState();
    if (widget.banners.length > 1) {
      _t = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted || MediaQuery.of(context).disableAnimations) return;
        _pc.animateToPage(
          (_i + 1) % widget.banners.length,
          duration: const Duration(milliseconds: 420),
          curve: Curves.easeOutCubic,
        );
      });
    }
  }

  @override
  void dispose() {
    _t?.cancel();
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const SizedBox(height: VsrSpace.lg),
      LayoutBuilder(
        builder: (context, box) {
          if (box.maxWidth != _w && box.maxWidth > 0) {
            _w = box.maxWidth;
            final old = _pc;
            _pc = PageController(
              initialPage: _i,
              viewportFraction: (_w - 2 * VsrSpace.gutter + _gap) / _w,
            );
            WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
          }
          return SizedBox(
            height: 168,
            child: PageView.builder(
              controller: _pc,
              itemCount: widget.banners.length,
              onPageChanged: (i) => setState(() => _i = i),
              itemBuilder: (_, i) {
                final b = widget.banners[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: _gap / 2),
                  child: GestureDetector(
                    onTap: () => context.push('/campaign', extra: b),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(VsrRadius.lg),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          NetImage(b.image, radius: 0),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xF2FBF7EE), Color(0x00FBF7EE)],
                                stops: [0.35, 0.85],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(VsrSpace.lg + 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 190,
                                  child: Text(
                                    b.title,
                                    maxLines: 2,
                                    style: const TextStyle(
                                      fontSize: 20,
                                      height: 1.1,
                                      fontWeight: FontWeight.w800,
                                      color: VsrColors.brand800,
                                    ),
                                  ),
                                ),
                                if (b.subtitle != null)
                                  SizedBox(
                                    width: 180,
                                    child: Padding(
                                      padding: const EdgeInsets.only(
                                        top: VsrSpace.xs,
                                      ),
                                      child: Text(
                                        b.subtitle!,
                                        maxLines: 2,
                                        // Fixed dark ink: the banner fades to cream in both themes
                                        style: const TextStyle(
                                          fontSize: 12,
                                          height: 1.35,
                                          fontWeight: FontWeight.w500,
                                          color: VsrColors.ink,
                                        ),
                                      ),
                                    ),
                                  ),
                                if (b.buttonText != null)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      top: VsrSpace.md,
                                    ),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 7,
                                      ),
                                      decoration: BoxDecoration(
                                        color: VsrColors.brand900,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        '${b.buttonText} →',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
      const SizedBox(height: VsrSpace.md),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < widget.banners.length; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.all(3),
              width: i == _i ? 16 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: i == _i ? context.vsr.brandText : context.vsr.line,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
        ],
      ),
    ],
  );
}

class _CategoryCell extends StatelessWidget {
  const _CategoryCell(this.c);
  final Category c;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () =>
        context.push('/category/${c.id}?name=${Uri.encodeComponent(c.name)}'),
    borderRadius: BorderRadius.circular(12),
    child: Column(
      children: [
        NetImage(c.image, width: 68, height: 68, radius: 34),
        const SizedBox(height: VsrSpace.sm),
        Text(
          c.name,
          maxLines: 2,
          textAlign: TextAlign.center,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            height: 1.15,
          ),
        ),
      ],
    ),
  );
}

// ------------------------------------------------------------- Categories ----
class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});
  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              VsrSpace.gutter,
              VsrSpace.xs,
              VsrSpace.gutter,
              VsrSpace.md,
            ),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search categories…',
              ),
              onChanged: (v) => setState(() => _q = v.toLowerCase()),
            ),
          ),
          Expanded(
            child: AsyncBody(
              value: cats,
              onRetry: () => ref.invalidate(categoriesProvider),
              builder: (list) {
                final items = list
                    .where(
                      (Category c) =>
                          c.name.toLowerCase().contains(_q) ||
                          c.children.any(
                            (s) => s.name.toLowerCase().contains(_q),
                          ),
                    )
                    .toList();
                if (items.isEmpty) {
                  return const MessageView(
                    icon: Icons.search_off,
                    title: 'No categories found',
                  );
                }
                return GridView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    VsrSpace.gutter,
                    VsrSpace.xs,
                    VsrSpace.gutter,
                    VsrSpace.navClearance,
                  ),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 200,
                    mainAxisExtent: 172,
                    crossAxisSpacing: VsrSpace.group,
                    mainAxisSpacing: VsrSpace.group,
                  ),
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final Category c = items[i];
                    return Card(
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => context.push(
                          '/category/${c.id}?name=${Uri.encodeComponent(c.name)}',
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(VsrSpace.sm + 2),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: NetImage(
                                  c.image,
                                  width: double.infinity,
                                  radius: VsrRadius.sm,
                                ),
                              ),
                              const SizedBox(height: VsrSpace.sm + 2),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: VsrSpace.xxs,
                                ),
                                child: Text(
                                  c.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                              if (c.children.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    VsrSpace.xxs,
                                    VsrSpace.xxs,
                                    VsrSpace.xxs,
                                    0,
                                  ),
                                  child: Text(
                                    '${c.children.length} subcategories',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------ Category products ----
class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({
    super.key,
    required this.title,
    this.categoryId,
    this.sort,
    this.type,
  });
  final String title;
  final String? categoryId, sort, type;
  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  String? _sub;
  late String? _sort = widget.sort;

  @override
  Widget build(BuildContext context) {
    final cats = widget.categoryId == null
        ? null
        : ref.watch(categoriesProvider).value;
    final parent = cats?.where((c) => c.id == widget.categoryId).firstOrNull;
    final query = ProductQuery(
      category: _sub ?? widget.categoryId,
      sort: _sort,
      type: widget.type,
    );
    final products = ref.watch(productsProvider(query));
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Sort',
            icon: const Icon(Icons.sort_rounded),
            initialValue: _sort,
            onSelected: (v) => setState(() => _sort = v),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'popular', child: Text('Popularity')),
              PopupMenuItem(
                value: 'price_asc',
                child: Text('Price: Low to High'),
              ),
              PopupMenuItem(
                value: 'price_desc',
                child: Text('Price: High to Low'),
              ),
              PopupMenuItem(value: 'latest', child: Text('Newest')),
            ],
          ),
          IconButton(
            tooltip: 'Search',
            onPressed: () => context.push('/search'),
            icon: const Icon(Icons.search),
          ),
        ],
      ),
      body: Column(
        children: [
          if (parent != null && parent.children.isNotEmpty)
            SizedBox(
              height: 56,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: VsrSpace.gutter,
                  vertical: VsrSpace.sm,
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: const Text('All'),
                      selected: _sub == null,
                      onSelected: (_) => setState(() => _sub = null),
                    ),
                  ),
                  for (final s in parent.children)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(s.name),
                        selected: _sub == s.id,
                        onSelected: (_) => setState(() => _sub = s.id),
                      ),
                    ),
                ],
              ),
            ),
          Expanded(
            child: AsyncBody(
              value: products,
              onRetry: () => ref.invalidate(productsProvider(query)),
              builder: (items) => items.isEmpty
                  ? const MessageView(
                      icon: Icons.inventory_2_outlined,
                      title: 'No products here yet',
                      message: 'Check back soon or explore other categories.',
                    )
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(productsProvider(query)),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                          VsrSpace.gutter,
                          VsrSpace.sm,
                          VsrSpace.gutter,
                          VsrSpace.xl,
                        ),
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: VsrSpace.group),
                        itemBuilder: (_, i) => _ProductRow(items[i]),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow(this.p);
  final Product p;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => context.push('/product/${p.id}'),
      child: Padding(
        padding: const EdgeInsets.all(VsrSpace.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NetImage(p.image, width: 88, height: 88, radius: VsrRadius.sm),
            const SizedBox(width: VsrSpace.md),
            Expanded(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 88),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: VsrSpace.xxs),
                    Text(
                      p.stockStatus == 'low_stock'
                          ? '${p.unit} · Only ${p.available} left'
                          : p.unit,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: p.stockStatus == 'low_stock'
                            ? context.vsr.warning
                            : null,
                      ),
                    ),
                    const SizedBox(height: VsrSpace.sm),
                    // Price and the add control share one baseline row at the bottom
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: PriceTag(price: p.price, mrp: p.mrp),
                        ),
                        AddToCartButton(product: p),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

// --------------------------------------------------------- Product detail ----
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _qty = 1;
  int _img = 0;
  bool _busy = false;
  bool? _wish;
  bool _recorded = false;
  String? _variantId;

  // 69. Selected pack size (falls back to the default size); products without sizes use product price/stock.
  Variant? _sel(Product p) => p.hasSizes
      ? (p.variants.where((v) => v.id == _variantId).firstOrNull ??
            p.defaultVariant)
      : null;
  num _price(Product p) => _sel(p)?.price ?? p.price;
  num _mrp(Product p) {
    final v = _sel(p);
    return v != null ? (v.mrp ?? v.price) : p.mrp;
  }

  num _avail(Product p) => _sel(p)?.available ?? p.available;
  bool _oos(Product p) => _avail(p) <= 0;

  Future<void> _add(Product p) async {
    if (!requireLogin(
      context,
      ref,
      reason: 'Log in to add items to your cart',
    )) {
      return;
    }
    setState(() => _busy = true);
    try {
      final cart = ref.read(cartProvider).value;
      final vid = _sel(p)?.id;
      await ref
          .read(cartProvider.notifier)
          .setQty(
            p.id,
            (cart?.qtyOf(p.id, variantId: vid) ?? 0) + _qty,
            variantId: vid,
          );
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text('${p.name} added to cart'),
              action: SnackBarAction(
                label: 'VIEW CART',
                textColor: VsrColors.accent,
                onPressed: () => context.push('/cart'),
              ),
            ),
          );
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleWish() async {
    if (!requireLogin(
      context,
      ref,
      reason: 'Log in to save items to your wishlist',
    )) {
      return;
    }
    try {
      final d =
          await ref.read(apiProvider).post('/store/me/wishlist/${widget.id}')
              as Json;
      final added = d['wishlisted'] as bool;
      setState(() => _wish = added);
      ref.invalidate(wishlistProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  Icon(
                    added ? Icons.favorite : Icons.heart_broken_outlined,
                    color: Colors.white,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(added ? 'Added to wishlist' : 'Removed from wishlist'),
                ],
              ),
              action: SnackBarAction(
                label: added ? 'VIEW' : 'UNDO',
                textColor: VsrColors.accent,
                onPressed: () =>
                    added ? context.push('/wishlist') : _toggleWish(),
              ),
            ),
          );
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(productDetailProvider(widget.id));
    final wished =
        _wish ??
        (ref.watch(wishlistProvider).value?.any((p) => p.id == widget.id) ??
            false);
    final t = Theme.of(context).textTheme;
    Widget roundBtn({
      required String tip,
      required VoidCallback onTap,
      required Widget icon,
    }) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: VsrSpace.sm),
      child: Material(
        color: Colors.white.withValues(alpha: 0.92),
        shape: const CircleBorder(),
        elevation: 2,
        shadowColor: Colors.black26,
        child: IconButton(tooltip: tip, onPressed: onTap, icon: icon),
      ),
    );
    return Scaffold(
      // Image runs edge to edge under the status bar; back + wishlist float over it
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        automaticallyImplyLeading: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: roundBtn(
          tip: 'Back',
          onTap: () => context.canPop() ? context.pop() : context.go('/'),
          icon: const Icon(Icons.arrow_back, color: VsrColors.ink),
        ),
        leadingWidth: 64,
        actions: [
          roundBtn(
            tip: wished ? 'Remove from wishlist' : 'Add to wishlist',
            onTap: _toggleWish,
            icon: Icon(
              wished ? Icons.favorite : Icons.favorite_border,
              color: wished ? VsrColors.danger : VsrColors.ink,
            ),
          ),
        ],
      ),
      body:
          detail.hasError &&
              detail.error is ApiException &&
              (detail.error as ApiException).status == 404
          ? const ProductUnavailableView()
          : AsyncBody(
              value: detail,
              onRetry: () => ref.invalidate(productDetailProvider(widget.id)),
              builder: (d) {
                final p = d.product;
                if (p.unavailable) return const ProductUnavailableView();
                if (!_recorded) {
                  _recorded = true;
                  WidgetsBinding.instance.addPostFrameCallback(
                    (_) =>
                        ref.read(recentlyViewedIdsProvider.notifier).add(p.id),
                  );
                }
                final side = MediaQuery.of(context).size.width;
                return ListView(
                  padding: const EdgeInsets.only(bottom: VsrSpace.xl),
                  children: [
                    // Edge-to-edge swipe carousel (square), counter + dots on the image
                    SizedBox(
                      height: side,
                      child: Stack(
                        children: [
                          PageView.builder(
                            itemCount: p.images.isEmpty ? 1 : p.images.length,
                            onPageChanged: (i) => setState(() => _img = i),
                            itemBuilder: (_, i) => Padding(
                              padding: EdgeInsets.zero,
                              child: Semantics(
                                button: p.images.isNotEmpty,
                                label: 'Open image ${i + 1} full screen',
                                child: GestureDetector(
                                  onTap: p.images.isEmpty
                                      ? null
                                      : () => context.push(
                                          '/gallery',
                                          extra: (p.images, i, p.name),
                                        ),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      NetImage(
                                        p.images.isEmpty ? null : p.images[i],
                                        radius: 0,
                                      ),
                                      if (p.images.isNotEmpty)
                                        Positioned(
                                          right: VsrSpace.md,
                                          bottom: VsrSpace.md,
                                          child: CircleAvatar(
                                            radius: 16,
                                            backgroundColor: Colors.white70,
                                            child: Icon(
                                              Icons.zoom_out_map,
                                              size: 18,
                                              color: context.vsr.ink,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          if (p.images.length > 1) ...[
                            Positioned(
                              right: VsrSpace.md,
                              bottom: VsrSpace.md,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  '${_img + 1}/${p.images.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              left: 0,
                              right: 0,
                              bottom: VsrSpace.md + 4,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  for (var i = 0; i < p.images.length; i++)
                                    AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 200,
                                      ),
                                      margin: const EdgeInsets.symmetric(
                                        horizontal: 3,
                                      ),
                                      width: i == _img ? 18 : 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: i == _img
                                            ? Colors.white
                                            : Colors.white60,
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        VsrSpace.gutter,
                        VsrSpace.lg,
                        VsrSpace.gutter,
                        0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name, style: t.headlineSmall),
                          const SizedBox(height: VsrSpace.xs),
                          Text(
                            '${p.unit}${p.brand != null ? ' · ${p.brand}' : ''}',
                            style: t.bodyMedium?.copyWith(
                              color: context.vsr.muted,
                            ),
                          ),
                          if (p.reviewCount > 0) ...[
                            const SizedBox(height: VsrSpace.sm),
                            Semantics(
                              label:
                                  'Rated ${p.rating} out of 5 from ${p.reviewCount} reviews',
                              child: InkWell(
                                onTap: () => context.push(
                                  '/product/${p.id}/reviews',
                                  extra: p.name,
                                ),
                                borderRadius: BorderRadius.circular(
                                  VsrRadius.sm,
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: VsrSpace.xs,
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.star_rounded,
                                        color: VsrColors.accent,
                                        size: 20,
                                      ),
                                      const SizedBox(width: VsrSpace.xs),
                                      Text(
                                        '${p.rating}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(width: VsrSpace.sm),
                                      Text(
                                        '${p.reviewCount} reviews',
                                        style: t.bodySmall?.copyWith(
                                          decoration: TextDecoration.underline,
                                          decorationColor: context.vsr.muted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: VsrSpace.lg),
                          PriceTag(price: _price(p), mrp: _mrp(p), big: true),
                          if (p.hasSizes) ...[
                            const SizedBox(height: VsrSpace.xl),
                            Text('Select Size', style: t.titleSmall),
                            const SizedBox(height: VsrSpace.sm),
                            Wrap(
                              spacing: VsrSpace.sm,
                              runSpacing: VsrSpace.sm,
                              children: [
                                for (final v in p.variants)
                                  ChoiceChip(
                                    selected: _sel(p)?.id == v.id,
                                    onSelected: (_) => setState(() {
                                      _variantId = v.id;
                                      _qty = 1;
                                    }),
                                    label: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          v.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        Text(
                                          v.outOfStock
                                              ? 'Sold out'
                                              : money(v.price),
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: v.outOfStock
                                                ? context.vsr.danger
                                                : null,
                                          ),
                                        ),
                                      ],
                                    ),
                                    tooltip:
                                        '${v.name}, ${v.outOfStock ? 'sold out' : money(v.price)}',
                                  ),
                              ],
                            ),
                          ],
                          const SizedBox(height: VsrSpace.lg),
                          Wrap(
                            spacing: VsrSpace.sm,
                            runSpacing: VsrSpace.sm,
                            children: [
                              if (p.categoryName != null)
                                Chip(
                                  label: Text(p.categoryName!),
                                  visualDensity: VisualDensity.compact,
                                ),
                              for (final b in p.badges)
                                Chip(
                                  label: Text(b),
                                  visualDensity: VisualDensity.compact,
                                  backgroundColor: context.vsr.accent50,
                                ),
                              Chip(
                                label: Text(
                                  _oos(p)
                                      ? 'Out of stock'
                                      : _avail(p) <= 10
                                      ? 'Only ${_avail(p)} left'
                                      : 'In stock',
                                ),
                                visualDensity: VisualDensity.compact,
                                backgroundColor: _oos(p)
                                    ? context.vsr.dangerBg
                                    : _avail(p) <= 10
                                    ? context.vsr.warningBg
                                    : context.vsr.successBg,
                              ),
                            ],
                          ),
                          const SizedBox(height: VsrSpace.sectionTop),
                          Text('Description', style: t.titleMedium),
                          const SizedBox(height: VsrSpace.sm),
                          Text(
                            p.description ?? p.shortDescription ?? '—',
                            style: t.bodyMedium?.copyWith(
                              height: 1.5,
                              color: context.vsr.muted,
                            ),
                          ),
                          if (p.allergens != null) ...[
                            const SizedBox(height: VsrSpace.lg),
                            Container(
                              padding: const EdgeInsets.all(VsrSpace.md),
                              decoration: BoxDecoration(
                                color: context.vsr.warningBg,
                                borderRadius: BorderRadius.circular(
                                  VsrRadius.md,
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.info_outline,
                                    size: 18,
                                    color: context.vsr.warning,
                                  ),
                                  const SizedBox(width: VsrSpace.md),
                                  Expanded(
                                    child: Text(
                                      'Ingredients & allergens: ${p.allergens}',
                                      style: TextStyle(
                                        fontSize: 13,
                                        height: 1.4,
                                        color: context.vsr.ink,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: VsrSpace.sectionTop),
                          Text('Delivery & Returns', style: t.titleMedium),
                          const SizedBox(height: VsrSpace.xs),
                          InfoRow(
                            icon: Icons.local_shipping_outlined,
                            title: p.deliveryType == 'instant'
                                ? 'Instant delivery available'
                                : 'Standard delivery',
                            value: p.outOfStock ? 'Currently out of stock' : 'Delivered to serviceable PIN codes. Availability is confirmed at checkout.',
                          ),
                          InfoRow(
                            icon: p.returnable
                                ? Icons.assignment_return_outlined
                                : Icons.block_outlined,
                            tone: p.returnable ? null : context.vsr.danger,
                            title: p.returnable
                                ? 'Returnable within ${p.returnWindowDays} day${p.returnWindowDays == 1 ? '' : 's'} of delivery'
                                : 'Not returnable',
                            value: p.returnable
                                ? 'Damaged or wrong items can be returned from Order Details.'
                                : 'You can still report damaged or wrong items to support.',
                          ),
                          if (p.type == 'homemade' && p.prepTimeMins != null)
                            InfoRow(
                              icon: Icons.timer_outlined,
                              title: 'Preparation time',
                              value:
                                  'About ${p.prepTimeMins} minutes after the kitchen confirms',
                            ),
                          if (p.sku != null)
                            InfoRow(
                              icon: Icons.qr_code_2_outlined,
                              title: 'SKU',
                              value: p.sku!,
                            ),
                          const SizedBox(height: VsrSpace.sectionTop - 8),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Ratings & Reviews',
                                  style: t.titleMedium,
                                ),
                              ),
                              TextButton(
                                onPressed: () => context.push(
                                  '/product/${p.id}/review',
                                  extra: p.name,
                                ),
                                child: const Text('Write a review'),
                              ),
                            ],
                          ),
                          if (d.reviews.isEmpty)
                            Text('No reviews yet.', style: t.bodySmall),
                          if (d.reviews.isNotEmpty) ...[
                            for (final r in d.reviews.take(3))
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                minVerticalPadding: VsrSpace.sm,
                                title: Row(
                                  children: [
                                    Text(
                                      r.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ...List.generate(
                                      r.rating.toInt(),
                                      (_) => const Icon(
                                        Icons.star_rounded,
                                        size: 14,
                                        color: VsrColors.accent,
                                      ),
                                    ),
                                  ],
                                ),
                                subtitle: r.text == null ? null : Text(r.text!),
                              ),
                            const SizedBox(height: VsrSpace.sm),
                            OutlinedButton(
                              onPressed: () => context.push(
                                '/product/${p.id}/reviews',
                                extra: p.name,
                              ),
                              child: Text('See all ${p.reviewCount} reviews'),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (d.similar.isNotEmpty) ...[
                      const SectionHeader('You may also like'),
                      ProductRail(products: d.similar),
                    ],
                  ],
                );
              },
            ),
      bottomNavigationBar: detail.hasValue
          ? BottomCta(
              leading: _oos(detail.value!.product)
                  ? null
                  : QtyStepper(
                      qty: _qty,
                      onChanged: (q) => setState(
                        () => _qty = q.clamp(
                          1,
                          _avail(detail.value!.product).toInt().clamp(1, 50),
                        ),
                      ),
                    ),
              child: detail.value!.product.outOfStock
                  ? NotifyMeButton(
                      product: detail.value!.product,
                      height: 52,
                      fontSize: 15,
                    )
                  : FilledButton(
                      onPressed: _oos(detail.value!.product) || _busy
                          ? null
                          : () => _add(detail.value!.product),
                      child: _busy
                          ? const Busy()
                          : Text(
                              _oos(detail.value!.product)
                                  ? (detail.value!.product.hasSizes
                                        ? 'Size Sold Out'
                                        : 'Out of Stock')
                                  : 'Add to Cart · ${money(_price(detail.value!.product) * _qty)}',
                            ),
                    ),
            )
          : null,
    );
  }
}
