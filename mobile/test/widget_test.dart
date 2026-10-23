import 'package:flutter_test/flutter_test.dart';
import 'package:vsr_customer/core/format.dart';
import 'package:vsr_customer/core/models.dart';

void main() {
  test('identifier detection routes email to password and phone to OTP', () {
    expect(isEmail('priya@gmail.com'), isTrue);
    expect(isPhone('9876543210'), isTrue);
    expect(isPhone('+91 98765 43210'), isTrue);
    expect(isEmail('9876543210'), isFalse);
    expect(isPhone('12345'), isFalse);
  });

  test('product parses price, discount and stock status', () {
    final p = Product.fromJson({
      '_id': 'p1', 'name': 'Fresh Tomatoes', 'unit': '500 g', 'price': 49, 'mrp': 60,
      'images': [{'url': 'https://x/y.jpg'}], 'available': 8, 'stockStatus': 'low_stock',
    });
    expect(p.discountPct, 18);
    expect(p.outOfStock, isFalse);
    expect(p.image, 'https://x/y.jpg');
  });

  test('cart counts quantities per product', () {
    final c = CartView.fromJson({
      'items': [
        {'product': 'a', 'name': 'A', 'unit': '1', 'unitPrice': 10, 'mrp': 10, 'quantity': 2, 'lineTotal': 20},
        {'product': 'b', 'name': 'B', 'unit': '1', 'unitPrice': 5, 'mrp': 5, 'quantity': 3, 'lineTotal': 15},
      ],
      'totals': {'itemTotal': 35, 'discount': 0, 'deliveryFee': 30, 'packagingFee': 10, 'tax': 2, 'grandTotal': 75},
      'warnings': [],
    });
    expect(c.count, 5);
    expect(c.qtyOf('b'), 3);
    expect(money(c.totals.grandTotal), '₹75');
  });
}
