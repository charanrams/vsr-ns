import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../profile/legal_screens.dart';
import 'login_flow.dart' show OtpFlowArgs, showOtpSentDialog;

class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.title, required this.subtitle, required this.children, this.showBack = false, this.icon});
  final String title, subtitle;
  final List<Widget> children;
  final bool showBack;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: showBack ? AppBar() : null,
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 24, 24, 32), children: [
          if (icon == null)
            Center(child: ClipRRect(borderRadius: BorderRadius.circular(20), child: Image.asset('assets/images/logo_mark.png', width: 88, height: 88)))
          else
            Center(child: Icon(icon, size: 56, color: VsrColors.brand700)),
          const SizedBox(height: 20),
          Text(title, textAlign: TextAlign.center, style: t.headlineSmall),
          const SizedBox(height: 8),
          Text(subtitle, textAlign: TextAlign.center, style: t.bodySmall),
          const SizedBox(height: 28),
          ...children,
        ]),
      ),
    );
  }
}

String? _validIdentifier(String? v) {
  final s = (v ?? '').trim();
  if (s.isEmpty) return 'Enter your email or phone number';
  if (!isEmail(s) && !isPhone(s)) return 'Enter a valid email or 10-digit mobile number';
  return null;
}

String? _validPassword(String? v) {
  final s = v ?? '';
  if (s.length < 8) return 'Use at least 8 characters';
  if (!RegExp(r'[A-Za-z]').hasMatch(s) || !RegExp(r'\d').hasMatch(s)) return 'Include a letter and a number';
  return null;
}

// --------------------------------------------------------------- Sign up ----
class SignUpScreen extends ConsumerStatefulWidget {
  /// Pre-filled from the login step when the email/phone isn't registered yet.
  const SignUpScreen({super.key, this.initialEmail, this.initialPhone});
  final String? initialEmail, initialPhone;
  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(), _pw = TextEditingController();
  late final _email = TextEditingController(text: widget.initialEmail);
  late final _phone = TextEditingController(text: _tenDigits(widget.initialPhone));
  static String? _tenDigits(String? p) {
    if (p == null) return null;
    final d = p.replaceAll(RegExp(r'\D'), '');
    return d.length >= 10 ? d.substring(d.length - 10) : d;
  }
  bool _agree = false, _busy = false, _hide = true;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _pw]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;
    if (!_agree) return setState(() => _error = 'Please accept the Terms & Conditions and Privacy Policy.');
    setState(() => _busy = true);
    try {
      final dev = await ref.read(sessionProvider.notifier).signUp(name: _name.text, email: _email.text, phone: _phone.text, password: _pw.text);
      if (mounted) context.push('/otp', extra: OtpArgs(identifier: _email.text.trim().toLowerCase(), purpose: 'verify', devOtp: dev));
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AuthScaffold(
      title: 'Create Account',
      subtitle: widget.initialEmail != null || widget.initialPhone != null
          ? 'No VSR account found for ${widget.initialEmail ?? '+91 ${_tenDigits(widget.initialPhone)}'}. Create one in a minute.'
          : 'Join VSR today',
      showBack: true,
      children: [
        Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextFormField(controller: _name, autofocus: true, textCapitalization: TextCapitalization.words, autofillHints: const [AutofillHints.name], decoration: const InputDecoration(labelText: 'Full Name'), validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null),
            const SizedBox(height: 16),
            TextFormField(controller: _phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: const InputDecoration(labelText: 'Phone Number', prefixText: '+91 '), inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)], validator: (v) => isPhone(v ?? '') ? null : 'Enter a valid 10-digit mobile number'),
            const SizedBox(height: 16),
            TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: const InputDecoration(labelText: 'Email Address'), validator: (v) => isEmail(v ?? '') ? null : 'Enter a valid email'),
            const SizedBox(height: 16),
            TextFormField(
              controller: _pw,
              obscureText: _hide,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(labelText: 'Password', helperText: 'At least 8 characters with a letter and a number', suffixIcon: IconButton(tooltip: _hide ? 'Show password' : 'Hide password', icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _hide = !_hide))),
              validator: _validPassword,
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _agree,
              onChanged: (v) => setState(() => _agree = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const LegalLinksText(prefix: 'I agree to the ', textAlign: TextAlign.start),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: VsrColors.danger))),
            FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const Busy() : const Text('Sign Up')),
          ]),
        ),
        const SizedBox(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Text('Already have an account?'),
          TextButton(onPressed: () => context.pop(), child: const Text('Login')),
        ]),
      ],
    );
  }
}

// ------------------------------------------------------------------- OTP ----
class OtpArgs {
  const OtpArgs({required this.identifier, required this.purpose, this.devOtp});
  final String identifier, purpose; // purpose: login | verify | reset
  final String? devOtp;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _pw = TextEditingController();
  Timer? _timer;
  int _left = 30;
  bool _busy = false;
  String? _error;
  String? _dev;

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
    _pw.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_code.text.length != 6) return setState(() => _error = 'Enter the 6-digit code');
    final s = ref.read(sessionProvider.notifier);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (widget.args.purpose == 'reset') {
        final err = _validPassword(_pw.text);
        if (err != null) throw Exception(err);
        await s.resetPassword(widget.args.identifier, _code.text, _pw.text);
        if (mounted) {
          showMessage(context, 'Password updated. Please sign in.');
          context.go('/login');
        }
      } else {
        await s.verifyOtp(widget.args.identifier, _code.text, widget.args.purpose);
        // Router redirect moves a signed-in user to Home.
      }
    } catch (e) {
      setState(() => _error = e is Exception && e.toString().startsWith('Exception: ') ? e.toString().substring(11) : errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      _dev = await ref.read(sessionProvider.notifier).sendOtp(widget.args.identifier, widget.args.purpose);
      _start();
      if (mounted) showMessage(context, 'A new code has been sent.');
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reset = widget.args.purpose == 'reset';
    final phone = isPhone(widget.args.identifier) && !isEmail(widget.args.identifier);
    return _AuthScaffold(
      showBack: true,
      icon: Icons.verified_user_outlined,
      title: reset ? 'Reset Password' : phone ? 'Verify Phone Number' : 'Verify Your Email',
      subtitle: 'Enter the 6-digit code sent to ${widget.args.identifier}',
      children: [
        TextField(
          controller: _code,
          autofocus: true,
          keyboardType: TextInputType.number,
          autofillHints: const [AutofillHints.oneTimeCode],
          textAlign: TextAlign.center,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(fontSize: 26, letterSpacing: 14, fontWeight: FontWeight.w700),
          decoration: const InputDecoration(counterText: '', hintText: '••••••'),
          onChanged: (v) {
            if (v.length == 6 && !reset) _verify();
          },
        ),
        if (reset) ...[
          const SizedBox(height: 16),
          TextField(controller: _pw, obscureText: true, decoration: const InputDecoration(labelText: 'New password', helperText: 'At least 8 characters with a letter and a number')),
        ],

        if (_dev != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: VsrColors.warningBg, borderRadius: BorderRadius.circular(10)),
            child: Text('Development build: your code is $_dev', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13)),
          ),
        const SizedBox(height: 12),
        Center(
          child: _left > 0
              ? Text('Resend code in 00:${_left.toString().padLeft(2, '0')}', style: Theme.of(context).textTheme.bodySmall)
              : TextButton(onPressed: _resend, child: const Text('Resend code')),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: VsrColors.danger))),
        const SizedBox(height: 20),
        FilledButton(onPressed: _busy ? null : _verify, child: _busy ? const Busy() : Text(reset ? 'Update Password' : 'Verify')),
        TextButton(onPressed: () => context.pop(), child: Text(phone ? 'Change phone number' : 'Change email')),
      ],
    );
  }
}

// -------------------------------------------------------- Forgot password ----
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _id.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final dev = await ref.read(sessionProvider.notifier).sendOtp(_id.text, 'reset');
      if (!mounted) return;
      await showOtpSentDialog(context, _id.text.trim());
      if (mounted) context.push('/login/otp', extra: OtpFlowArgs(identifier: _id.text.trim(), purpose: 'reset', devOtp: dev));
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        showBack: true,
        icon: Icons.lock_reset_rounded,
        title: 'Forgot Password',
        subtitle: 'We’ll send a one-time code to your registered email or phone. No reset links.',
        children: [
          Form(key: _form, child: TextFormField(controller: _id, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email or Phone'), validator: _validIdentifier)),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _send, child: _busy ? const Busy() : const Text('Send Code')),
        ],
      );
}
