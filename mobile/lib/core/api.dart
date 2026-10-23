import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;
  bool get isUnauthorized => status == 401;
  bool get isOffline => code == 'offline';
  @override
  String toString() => message;
}

/// Thin HTTP client: JSON in/out, bearer auth, one-shot refresh-token rotation.
/// Tokens live in the platform keystore (Keychain / EncryptedSharedPreferences).
class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
      : _http = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _http;
  final FlutterSecureStorage _storage;
  String? _access;
  String? _refresh;
  Future<bool>? _refreshing;

  /// Called when the session can't be refreshed (expired/revoked).
  void Function()? onSessionExpired;

  static const _kAccess = 'vsr.access';
  static const _kRefresh = 'vsr.refresh';

  Future<bool> restore() async {
    try {
      _access = await _storage.read(key: _kAccess);
      _refresh = await _storage.read(key: _kRefresh);
    } catch (_) {
      // Keystore can become unreadable after reinstall/backup restore on some Android devices.
      try {
        await _storage.deleteAll();
      } catch (_) {}
      _access = null;
      _refresh = null;
    }
    return _refresh != null;
  }

  bool _persist = true;

  /// [persist] false = "Keep me logged in" unticked: tokens stay in memory only and the
  /// session ends when the app is closed (server-side expiry still applies either way).
  Future<void> saveTokens(String access, String refresh, {bool? persist}) async {
    if (persist != null) _persist = persist;
    _access = access;
    _refresh = refresh;
    if (_persist) {
      await _storage.write(key: _kAccess, value: access);
      await _storage.write(key: _kRefresh, value: refresh);
    } else {
      await _storage.delete(key: _kAccess);
      await _storage.delete(key: _kRefresh);
    }
  }

  Future<void> clear() async {
    _access = null;
    _refresh = null;
    try {
      await _storage.delete(key: _kAccess);
      await _storage.delete(key: _kRefresh);
    } catch (_) {}
  }

  String? get refreshToken => _refresh;
  String? get accessToken => _access;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body, Map<String, String>? headers]) => _send('POST', path, body: body, headers: headers);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body: body);
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, dynamic>? query, Map<String, String>? headers, bool retried = false}) async {
    final uri = Uri.parse('${AppConfig.apiUrl}$path').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, '$v'))?..removeWhere((_, v) => v.isEmpty || v == 'null'),
    );
    final req = http.Request(method, uri)
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'application/json';
    if (_access != null) req.headers['Authorization'] = 'Bearer $_access';
    if (headers != null) req.headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);

    http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 20)));
    } on SocketException {
      throw ApiException('No internet connection. Check your network and try again.', code: 'offline');
    } on TimeoutException {
      throw ApiException('The server is taking too long. Please try again.', code: 'timeout');
    } on http.ClientException {
      throw ApiException('Can’t reach VSR right now. Please try again.', code: 'offline');
    }

    if (res.statusCode == 401 && !retried && !path.startsWith('/auth/') && _refresh != null) {
      _refreshing ??= _rotate().whenComplete(() => _refreshing = null);
      if (await _refreshing!) return _send(method, path, body: body, query: query, headers: headers, retried: true);
      onSessionExpired?.call();
    }

    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return decoded;
    final err = decoded is Map ? decoded['error'] as Map? : null;
    var message = (err?['message'] as String?) ?? 'Something went wrong. Please try again.';
    final details = err?['details'];
    if (details is Map && details.isNotEmpty) {
      final first = details.values.first;
      if (first is List && first.isNotEmpty) message = '${first.first}';
    }
    throw ApiException(message, status: res.statusCode, code: err?['code'] as String?);
  }

  Future<bool> _rotate() async {
    try {
      final res = await _http.post(
        Uri.parse('${AppConfig.apiUrl}/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refresh}),
      );
      if (res.statusCode != 200) {
        await clear();
        return false;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      await saveTokens(data['accessToken'] as String, data['refreshToken'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }
}
