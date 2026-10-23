import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/status_screen.dart';

// ----------------------------------------------------------- 68. Gallery / zoom
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key, required this.images, this.initial = 0, this.title});
  final List<String> images;
  final int initial;
  final String? title;
  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  late final _pc = PageController(initialPage: widget.initial);
  late int _i = widget.initial;
  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: Text(widget.images.length > 1 ? '${_i + 1} / ${widget.images.length}' : (widget.title ?? '')),
        ),
        body: Column(children: [
          Expanded(
            child: PageView.builder(
              controller: _pc,
              itemCount: widget.images.length,
              onPageChanged: (i) => setState(() => _i = i),
              // Pinch to zoom, double-tap handled by InteractiveViewer gestures
              itemBuilder: (_, i) => InteractiveViewer(minScale: 1, maxScale: 4, child: Center(child: NetImage(widget.images[i], radius: 0, fit: BoxFit.contain))),
            ),
          ),
          if (widget.images.length > 1)
            SafeArea(
              top: false,
              child: SizedBox(
                height: 80,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: VsrSpace.gutter, vertical: VsrSpace.md),
                  itemCount: widget.images.length,
                  separatorBuilder: (_, _) => const SizedBox(width: VsrSpace.sm),
                  itemBuilder: (_, i) => GestureDetector(
                    onTap: () => _pc.animateToPage(i, duration: const Duration(milliseconds: 250), curve: Curves.easeOutCubic),
                    child: Container(
                      decoration: BoxDecoration(border: Border.all(color: i == _i ? VsrColors.accent : Colors.transparent, width: 2), borderRadius: BorderRadius.circular(10)),
                      child: NetImage(widget.images[i], width: 52, height: 52, radius: 8),
                    ),
                  ),
                ),
              ),
            ),
          Padding(padding: const EdgeInsets.only(bottom: VsrSpace.md), child: Text('Pinch to zoom', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12))),
        ]),
      );
}

// ------------------------------------------------------------ 71. Product unavailable
class ProductUnavailableView extends StatelessWidget {
  const ProductUnavailableView({super.key});
  @override
  Widget build(BuildContext context) => MessageView(
        icon: Icons.remove_shopping_cart_outlined,
        tone: context.vsr.warning,
        title: 'This product isn’t available',
        message: 'It may have been removed or is temporarily unavailable in your area. Explore similar products instead.',
        action: 'Browse Categories',
        onAction: () => context.go('/categories'),
      );
}

// ------------------------------------------------------------- 74. Reviews & ratings
class ReviewsScreen extends ConsumerWidget {
  const ReviewsScreen({super.key, required this.productId, this.productName});
  final String productId;
  final String? productName;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = ref.watch(reviewsProvider(productId));
    return Scaffold(
      appBar: AppBar(title: const Text('Ratings & Reviews')),
      body: AsyncBody(
        value: r,
        onRetry: () => ref.invalidate(reviewsProvider(productId)),
        builder: (d) {
          final count = d.distribution.values.fold<int>(0, (a, b) => a + b);
          final avg = count == 0 ? 0.0 : d.distribution.entries.fold<double>(0, (a, e) => a + e.key * e.value) / count;
          return ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
            if (productName != null) ...[
              Text(productName!, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: VsrSpace.md),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(VsrSpace.lg + 4),
                child: Row(children: [
                  Semantics(
                    label: 'Average rating ${avg.toStringAsFixed(1)} out of 5 from $count ratings',
                    child: ExcludeSemantics(
                      child: Column(children: [
                        Text(avg.toStringAsFixed(1), style: const TextStyle(fontSize: 40, height: 1.1, fontWeight: FontWeight.w800)),
                        const SizedBox(height: VsrSpace.xs),
                        Row(children: List.generate(5, (i) => Icon(i < avg.round() ? Icons.star_rounded : Icons.star_outline_rounded, size: 18, color: VsrColors.accent))),
                        const SizedBox(height: VsrSpace.xs),
                        Text('$count ratings', style: Theme.of(context).textTheme.bodySmall),
                      ]),
                    ),
                  ),
                  const SizedBox(width: VsrSpace.xl),
                  Expanded(
                    child: Column(children: [
                      for (var s = 5; s >= 1; s--)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(children: [
                            SizedBox(width: 14, child: Text('$s', style: const TextStyle(fontSize: 12))),
                            const Icon(Icons.star_rounded, size: 12, color: VsrColors.accent),
                            const SizedBox(width: VsrSpace.sm),
                            Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: count == 0 ? 0 : (d.distribution[s] ?? 0) / count, minHeight: 6, backgroundColor: context.vsr.lineSoft, color: context.vsr.brandText))),
                            SizedBox(width: 28, child: Text('${d.distribution[s] ?? 0}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 12))),
                          ]),
                        ),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: VsrSpace.group),
            OutlinedButton.icon(onPressed: () => context.push('/product/$productId/review', extra: productName), icon: const Icon(Icons.rate_review_outlined), label: const Text('Write a Review')),
            const SizedBox(height: VsrSpace.xl),
            if (d.items.isEmpty) const MessageView(icon: Icons.reviews_outlined, title: 'No reviews yet', message: 'Be the first to share your experience.'),
            for (final rv in d.items)
              Padding(
                padding: const EdgeInsets.only(bottom: VsrSpace.group),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(VsrSpace.lg),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: rv.rating >= 4 ? context.vsr.success : rv.rating >= 3 ? context.vsr.warning : context.vsr.danger, borderRadius: BorderRadius.circular(6)),
                          child: Text('${rv.rating} ★', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                        const SizedBox(width: VsrSpace.sm),
                        Expanded(child: Text(rv.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
                        Text(shortDate(rv.createdAt), style: Theme.of(context).textTheme.bodySmall),
                      ]),
                      if (rv.text != null && rv.text!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: VsrSpace.md), child: Text(rv.text!)),
                      const SizedBox(height: VsrSpace.md),
                      Row(children: [Icon(Icons.verified_outlined, size: 14, color: context.vsr.success), SizedBox(width: 4), Text('Verified purchase', style: TextStyle(fontSize: 12, color: context.vsr.success))]),
                    ]),
                  ),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

// --------------------------------------------------- 75. Write / edit review
class WriteReviewScreen extends ConsumerStatefulWidget {
  const WriteReviewScreen({super.key, required this.productId, this.productName});
  final String productId;
  final String? productName;
  @override
  ConsumerState<WriteReviewScreen> createState() => _WriteReviewScreenState();
}

class _WriteReviewScreenState extends ConsumerState<WriteReviewScreen> {
  final _text = TextEditingController();
  int _stars = 0;
  bool _loading = true, _eligible = false, _editing = false, _busy = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await ref.read(apiProvider).get('/store/me/products/${widget.productId}/review') as Json;
      final r = d['review'] as Json?;
      setState(() {
        _eligible = d['eligible'] == true;
        _editing = r != null;
        _stars = (r?['rating'] as num?)?.toInt() ?? 0;
        _text.text = (r?['text'] as String?) ?? '';
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).put('/store/me/products/${widget.productId}/review', {'rating': _stars, if (_text.text.trim().isNotEmpty) 'text': _text.text.trim()});
      ref.invalidate(reviewsProvider(widget.productId));
      ref.invalidate(productDetailProvider(widget.productId));
      if (mounted) context.pushReplacement('/review-success', extra: _editing);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static const _labels = ['Tap to rate', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(appBar: AppBar(title: const Text('Write a Review')), body: const LoadingView());
    if (_error != null) return Scaffold(appBar: AppBar(title: const Text('Write a Review')), body: ErrorView(error: _error!, onRetry: _load));
    if (!_eligible) {
      return StatusScreen(
        showBack: true,
        icon: Icons.lock_clock_outlined,
        tone: StatusTone.info,
        title: 'Review after delivery',
        message: 'Only customers who received this product can review it. Once your order is delivered, you can share your experience here.',
        primaryLabel: 'OK',
        onPrimary: () => context.pop(),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit Your Review' : 'Write a Review')),
      body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xl, VsrSpace.gutter, VsrSpace.xl), children: [
        if (widget.productName != null) Text(widget.productName!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: VsrSpace.md),
        Center(
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                tooltip: '$i star${i > 1 ? 's' : ''}',
                iconSize: 44,
                onPressed: () => setState(() => _stars = i),
                icon: Icon(i <= _stars ? Icons.star_rounded : Icons.star_outline_rounded, color: VsrColors.accent),
              ),
          ]),
        ),
        Center(child: Text(_labels[_stars], style: TextStyle(fontWeight: FontWeight.w600, color: _stars == 0 ? context.vsr.muted : null))),
        const SizedBox(height: VsrSpace.xl),
        TextField(controller: _text, maxLines: 5, maxLength: 1000, decoration: const InputDecoration(labelText: 'Your review (optional)', hintText: 'What did you like or dislike? How was the quality?', alignLabelWithHint: true)),
        Text('Reviews are public and show your first name. Don’t include personal details.', style: Theme.of(context).textTheme.bodySmall),
      ]),
      bottomNavigationBar: BottomCta(child: FilledButton(onPressed: _stars == 0 || _busy ? null : _submit, child: _busy ? const Busy() : Text(_editing ? 'Update Review' : 'Submit Review'))),
    );
  }
}

// ---------------------------------------------------------- 76. Review submitted
class ReviewSuccessScreen extends StatelessWidget {
  const ReviewSuccessScreen({super.key, this.edited = false});
  final bool edited;
  @override
  Widget build(BuildContext context) => StatusScreen(
        icon: Icons.reviews_rounded,
        tone: StatusTone.success,
        title: edited ? 'Review updated' : 'Thanks for your review!',
        message: 'Your feedback helps other customers shop better and helps us improve.',
        primaryLabel: 'Done',
        onPrimary: () => context.pop(),
      );
}

/// Row used in the product details "Delivery & returns" block.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.icon, required this.title, required this.value, this.tone});
  final IconData icon;
  final String title, value;
  final Color? tone;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: VsrSpace.sm),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 20, color: tone ?? context.vsr.brandText)),
          const SizedBox(width: VsrSpace.md),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w600)), const SizedBox(height: VsrSpace.xxs), Text(value, style: Theme.of(context).textTheme.bodySmall)])),
        ]),
      );
}
