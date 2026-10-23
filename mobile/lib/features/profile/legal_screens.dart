import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/legal.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Terms / Privacy / Refunds / Delivery. Content is generated from the web storefront (one source).
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key, required this.slug});
  final String slug;
  @override
  Widget build(BuildContext context) {
    final doc = legalDocs[slug];
    if (doc == null) {
      return Scaffold(appBar: AppBar(), body: const MessageView(icon: Icons.description_outlined, title: 'Page not found'));
    }
    final t = Theme.of(context).textTheme;
    final bodyStyle = t.bodyLarge?.copyWith(height: 1.55, color: context.vsr.ink);
    return Scaffold(
      appBar: AppBar(title: Text(doc.title)),
      body: SelectionArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xxl),
          children: [
            Text('Last updated $legalUpdated', style: t.bodySmall),
            const SizedBox(height: VsrSpace.lg),
            Text(doc.intro, style: bodyStyle?.copyWith(fontSize: 17)),
            for (final s in doc.sections) ...[
              const SizedBox(height: VsrSpace.sectionTop),
              Text(s.heading, style: t.titleMedium?.copyWith(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: VsrSpace.sm),
              for (final p in s.body ?? const <String>[]) Padding(padding: const EdgeInsets.only(bottom: VsrSpace.sm), child: Text(p, style: bodyStyle)),
              for (final b in s.bullets ?? const <String>[])
                Padding(
                  padding: const EdgeInsets.only(bottom: VsrSpace.sm),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 10, right: VsrSpace.md),
                      child: Container(width: 6, height: 6, decoration: BoxDecoration(color: context.vsr.brandText, shape: BoxShape.circle)),
                    ),
                    Expanded(child: Text(b, style: bodyStyle)),
                  ]),
                ),
            ],
            if (legalEntityAddress.isNotEmpty || legalEntityGstin.isNotEmpty) ...[
              const SizedBox(height: VsrSpace.xxl),
              const Divider(),
              const SizedBox(height: VsrSpace.lg),
              Text(
                [legalEntityName, if (legalEntityAddress.isNotEmpty) legalEntityAddress, if (legalEntityGstin.isNotEmpty) 'GSTIN $legalEntityGstin'].join(' · '),
                style: t.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('FAQs')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl),
          children: [
            TileGroup(children: [
              for (final (q, a) in legalFaqs)
                ExpansionTile(
                  shape: const Border(),
                  collapsedShape: const Border(),
                  tilePadding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg),
                  childrenPadding: const EdgeInsets.fromLTRB(VsrSpace.lg, 0, VsrSpace.lg, VsrSpace.lg),
                  expandedAlignment: Alignment.centerLeft,
                  title: Text(q, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  children: [Text(a, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: context.vsr.muted))],
                ),
            ]),
            const SizedBox(height: VsrSpace.lg),
            Center(child: TextButton(onPressed: () => context.push('/help'), child: const Text('Still need help? Contact support'))),
          ],
        ),
      );
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    Widget point(IconData i, String title, String text) => Padding(
          padding: const EdgeInsets.only(bottom: VsrSpace.xl),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: context.vsr.brand50, borderRadius: BorderRadius.circular(VsrRadius.md)),
              child: Icon(i, color: context.vsr.brandText),
            ),
            const SizedBox(width: VsrSpace.lg),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: t.titleMedium),
                const SizedBox(height: VsrSpace.xs),
                Text(text, style: t.bodyMedium?.copyWith(color: context.vsr.muted)),
              ]),
            ),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('About VSR')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xxl),
        children: [
          Text('Shop. Eat. Live better.', style: t.headlineMedium),
          const SizedBox(height: VsrSpace.md),
          Text(
            'VSR brings groceries, daily essentials and homemade food from local kitchens together in one place, and delivers them to your door, with every order checked by a real team.',
            style: t.bodyLarge?.copyWith(color: context.vsr.muted),
          ),
          const SizedBox(height: VsrSpace.xxl),
          point(Icons.shopping_basket_outlined, 'You order', 'Pick products, apply a coupon, pay online or choose cash on delivery.'),
          point(Icons.fact_check_outlined, 'We confirm', 'Our team checks stock and payment, then confirms and packs your order.'),
          point(Icons.local_shipping_outlined, 'We deliver', 'Track every step live. A delivery partner brings it to your door.'),
          point(Icons.key_rounded, 'You verify', 'Share your 6-digit delivery code at the door. Only then is it marked delivered.'),
          const SizedBox(height: VsrSpace.sm),
          TileGroup(children: [
            NavTile(icon: Icons.call_outlined, label: 'Call us', detail: AppConfig.supportPhone, chevron: false, onTap: () => safeLaunch('tel:${AppConfig.supportPhone}', context: context)),
            NavTile(icon: Icons.mail_outline, label: 'Email us', detail: AppConfig.supportEmail, chevron: false, onTap: () => safeLaunch('mailto:${AppConfig.supportEmail}', context: context)),
          ]),
          const SizedBox(height: VsrSpace.lg),
          Center(child: Text('Version 1.0.0', style: t.bodySmall)),
        ],
      ),
    );
  }
}

/// "…Terms & Conditions and Privacy Policy" with both names tappable (opens the in-app page).
class LegalLinksText extends StatefulWidget {
  const LegalLinksText({super.key, this.prefix = 'By continuing, you agree to VSR’s ', this.style, this.textAlign = TextAlign.center});
  final String prefix;
  final TextStyle? style;
  final TextAlign textAlign;
  @override
  State<LegalLinksText> createState() => _LegalLinksTextState();
}

class _LegalLinksTextState extends State<LegalLinksText> {
  late final _terms = TapGestureRecognizer()..onTap = () => context.push('/legal/terms');
  late final _privacy = TapGestureRecognizer()..onTap = () => context.push('/legal/privacy');
  @override
  void dispose() {
    _terms.dispose();
    _privacy.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.style ?? Theme.of(context).textTheme.bodySmall;
    final link = base?.copyWith(color: context.vsr.brandText, fontWeight: FontWeight.w700, decoration: TextDecoration.underline, decorationColor: context.vsr.brandText);
    return Text.rich(
      TextSpan(style: base, children: [
        TextSpan(text: widget.prefix),
        TextSpan(text: 'Terms & Conditions', style: link, recognizer: _terms, semanticsLabel: 'Terms and Conditions, link'),
        const TextSpan(text: ' and '),
        TextSpan(text: 'Privacy Policy', style: link, recognizer: _privacy, semanticsLabel: 'Privacy Policy, link'),
        const TextSpan(text: '.'),
      ]),
      textAlign: widget.textAlign,
    );
  }
}
