import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// Cached network image with a neutral placeholder and a broken-image fallback.
class NetImage extends StatelessWidget {
  const NetImage(
    this.url, {
    super.key,
    this.width,
    this.height,
    this.radius = 12,
    this.fit = BoxFit.cover,
  });
  final String? url;
  final double? width, height, radius;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) {
    final ph = Container(
      width: width,
      height: height,
      color: context.vsr.lineSoft,
      alignment: Alignment.center,
      child: Icon(Icons.image_outlined, color: context.vsr.muted, size: 20),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius ?? 0),
      child: url == null
          ? ph
          : CachedNetworkImage(
              imageUrl: url!,
              width: width,
              height: height,
              fit: fit,
              placeholder: (_, _) => ph,
              errorWidget: (_, _, _) => ph,
            ),
    );
  }
}

/// Loading / error / empty states used on every async screen (PRD §17).
/// Skeleton placeholder shown while content loads (finite height, safe in any parent).
class LoadingView extends StatefulWidget {
  const LoadingView({super.key, this.label, this.rows = 4});
  final String? label;
  final int rows;
  @override
  State<LoadingView> createState() => _LoadingViewState();
}

class _LoadingViewState extends State<LoadingView>
    with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
    lowerBound: 0.45,
    upperBound: 1,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) _pulse.stop();
    final c = context.vsr.line;
    Widget bar(double w, double h) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: c,
        borderRadius: BorderRadius.circular(8),
      ),
    );
    return Semantics(
      label: widget.label ?? 'Loading',
      child: ExcludeSemantics(
        child: FadeTransition(
          opacity: _pulse,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < widget.rows; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: VsrSpace.lg),
                    child: Row(
                      children: [
                        bar(56, 56),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              bar(double.infinity, 14),
                              const SizedBox(height: 8),
                              bar(120, 12),
                            ],
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
    );
  }
}

class MessageView extends StatelessWidget {
  const MessageView({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
    this.onAction,
    this.tone,
  });
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;

  /// Defaults to the brand colour for the current theme.
  final Color? tone;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final body = Padding(
        padding: const EdgeInsets.all(VsrSpace.xxl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: (tone ?? context.vsr.brandText).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  color: tone ?? context.vsr.brandText,
                  size: 32,
                ),
              ),
              const SizedBox(height: VsrSpace.xl),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontSize: 20),
              ),
              if (message != null) ...[
                const SizedBox(height: VsrSpace.sm),
                Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: context.vsr.muted),
                ),
              ],
              if (action != null) ...[
                const SizedBox(height: VsrSpace.xl),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onAction,
                    child: Text(action!),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
      // Scroll only when given a fixed height (full-screen states); inside lists it sizes to content
      return box.hasBoundedHeight
          ? Center(child: SingleChildScrollView(child: body))
          : Center(child: body);
    },
  );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final offline = error is ApiException && (error as ApiException).isOffline;
    return MessageView(
      icon: offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
      tone: offline ? context.vsr.warning : context.vsr.danger,
      title: offline ? 'You’re offline' : 'Something went wrong',
      message: error is ApiException
          ? (error as ApiException).message
          : 'Please try again.',
      action: 'Retry',
      onAction: onRetry,
    );
  }
}

/// Renders an AsyncValue with consistent loading/error handling.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({
    super.key,
    required this.value,
    required this.onRetry,
    required this.builder,
    this.loading,
  });
  final AsyncValue<T> value;
  final VoidCallback onRetry;
  final Widget Function(T data) builder;
  final Widget? loading;
  @override
  Widget build(BuildContext context) => value.when(
    data: builder,
    loading: () => loading ?? const LoadingView(),
    error: (e, _) => ErrorView(error: e, onRetry: onRetry),
    skipLoadingOnRefresh: true,
    skipLoadingOnReload: true,
  );
}

void showMessage(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: error ? VsrColors.danger : VsrColors.brand900,
        duration: const Duration(seconds: 2),
      ),
    );
}

/// For guests: explains why and opens Login. Returns true when the action may continue.
bool requireLogin(
  BuildContext context,
  WidgetRef ref, {
  String reason = 'Log in to continue',
}) {
  if (ref.read(isSignedInProvider)) return true;
  showMessage(context, reason);
  context.push('/login');
  return false;
}

/// Shown in place of account-only content while browsing as a guest.
class GuestPrompt extends StatelessWidget {
  const GuestPrompt({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title, message;
  @override
  Widget build(BuildContext context) => MessageView(
    icon: icon,
    title: title,
    message: message,
    action: 'Log in',
    onAction: () => context.push('/login'),
  );
}

/// Opens tel:/mailto:/https links without crashing when no app can handle them.
Future<bool> safeLaunch(
  String url, {
  BuildContext? context,
  bool external = false,
}) async {
  try {
    final ok = await launchUrl(
      Uri.parse(url),
      mode: external
          ? LaunchMode.externalApplication
          : LaunchMode.platformDefault,
    );
    if (!ok && context != null && context.mounted) {
      showMessage(context, 'Couldn’t open this on your phone.', error: true);
    }
    return ok;
  } catch (_) {
    if (context != null && context.mounted) {
      showMessage(context, 'Couldn’t open this on your phone.', error: true);
    }
    return false;
  }
}

String errorText(Object e) =>
    e is ApiException ? e.message : 'Something went wrong. Please try again.';

class PriceTag extends StatelessWidget {
  const PriceTag({
    super.key,
    required this.price,
    required this.mrp,
    this.big = false,
  });
  final num price, mrp;
  final bool big;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final off = mrp > price && mrp > 0 ? ((1 - price / mrp) * 100).round() : 0;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 6,
      children: [
        Text(
          money(price),
          style: (big ? t.headlineSmall : t.titleSmall)?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        if (off > 0)
          Text(
            money(mrp),
            style: t.bodySmall?.copyWith(
              decoration: TextDecoration.lineThrough,
            ),
          ),
        if (off > 0 && big)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: context.vsr.successBg,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '$off% OFF',
              style: TextStyle(
                color: context.vsr.success,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
      ],
    );
  }
}

/// − qty + control with ≥44pt targets.
class QtyStepper extends StatelessWidget {
  const QtyStepper({
    super.key,
    required this.qty,
    required this.onChanged,
    this.max = 50,
    this.busy = false,
    this.compact = false,
  });
  final int qty;
  final ValueChanged<int> onChanged;
  final int max;
  final bool busy, compact;
  @override
  Widget build(BuildContext context) {
    final s = compact ? 34.0 : 44.0;
    Widget btn(IconData i, String label, VoidCallback? onTap) => Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: s,
          height: s,
          child: Icon(
            i,
            size: 18,
            color: onTap == null ? context.vsr.muted : null,
          ),
        ),
      ),
    );
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: context.vsr.line),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          btn(
            Icons.remove,
            'Decrease quantity',
            qty > 0 ? () => onChanged(qty - 1) : null,
          ),
          SizedBox(
            width: compact ? 26 : 32,
            child: busy
                ? const Center(
                    child: SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : Text(
                    '$qty',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
          ),
          btn(
            Icons.add,
            'Increase quantity',
            qty < max ? () => onChanged(qty + 1) : null,
          ),
        ],
      ),
    );
  }
}

/// Add-to-cart control that turns into a stepper once the item is in the cart.
class AddToCartButton extends ConsumerStatefulWidget {
  const AddToCartButton({
    super.key,
    required this.product,
    this.compact = true,
  });
  final Product product;
  final bool compact;
  @override
  ConsumerState<AddToCartButton> createState() => _AddToCartButtonState();
}

class _AddToCartButtonState extends ConsumerState<AddToCartButton> {
  bool busy = false;
  Future<void> set(int q) async {
    if (!requireLogin(
      context,
      ref,
      reason: 'Log in to add items to your cart',
    )) {
      return;
    }
    setState(() => busy = true);
    try {
      await ref.read(cartProvider.notifier).setQty(widget.product.id, q);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final qty = ref.watch(cartProvider).value?.qtyOf(widget.product.id) ?? 0;
    if (widget.product.hasSizes && !widget.product.outOfStock) {
      // Pick a size on the product page; show how many are already in the cart.
      return SizedBox(
        height: widget.compact ? 34 : 48,
        child: OutlinedButton(
          onPressed: () => context.push('/product/${widget.product.id}'),
          style: OutlinedButton.styleFrom(
            minimumSize: Size(
              widget.compact ? 64 : 120,
              widget.compact ? 34 : 48,
            ),
            padding: EdgeInsets.symmetric(horizontal: VsrSpace.md),
            foregroundColor: context.vsr.brandText,
            side: BorderSide(color: context.vsr.brandText),
          ),
          child: Text(
            qty > 0
                ? '$qty in cart'
                : '${widget.product.variants.length} sizes',
            semanticsLabel: 'Choose a size of ${widget.product.name}',
          ),
        ),
      );
    }
    if (widget.product.outOfStock) {
      return Text(
        'Out of stock',
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: context.vsr.danger, fontWeight: FontWeight.w600),
      );
    }
    if (qty == 0) {
      return SizedBox(
        height: widget.compact ? 34 : 48,
        child: OutlinedButton(
          onPressed: busy ? null : () => set(1),
          style: OutlinedButton.styleFrom(
            minimumSize: Size(
              widget.compact ? 64 : 120,
              widget.compact ? 34 : 48,
            ),
            padding: const EdgeInsets.symmetric(horizontal: VsrSpace.md),
            foregroundColor: context.vsr.brandText,
            side: BorderSide(color: context.vsr.brandText),
          ),
          child: busy
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(
                  'Add',
                  semanticsLabel: 'Add ${widget.product.name} to cart',
                ),
        ),
      );
    }
    return QtyStepper(
      qty: qty,
      busy: busy,
      compact: widget.compact,
      max: widget.product.available.toInt().clamp(1, 50),
      onChanged: set,
    );
  }
}

class ProductTile extends ConsumerStatefulWidget {
  const ProductTile({super.key, required this.product, this.width = 176});
  final Product product;
  final double width;

  @override
  ConsumerState<ProductTile> createState() => _ProductTileState();
}

class _ProductTileState extends ConsumerState<ProductTile> {
  bool _busy = false;

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
          await ref
                  .read(apiProvider)
                  .post('/store/me/wishlist/${widget.product.id}')
              as Json;
      final added = d['wishlisted'] as bool? ?? false;
      ref.invalidate(wishlistProvider);
      if (mounted) {
        showMessage(
          context,
          added ? 'Added to wishlist' : 'Removed from wishlist',
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  Future<void> _setQty(int q) async {
    if (!requireLogin(
      context,
      ref,
      reason: 'Log in to add items to your cart',
    )) {
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(cartProvider.notifier).setQty(widget.product.id, q);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Real reviews only. Never invent ratings or counts for products nobody has reviewed.
  String _reviewsStr(Product p) {
    final c = p.reviewCount;
    if (c >= 1000) return '${(c / 1000).toStringAsFixed(1)}K reviews';
    return '$c review${c == 1 ? '' : 's'}';
  }

  String _subtitleStr(Product p) {
    if (p.shortDescription != null && p.shortDescription!.trim().isNotEmpty) {
      return p.shortDescription!.trim();
    }
    final parts = [
      if (p.unit.isNotEmpty) p.unit,
      if (p.brand != null && p.brand!.isNotEmpty) p.brand,
      if (p.categoryName != null && p.categoryName!.isNotEmpty) p.categoryName,
    ];
    if (parts.isNotEmpty) return parts.take(2).join(', ');
    return 'Standard Pack';
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final wish =
        ref.watch(wishlistProvider).value?.any((x) => x.id == p.id) ?? false;
    final qty = ref.watch(cartProvider).value?.qtyOf(p.id) ?? 0;
    final off = p.discountPct;

    return Container(
      width: widget.width,
      decoration: BoxDecoration(
        color: context.vsr.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2E) : const Color(0xFFE8E5DF),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/product/${p.id}'),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. Media Area
                AspectRatio(
                  aspectRatio: 1.05,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: isDark
                                ? const Color(0xFF1E1E21)
                                : const Color(0xFFF7F6F3),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: NetImage(
                            p.image,
                            fit: BoxFit.cover,
                            radius: 14,
                          ),
                        ),
                      ),
                      // Discount Badge
                      if (off > 0)
                        Positioned(
                          left: 7,
                          top: 7,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3.5,
                            ),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFF5722), Color(0xFFFF3D00)],
                              ),
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFFF5722)
                                      .withValues(alpha: 0.35),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.bolt,
                                  size: 12,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '$off% OFF',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      // Out of Stock Badge
                      if (p.outOfStock)
                        Positioned(
                          left: 7,
                          bottom: 7,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3.5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDC2626),
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFDC2626)
                                      .withValues(alpha: 0.35),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Text(
                              'Out of stock',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                              ),
                            ),
                          ),
                        ),
                      // Wishlist Heart Button
                      Positioned(
                        right: 7,
                        top: 7,
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: _toggleWish,
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color:
                                    (isDark
                                            ? const Color(0xFF26262A)
                                            : Colors.white)
                                        .withValues(alpha: 0.92),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.08),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Icon(
                                wish
                                    ? Icons.favorite
                                    : Icons.favorite_border_rounded,
                                size: 16,
                                color: wish
                                    ? const Color(0xFFEF4444)
                                    : (isDark
                                          ? Colors.white70
                                          : const Color(0xFF202923)),
                              ),
                            ),
                          ),
                        ),
                      ),
                      // Variant Dots
                      if (p.hasSizes)
                        Positioned(
                          right: 7,
                          top: 44,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 4,
                              horizontal: 3,
                            ),
                            decoration: BoxDecoration(
                              color:
                                  (isDark
                                          ? const Color(0xFF26262A)
                                          : Colors.white)
                                      .withValues(alpha: 0.92),
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFFD1D5DB),
                                      width: 1,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF212529),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF1E3A8A),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                if (p.variants.length > 3) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    '+${p.variants.length - 3}',
                                    style: const TextStyle(
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      // Carousel Dots
                      if (!p.outOfStock && p.images.length > 1)
                        Positioned(
                          bottom: 6,
                          left: 0,
                          right: 0,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: context.vsr.ink.withValues(alpha: 0.7),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 3),
                              Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: context.vsr.ink.withValues(
                                    alpha: 0.25,
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 3),
                              Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: context.vsr.ink.withValues(
                                    alpha: 0.25,
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 7),
                // 2. Title
                Text(
                  p.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: context.vsr.ink,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                // 3. Subtitle
                Text(
                  _subtitleStr(p),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: context.vsr.muted,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 3),
                // 4. Rating & Reviews (only when the product has real reviews; otherwise a "New" tag)
                if (p.reviewCount <= 0)
                  Text(
                    'New',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: context.vsr.brandText,
                    ),
                  )
                else
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        size: 15,
                        color: Color(0xFFF59E0B),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        p.rating.toStringAsFixed(1),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                          color: context.vsr.ink,
                        ),
                      ),
                      Container(
                        height: 10,
                        width: 1,
                        margin: const EdgeInsets.symmetric(horizontal: 5),
                        color: context.vsr.line,
                      ),
                      Expanded(
                        child: Text(
                          _reviewsStr(p),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: context.vsr.muted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: 5),
                // 5. Price Row
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  children: [
                    Text(
                      money(p.price),
                      style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w800,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    if (off > 0)
                      Text(
                        money(p.mrp),
                        style: TextStyle(
                          fontSize: 12.5,
                          color: context.vsr.muted,
                          decoration: TextDecoration.lineThrough,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                // 6. Action Row
                if (p.outOfStock)
                  SizedBox(
                    width: double.infinity,
                    height: 36,
                    child: NotifyMeButton(product: p),
                  )
                else if (qty > 0)
                  SizedBox(
                    width: double.infinity,
                    height: 36,
                    child: QtyStepper(
                      qty: qty,
                      busy: _busy,
                      compact: true,
                      max: p.available.toInt().clamp(1, 50),
                      onChanged: _setQty,
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    height: 36,
                    child: ElevatedButton.icon(
                      onPressed: _busy
                          ? null
                          : () {
                              if (p.hasSizes) {
                                context.push('/product/${p.id}');
                              } else {
                                _setQty(1);
                              }
                            },
                      icon: _busy
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(
                              Icons.shopping_cart_outlined,
                              size: 15,
                              color: Colors.white,
                            ),
                      label: Text(
                        p.hasSizes ? 'Select Size' : 'Add to Cart',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                        ),
                        backgroundColor: VsrColors.accent,
                        foregroundColor: Colors.white,
                        elevation: 2,
                        shadowColor: VsrColors.accent.withValues(
                          alpha: 0.35,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Notify Me" for out-of-stock products: tap to ask for a back-in-stock alert, tap again to cancel.
class NotifyMeButton extends ConsumerStatefulWidget {
  const NotifyMeButton({
    super.key,
    required this.product,
    this.height = 36,
    this.fontSize = 12,
  });
  final Product product;
  final double height, fontSize;
  @override
  ConsumerState<NotifyMeButton> createState() => _NotifyMeButtonState();
}

class _NotifyMeButtonState extends ConsumerState<NotifyMeButton> {
  bool _busy = false;
  Future<void> _toggle(bool on) async {
    if (!requireLogin(
      context,
      ref,
      reason: 'Log in to get back-in-stock alerts',
    )) {
      return;
    }
    setState(() => _busy = true);
    try {
      final api = ref.read(apiProvider);
      final path = '/store/me/stock-alerts/${widget.product.id}';
      if (on) {
        await api.delete(path);
      } else {
        await api.post(path);
      }
      ref.invalidate(stockAlertsProvider);
      if (mounted) {
        showMessage(
          context,
          on ? 'Alert cancelled' : 'We’ll notify you when it’s back in stock',
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final on =
        ref.watch(stockAlertsProvider).value?.contains(widget.product.id) ??
        false;
    final fg = on ? context.vsr.brandText : VsrColors.accentDark;
    return SizedBox(
      height: widget.height,
      child: OutlinedButton.icon(
        onPressed: _busy ? null : () => _toggle(on),
        icon: _busy
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Icon(
                on
                    ? Icons.notifications_active_rounded
                    : Icons.notifications_none_rounded,
                size: widget.fontSize + 3,
                color: fg,
              ),
        label: Text(
          on ? 'We’ll notify you' : 'Notify Me',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: fg,
            fontSize: widget.fontSize,
            fontWeight: FontWeight.w700,
          ),
        ),
        style: OutlinedButton.styleFrom(
          minimumSize: Size(0, widget.height),
          padding: const EdgeInsets.symmetric(horizontal: 6),
          side: BorderSide(
            color: on
                ? context.vsr.brandText.withValues(alpha: 0.4)
                : VsrColors.accent,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: on ? context.vsr.brand50 : context.vsr.surface,
        ),
      ),
    );
  }
}

/// Horizontal product rail.
class ProductRail extends StatelessWidget {
  const ProductRail({super.key, required this.products});
  final List<Product> products;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 314,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter),
      itemCount: products.length,
      separatorBuilder: (_, _) => const SizedBox(width: VsrSpace.group),
      itemBuilder: (_, i) => ProductTile(product: products[i], width: 176),
    ),
  );
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(
    this.title, {
    super.key,
    this.subtitle,
    this.action,
    this.onAction,
  });
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      VsrSpace.gutter,
      16.0,
      VsrSpace.gutter,
      8.0,
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style:
                    Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ) ??
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: TextStyle(
                    fontSize: 13,
                    color: context.vsr.muted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (action != null)
          InkWell(
            onTap: onAction,
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    action!,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: VsrColors.brand800,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: VsrColors.brand800,
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;
  static const _labels = {
    'placed': 'Placed',
    'picking': 'Preparing',
    'out_for_delivery': 'Out for Delivery',
    'refund_pending': 'Refund Pending',
  };
  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (status) {
      'delivered' ||
      'paid' ||
      'confirmed' ||
      'resolved' => (context.vsr.success, context.vsr.successBg),
      'cancelled' ||
      'rejected' ||
      'failed' ||
      'delivery_failed' ||
      'open' => (context.vsr.danger, context.vsr.dangerBg),
      'out_for_delivery' ||
      'assigned' => (context.vsr.info, context.vsr.infoBg),
      _ => (context.vsr.warning, context.vsr.warningBg),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            _labels[status] ?? titleCase(status),
            style: TextStyle(
              color: fg,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class BillRow extends StatelessWidget {
  const BillRow(
    this.label,
    this.value, {
    super.key,
    this.bold = false,
    this.color,
    this.was,
  });
  final String label, value;
  final bool bold;
  final Color? color;
  /// Old value shown struck through before [value] (e.g. the delivery fee that free delivery saved)
  final String? was;
  @override
  Widget build(BuildContext context) {
    final s = bold
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: s?.copyWith(color: bold ? null : context.vsr.muted),
            ),
          ),
          if (was != null) ...[
            Text(was!, style: s?.copyWith(color: context.vsr.muted, decoration: TextDecoration.lineThrough)),
            const SizedBox(width: 6),
          ],
          Text(
            value,
            style: s?.copyWith(
              color: color,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class BillCard extends StatelessWidget {
  const BillCard({super.key, required this.totals, this.count, this.standardDeliveryFee = 0});
  final Totals totals;
  final int? count;
  /// Shown struck through next to FREE, so the customer sees what free delivery saved
  final num standardDeliveryFee;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Bill Details',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const SizedBox(height: VsrSpace.md),
          BillRow(
            'Item Total${count != null ? ' ($count items)' : ''}',
            money(totals.itemTotal),
          ),
          if (totals.discount > 0)
            BillRow(
              'Discount${totals.couponCode != null ? ' (${totals.couponCode})' : ''}',
              '−${money(totals.discount)}',
              color: context.vsr.success,
            ),
          BillRow(
            'Delivery Fee',
            totals.deliveryFee == 0 ? 'FREE' : money(totals.deliveryFee),
            color: totals.deliveryFee == 0 ? context.vsr.success : null,
            was: totals.deliveryFee == 0 && standardDeliveryFee > 0 ? money(standardDeliveryFee) : null,
          ),
          BillRow('Packaging Fee', money(totals.packagingFee)),
          BillRow('GST (included)', money(totals.tax)),
          const Divider(height: VsrSpace.xl),
          BillRow('Total', money(totals.grandTotal), bold: true),
        ],
      ),
    ),
  );
}

/// A titled group of rows on one card; dividers start at the row text so every list aligns.
class TileGroup extends StatelessWidget {
  const TileGroup({super.key, this.title, required this.children});
  final String? title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (title != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(
            VsrSpace.xs,
            0,
            VsrSpace.xs,
            VsrSpace.sm,
          ),
          child: Text(
            title!,
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(color: context.vsr.muted),
          ),
        ),
      Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const Divider(indent: VsrSpace.lg + 24 + 14),
              children[i],
            ],
          ],
        ),
      ),
    ],
  );
}

/// Standard row for [TileGroup]: icon, label, optional detail, chevron when it navigates.
class NavTile extends StatelessWidget {
  const NavTile({
    super.key,
    required this.icon,
    required this.label,
    this.detail,
    this.onTap,
    this.danger = false,
    this.chevron = true,
    this.trailing,
  });
  final IconData icon;
  final String label;
  final String? detail;
  final VoidCallback? onTap;
  final bool danger, chevron;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final c = danger ? context.vsr.danger : null;
    return ListTile(
      leading: Icon(icon, color: c ?? context.vsr.brandText),
      title: Text(label, style: c == null ? null : TextStyle(color: c)),
      subtitle: detail == null ? null : Text(detail!),
      trailing:
          trailing ??
          (chevron && onTap != null && !danger
              ? Icon(Icons.chevron_right_rounded, color: context.vsr.muted)
              : null),
      onTap: onTap,
    );
  }
}

/// Primary CTA pinned above the safe area.
class BottomCta extends StatelessWidget {
  const BottomCta({super.key, required this.child, this.leading});
  final Widget child;
  final Widget? leading;
  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Material(
      color: context.vsr.surface,
      shape: Border(top: BorderSide(color: context.vsr.line)),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            VsrSpace.gutter,
            10,
            VsrSpace.gutter,
            bottomInset > 0 ? 4 : 12,
          ),
          child: SizedBox(
            width: double.infinity,
            height: 48,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (leading != null) ...[
                  leading!,
                  const SizedBox(width: VsrSpace.lg),
                ],
                Expanded(child: SizedBox.expand(child: child)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class Busy extends StatelessWidget {
  const Busy({super.key, this.color = Colors.white});
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 20,
    height: 20,
    child: CircularProgressIndicator(strokeWidth: 2.2, color: color),
  );
}
