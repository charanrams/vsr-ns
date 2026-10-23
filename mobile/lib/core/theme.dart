import 'package:flutter/material.dart';

/// VSR design tokens (PRD §5.1) — mirrors the admin web tokens.
/// Fixed brand colours. For surfaces/text that must adapt to dark mode use `context.vsr`.
class VsrColors {
  static const brand900 = Color(0xFF0B3D2E);
  static const brand800 = Color(0xFF064E3B);
  static const brand700 = Color(0xFF0A5C43);
  static const brand600 = Color(0xFF12704F);
  static const brand100 = Color(0xFFDCEFE3);
  static const brand50 = Color(0xFFEEF7F1);
  static const accent = Color(0xFFF58220);
  static const accentDark = Color(0xFFD96D10);
  static const accent50 = Color(0xFFFFF4E8);
  static const cream = Color(0xFFFBF7EE);
  static const surface = Colors.white;
  static const ink = Color(0xFF202923);
  static const muted = Color(0xFF5E6964);
  static const line = Color(0xFFEBE5DA);
  static const lineSoft = Color(0xFFF3EFE7);
  static const success = Color(0xFF25834A);
  static const successBg = Color(0xFFE5F4EA);
  static const warning = Color(0xFFB86E00);
  static const warningBg = Color(0xFFFDF1DC);
  static const danger = Color(0xFFC9362B);
  static const dangerBg = Color(0xFFFDE8E6);
  static const info = Color(0xFF2563EB);
  static const infoBg = Color(0xFFE6EEFD);
}

/// Adaptive palette (light/dark). Read with `context.vsr.<token>`.
@immutable
class VsrPalette extends ThemeExtension<VsrPalette> {
  const VsrPalette({
    required this.bg,
    required this.surface,
    required this.line,
    required this.lineSoft,
    required this.ink,
    required this.muted,
    required this.brandText,
    required this.brand50,
    required this.brand100,
    required this.accent50,
    required this.success,
    required this.successBg,
    required this.warning,
    required this.warningBg,
    required this.danger,
    required this.dangerBg,
    required this.info,
    required this.infoBg,
  });

  /// Page background, card/sheet surface, borders.
  final Color bg, surface, line, lineSoft;
  /// Primary and secondary text.
  final Color ink, muted;
  /// Brand green used for text/icons on surfaces (lighter in dark mode for contrast).
  final Color brandText;
  /// Tinted fills.
  final Color brand50, brand100, accent50;
  /// Status foreground/background pairs.
  final Color success, successBg, warning, warningBg, danger, dangerBg, info, infoBg;

  static const light = VsrPalette(
    bg: VsrColors.cream,
    surface: Colors.white,
    line: VsrColors.line,
    lineSoft: VsrColors.lineSoft,
    ink: VsrColors.ink,
    muted: VsrColors.muted,
    brandText: VsrColors.brand700,
    brand50: VsrColors.brand50,
    brand100: VsrColors.brand100,
    accent50: VsrColors.accent50,
    success: VsrColors.success,
    successBg: VsrColors.successBg,
    warning: VsrColors.warning,
    warningBg: VsrColors.warningBg,
    danger: VsrColors.danger,
    dangerBg: VsrColors.dangerBg,
    info: VsrColors.info,
    infoBg: VsrColors.infoBg,
  );

  // Dark values keep ≥4.5:1 text contrast on `surface`/`bg`.
  static const dark = VsrPalette(
    bg: Color(0xFF0B0B0C),
    surface: Color(0xFF161618),
    line: Color(0xFF2A2A2E),
    lineSoft: Color(0xFF1E1E21),
    ink: Color(0xFFE8EDEA),
    muted: Color(0xFFA6B2AC),
    brandText: Color(0xFF7FD6A3),
    brand50: Color(0xFF16302A),
    brand100: Color(0xFF1F4236),
    accent50: Color(0xFF3A2A18),
    success: Color(0xFF6FD39A),
    successBg: Color(0xFF16352A),
    warning: Color(0xFFF2B455),
    warningBg: Color(0xFF3A2C12),
    danger: Color(0xFFFF8A80),
    dangerBg: Color(0xFF3F1D1A),
    info: Color(0xFF8AB4FF),
    infoBg: Color(0xFF172A47),
  );

  @override
  VsrPalette copyWith() => this;

  @override
  VsrPalette lerp(ThemeExtension<VsrPalette>? other, double t) {
    if (other is! VsrPalette) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return VsrPalette(
      bg: l(bg, other.bg),
      surface: l(surface, other.surface),
      line: l(line, other.line),
      lineSoft: l(lineSoft, other.lineSoft),
      ink: l(ink, other.ink),
      muted: l(muted, other.muted),
      brandText: l(brandText, other.brandText),
      brand50: l(brand50, other.brand50),
      brand100: l(brand100, other.brand100),
      accent50: l(accent50, other.accent50),
      success: l(success, other.success),
      successBg: l(successBg, other.successBg),
      warning: l(warning, other.warning),
      warningBg: l(warningBg, other.warningBg),
      danger: l(danger, other.danger),
      dangerBg: l(dangerBg, other.dangerBg),
      info: l(info, other.info),
      infoBg: l(infoBg, other.infoBg),
    );
  }
}

extension VsrThemeX on BuildContext {
  VsrPalette get vsr => Theme.of(this).extension<VsrPalette>() ?? VsrPalette.light;
}

/// 4-pt spacing scale plus the layout roles every screen uses.
class VsrSpace {
  static const xxs = 2.0, xs = 4.0, sm = 8.0, md = 12.0, lg = 16.0, xl = 24.0, xxl = 32.0, xxxl = 48.0;

  /// Left/right page gutter.
  static const gutter = 16.0;
  /// Space above a section heading (generous) and below it (tight).
  static const sectionTop = 28.0, sectionBottom = 12.0;
  /// Gap between sibling cards/groups and between rows inside a group.
  static const group = 12.0, row = 8.0;
  /// Bottom padding that clears the floating nav bar on tab screens.
  static const navClearance = 120.0;
}

/// Corner radii: controls, cards, sheets.
class VsrRadius {
  static const sm = 10.0, md = 14.0, lg = 18.0, pill = 999.0;
}

/// VSR theme for the given brightness. The app follows the system setting, except splash,
/// onboarding and the login/sign-up flow, which are always rendered with the light theme.
ThemeData buildTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final p = dark ? VsrPalette.dark : VsrPalette.light;
  final scheme = ColorScheme.fromSeed(
    seedColor: VsrColors.brand800,
    brightness: brightness,
    primary: dark ? p.brandText : VsrColors.brand900,
    onPrimary: dark ? VsrColors.brand900 : Colors.white,
    secondary: VsrColors.accent,
    surface: p.surface,
    onSurface: p.ink,
    error: p.danger,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  final radius = BorderRadius.circular(VsrRadius.md);
  return base.copyWith(
    extensions: [p],
    scaffoldBackgroundColor: p.bg,
    canvasColor: p.bg,
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.2),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, height: 1.3),
      titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      bodyLarge: text.bodyLarge?.copyWith(height: 1.45),
      bodyMedium: text.bodyMedium?.copyWith(fontSize: 14, height: 1.45),
      bodySmall: text.bodySmall?.copyWith(fontSize: 13, height: 1.4, color: p.muted),
      labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: p.bg,
      foregroundColor: p.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      // Android convention: start-aligned titles on the page gutter
      centerTitle: false,
      titleSpacing: VsrSpace.gutter,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, fontSize: 20, letterSpacing: -0.2, color: p.ink),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg), side: BorderSide(color: p.line)),
    ),
    dividerTheme: DividerThemeData(color: p.line, space: 1, thickness: 1),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        // Brand-green buttons with white text in both modes
        backgroundColor: dark ? VsrColors.brand600 : VsrColors.brand900,
        foregroundColor: Colors.white,
        disabledBackgroundColor: dark ? const Color(0xFF2A3730) : VsrColors.brand800.withValues(alpha: 0.45),
        disabledForegroundColor: dark ? const Color(0xFF9AA69F) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: p.ink,
        side: BorderSide(color: p.line),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 44), foregroundColor: p.brandText, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
    ),
    iconTheme: IconThemeData(color: p.ink),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.primary, width: 1.6)),
      errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.danger)),
      labelStyle: TextStyle(color: p.muted),
      hintStyle: TextStyle(color: p.muted),
      prefixIconColor: p.muted,
      suffixIconColor: p.muted,
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: p.surface,
      selectedColor: p.brand100,
      labelStyle: TextStyle(color: p.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      side: BorderSide(color: p.line),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.brand100,
      height: 68,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? p.brandText : p.muted)),
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 12, color: s.contains(WidgetState.selected) ? p.ink : p.muted, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500)),
    ),
    tabBarTheme: TabBarThemeData(labelColor: p.brandText, unselectedLabelColor: p.muted, indicatorColor: p.brandText, dividerColor: p.line, labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), labelPadding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg)),
    dialogTheme: DialogThemeData(backgroundColor: p.surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VsrRadius.lg))),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.surface, modalBackgroundColor: p.surface, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24)))),
    popupMenuTheme: PopupMenuThemeData(color: p.surface),
    listTileTheme: ListTileThemeData(
      iconColor: p.brandText,
      textColor: p.ink,
      contentPadding: const EdgeInsets.symmetric(horizontal: VsrSpace.lg),
      horizontalTitleGap: 14,
      minVerticalPadding: 12,
      minLeadingWidth: 24,
      titleTextStyle: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.ink),
      subtitleTextStyle: TextStyle(fontSize: 13, height: 1.35, color: p.muted),
    ),
    // Same look in both themes: brand-green bar, white text, orange action (dark mode used dark text before)
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: radius),
      backgroundColor: VsrColors.brand900,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
      actionTextColor: VsrColors.accent,
      closeIconColor: Colors.white,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.brandText),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : p.muted),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? (dark ? VsrColors.brand600 : VsrColors.brand800) : p.lineSoft),
    ),
    checkboxTheme: CheckboxThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? (dark ? VsrColors.brand600 : VsrColors.brand800) : null)),
    radioTheme: RadioThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? p.brandText : p.muted)),
    textSelectionTheme: TextSelectionThemeData(cursorColor: scheme.primary, selectionColor: p.brand100, selectionHandleColor: scheme.primary),
  );
}

/// Light theme wrapper for screens that are always light (splash, onboarding, login/sign-up).
Widget alwaysLight(Widget child) => _AlwaysLight(child: child);

class _AlwaysLight extends StatelessWidget {
  const _AlwaysLight({required this.child});
  final Widget child;
  static final _light = buildTheme(Brightness.light);
  @override
  Widget build(BuildContext context) => Theme(data: _light, child: child);
}
