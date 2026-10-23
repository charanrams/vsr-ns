import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../state/splash.dart';

/// Brand display face used for onboarding and auth headlines.
TextStyle displayFont(double size, {Color color = VsrColors.brand900, double height = 1.08}) =>
    GoogleFonts.dmSerifDisplay(fontSize: size, color: color, height: height, letterSpacing: -0.3);

/// Two-tone headline: dark first line(s), orange highlight.
class TwoToneTitle extends StatelessWidget {
  const TwoToneTitle(this.first, this.highlight, {super.key, this.size = 34, this.align = TextAlign.start, this.inline = false});
  final String first, highlight;
  final double size;
  final TextAlign align;
  final bool inline;
  @override
  Widget build(BuildContext context) => Semantics(
        header: true,
        label: '$first $highlight',
        child: ExcludeSemantics(
          child: Text.rich(
            TextSpan(children: [
              TextSpan(text: inline ? '$first ' : '$first\n', style: displayFont(size)),
              TextSpan(text: highlight, style: displayFont(size, color: VsrColors.accent)),
            ]),
            textAlign: align,
          ),
        ),
      );
}

// ------------------------------------------------------------------ Splash ----
/// Launch animation (assets/images/splash.webp — animated WebP, 540×960, 6 s, 20 fps).
/// Played as a normal image rather than through a video player: video textures can freeze the UI
/// (ANR) together with the Impeller renderer on some Android devices. Shows the first frame
/// instantly, plays once, then holds the final logo frame while the app finishes loading.
/// Tap to skip. Reduced-motion users get the final frame without animation.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  static const _bg = Color(0xFFF1E3C9); // matches the animation background and native launch screen
  static const _duration = Duration(seconds: 6); // 120 frames @ 20 fps
  static const _anim = AssetImage('assets/images/splash.webp');
  Timer? _timer;
  bool _playing = false;

  void _finish() => ref.read(splashDoneProvider.notifier).finish();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    if (!mounted || ref.read(splashDoneProvider)) return;
    if (MediaQuery.of(context).disableAnimations) {
      _timer = Timer(const Duration(milliseconds: 1200), _finish);
      return;
    }
    try {
      // Decode the first frames before swapping in, so there's no blank flash.
      await precacheImage(_anim, context).timeout(const Duration(seconds: 3));
    } catch (_) {
      // If decoding is slow or fails, still move on after the same total time.
    }
    if (!mounted) return;
    setState(() => _playing = true);
    _timer = Timer(_duration, _finish);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final done = ref.watch(splashDoneProvider);
    final reduce = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      backgroundColor: _bg,
      body: Semantics(
        label: 'VSR. Shop, Eat, Live Better. Loading',
        button: !done,
        hint: done ? null : 'Double tap to skip',
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: done ? null : _finish,
          child: Stack(fit: StackFit.expand, children: [
            Image.asset(done || reduce ? 'assets/images/splash_last.jpg' : 'assets/images/splash_first.jpg', fit: BoxFit.cover, gaplessPlayback: true),
            if (_playing && !done) const Image(image: _anim, fit: BoxFit.cover, gaplessPlayback: true),
          ]),
        ),
      ),
    );
  }
}

// -------------------------------------------------------------- Onboarding ----
class _Slide {
  const _Slide({required this.image, required this.first, required this.highlight, required this.body, required this.semantic, this.contain = false});
  final String image, first, highlight, body, semantic;
  /// true = show the whole artwork on cream (category tiles); false = full-bleed photo.
  final bool contain;
}

const _slides = [
  _Slide(
    image: 'assets/images/onboarding_1.jpg',
    first: 'Fresh Products for a',
    highlight: 'Better Living',
    body: 'Get fresh groceries, daily essentials and more delivered to your doorstep.',
    semantic: 'VSR bag full of fresh vegetables',
  ),
  _Slide(
    image: 'assets/images/onboarding_2.jpg',
    first: 'Explore',
    highlight: 'Wide Categories',
    body: 'Electronics, fashion, home & living, beauty, kids, groceries, homemade food and more — all in one app.',
    semantic: 'Categories: groceries, electronics, fashion, home and living, beauty, homemade food, kids',
    contain: true,
  ),
  _Slide(
    image: 'assets/images/onboarding_3.jpg',
    first: 'Everything You Love,',
    highlight: 'All in One Place',
    body: 'Shop smart, enjoy homemade food, and get fast & safe delivery to your doorstep.',
    semantic: 'Customer shopping on the VSR app',
  ),
];

/// Three slides that auto-advance every 4 s (paused while touched). Skip or Start Shopping → Login.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  static const _interval = Duration(seconds: 4);
  final _pc = PageController();
  Timer? _timer;
  int _i = 0;

  bool get _last => _i == _slides.length - 1;

  @override
  void initState() {
    super.initState();
    _startAuto();
  }

  void _startAuto() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) {
      if (!mounted || MediaQuery.of(context).disableAnimations || _last) return;
      _pc.animateToPage(_i + 1, duration: const Duration(milliseconds: 500), curve: Curves.easeOutCubic);
    });
  }

  void _done() {
    _timer?.cancel();
    ref.read(sessionProvider.notifier).finishOnboarding();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VsrColors.cream,
      body: Stack(children: [
        // Slides fill the screen above the fixed bottom bar; nothing overlaps them except Skip.
        Column(children: [
          Expanded(
            child: Listener(
              onPointerDown: (_) => _timer?.cancel(),
              onPointerUp: (_) => _startAuto(),
              child: PageView.builder(
                controller: _pc,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _i = i),
                itemBuilder: (_, i) => _SlideView(slide: _slides[i]),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _Dots(index: _i, count: _slides.length, onTap: (i) => _pc.animateToPage(i, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic)),
                const SizedBox(height: 20),
                // Same height on every slide so the layout never jumps; button appears on the last slide.
                SizedBox(
                  height: 54,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    child: _last
                        ? FilledButton(
                            key: const ValueKey('start'),
                            onPressed: _done,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54), shape: const StadiumBorder(), backgroundColor: VsrColors.brand900),
                            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Flexible(child: Text('Start Shopping', overflow: TextOverflow.ellipsis)), SizedBox(width: 8), Icon(Icons.chevron_right)]),
                          )
                        : const SizedBox.shrink(key: ValueKey('none')),
                  ),
                ),
              ]),
            ),
          ),
        ]),
        if (!_last)
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 12, top: 6),
                child: TextButton(
                  onPressed: _done,
                  style: TextButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.85), foregroundColor: VsrColors.ink, shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 18)),
                  child: const Text('Skip'),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});
  final _Slide slide;
  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final artHeight = (h * 0.56).clamp(300.0, 520.0);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        height: artHeight,
        width: double.infinity,
        child: ClipPath(
          clipper: _WaveClipper(),
          child: ColoredBox(
            color: const Color(0xFFF3ECDF),
            child: slide.contain
                ? SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.fromLTRB(20, 48, 20, 36), child: Image.asset(slide.image, fit: BoxFit.contain, semanticLabel: slide.semantic)))
                : Image.asset(slide.image, fit: BoxFit.cover, alignment: Alignment.center, semanticLabel: slide.semantic),
          ),
        ),
      ),
      Expanded(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(28, 20, 28, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TwoToneTitle(slide.first, slide.highlight, size: 32),
            const SizedBox(height: 12),
            Text(slide.body, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: const Color(0xFF4A524E), height: 1.45)),
          ]),
        ),
      ),
    ]);
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.index, required this.count, required this.onTap});
  final int index, count;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Slide ${index + 1} of $count',
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < count; i++)
            GestureDetector(
              onTap: () => onTap(i),
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOutCubic,
                  width: i == index ? 26 : 8,
                  height: 8,
                  decoration: BoxDecoration(color: i == index ? VsrColors.brand900 : const Color(0xFFD5D1C8), borderRadius: BorderRadius.circular(4)),
                ),
              ),
            ),
        ]),
      );
}

/// Soft wave along the bottom edge of slide artwork.
class _WaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..lineTo(0, s.height - 34)
    ..quadraticBezierTo(s.width * 0.25, s.height, s.width * 0.55, s.height - 22)
    ..quadraticBezierTo(s.width * 0.8, s.height - 44, s.width, s.height - 16)
    ..lineTo(s.width, 0)
    ..close();
  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
