import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config.dart';
import 'providers.dart';

/// Live updates: the API pushes `change {coll, op, id}` over Socket.IO whenever the database
/// changes, and we refresh the providers that show that collection. No data rides on the socket;
/// screens refetch through the normal authorised API. See docs/realtime-sync.md.
class Realtime {
  Realtime(this._ref) {
    _connect();
    // Login / logout / guest → reconnect with the right identity (and rooms)
    _ref.listen(sessionProvider.select((s) => s.status), (_, _) => _connect());
  }

  final Ref _ref;
  io.Socket? _socket;
  final _pending = <String>{};
  Timer? _timer;

  void _connect() {
    _socket?.dispose();
    final token = _ref.read(apiProvider).accessToken;
    final origin = Uri.parse(AppConfig.apiUrl).replace(path: '').toString();
    final opts = io.OptionBuilder().setTransports(['websocket']).enableReconnection().disableAutoConnect();
    if (token != null && _ref.read(isSignedInProvider)) opts.setAuth({'token': token});
    final s = io.io(origin, opts.build());
    s.on('change', (data) {
      final coll = (data is Map ? data['coll'] : null) as String?;
      if (coll == null) return;
      _pending.add(coll);
      // Writes come in bursts → one refresh per collection
      _timer?.cancel();
      _timer = Timer(const Duration(milliseconds: 250), _flush);
    });
    // Token expired during a reconnect: any authorised call refreshes it, then rejoin with the new one
    s.on('auth_error', (_) async {
      try {
        await _ref.read(apiProvider).get('/auth/me');
      } catch (_) {}
      _connect();
    });
    // Missed events while offline → refresh what's on screen
    s.onReconnect((_) => _refreshAll());
    s.connect();
    _socket = s;
  }

  void _flush() {
    final colls = Set.of(_pending);
    _pending.clear();
    colls.forEach(_refresh);
  }

  void _refresh(String coll) {
    final r = _ref;
    switch (coll) {
      case 'products':
        for (final p in [homeProvider, dealsProvider, recentlyViewedProvider, recommendationsProvider, wishlistProvider]) {
          r.invalidate(p);
        }
        r.invalidate(productsProvider);
        r.invalidate(productDetailProvider);
        r.invalidate(searchProvider);
        r.invalidate(cartProvider);
      case 'categories':
        r.invalidate(categoriesProvider);
        r.invalidate(homeProvider);
      case 'homelayouts':
        r.invalidate(homeProvider);
        r.invalidate(recommendationsProvider);
      case 'banners':
        r.invalidate(homeProvider);
      case 'reviews':
        r.invalidate(productDetailProvider);
        r.invalidate(reviewsProvider);
      case 'coupons':
        r.invalidate(couponsProvider);
        r.invalidate(cartProvider);
      case 'orders' || 'payments' || 'refunds' || 'deliverypartners':
        r.invalidate(ordersProvider);
        r.invalidate(orderProvider);
      case 'carts':
        r.invalidate(cartProvider);
      case 'stockalerts':
        r.invalidate(stockAlertsProvider);
      case 'notifications':
        r.invalidate(notificationsProvider);
      case 'users':
        r.invalidate(addressesProvider);
        r.invalidate(wishlistProvider);
      case 'supporttickets':
        r.invalidate(ticketsProvider);
    }
  }

  void _refreshAll() {
    for (final c in ['products', 'categories', 'reviews', 'coupons', 'orders', 'carts', 'notifications', 'users', 'supporttickets']) {
      _refresh(c);
    }
  }

  void dispose() {
    _timer?.cancel();
    _socket?.dispose();
  }
}

final realtimeProvider = Provider<Realtime>((ref) {
  final rt = Realtime(ref);
  ref.onDispose(rt.dispose);
  return rt;
});
