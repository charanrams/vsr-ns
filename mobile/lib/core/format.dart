import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String money(num? v) => _inr.format(v ?? 0);
String shortDate(DateTime? d) => d == null ? '' : DateFormat('d MMM yyyy').format(d.toLocal());
String dateTime(DateTime? d) => d == null ? '' : DateFormat('d MMM yyyy, h:mm a').format(d.toLocal());
String timeOnly(DateTime? d) => d == null ? '' : DateFormat('h:mm a').format(d.toLocal());
String titleCase(String s) => s.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');

String ago(DateTime? d) {
  if (d == null) return '';
  final s = DateTime.now().difference(d.toLocal()).inSeconds;
  if (s < 60) return 'just now';
  if (s < 3600) return '${s ~/ 60} min ago';
  if (s < 86400) return '${s ~/ 3600} hr ago';
  return '${s ~/ 86400} day${s >= 172800 ? 's' : ''} ago';
}

bool isEmail(String s) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(s.trim());
bool isPhone(String s) => RegExp(r'^(\+?91)?[6-9]\d{9}$').hasMatch(s.replaceAll(RegExp(r'[\s-]'), ''));
