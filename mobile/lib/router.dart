import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/models.dart';
import 'core/theme.dart';
import 'features/auth/auth_screens.dart';
import 'features/auth/login_flow.dart';
import 'features/catalog/catalog_screens.dart';
import 'features/catalog/product_extras.dart';
import 'features/checkout/checkout_screens.dart';
import 'features/onboarding/onboarding_screens.dart';
import 'features/orders/order_screens.dart';
import 'features/profile/legal_screens.dart';
import 'features/profile/profile_screens.dart';

import 'package:latlong2/latlong.dart';

import 'features/discovery/discovery_screens.dart';
import 'features/location/location_screens.dart';
import 'features/system/system_screens.dart';
import 'state/app_gate.dart';
import 'state/permissions.dart';
import 'state/providers.dart';
import 'state/splash.dart';
import 'widgets/floating_cart.dart';

/// What a guest may open without an account (browse only). Anything else asks them to log in.
bool _guestAllowed(String loc) =>
    _publicPaths.contains(loc) ||
    const {
      '/',
      '/categories',
      '/search',
      '/deals',
      '/campaign',
      '/gallery',
      '/recently-viewed',
      '/products',
      '/orders',
      '/profile',
      '/more',
    }.contains(loc) ||
    loc.startsWith('/category/') ||
    (loc.startsWith('/product/') && !loc.endsWith('/review'));

const _needsExtra = {'/login/password', '/login/otp', '/login/new-password', '/otp', '/campaign', '/gallery', '/checkout/payment'};

/// Policies, FAQ and About: readable before signing in (linked from login / sign-up).
bool _isInfo(String loc) => loc.startsWith('/legal/') || loc == '/faq' || loc == '/about';

const _publicPaths = [
  '/login',
  '/login/password',
  '/login/otp',
  '/login/new-password',
  '/login/password-updated',
  '/signup',
  '/otp',
  '/forgot',
];

final routerProvider = Provider<GoRouter>((ref) {
  final session = ref.read(sessionProvider.notifier);
  final gate = ref.read(gateProvider.notifier);
  final splash = ref.read(splashDoneProvider.notifier);
  return GoRouter(
    initialLocation: '/',
    refreshListenable: Listenable.merge([
      session.listenable,
      gate.listenable,
      splash.listenable,
    ]),
    redirect: (context, state) {
      final s = ref.read(sessionProvider).status;
      final loc = state.matchedLocation;
      // Screens that need data passed in `extra` can't be rebuilt without it (app restored by
      // Android, hot restart, deep link) — go Home instead of crashing on a null check.
      if (state.extra == null && (_needsExtra.contains(loc) || loc.startsWith('/notifications/'))) return '/';
      // Launch video plays once per app start before anything else.
      if (!ref.read(splashDoneProvider)) {
        return loc == '/splash' ? null : '/splash';
      }
      // App-level gates first (maintenance / forced update / outage); session rules below are unchanged.
      final g = ref.read(gateProvider).status;
      const gateRoutes = {
        GateStatus.maintenance: '/gate/maintenance',
        GateStatus.updateRequired: '/gate/update',
        GateStatus.unsupported: '/gate/unsupported',
        GateStatus.unavailable: '/gate/unavailable',
      };
      if (gateRoutes.containsKey(g)) {
        return loc == gateRoutes[g] ? null : gateRoutes[g];
      }
      if (g == GateStatus.checking && s == SessionStatus.loading) {
        return loc == '/splash' ? null : '/splash';
      }
      if (loc.startsWith('/gate/')) return '/';
      if (_isInfo(loc) && s != SessionStatus.loading) return null;
      switch (s) {
        case SessionStatus.loading:
          return loc == '/splash' ? null : '/splash';
        case SessionStatus.onboarding:
          return loc == '/onboarding' ? null : '/onboarding';
        case SessionStatus.signedOut:
          return _publicPaths.contains(loc) ? null : '/login';
        case SessionStatus.guest:
          if (loc == '/splash' ||
              loc == '/onboarding' ||
              loc == '/auth/success') {
            return '/';
          }
          return _guestAllowed(loc) ? null : '/login';
        case SessionStatus.signedIn:
          // Logged in → straight Home (no "Logged in successfully" stop; web does the same)
          if (_publicPaths.contains(loc) ||
              loc == '/splash' ||
              loc == '/onboarding' ||
              loc == '/auth/success') {
            session.welcome = null; // plain reset: notifying here would re-trigger this redirect
            return '/';
          }
          return null;
      }
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, _) => alwaysLight(const SplashScreen()),
      ),
      GoRoute(path: '/loading', builder: (_, _) => const AppLoadingScreen()),
      GoRoute(
        path: '/gate/maintenance',
        builder: (_, _) => const MaintenanceScreen(),
      ),
      GoRoute(
        path: '/gate/update',
        builder: (_, _) => const UpdateRequiredScreen(),
      ),
      GoRoute(
        path: '/gate/unsupported',
        builder: (_, _) => const UnsupportedVersionScreen(),
      ),
      GoRoute(
        path: '/gate/unavailable',
        builder: (_, _) => const ServiceUnavailableScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (_, _) => alwaysLight(const OnboardingScreen()),
      ),
      GoRoute(
        path: '/login',
        builder: (_, _) => alwaysLight(const LoginEntryScreen()),
      ),
      GoRoute(
        path: '/login/password',
        builder: (_, s) =>
            alwaysLight(PasswordScreen(email: s.extra! as String)),
      ),
      GoRoute(
        path: '/login/otp',
        builder: (_, s) =>
            alwaysLight(LoginOtpScreen(args: s.extra! as OtpFlowArgs)),
      ),
      GoRoute(
        path: '/login/new-password',
        builder: (_, s) {
          final (id, code) = s.extra! as (String, String);
          return alwaysLight(CreatePasswordScreen(identifier: id, code: code));
        },
      ),
      GoRoute(
        path: '/login/password-updated',
        builder: (_, _) => alwaysLight(const PasswordUpdatedScreen()),
      ),
      GoRoute(
        path: '/auth/success',
        builder: (_, _) => alwaysLight(const LoginSuccessScreen()),
      ),
      GoRoute(
        path: '/signup',
        builder: (_, s) {
          final pre = s.extra as (String?, String?)?;
          return alwaysLight(
            SignUpScreen(initialEmail: pre?.$1, initialPhone: pre?.$2),
          );
        },
      ),
      GoRoute(
        path: '/forgot',
        builder: (_, _) => alwaysLight(const ForgotPasswordScreen()),
      ),
      GoRoute(
        path: '/otp',
        builder: (_, s) => alwaysLight(OtpScreen(args: s.extra! as OtpArgs)),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => _Shell(shell: shell),
        branches: [
          // Bottom bar order: Categories · Home · Orders · Profile (cart is a floating bar, not a tab)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/categories',
                builder: (_, _) => const CategoriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
      GoRoute(
        path: '/search',
        builder: (_, s) => SearchV2Screen(initial: s.uri.queryParameters['q']),
      ),
      GoRoute(path: '/deals', builder: (_, _) => const DealsScreen()),
      GoRoute(
        path: '/campaign',
        builder: (_, s) => CampaignScreen(banner: s.extra! as BannerItem),
      ),
      GoRoute(
        path: '/recommended',
        builder: (_, _) => const ProductCollectionScreen(kind: 'recommended'),
      ),
      GoRoute(
        path: '/recently-viewed',
        builder: (_, _) => const ProductCollectionScreen(kind: 'recent'),
      ),
      GoRoute(
        path: '/category/:id',
        builder: (_, s) => ProductListScreen(
          title: s.uri.queryParameters['name'] ?? 'Products',
          categoryId: s.pathParameters['id'],
          subId: s.uri.queryParameters['sub'],
        ),
      ),
      GoRoute(
        path: '/products',
        builder: (_, s) => ProductListScreen(
          title: s.uri.queryParameters['title'] ?? 'Products',
          sort: s.uri.queryParameters['sort'],
          type: s.uri.queryParameters['type'],
        ),
      ),
      GoRoute(
        path: '/product/:id',
        builder: (_, s) => ProductDetailScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/product/:id/reviews',
        builder: (_, s) => ReviewsScreen(
          productId: s.pathParameters['id']!,
          productName: s.extra as String?,
        ),
      ),
      GoRoute(
        path: '/product/:id/review',
        builder: (_, s) => WriteReviewScreen(
          productId: s.pathParameters['id']!,
          productName: s.extra as String?,
        ),
      ),
      GoRoute(
        path: '/review-success',
        builder: (_, s) =>
            ReviewSuccessScreen(edited: (s.extra as bool?) ?? false),
      ),
      GoRoute(
        path: '/gallery',
        builder: (_, s) {
          final (images, index, title) =
              s.extra! as (List<String>, int, String);
          return GalleryScreen(images: images, initial: index, title: title);
        },
      ),
      GoRoute(
        path: '/checkout/address',
        builder: (_, _) => const AddressesScreen(select: true),
      ),
      GoRoute(
        path: '/checkout/payment',
        builder: (_, s) => PaymentScreen(address: s.extra! as Address),
      ),
      GoRoute(
        path: '/order-success/:id',
        builder: (_, s) => OrderSuccessScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (_, s) => OrderDetailScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id/rate',
        builder: (_, s) => RateOrderScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/addresses', builder: (_, _) => const AddressesScreen()),
      GoRoute(
        path: '/address/new',
        builder: (_, s) => AddressFormScreen(prefill: s.extra as Address?),
      ),
      GoRoute(
        path: '/location',
        builder: (_, _) => const ChooseLocationScreen(),
      ),
      GoRoute(
        path: '/location/permission',
        builder: (_, _) => const LocationPermissionScreen(),
      ),
      GoRoute(
        path: '/location/search',
        builder: (_, _) => const LocationSearchScreen(),
      ),
      GoRoute(
        path: '/location/map',
        builder: (_, s) => MapPickScreen(initial: s.extra as LatLng?),
      ),
      GoRoute(
        path: '/location/not-serviceable',
        builder: (_, s) => NotServiceableScreen(address: s.extra as Address?),
      ),
      GoRoute(
        path: '/location/unavailable',
        builder: (_, s) =>
            LocationUnavailableScreen(serviceOff: (s.extra as bool?) ?? false),
      ),
      GoRoute(
        path: '/location/denied',
        builder: (_, s) =>
            LocationDeniedScreen(permanently: (s.extra as bool?) ?? false),
      ),
      GoRoute(
        path: '/address/:id',
        builder: (_, s) => AddressFormScreen(existing: s.extra as Address?),
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (_, _) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/notifications/:id',
        builder: (_, s) =>
            NotificationDetailScreen(notification: s.extra! as AppNotification),
      ),
      GoRoute(
        path: '/help',
        builder: (_, s) => HelpScreen(orderId: s.uri.queryParameters['order']),
      ),
      GoRoute(path: '/wishlist', builder: (_, _) => const WishlistScreen()),
      GoRoute(path: '/offers', builder: (_, _) => const OffersScreen()),
      GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
      GoRoute(path: '/legal/:slug', builder: (_, s) => LegalScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/faq', builder: (_, _) => const FaqScreen()),
      GoRoute(path: '/about', builder: (_, _) => const AboutScreen()),
    ],
  );
});

/// Safe-area-aware bottom navigation: Home, Categories, Cart, Orders, Profile (PRD §5.3).
class _Shell extends ConsumerStatefulWidget {
  const _Shell({required this.shell});
  final StatefulNavigationShell shell;
  @override
  ConsumerState<_Shell> createState() => _ShellState();
}

class _ShellState extends ConsumerState<_Shell> {
  bool _prompted = false;
  int? _hiddenAtCount;
  // Scrolling down hides the nav bar; the cart bar (compact) takes its place until the user scrolls up.
  bool _navHidden = false;

  bool _onScroll(UserScrollNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final hide = n.direction == ScrollDirection.reverse
        ? true
        : n.direction == ScrollDirection.forward
        ? false
        : _navHidden;
    if (hide != _navHidden) setState(() => _navHidden = hide);
    return false;
  }

  void _maybePrompt(GateState g) {
    if (_prompted || g.status != GateStatus.optionalUpdate || !mounted) return;
    _prompted = true;
    showOptionalUpdate(context, ref, g.latest);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybePrompt(ref.read(gateProvider));
      if (ref.read(isSignedInProvider)) askStartupPermissions();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(gateProvider, (_, g) => _maybePrompt(g));
    // Logged in while the app was already open → ask then too (once per app run)
    ref.listen(isSignedInProvider, (was, now) {
      if (now && was != true) askStartupPermissions();
    });
    final shell = widget.shell;
    final count = ref.watch(cartProvider).value?.count ?? 0;
    // Cart bar on Categories and Home; ✕ hides it until the cart changes
    final showCart =
        count > 0 && shell.currentIndex <= 1 && _hiddenAtCount != count;
    final hideNav = _navHidden && showCart;
    // System back on any tab but Home returns to Home; only Home lets back leave the app.
    return PopScope(
      canPop: shell.currentIndex == 1,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(1);
      },
      child: Scaffold(
        extendBody: true,
        body: NotificationListener<UserScrollNotification>(
          onNotification: _onScroll,
          child: shell,
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  switchInCurve: Curves.easeOutCubic,
                  transitionBuilder: (c, a) => SizeTransition(
                    sizeFactor: a,
                    alignment: Alignment.bottomCenter,
                    child: FadeTransition(opacity: a, child: c),
                  ),
                  child: showCart
                      ? Padding(
                          key: ValueKey(hideNav ? 'cart-compact' : 'cart'),
                          padding: EdgeInsets.only(bottom: hideNav ? 0 : 10),
                          child: FloatingCartBar(
                            compact: hideNav,
                            onDismiss: () =>
                                setState(() => _hiddenAtCount = count),
                          ),
                        )
                      : const SizedBox.shrink(key: ValueKey('nocart')),
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  child: hideNav
                      ? const SizedBox(width: double.infinity)
                      : FloatingNavBar(
                          index: shell.currentIndex,
                          onTap: (i) {
                            setState(() => _navHidden = false);
                            shell.goBranch(
                              i,
                              initialLocation: i == shell.currentIndex,
                            );
                          },
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
