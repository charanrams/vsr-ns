import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/models.dart' show Json;
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../profile/legal_screens.dart';
import '../onboarding/onboarding_screens.dart' show TwoToneTitle, displayFont;

// ===================================================================== Frame ==
/// Cream canvas with leaves (top-right), optional back button, logo and the green/orange wave at the bottom.
class AuthFrame extends StatelessWidget {
  const AuthFrame({
    super.key,
    required this.children,
    this.back = true,
    this.bottomArt,
    this.logoSize = 76,
  });
  final List<Widget> children;
  final bool back;
  final Widget? bottomArt;
  final double logoSize;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: VsrColors.cream,
    body: Stack(
      children: [
        const Positioned(
          top: 0,
          right: 0,
          child: ExcludeSemantics(child: _Leaves()),
        ),
        if (bottomArt != null)
          Positioned(left: 0, right: 0, bottom: 0, child: bottomArt!)
        else
          const Positioned(left: 0, right: 0, bottom: 0, child: _Wave()),
        SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 140),
            children: [
              SizedBox(
                height: 48,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: back && context.canPop()
                      ? IconButton(
                          tooltip: 'Back',
                          onPressed: () => context.canPop() ? context.pop() : context.go('/'),
                          icon: const Icon(Icons.arrow_back),
                        )
                      : null,
                ),
              ),
              Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'assets/images/logo_mark.png',
                    width: logoSize,
                    height: logoSize,
                    semanticLabel: 'VSR',
                  ),
                ),
              ),
              const SizedBox(height: 20),
              ...children,
            ],
          ),
        ),
      ],
    ),
  );
}

class _Leaves extends StatelessWidget {
  const _Leaves();
  @override
  Widget build(BuildContext context) =>
      SafeArea(child: Image.asset('assets/images/leaves.png', width: 96));
}

class _Wave extends StatelessWidget {
  const _Wave();
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(
      size: const Size(double.infinity, 90),
      painter: _WavePainter(),
    ),
  );
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final green = Path()
      ..moveTo(0, s.height * 0.35)
      ..quadraticBezierTo(
        s.width * 0.3,
        s.height * 0.95,
        s.width * 0.62,
        s.height * 0.75,
      )
      ..quadraticBezierTo(
        s.width * 0.85,
        s.height * 0.6,
        s.width,
        s.height * 0.7,
      )
      ..lineTo(s.width, s.height)
      ..lineTo(0, s.height)
      ..close();
    final orange = Path()
      ..moveTo(0, s.height * 0.28)
      ..quadraticBezierTo(
        s.width * 0.32,
        s.height * 0.85,
        s.width * 0.64,
        s.height * 0.66,
      )
      ..quadraticBezierTo(
        s.width * 0.86,
        s.height * 0.52,
        s.width,
        s.height * 0.6,
      )
      ..lineTo(s.width, s.height * 0.72)
      ..quadraticBezierTo(
        s.width * 0.85,
        s.height * 0.62,
        s.width * 0.62,
        s.height * 0.8,
      )
      ..quadraticBezierTo(s.width * 0.3, s.height, 0, s.height * 0.42)
      ..close();
    c.drawPath(
      orange,
      Paint()..color = VsrColors.accent.withValues(alpha: 0.85),
    );
    c.drawPath(green, Paint()..color = VsrColors.brand800);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _Subtitle extends StatelessWidget {
  const _Subtitle(this.text, {this.strong});
  final String text;
  final String? strong;
  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(
      children: [
        TextSpan(text: text),
        if (strong != null)
          TextSpan(
            text: strong,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: VsrColors.ink,
            ),
          ),
      ],
    ),
    style: Theme.of(context).textTheme.bodyLarge
        ?.copyWith(color: const Color(0xFF4A524E), height: 1.4),
  );
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);
  final String message;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: VsrColors.dangerBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: const TextStyle(color: VsrColors.danger, fontSize: 13),
      ),
    ),
  );
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.onPressed,
    this.busy = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: busy ? null : onPressed,
    style: FilledButton.styleFrom(
      shape: const StadiumBorder(),
      backgroundColor: VsrColors.brand900,
      disabledBackgroundColor: VsrColors.brand800.withValues(alpha: 0.55),
      disabledForegroundColor: Colors.white,
    ),
    child: busy
        ? const Busy()
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward, size: 18),
            ],
          ),
  );
}

String _maskTarget(String id) {
  if (isEmail(id)) return id.trim();
  final d = id.replaceAll(RegExp(r'\D'), '');
  final ten = d.length >= 10 ? d.substring(d.length - 10) : d;
  return ten.length == 10
      ? '+91 ${ten.substring(0, 5)} ${ten.substring(5)}'
      : id;
}

// =========================================================== 1. Entry screen ==
class LoginEntryScreen extends ConsumerStatefulWidget {
  const LoginEntryScreen({super.key});
  @override
  ConsumerState<LoginEntryScreen> createState() => _LoginEntryScreenState();
}

class _LoginEntryScreenState extends ConsumerState<LoginEntryScreen> {
  final _id = TextEditingController();
  bool _busy = false;
  String? _error;

  bool get _valid => isEmail(_id.text) || isPhone(_id.text);
  bool get _isPhone => isPhone(_id.text) && !isEmail(_id.text);

  @override
  void dispose() {
    _id.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (!_valid) {
      return setState(
        () => _error = 'Enter a valid email or 10-digit mobile number',
      );
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    // Phones go out as their last 10 digits, so autofilled prefixes (+91, +1 91…) don't matter
    final id = _isPhone ? phoneDigits(_id.text) : _id.text.trim();
    try {
      // Registered → password (email) or OTP (phone). New → sign-up with the email/phone filled in.
      final r = await ref.read(apiProvider).post('/auth/check', {
        'identifier': id,
      }) as Json;
      if (!mounted) return;
      final exists = r['exists'] == true;
      if (!_isPhone) {
        context.push(
          exists ? '/login/password' : '/signup',
          extra: exists ? id : (id.toLowerCase(), null),
        );
      } else if (exists) {
        final dev = await ref
            .read(sessionProvider.notifier)
            .sendOtp(id, 'login');
        if (mounted) {
          context.push(
            '/login/otp',
            extra: OtpFlowArgs(identifier: id, purpose: 'login', devOtp: dev),
          );
        }
      } else {
        context.push('/signup', extra: (null, id));
      }
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final guest = ref.watch(sessionProvider).status == SessionStatus.guest;
    final t = Theme.of(context).textTheme;
    final heroH = (MediaQuery.of(context).size.height * 0.34).clamp(
      220.0,
      330.0,
    );
    return Scaffold(
      backgroundColor: VsrColors.cream,
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Hero: illustration with a curved edge, fading into the page, logo badge overlapping it.
            SizedBox(
              height: heroH + 48,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    bottom: 48,
                    child: ClipPath(
                      clipper: _HeroCurve(),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.asset(
                            'assets/images/login_art.jpg',
                            fit: BoxFit.cover,
                            alignment: Alignment.center,
                            excludeFromSemantics: true,
                          ),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Color(0x33000000),
                                  Color(0x00000000),
                                  Color(0x00FBF7EE),
                                ],
                                stops: [0, 0.35, 1],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (guest)
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: IconButton.filledTonal(
                          tooltip: 'Back',
                          onPressed: () => context.pop(),
                          icon: const Icon(Icons.arrow_back),
                        ),
                      ),
                    )
                  else
                    SafeArea(
                      child: Align(
                        alignment: Alignment.topRight,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 8, right: 12),
                          child: TextButton.icon(
                            onPressed: () {
                              ref
                                  .read(sessionProvider.notifier)
                                  .continueAsGuest();
                              context.go('/');
                            },
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.9,
                              ),
                              foregroundColor: VsrColors.brand800,
                              shape: const StadiumBorder(),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              minimumSize: const Size(48, 44),
                            ),
                            icon: const Icon(Icons.person_outline, size: 18),
                            label: const Text(
                              'Guest',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Center(
                      child: Container(
                        width: 96,
                        height: 96,
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: VsrColors.brand900.withValues(alpha: 0.18),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/images/logo_mark.png',
                            fit: BoxFit.cover,
                            semanticLabel: 'VSR',
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(
                    child: TwoToneTitle(
                      'Welcome',
                      'Back!',
                      size: 36,
                      inline: true,
                      align: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to shop, track orders and enjoy homemade food.',
                    textAlign: TextAlign.center,
                    style: t.bodyLarge?.copyWith(
                      color: const Color(0xFF4A524E),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Semantics(
                    label: 'Email or phone number',
                    textField: true,
                    child: TextField(
                      controller: _id,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [
                        AutofillHints.email,
                        AutofillHints.telephoneNumber,
                      ],
                      textInputAction: TextInputAction.go,
                      onChanged: (_) => setState(() => _error = null),
                      onSubmitted: (_) => _continue(),
                      decoration: InputDecoration(
                        prefixIcon: Icon(
                          _isPhone ? Icons.phone_iphone : Icons.mail_outline,
                        ),
                      ),
                    ),
                  ),
                  if (_error != null) _ErrorText(_error!),
                  const SizedBox(height: 20),
                  _PillButton(
                    label: 'Continue',
                    busy: _busy,
                    onPressed: _valid ? _continue : null,
                  ),
                  const SizedBox(height: 24),
                  LegalLinksText(style: t.bodySmall?.copyWith(fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroCurve extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..lineTo(0, s.height - 40)
    ..quadraticBezierTo(s.width / 2, s.height + 30, s.width, s.height - 40)
    ..lineTo(s.width, 0)
    ..close();
  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

// ======================================================= 2. Password (email) ==
class PasswordScreen extends ConsumerStatefulWidget {
  const PasswordScreen({super.key, required this.email});
  final String email;
  @override
  ConsumerState<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends ConsumerState<PasswordScreen> {
  final _pw = TextEditingController();
  bool _hide = true, _keep = true, _busy = false, _sending = false;
  String? _error;

  @override
  void dispose() {
    _pw.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_pw.text.isEmpty) return setState(() => _error = 'Enter your password');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(sessionProvider.notifier)
          .loginWithPassword(
            widget.email,
            _pw.text,
            keepLoggedIn: _keep,
            showWelcome: true,
          );
      // Router shows the success screen once signed in.
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgot() async {
    setState(() => _sending = true);
    try {
      final dev = await ref
          .read(sessionProvider.notifier)
          .sendOtp(widget.email, 'reset');
      if (!mounted) return;
      await showOtpSentDialog(context, widget.email);
      if (mounted) {
        context.push(
          '/login/otp',
          extra: OtpFlowArgs(
            identifier: widget.email,
            purpose: 'reset',
            devOtp: dev,
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthFrame(
    children: [
      Semantics(
        header: true,
        child: Text('Enter Your Password', style: displayFont(32)),
      ),
      const SizedBox(height: 12),
      _Subtitle(
        'Welcome back!\nPlease enter your password for\n',
        strong: widget.email,
      ),
      const SizedBox(height: 24),
      AutofillGroup(
        child: TextField(
          controller: _pw,
          obscureText: _hide,
          autofocus: true,
          autofillHints: const [AutofillHints.password],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _login(),
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.lock_outline),
            hintText: 'Enter your password',
            labelText: 'Password',
            suffixIcon: IconButton(
              tooltip: _hide ? 'Show password' : 'Hide password',
              icon: Icon(
                _hide
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
              onPressed: () => setState(() => _hide = !_hide),
            ),
          ),
        ),
      ),
      const SizedBox(height: 8),
      Row(
        children: [
          Checkbox(
            value: _keep,
            onChanged: (v) => setState(() => _keep = v ?? true),
            activeColor: VsrColors.brand800,
          ),
          const Expanded(
            child: Text('Keep me logged in', overflow: TextOverflow.ellipsis),
          ),
          TextButton(
            onPressed: _sending ? null : _forgot,
            child: Text(
              _sending ? 'Sending…' : 'Forgot Password?',
              style: const TextStyle(color: VsrColors.accentDark),
            ),
          ),
        ],
      ),
      if (_error != null) _ErrorText(_error!),
      const SizedBox(height: 16),
      _PillButton(label: 'Login', busy: _busy, onPressed: _login),
      const SizedBox(height: 16),
      Center(
        child: TextButton.icon(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back, size: 18),
          label: const Text('Use a different account'),
          style: TextButton.styleFrom(foregroundColor: VsrColors.ink),
        ),
      ),
    ],
  );
}

// ================================================ 3. "Reset OTP sent" dialog ==
Future<void> showOtpSentDialog(BuildContext context, String target) =>
    showDialog(
      context: context,
      builder: (c) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(c),
                  icon: const Icon(Icons.close),
                ),
              ),
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(
                  color: VsrColors.accent50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isEmail(target)
                      ? Icons.mark_email_read_rounded
                      : Icons.lock_rounded,
                  size: 48,
                  color: VsrColors.accent,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Password Reset OTP Sent!',
                textAlign: TextAlign.center,
                style: displayFont(24),
              ),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'We have sent a 6-digit OTP to\n'),
                    TextSpan(
                      text: _maskTarget(target),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(c),
                  style: FilledButton.styleFrom(
                    shape: const StadiumBorder(),
                    backgroundColor: VsrColors.brand900,
                  ),
                  child: const Text('OK'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

// ======================================================== 4. OTP (boxes) ==
class OtpFlowArgs {
  const OtpFlowArgs({
    required this.identifier,
    required this.purpose,
    this.devOtp,
  });
  final String identifier;
  final String purpose; // login | reset
  final String? devOtp;
}

/// Six visible boxes backed by one hidden field (supports paste and SMS autofill).
class OtpBoxes extends StatefulWidget {
  const OtpBoxes({
    super.key,
    required this.controller,
    required this.onCompleted,
  });
  final TextEditingController controller;
  final ValueChanged<String> onCompleted;
  @override
  State<OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<OtpBoxes> {
  final _focus = FocusNode();
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  void _changed() {
    setState(() {});
    if (widget.controller.text.length == 6) {
      widget.onCompleted(widget.controller.text);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.controller.text;
    return Semantics(
      label: 'One-time code, ${code.length} of 6 digits entered',
      textField: true,
      child: GestureDetector(
        onTap: () => _focus.requestFocus(),
        child: Stack(
          children: [
            Opacity(
              opacity: 0,
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  counterText: '',
                  border: InputBorder.none,
                ),
              ),
            ),
            ExcludeSemantics(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < 6; i++)
                    Flexible(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        constraints: const BoxConstraints(maxWidth: 52),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        height: 56,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: i == code.length && _focus.hasFocus
                                ? VsrColors.accentDark
                                : VsrColors.line,
                            width: i == code.length && _focus.hasFocus
                                ? 1.8
                                : 1,
                          ),
                        ),
                        child: Text(
                          i < code.length ? code[i] : '',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
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
    );
  }
}

class LoginOtpScreen extends ConsumerStatefulWidget {
  const LoginOtpScreen({super.key, required this.args});
  final OtpFlowArgs args;
  @override
  ConsumerState<LoginOtpScreen> createState() => _LoginOtpScreenState();
}

class _LoginOtpScreenState extends ConsumerState<LoginOtpScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  int _left = 30;
  bool _busy = false;
  String? _error, _dev;

  bool get _reset => widget.args.purpose == 'reset';

  @override
  void initState() {
    super.initState();
    _dev = widget.args.devOtp;
    _start();
  }

  void _start() {
    _timer?.cancel();
    setState(() => _left = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_left <= 1) t.cancel();
      if (mounted) setState(() => _left--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_code.text.length != 6) {
      return setState(() => _error = 'Enter the 6-digit OTP');
    }
    if (_reset) {
      // The server checks the code together with the new password (single-use), on the next step.
      context.push(
        '/login/new-password',
        extra: (widget.args.identifier, _code.text),
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(sessionProvider.notifier)
          .verifyOtp(
            widget.args.identifier,
            _code.text,
            'login',
            showWelcome: true,
          );
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
      _code.clear();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      _dev = await ref
          .read(sessionProvider.notifier)
          .sendOtp(widget.args.identifier, widget.args.purpose);
      _start();
      if (mounted) showMessage(context, 'A new OTP has been sent.');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) => AuthFrame(
    children: [
      Semantics(header: true, child: Text('Enter OTP', style: displayFont(34))),
      const SizedBox(height: 12),
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          _Subtitle(
            'We have sent a 6-digit OTP to\n',
            strong: _maskTarget(widget.args.identifier),
          ),
          TextButton(
            onPressed: () => context.pop(),
            child: const Text(
              'Edit',
              style: TextStyle(color: VsrColors.accentDark),
            ),
          ),
        ],
      ),
      const SizedBox(height: 24),
      OtpBoxes(controller: _code, onCompleted: (_) => _verify()),
      if (_dev != null)
        Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: VsrColors.warningBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            'Development build: your OTP is $_dev',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13),
          ),
        ),
      const SizedBox(height: 16),
      Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Text('Didn’t receive OTP? '),
          _left > 0
              ? Text(
                  'Resend in 00:${_left.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: VsrColors.accentDark,
                    fontWeight: FontWeight.w600,
                  ),
                )
              : TextButton(
                  onPressed: _resend,
                  child: const Text(
                    'Resend OTP',
                    style: TextStyle(color: VsrColors.accentDark),
                  ),
                ),
        ],
      ),
      if (_error != null) _ErrorText(_error!),
      const SizedBox(height: 20),
      _PillButton(
        label: 'Verify OTP',
        busy: _busy,
        onPressed: _code.text.length == 6 ? _verify : null,
      ),
    ],
  );
}

// ===================================================== 5. Create new password ==
class CreatePasswordScreen extends ConsumerStatefulWidget {
  const CreatePasswordScreen({
    super.key,
    required this.identifier,
    required this.code,
  });
  final String identifier, code;
  @override
  ConsumerState<CreatePasswordScreen> createState() =>
      _CreatePasswordScreenState();
}

class _CreatePasswordScreenState extends ConsumerState<CreatePasswordScreen> {
  final _pw = TextEditingController(), _confirm = TextEditingController();
  bool _hide1 = true, _hide2 = true, _busy = false;
  String? _error;

  bool get _len => _pw.text.length >= 8;
  bool get _upper => RegExp(r'[A-Z]').hasMatch(_pw.text);
  bool get _digit => RegExp(r'\d').hasMatch(_pw.text);
  bool get _special => RegExp(r'[^A-Za-z0-9]').hasMatch(_pw.text);
  bool get _match => _pw.text.isNotEmpty && _pw.text == _confirm.text;
  bool get _valid => _len && _upper && _digit && _special && _match;

  @override
  void dispose() {
    _pw.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(sessionProvider.notifier)
          .resetPassword(widget.identifier, widget.code, _pw.text);
      if (mounted) context.go('/login/password-updated');
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = '${errorText(e)} Go back to request a new OTP.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _rule(bool ok, String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Icon(
          ok ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 20,
          color: ok ? VsrColors.success : VsrColors.muted,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: ok ? VsrColors.ink : VsrColors.muted,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _field(
    TextEditingController c,
    String hint,
    bool hide,
    VoidCallback toggle, {
    String? error,
  }) => TextField(
    controller: c,
    obscureText: hide,
    autofillHints: const [AutofillHints.newPassword],
    onChanged: (_) => setState(() {}),
    decoration: InputDecoration(
      prefixIcon: const Icon(Icons.lock_outline),
      hintText: hint,
      labelText: hint,
      errorText: error,
      suffixIcon: IconButton(
        tooltip: hide ? 'Show password' : 'Hide password',
        icon: Icon(
          hide ? Icons.visibility_off_outlined : Icons.visibility_outlined,
        ),
        onPressed: toggle,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => AuthFrame(
    children: [
      Semantics(
        header: true,
        child: Text('Create New Password', style: displayFont(32)),
      ),
      const SizedBox(height: 12),
      const _Subtitle(
        'Your new password must be different from previous passwords.',
      ),
      const SizedBox(height: 24),
      _field(
        _pw,
        'Enter new password',
        _hide1,
        () => setState(() => _hide1 = !_hide1),
      ),
      const SizedBox(height: 16),
      _field(
        _confirm,
        'Confirm new password',
        _hide2,
        () => setState(() => _hide2 = !_hide2),
        error: _confirm.text.isNotEmpty && !_match
            ? 'Passwords don’t match'
            : null,
      ),
      const SizedBox(height: 16),
      _rule(_len, 'At least 8 characters'),
      _rule(_upper, 'One uppercase letter'),
      _rule(_digit, 'One number'),
      _rule(_special, 'One special character (e.g. @, #, \$)'),
      if (_error != null) _ErrorText(_error!),
      const SizedBox(height: 20),
      _PillButton(
        label: 'Update Password',
        busy: _busy,
        onPressed: _valid ? _submit : null,
      ),
    ],
  );
}

/// Password updated → back to login.
class PasswordUpdatedScreen extends StatelessWidget {
  const PasswordUpdatedScreen({super.key});
  @override
  Widget build(BuildContext context) => _SuccessFrame(
    icon: Icons.lock_open_rounded,
    title: 'Password Updated!',
    message: 'Your password has been changed and other devices were signed out. Log in with your new password.',
    cta: 'Back to Login',
    onTap: () => context.go('/login'),
  );
}

// ============================================================ 6. Login success ==
class LoginSuccessScreen extends ConsumerWidget {
  const LoginSuccessScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.read(sessionProvider.notifier);
    final email = s.welcome == 'email';
    return _SuccessFrame(
      icon: email ? Icons.shopping_bag_rounded : Icons.check_rounded,
      bag: email,
      title: email ? 'Welcome Back!' : 'Logged In Successfully!',
      message: email
          ? 'You have successfully logged in.'
          : 'Welcome back to VSR.',
      cta: 'Go to Home',
      onTap: () {
        s.clearWelcome();
        context.go('/');
      },
    );
  }
}

class _SuccessFrame extends StatelessWidget {
  const _SuccessFrame({
    required this.icon,
    required this.title,
    required this.message,
    required this.cta,
    required this.onTap,
    this.bag = false,
  });
  final IconData icon;
  final String title, message, cta;
  final VoidCallback onTap;
  final bool bag;
  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return PopScope(
      canPop: false,
      child: AuthFrame(
        back: false,
        children: [
          const SizedBox(height: 24),
          Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: reduce ? 1 : 0.6, end: 1),
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutBack,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 150,
                    height: 150,
                    decoration: BoxDecoration(
                      color: (bag ? VsrColors.accent : VsrColors.brand700)
                          .withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: bag ? VsrColors.accent : VsrColors.brand800,
                      shape: bag ? BoxShape.rectangle : BoxShape.circle,
                      borderRadius: bag ? BorderRadius.circular(22) : null,
                    ),
                    child: Icon(icon, color: Colors.white, size: 54),
                  ),
                  if (bag)
                    const Positioned(
                      right: 30,
                      bottom: 34,
                      child: CircleAvatar(
                        radius: 16,
                        backgroundColor: Colors.white,
                        child: Icon(
                          Icons.check,
                          color: VsrColors.accent,
                          size: 20,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          Semantics(
            header: true,
            liveRegion: true,
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: displayFont(30),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge
                ?.copyWith(color: const Color(0xFF4A524E)),
          ),
          const SizedBox(height: 28),
          _PillButton(label: cta, onPressed: onTap),
        ],
      ),
    );
  }
}
