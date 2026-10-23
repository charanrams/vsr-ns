import 'package:flutter_test/flutter_test.dart';
import 'package:vsr_customer/core/models.dart';

void main() {
  test('product with sizes exposes default size and per-size availability', () {
    final p = Product.fromJson({
      '_id': 'p1', 'name': 'Fresh Tomatoes', 'unit': '500 g', 'price': 49, 'mrp': 60, 'images': [], 'available': 395, 'stockStatus': 'in_stock',
      'variants': [
        {'_id': 'v1', 'name': '500 g', 'price': 49, 'stock': 250, 'reserved': 5, 'isDefault': true},
        {'_id': 'v2', 'name': '1 kg', 'price': 90, 'stock': 0, 'reserved': 0},
      ],
    });
    expect(p.hasSizes, isTrue);
    expect(p.defaultVariant!.id, 'v1');
    expect(p.variants[0].available, 245);
    expect(p.variants[1].outOfStock, isTrue);
  });

  test('cart counts quantity per size and keys lines by product + size', () {
    final c = CartView.fromJson({
      'items': [
        {'product': 'p1', 'variant': 'v1', 'variantName': '500 g', 'name': 'T', 'unit': '500 g', 'unitPrice': 49, 'mrp': 60, 'quantity': 2, 'lineTotal': 98},
        {'product': 'p1', 'variant': 'v2', 'variantName': '1 kg', 'name': 'T', 'unit': '1 kg', 'unitPrice': 90, 'mrp': 90, 'quantity': 1, 'lineTotal': 90},
      ],
      'totals': {'itemTotal': 188, 'discount': 0, 'deliveryFee': 30, 'packagingFee': 10, 'tax': 9, 'grandTotal': 228},
      'warnings': [],
    });
    expect(c.qtyOf('p1'), 3);
    expect(c.qtyOf('p1', variantId: 'v2'), 1);
    expect(c.items.map((i) => i.key).toSet().length, 2);
  });
}
