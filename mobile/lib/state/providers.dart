import 'dart:async';

import 'package:flutter/foundation.dart' show ValueNotifier;
import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api.dart';
import '../core/models.dart';

final apiProvider = Provider<ApiClient>((ref) => ApiClient());

// ---------------------------------------------------------------- Session ----
/// onboarding: not signed in → onboarding is shown on every launch.
/// guest: browsing without an account for this app run (not persisted).
enum SessionStatus { loading, onboarding, signedOut, guest, signedIn }

class SessionState {
  const SessionState(this.status, [this.user]);
  final SessionStatus status;
  final AppUser? user;
}

/// Owns sign-in state. Exposes a [Listenable] so go_router can re-run redirects.
class SessionNotifier extends Notifier<SessionState> {
  final listenable = ValueNotifier<int>(0);

  /// Set by an interactive sign-in so the router shows the "Login successful" screen once.
  /// 'email' | 'phone' | null
  String? welcome;

  void clearWelcome() {
    welcome = null;
    listenable.value++;
  }

  @override
  SessionState build() {
    ref.read(apiProvider).onSessionExpired = () => _set(const SessionState(SessionStatus.signedOut));
    _bootstrap();
    return const SessionState(SessionStatus.loading);
  }

  void _set(SessionState s) {
    state = s;
    listenable.value++;
  }

  ApiClient get _api => ref.read(apiProvider);

  Future<void> _bootstrap() async {
    // Signed-in users go straight Home; everyone else sees onboarding each launch.
    if (!await _api.restore()) return _set(const SessionState(SessionStatus.onboarding));
    try {
      final data = await _api.get('/auth/me') as Json;
      final user = AppUser.fromJson(data['user'] as Json);
      if (!user.roles.contains('customer')) {
        await _api.clear();
        return _set(const SessionState(SessionStatus.onboarding));
      }
      _set(SessionState(SessionStatus.signedIn, user));
    } on ApiException catch (e) {
      // Offline at launch: keep the stored session and let screens show offline states
      if (e.isOffline) return _set(const SessionState(SessionStatus.signedIn));
      await _api.clear();
      _set(const SessionState(SessionStatus.onboarding));
    }
  }

  /// Onboarding Skip / Start Shopping → Login.
  Future<void> finishOnboarding() async {
    _set(const SessionState(SessionStatus.signedOut));
  }

  /// Login "Continue as Guest" → browse without an account.
  void continueAsGuest() => _set(const SessionState(SessionStatus.guest));

  bool get isSignedIn => state.status == SessionStatus.signedIn;

  Future<void> _accept(Json data, {bool persist = true, String? welcomeKind}) async {
    await _api.saveTokens(data['accessToken'] as String, data['refreshToken'] as String, persist: persist);
    welcome = welcomeKind;
    _set(SessionState(SessionStatus.signedIn, AppUser.fromJson(data['user'] as Json)));
  }

  Future<void> loginWithPassword(String identifier, String password, {bool keepLoggedIn = true, bool showWelcome = false}) async {
    final data = await _api.post('/auth/login', {'identifier': identifier.trim(), 'password': password, 'portal': 'customer'}) as Json;
    await _accept(data, persist: keepLoggedIn, welcomeKind: showWelcome ? 'email' : null);
  }

  /// Returns a dev-only OTP when the backend runs without SMTP (never in production).
  Future<String?> sendOtp(String identifier, String purpose) async {
    final data = await _api.post('/auth/otp/send', {'identifier': identifier.trim(), 'purpose': purpose}) as Json;
    return data['devOtp'] as String?;
  }

  Future<void> verifyOtp(String identifier, String code, String purpose, {bool showWelcome = false}) async {
    final data = await _api.post('/auth/otp/verify', {'identifier': identifier.trim(), 'code': code, 'purpose': purpose, 'portal': 'customer'}) as Json;
    await _accept(data, welcomeKind: showWelcome ? 'phone' : null);
  }

  Future<String?> signUp({required String name, required String email, required String phone, required String password}) async {
    final data = await _api.post('/auth/signup', {'name': name.trim(), 'email': email.trim(), 'phone': phone.trim(), 'password': password, 'acceptTerms': true}) as Json;
    return data['devOtp'] as String?;
  }

  Future<void> resetPassword(String identifier, String code, String password) async {
    await _api.post('/auth/password/reset', {'identifier': identifier.trim(), 'code': code, 'password': password});
  }

  Future<void> updateUser(AppUser u) async => _set(SessionState(SessionStatus.signedIn, u));

  /// Signs out on the device immediately, then revokes the refresh session on the server in the
  /// background. (Cart and other account data rebuild on their own because they watch this state —
  /// invalidating them from here is a circular dependency in Riverpod 3 and used to throw.)
  Future<void> logout() async {
    final token = _api.refreshToken;
    await _api.clear();
    welcome = null;
    _set(const SessionState(SessionStatus.signedOut));
    if (token != null) {
      unawaited(_api.post('/auth/logout', {'refreshToken': token}).then((_) {}, onError: (_) {}));
    }
  }
}

final sessionProvider = NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);

// ------------------------------------------------------------------- Cart ----
/// Server-side cart; every mutation returns freshly priced totals from the API.
class CartNotifier extends AsyncNotifier<CartView> {
  ApiClient get _api => ref.read(apiProvider);

  @override
  Future<CartView> build() async {
    final session = ref.watch(sessionProvider);
    if (session.status != SessionStatus.signedIn) return CartView.empty();
    return CartView.fromJson(await _api.get('/store/me/cart') as Json);
  }

  Future<void> setQty(String productId, int quantity, {String? variantId}) async {
    final next = CartView.fromJson(await _api.put('/store/me/cart/items', {'productId': productId, 'quantity': quantity, 'variantId': ?variantId}) as Json);
    state = AsyncData(next);
  }

  Future<void> applyCoupon(String? code) async {
    final next = CartView.fromJson(await _api.post('/store/me/cart/coupon', {'code': code}) as Json);
    state = AsyncData(next);
  }

  Future<void> clear() async {
    state = AsyncData(CartView.fromJson(await _api.delete('/store/me/cart') as Json));
  }

  void replace(CartView v) => state = AsyncData(v);
}

final cartProvider = AsyncNotifierProvider<CartNotifier, CartView>(CartNotifier.new);

// ------------------------------------------------------------------- Data ----
final homeProvider = FutureProvider<HomeData>((ref) async => HomeData.fromJson(await ref.read(apiProvider).get('/store/home') as Json));

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final data = await ref.read(apiProvider).get('/store/categories') as Json;
  return (data['categories'] as List).map((e) => Category.fromJson(e as Json)).toList();
});

class ProductQuery {
  const ProductQuery({this.category, this.q, this.sort, this.type});
  final String? category, q, sort, type;
  @override
  bool operator ==(Object other) => other is ProductQuery && other.category == category && other.q == q && other.sort == sort && other.type == type;
  @override
  int get hashCode => Object.hash(category, q, sort, type);
}

final productsProvider = FutureProvider.family<List<Product>, ProductQuery>((ref, q) async {
  final data = await ref.read(apiProvider).get('/store/products', query: {'category': q.category, 'q': q.q, 'sort': q.sort, 'type': q.type, 'limit': 50}) as Json;
  return (data['items'] as List).map((e) => Product.fromJson(e as Json)).toList();
});

class ProductDetail {
  ProductDetail(this.product, this.reviews, this.similar);
  final Product product;
  final List<Review> reviews;
  final List<Product> similar;
}

final productDetailProvider = FutureProvider.family<ProductDetail, String>((ref, id) async {
  final d = await ref.read(apiProvider).get('/store/products/$id') as Json;
  return ProductDetail(
    Product.fromJson(d['product'] as Json),
    (d['reviews'] as List).map((e) => Review.fromJson(e as Json)).toList(),
    (d['similar'] as List).map((e) => Product.fromJson(e as Json)).toList(),
  );
});

final addressesProvider = FutureProvider<List<Address>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/addresses') as Json;
  return (d['addresses'] as List).map((e) => Address.fromJson(e as Json)).toList();
});

final ordersProvider = FutureProvider.family<List<OrderSummary>, String>((ref, tab) async {
  final d = await ref.read(apiProvider).get('/store/me/orders', query: {'tab': tab}) as Json;
  return (d['orders'] as List).map((e) => OrderSummary.fromJson(e as Json)).toList();
});

final orderProvider = FutureProvider.family<OrderSummary, String>((ref, id) async {
  final d = await ref.read(apiProvider).get('/store/me/orders/$id') as Json;
  return OrderSummary.fromJson(d['order'] as Json);
});

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/notifications') as Json;
  return (d['items'] as List).map((e) => AppNotification.fromJson(e as Json)).toList();
});

final wishlistProvider = FutureProvider<List<Product>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/wishlist') as Json;
  return (d['items'] as List).map((e) => Product.fromJson(e as Json)).toList();
});

final ticketsProvider = FutureProvider<List<Ticket>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/tickets') as Json;
  return (d['tickets'] as List).map((e) => Ticket.fromJson(e as Json)).toList();
});

final paymentConfigProvider = FutureProvider<Json>((ref) async => await ref.read(apiProvider).get('/store/config') as Json);

// ------------------------------------------------------- Discovery (1.4) ----
/// Small on-device lists (recent searches, recently viewed). Not synced; cleared on uninstall.
class LocalListNotifier extends Notifier<List<String>> {
  LocalListNotifier(this.key, {this.max = 10});
  final String key;
  final int max;

  @override
  List<String> build() {
    SharedPreferences.getInstance().then((p) {
      if (ref.mounted) state = p.getStringList(key) ?? const [];
    }, onError: (_) {});
    return const [];
  }

  Future<void> add(String value) async {
    final next = [value, ...state.where((v) => v != value)].take(max).toList();
    state = next;
    (await SharedPreferences.getInstance()).setStringList(key, next);
  }

  Future<void> remove(String value) async {
    state = state.where((v) => v != value).toList();
    (await SharedPreferences.getInstance()).setStringList(key, state);
  }

  Future<void> clear() async {
    state = const [];
    (await SharedPreferences.getInstance()).remove(key);
  }
}

final recentSearchesProvider = NotifierProvider<LocalListNotifier, List<String>>(() => LocalListNotifier('vsr.recentSearches', max: 8));

/// Recently viewed product IDs (most recent first).
final recentlyViewedIdsProvider = NotifierProvider<LocalListNotifier, List<String>>(() => LocalListNotifier('vsr.recentlyViewed', max: 12));

final recentlyViewedProvider = FutureProvider<List<Product>>((ref) async {
  final ids = ref.watch(recentlyViewedIdsProvider);
  if (ids.isEmpty) return const [];
  final api = ref.read(apiProvider);
  final out = <Product>[];
  for (final id in ids.take(10)) {
    try {
      final d = await api.get('/store/products/$id') as Json;
      out.add(Product.fromJson(d['product'] as Json));
    } catch (_) {
      // Product removed or unavailable — skip it
    }
  }
  return out;
});

final recommendationsProvider = FutureProvider<List<Product>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/recommendations') as Json;
  return (d['items'] as List).map((e) => Product.fromJson(e as Json)).toList();
});

final unreadCountProvider = Provider<int>((ref) => ref.watch(notificationsProvider).value?.where((n) => !n.read).length ?? 0);

/// Search with filter + sort (1.4 items 50–53).
class SearchQuery {
  const SearchQuery({required this.q, this.sort = 'popular', this.minPrice, this.maxPrice, this.inStock = false, this.type, this.category});
  final String q, sort;
  final int? minPrice, maxPrice;
  final bool inStock;
  final String? type, category;
  int get activeFilters => [minPrice != null || maxPrice != null, inStock, type != null, category != null].where((x) => x).length;
  SearchQuery copyWith({String? q, String? sort, int? minPrice, int? maxPrice, bool? inStock, String? type, String? category, bool clearPrice = false, bool clearType = false, bool clearCategory = false}) => SearchQuery(
        q: q ?? this.q,
        sort: sort ?? this.sort,
        minPrice: clearPrice ? null : minPrice ?? this.minPrice,
        maxPrice: clearPrice ? null : maxPrice ?? this.maxPrice,
        inStock: inStock ?? this.inStock,
        type: clearType ? null : type ?? this.type,
        category: clearCategory ? null : category ?? this.category,
      );
  @override
  bool operator ==(Object other) => other is SearchQuery && other.q == q && other.sort == sort && other.minPrice == minPrice && other.maxPrice == maxPrice && other.inStock == inStock && other.type == type && other.category == category;
  @override
  int get hashCode => Object.hash(q, sort, minPrice, maxPrice, inStock, type, category);
}

final searchProvider = FutureProvider.family<List<Product>, SearchQuery>((ref, s) async {
  final d = await ref.read(apiProvider).get('/store/products', query: {
    'q': s.q,
    'sort': s.sort,
    'minPrice': s.minPrice,
    'maxPrice': s.maxPrice,
    'inStock': s.inStock ? 1 : null,
    'type': s.type,
    'category': s.category,
    'limit': 50,
  }) as Json;
  return (d['items'] as List).map((e) => Product.fromJson(e as Json)).toList();
});

final dealsProvider = FutureProvider<List<Product>>((ref) async {
  final d = await ref.read(apiProvider).get('/store/products', query: {'sort': 'discount', 'limit': 30}) as Json;
  return (d['items'] as List).map((e) => Product.fromJson(e as Json)).toList();
});

/// True for signed-in customers; guests and signed-out users get false.
final isSignedInProvider = Provider<bool>((ref) => ref.watch(sessionProvider).status == SessionStatus.signedIn);

// ------------------------------------------------------------ Appearance ----
/// Light / dark / follow-the-phone, chosen in Profile → More. Defaults to the phone's setting.
class ThemeModeNotifier extends Notifier<ThemeMode> {
  static const _key = 'vsr.themeMode';

  @override
  ThemeMode build() {
    SharedPreferences.getInstance().then((p) {
      final saved = ThemeMode.values.asNameMap()[p.getString(_key)];
      if (saved != null && ref.mounted) state = saved;
    }, onError: (_) {});
    return ThemeMode.system;
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    (await SharedPreferences.getInstance()).setString(_key, mode.name);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);

// ---------------------------------------------------------- Reviews / coupons ----
class ReviewsData {
  ReviewsData(this.items, this.total, this.distribution);
  final List<Review> items;
  final int total;
  final Map<int, int> distribution;
}

final reviewsProvider = FutureProvider.family<ReviewsData, String>((ref, id) async {
  final d = await ref.read(apiProvider).get('/store/products/$id/reviews', query: {'limit': 50}) as Json;
  final dist = <int, int>{for (final e in (d['distribution'] as Map).entries) int.parse('${e.key}'): (e.value as num).toInt()};
  return ReviewsData((d['items'] as List).map((e) => Review.fromJson(e as Json)).toList(), (d['total'] as num).toInt(), dist);
});

final couponsProvider = FutureProvider<List<Json>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const [];
  final d = await ref.read(apiProvider).get('/store/me/coupons') as Json;
  return (d['coupons'] as List).cast<Json>();
});

// ------------------------------------------------------------ Notify Me ----
/// Product ids the customer asked to be told about when back in stock.
final stockAlertsProvider = FutureProvider<Set<String>>((ref) async {
  if (ref.watch(sessionProvider).status != SessionStatus.signedIn) return const {};
  final d = await ref.read(apiProvider).get('/store/me/stock-alerts') as Json;
  return (d['productIds'] as List).cast<String>().toSet();
});
