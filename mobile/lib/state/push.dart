import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../router.dart';
import 'providers.dart';

/// Push notifications (Firebase Cloud Messaging).
///
/// - App closed / in background: Android shows the push itself on the "vsr_alerts" channel
///   (high importance, so it pops up as a heads-up banner and appears on the lock screen).
/// - App open: FCM doesn't display anything, so we show it with flutter_local_notifications.
/// - Tapping opens the order / product / notification list (data: orderId, link, notificationId).
/// - The device token is registered with the API, linked to the signed-in user (guests get
///   store-wide offers only) and re-registered on login, logout and token refresh.
/// The backend side is backend/src/utils/push.ts.
const _channel = AndroidNotificationChannel(
  'vsr_alerts',
  'Orders & offers',
  description: 'Order updates, refunds, support replies, back-in-stock alerts and offers',
  importance: Importance.max,
);

/// Runs in its own isolate when a push arrives while the app is closed. The system already
/// shows notification pushes, so there's nothing to do; it only has to exist.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {}

/// Call before runApp. Returns false (and push stays off) if Firebase isn't set up for this platform.
Future<bool> initFirebase() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS) return false;
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    return true;
  } catch (e) {
    debugPrint('Push disabled: Firebase init failed: $e');
    return false;
  }
}

class PushService {
  PushService(this._ref) {
    unawaited(_start());
  }

  final Ref _ref;
  final _local = FlutterLocalNotificationsPlugin();
  final _subs = <StreamSubscription<dynamic>>[];
  String? _token;

  FirebaseMessaging get _fcm => FirebaseMessaging.instance;

  Future<void> _start() async {
    if (Firebase.apps.isEmpty) return;
    try {
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@drawable/ic_notification'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
        onDidReceiveNotificationResponse: (r) => _openPayload(r.payload),
      );
      await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(_channel);

      // Android 13+ / iOS ask once; denying just means no pushes (in-app list still works)
      await _fcm.requestPermission();
      // iOS: also show banners while the app is open
      await _fcm.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

      _subs
        ..add(FirebaseMessaging.onMessage.listen(_showForeground))
        ..add(FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data)))
        // ignore: deprecated_member_use
        ..add(_fcm.onTokenRefresh.listen((t) {
          _token = t;
          unawaited(_register());
        }));
      // Login / logout / guest → relink this device to the right account
      _ref.listen(sessionProvider.select((s) => s.status), (_, _) => unawaited(_register()));

      // ignore: deprecated_member_use
      _token = await _fcm.getToken();
      await _register();

      // Launched by tapping a push (app was closed)
      final initial = await _fcm.getInitialMessage();
      if (initial != null) _open(initial.data);
      final launch = await _local.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) _openPayload(launch!.notificationResponse?.payload);
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }

  Future<void> _register() async {
    final token = _token;
    if (token == null) return;
    final status = _ref.read(sessionProvider).status;
    if (status == SessionStatus.loading) return; // registered again once the session settles
    try {
      await _ref.read(apiProvider).post('/devices', {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        'app': 'shop',
      });
    } catch (e) {
      debugPrint('Push token registration failed: $e');
    }
  }

  Future<void> _showForeground(RemoteMessage m) async {
    _ref.invalidate(notificationsProvider);
    final n = m.notification;
    if (n == null) return;
    await _local.show(
      id: m.messageId.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.max,
          priority: Priority.high,
          visibility: NotificationVisibility.public,
          icon: '@drawable/ic_notification',
          styleInformation: BigTextStyleInformation(n.body ?? ''),
        ),
        iOS: const DarwinNotificationDetails(presentAlert: true, presentSound: true, presentBadge: true),
      ),
      payload: jsonEncode(m.data),
    );
  }

  void _openPayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      _open((jsonDecode(payload) as Map).cast<String, dynamic>());
    } catch (_) {}
  }

  /// Push data → this app's route. Waits until the splash/session check is done.
  Future<void> _open(Map<String, dynamic> data) async {
    final orderId = data['orderId'] as String?;
    final link = data['link'] as String?;
    final route = orderId != null && orderId.isNotEmpty
        ? '/orders/$orderId'
        : link != null && link.startsWith('/product/')
            ? link
            : '/notifications';
    for (var i = 0; i < 40 && _ref.read(sessionProvider).status == SessionStatus.loading; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 150));
    }
    _ref.read(routerProvider).push(route);
  }

  void dispose() {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
  }
}

final pushProvider = Provider<PushService>((ref) {
  final p = PushService(ref);
  ref.onDispose(p.dispose);
  return p;
});
