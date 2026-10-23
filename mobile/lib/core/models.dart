// Plain data classes parsed from the VSR API.
typedef Json = Map<String, dynamic>;

DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v as String);
num _num(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;

class AppUser {
  AppUser({required this.id, required this.name, this.email, this.phone, this.avatar, required this.roles});
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? avatar;
  final List<String> roles;
  factory AppUser.fromJson(Json j) => AppUser(
        id: (j['id'] ?? j['_id']) as String,
        name: j['name'] as String,
        email: j['email'] as String?,
        phone: j['phone'] as String?,
        avatar: j['avatar'] as String?,
        roles: (j['roles'] as List? ?? const []).cast<String>(),
      );
}

class Category {
  Category({required this.id, required this.name, this.image, this.description, this.children = const []});
  final String id;
  final String name;
  final String? image;
  final String? description;
  final List<Category> children;
  factory Category.fromJson(Json j) => Category(
        id: j['_id'] as String,
        name: j['name'] as String,
        image: j['image'] as String?,
        description: j['description'] as String?,
        children: (j['children'] as List? ?? const []).map((e) => Category.fromJson(e as Json)).toList(),
      );
}

class Product {
  Product({
    required this.id,
    required this.name,
    required this.unit,
    required this.price,
    required this.mrp,
    required this.images,
    required this.available,
    required this.stockStatus,
    this.brand,
    this.description,
    this.shortDescription,
    this.rating = 0,
    this.reviewCount = 0,
    this.type = 'physical',
    this.badges = const [],
    this.allergens,
    this.categoryName,
    this.sku,
    this.returnable = true,
    this.returnWindowDays = 2,
    this.deliveryType = 'standard',
    this.prepTimeMins,
    this.variants = const [],
    this.status = 'active',
  });
  final String id;
  final String name;
  final String unit;
  final num price;
  final num mrp;
  final List<String> images;
  final num available;
  final String stockStatus;
  final String? brand;
  final String? description;
  final String? shortDescription;
  final num rating;
  final num reviewCount;
  final String type;
  final List<String> badges;
  final String? allergens;
  final String? categoryName;
  final String? sku;
  final bool returnable;
  final num returnWindowDays;
  final String deliveryType;
  final num? prepTimeMins;
  final List<Variant> variants;
  final String status;

  bool get unavailable => status != 'active';
  bool get hasSizes => variants.isNotEmpty;
  Variant? get defaultVariant => variants.isEmpty ? null : variants.firstWhere((v) => v.isDefault, orElse: () => variants.first);
  String? get image => images.isEmpty ? null : images.first;
  int get discountPct => mrp > price && mrp > 0 ? ((1 - price / mrp) * 100).round() : 0;
  bool get outOfStock => stockStatus == 'out_of_stock';

  factory Product.fromJson(Json j) => Product(
        id: j['_id'] as String,
        name: j['name'] as String,
        unit: (j['unit'] ?? '') as String,
        price: _num(j['price']),
        mrp: _num(j['mrp']),
        images: (j['images'] as List? ?? const []).map((e) => (e as Json)['url'] as String).toList(),
        available: _num(j['available']),
        stockStatus: (j['stockStatus'] ?? 'in_stock') as String,
        brand: j['brand'] as String?,
        description: j['description'] as String?,
        shortDescription: j['shortDescription'] as String?,
        rating: _num(j['rating']),
        reviewCount: _num(j['reviewCount']),
        type: (j['type'] ?? 'physical') as String,
        badges: (j['badges'] as List? ?? const []).cast<String>(),
        allergens: j['allergens'] as String?,
        categoryName: j['category'] is Map ? (j['category'] as Json)['name'] as String? : null,
        sku: j['sku'] as String?,
        returnable: (j['returnable'] ?? true) as bool,
        returnWindowDays: _num(j['returnWindowDays'] ?? 2),
        deliveryType: (j['deliveryType'] ?? 'standard') as String,
        prepTimeMins: j['prepTimeMins'] as num?,
        variants: (j['variants'] as List? ?? const []).map((e) => Variant.fromJson(e as Json)).toList(),
        status: (j['status'] ?? 'active') as String,
      );
}

class Variant {
  Variant({required this.id, required this.name, required this.price, required this.stock, this.reserved = 0, this.mrp, this.isDefault = false});
  final String id, name;
  final num price, stock, reserved;
  final num? mrp;
  final bool isDefault;
  num get available => (stock - reserved) < 0 ? 0 : stock - reserved;
  bool get outOfStock => available <= 0;
  factory Variant.fromJson(Json j) => Variant(
        id: (j['_id'] ?? '') as String,
        name: j['name'] as String,
        price: _num(j['price']),
        stock: _num(j['stock']),
        reserved: _num(j['reserved'] ?? 0),
        mrp: j['mrp'] as num?,
        isDefault: (j['isDefault'] ?? false) as bool,
      );
}

class Review {
  Review({required this.name, required this.rating, this.text, this.createdAt});
  final String name;
  final num rating;
  final String? text;
  final DateTime? createdAt;
  factory Review.fromJson(Json j) => Review(
        name: (j['customer'] is Map ? (j['customer'] as Json)['name'] : 'Customer') as String,
        rating: _num(j['rating']),
        text: j['text'] as String?,
        createdAt: _date(j['createdAt']),
      );
}

class BannerItem {
  BannerItem({required this.title, this.subtitle, this.buttonText, required this.image, this.linkValue});
  final String title;
  final String? subtitle;
  final String? buttonText;
  final String image;
  final String? linkValue;
  factory BannerItem.fromJson(Json j) => BannerItem(
        title: j['title'] as String,
        subtitle: j['subtitle'] as String?,
        buttonText: j['buttonText'] as String?,
        image: j['image'] as String,
        linkValue: j['linkValue'] as String?,
      );
}

/// One Home row; order, titles and visibility come from Admin → Home Screen.
/// key 'category' = admin-added row for one category / subcategory; its products come in [items].
typedef HomeSection = ({String key, String title, String? categoryId, List<Product> items});

const defaultHomeSections = <HomeSection>[
  (key: 'categories', title: 'Shop by Category', categoryId: null, items: <Product>[]),
  (key: 'recommended', title: 'Recommended for You', categoryId: null, items: <Product>[]),
  (key: 'deals', title: 'Today’s Deals', categoryId: null, items: <Product>[]),
  (key: 'bestSellers', title: 'Best Sellers', categoryId: null, items: <Product>[]),
  (key: 'recent', title: 'Recently Viewed', categoryId: null, items: <Product>[]),
];

class HomeData {
  HomeData({required this.banners, required this.categories, required this.bestSellers, required this.homemade, required this.deals, this.recommended = const [], this.sections = defaultHomeSections});
  final List<BannerItem> banners;
  final List<Category> categories;
  final List<Product> bestSellers;
  final List<Product> homemade;
  final List<Product> deals;
  /// Admin picks (+ best sellers) for guests; signed-in customers use /store/me/recommendations.
  final List<Product> recommended;
  final List<HomeSection> sections;
  factory HomeData.fromJson(Json j) => HomeData(
        banners: (j['banners'] as List).map((e) => BannerItem.fromJson(e as Json)).toList(),
        categories: (j['categories'] as List).map((e) => Category.fromJson(e as Json)).toList(),
        bestSellers: (j['bestSellers'] as List).map((e) => Product.fromJson(e as Json)).toList(),
        homemade: (j['homemade'] as List).map((e) => Product.fromJson(e as Json)).toList(),
        deals: (j['deals'] as List).map((e) => Product.fromJson(e as Json)).toList(),
        recommended: (j['recommended'] as List? ?? const []).map((e) => Product.fromJson(e as Json)).toList(),
        sections: j['sections'] is List
            ? (j['sections'] as List)
                .map((e) => (
                      key: (e as Json)['key'] as String,
                      title: e['title'] as String,
                      categoryId: e['categoryId'] as String?,
                      items: (e['items'] as List? ?? const []).map((p) => Product.fromJson(p as Json)).toList(),
                    ))
                .toList()
            : defaultHomeSections,
      );
}

class Totals {
  Totals({required this.itemTotal, required this.discount, this.couponCode, required this.deliveryFee, required this.packagingFee, required this.tax, required this.grandTotal});
  final num itemTotal, discount, deliveryFee, packagingFee, tax, grandTotal;
  final String? couponCode;
  factory Totals.fromJson(Json j) => Totals(
        itemTotal: _num(j['itemTotal']),
        discount: _num(j['discount']),
        couponCode: j['couponCode'] as String?,
        deliveryFee: _num(j['deliveryFee']),
        packagingFee: _num(j['packagingFee']),
        tax: _num(j['tax']),
        grandTotal: _num(j['grandTotal']),
      );
}

class LineItem {
  LineItem({required this.productId, required this.name, required this.unit, this.image, required this.unitPrice, required this.mrp, required this.quantity, required this.lineTotal, this.available, this.outOfStock = false, this.previousPrice, this.variantId, this.variantName});
  final String productId;
  final String name;
  final String unit;
  final String? image;
  final num unitPrice, mrp, lineTotal;
  final int quantity;
  final num? available;
  final bool outOfStock;
  final num? previousPrice;
  final String? variantId, variantName;
  String get key => '$productId:${variantId ?? ''}';
  bool get priceChanged => previousPrice != null && previousPrice != unitPrice;
  num get savings => mrp > unitPrice ? (mrp - unitPrice) * quantity : 0;
  factory LineItem.fromJson(Json j) => LineItem(
        productId: j['product'] as String,
        name: (j['name'] ?? '') as String,
        unit: (j['unit'] ?? '') as String,
        image: j['image'] as String?,
        unitPrice: _num(j['unitPrice']),
        mrp: _num(j['mrp']),
        quantity: _num(j['quantity']).toInt(),
        lineTotal: _num(j['lineTotal']),
        available: j['available'] == null ? null : _num(j['available']),
        outOfStock: (j['outOfStock'] ?? false) as bool,
        previousPrice: j['previousPrice'] as num?,
        variantId: j['variant'] as String?,
        variantName: j['variantName'] as String?,
      );
}

class CartView {
  CartView({required this.items, required this.totals, required this.warnings, this.couponCode});
  final List<LineItem> items;
  final Totals totals;
  final List<String> warnings;
  final String? couponCode;
  int get count => items.fold(0, (s, i) => s + i.quantity);
  int qtyOf(String productId, {String? variantId}) => items.where((i) => i.productId == productId && (variantId == null || i.variantId == variantId)).fold(0, (s, i) => s + i.quantity);
  factory CartView.fromJson(Json j) => CartView(
        items: (j['items'] as List).map((e) => LineItem.fromJson(e as Json)).toList(),
        totals: Totals.fromJson(j['totals'] as Json),
        warnings: (j['warnings'] as List? ?? const []).cast<String>(),
        couponCode: j['couponCode'] as String?,
      );
  static CartView empty() => CartView(items: const [], totals: Totals(itemTotal: 0, discount: 0, deliveryFee: 0, packagingFee: 0, tax: 0, grandTotal: 0), warnings: const []);
}

class Address {
  Address({required this.id, required this.label, required this.recipient, required this.phone, required this.line1, this.line2, this.landmark, required this.city, required this.state, required this.postalCode, this.isDefault = false, this.lat, this.lng});
  final String id, label, recipient, phone, line1, city, state, postalCode;
  final String? line2, landmark;
  final bool isDefault;
  final double? lat, lng;
  /// Short form for headers: area + city (skips flat numbers / map codes). Full address stays at checkout.
  String get shortLine {
    final area = (line2?.isNotEmpty ?? false) ? line2 : ((landmark?.isNotEmpty ?? false) ? landmark : null);
    final parts = [?area, if (city.isNotEmpty) city];
    return parts.isEmpty ? oneLine : parts.join(', ');
  }
  String get oneLine => [line1, if (landmark?.isNotEmpty ?? false) landmark, if (line2?.isNotEmpty ?? false) line2, '$city - $postalCode'].join(', ');
  factory Address.fromJson(Json j) => Address(
        id: (j['_id'] ?? '') as String,
        label: (j['label'] ?? 'Home') as String,
        recipient: (j['recipient'] ?? '') as String,
        phone: (j['phone'] ?? '') as String,
        line1: (j['line1'] ?? '') as String,
        line2: j['line2'] as String?,
        landmark: j['landmark'] as String?,
        city: (j['city'] ?? '') as String,
        state: (j['state'] ?? '') as String,
        postalCode: (j['postalCode'] ?? '') as String,
        isDefault: (j['isDefault'] ?? false) as bool,
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
      );
  Json toJson() => {'label': label, 'recipient': recipient, 'phone': phone, 'line1': line1, 'line2': line2, 'landmark': landmark, 'city': city, 'state': state, 'postalCode': postalCode, 'isDefault': isDefault, if (lat != null) 'lat': lat, if (lng != null) 'lng': lng};
}

class HistoryEntry {
  HistoryEntry({required this.to, required this.at, this.reason});
  final String to;
  final DateTime? at;
  final String? reason;
  factory HistoryEntry.fromJson(Json j) => HistoryEntry(to: j['to'] as String, at: _date(j['at']), reason: j['reason'] as String?);
}

class Partner {
  Partner({required this.name, this.phone, this.avatar, this.rating, this.deliveries});
  final String name;
  final String? phone, avatar;
  final num? rating, deliveries;
  factory Partner.fromJson(Json j) => Partner(name: j['name'] as String, phone: j['phone'] as String?, avatar: j['avatar'] as String?, rating: j['rating'] as num?, deliveries: j['deliveries'] as num?);
}

class OrderSummary {
  OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.items,
    required this.totals,
    required this.createdAt,
    this.address,
    this.history = const [],
    this.deliveryCode,
    this.partner,
    this.rating,
    this.rejectionReason,
  });
  final String id, orderNumber, status, paymentStatus, paymentMethod;
  final List<LineItem> items;
  final Totals totals;
  final DateTime? createdAt;
  final Address? address;
  final List<HistoryEntry> history;
  final String? deliveryCode;
  final Partner? partner;
  final num? rating;
  final String? rejectionReason;

  bool get isActive => const ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'].contains(status);
  bool get canCancel => status == 'placed';

  factory OrderSummary.fromJson(Json j) => OrderSummary(
        id: j['_id'] as String,
        orderNumber: j['orderNumber'] as String,
        status: j['status'] as String,
        paymentStatus: (j['paymentStatus'] ?? 'pending') as String,
        paymentMethod: (j['paymentMethod'] ?? 'cod') as String,
        items: (j['items'] as List).map((e) => LineItem.fromJson(e as Json)).toList(),
        totals: Totals.fromJson(j['totals'] as Json),
        createdAt: _date(j['createdAt']),
        address: j['address'] is Map ? Address.fromJson(j['address'] as Json) : null,
        history: (j['history'] as List? ?? const []).map((e) => HistoryEntry.fromJson(e as Json)).toList(),
        deliveryCode: j['deliveryCode'] as String?,
        partner: j['deliveryPartner'] is Map ? Partner.fromJson(j['deliveryPartner'] as Json) : null,
        rating: j['rating'] as num?,
        rejectionReason: j['rejectionReason'] as String?,
      );
}

class AppNotification {
  AppNotification({required this.id, required this.title, required this.body, required this.kind, required this.read, this.createdAt, this.link});
  final String id, title, body, kind;
  /// In-app destination, e.g. `/product/{id}` for "Back in stock".
  final String? link;
  final bool read;
  final DateTime? createdAt;
  factory AppNotification.fromJson(Json j) => AppNotification(
        id: j['_id'] as String,
        title: j['title'] as String,
        body: (j['body'] ?? '') as String,
        kind: (j['kind'] ?? 'system') as String,
        read: (j['read'] ?? false) as bool,
        createdAt: _date(j['createdAt']),
        link: j['link'] as String?,
      );
}

class Ticket {
  Ticket({required this.id, required this.number, required this.subject, required this.status, this.createdAt});
  final String id, number, subject, status;
  final DateTime? createdAt;
  factory Ticket.fromJson(Json j) => Ticket(id: j['_id'] as String, number: j['ticketNumber'] as String, subject: j['subject'] as String, status: j['status'] as String, createdAt: _date(j['createdAt']));
}


class Kitchen {
  Kitchen({required this.id, required this.name, this.chef, this.image, this.area, this.openingHours, this.rating = 0, this.status = 'active', this.verified = false, this.bio});
  final String id, name, status;
  final String? chef, image, area, openingHours, bio;
  final num rating;
  final bool verified;
  bool get paused => status != 'active';

  /// Parses "11:00 AM – 9:00 PM" style hours; null when unknown.
  bool? get openNow {
    final h = openingHours;
    if (h == null) return null;
    final parts = h.split(RegExp(r'\s*[–-]\s*'));
    if (parts.length != 2) return null;
    int? mins(String s) {
      final m = RegExp(r'(\d{1,2}):(\d{2})\s*(AM|PM)', caseSensitive: false).firstMatch(s);
      if (m == null) return null;
      var hh = int.parse(m.group(1)!) % 12;
      if (m.group(3)!.toUpperCase() == 'PM') hh += 12;
      return hh * 60 + int.parse(m.group(2)!);
    }
    final a = mins(parts[0]), b = mins(parts[1]);
    if (a == null || b == null) return null;
    final now = DateTime.now().hour * 60 + DateTime.now().minute;
    return now >= a && now <= b;
  }

  factory Kitchen.fromJson(Json j) => Kitchen(
        id: j['_id'] as String,
        name: j['name'] as String,
        chef: j['chef'] as String?,
        image: j['image'] as String?,
        area: j['area'] as String?,
        openingHours: j['openingHours'] as String?,
        rating: _num(j['rating']),
        status: (j['status'] ?? 'active') as String,
        verified: j['verification'] == 'verified',
        bio: j['bio'] as String?,
      );
}

class TicketMessage {
  TicketMessage({required this.from, required this.text, this.author, this.at});
  final String from, text;
  final String? author;
  final DateTime? at;
  bool get mine => from == 'customer';
  factory TicketMessage.fromJson(Json j) => TicketMessage(
        from: (j['from'] ?? 'agent') as String,
        text: (j['text'] ?? '') as String,
        author: j['author'] is Map ? (j['author'] as Json)['name'] as String? : null,
        at: _date(j['at']),
      );
}

class TicketDetail {
  TicketDetail({required this.id, required this.number, required this.subject, required this.status, required this.issueType, required this.messages, required this.attachments, this.orderNumber, this.createdAt, this.isReturn = false, this.returnItems = const []});
  final String id, number, subject, status, issueType;
  final List<TicketMessage> messages;
  final List<String> attachments;
  final String? orderNumber;
  final DateTime? createdAt;
  final bool isReturn;
  final List<(String, int)> returnItems;
  factory TicketDetail.fromJson(Json j) => TicketDetail(
        id: j['_id'] as String,
        number: j['ticketNumber'] as String,
        subject: j['subject'] as String,
        status: j['status'] as String,
        issueType: (j['issueType'] ?? 'other') as String,
        messages: (j['messages'] as List? ?? const []).map((e) => TicketMessage.fromJson(e as Json)).toList(),
        attachments: (j['attachments'] as List? ?? const []).cast<String>(),
        orderNumber: j['order'] is Map ? (j['order'] as Json)['orderNumber'] as String? : null,
        createdAt: _date(j['createdAt']),
        isReturn: (j['isReturn'] ?? false) as bool,
        returnItems: (j['returnItems'] as List? ?? const []).map((e) => ((e as Json)['name'] as String? ?? 'Item', _num(e['quantity']).toInt())).toList(),
      );
}
