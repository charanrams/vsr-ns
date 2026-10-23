/* eslint-disable no-console */
import mongoose, { Types } from 'mongoose';
import { User, Session, Otp } from './models/User';
import { Category, Product, InventoryMovement, Review } from './models/Catalog';
import { Order, Payment, Refund, Cart, Counter, OrderState } from './models/Order';
import { DeliveryPartner, Banner, Coupon, SupportTicket, Notification, AuditLog, Kitchen } from './models/Ops';
import { hashPassword, sha256 } from './utils/security';
import { env } from './config/env';
import { RESERVED_STATES } from './utils/orders';

const img = (id: string) => `https://images.unsplash.com/${id}?w=600&q=70&auto=format&fit=crop`;
const avatar = (g: 'men' | 'women', n: number) => `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

/** Staff accounts — email decides the role, and the role decides where the portal redirects. */
export const SEED_STAFF = [
  { name: 'Admin', email: 'superadmin@vsr.in', roles: ['super_admin'], avatar: avatar('women', 44) },
  { name: 'Ramesh Rao', email: 'orders@vsr.in', roles: ['order_manager'], avatar: avatar('men', 32) },
  { name: 'Kavya Menon', email: 'catalogue@vsr.in', roles: ['catalogue_manager'], avatar: avatar('women', 65) },
  { name: 'Vikram Shetty', email: 'inventory@vsr.in', roles: ['inventory_manager'], avatar: avatar('men', 45) },
  { name: 'Anita Desai', email: 'finance@vsr.in', roles: ['finance_manager'], avatar: avatar('women', 21) },
  { name: 'Lokesh Reddy', email: 'support@vsr.in', roles: ['support_agent'], avatar: avatar('men', 52) },
] as const;

const CATS: { name: string; desc: string; image: string; subs: [string, string, string][] }[] = [
  { name: 'Groceries', desc: 'Fresh vegetables, fruits, grains and everyday essentials.', image: img('photo-1542838132-92c53300491e'), subs: [['Fresh Vegetables', 'Leafy and seasonal vegetables.', img('photo-1540420773420-3366772f4999')], ['Fruits', 'Fresh and seasonal fruits.', img('photo-1619566636858-adf3ef46400b')], ['Rice & Grains', 'Rice, wheat, dals and grains.', img('photo-1586201375761-83865001e31c')], ['Oils & Ghee', 'Cooking oils, ghee and healthy fats.', img('photo-1474979266404-7eaacbcd87c5')], ['Snacks & Beverages', 'Snacks, biscuits, tea, coffee and drinks.', img('photo-1621939514649-280e2ee25f60')]] },
  { name: 'Dairy & Eggs', desc: 'Milk, curd, paneer, butter and farm eggs.', image: img('photo-1563636619-e9143da7973b'), subs: [['Milk', 'Toned, full cream and organic milk.', img('photo-1563636619-e9143da7973b')], ['Eggs', 'Farm fresh eggs.', img('photo-1582722872445-44dc5f7e3c8f')]] },
  { name: 'Homemade Food', desc: 'Home-cooked meals and snacks prepared with love.', image: img('photo-1563379091339-03b21ab4a4f8'), subs: [['Meals', 'Biryanis, curries and thalis.', img('photo-1563379091339-03b21ab4a4f8')], ['Sweets & Snacks', 'Laddoos, murukku and more.', img('photo-1601050690597-df0568f70950')]] },
  { name: 'Bakery', desc: 'Breads, buns and baked goods.', image: img('photo-1509440159596-0249088772ff'), subs: [] },
  { name: 'Home & Kitchen', desc: 'Kitchen appliances, utensils and essentials.', image: img('photo-1556909114-f6e7ad7d3136'), subs: [['Household', 'Cleaning and laundry.', img('photo-1585421514738-01798e348b17')]] },
  { name: 'Personal Care', desc: 'Skin, hair and hygiene essentials.', image: img('photo-1556228578-8c89e6adf883'), subs: [] },
  { name: 'Electronics', desc: 'Smart gadgets and electronic devices.', image: img('photo-1505740420928-5e560c06d30e'), subs: [] },
  { name: 'Fashion', desc: 'Men, women and kids fashion wear.', image: img('photo-1521572163474-6864f9cf17ab'), subs: [] },
];

// name, category/sub, brand, unit, mrp, price, stock, threshold, image, type
type P = [string, string, string, string, number, number, number, number, string, ('physical' | 'homemade')?];
const PRODUCTS: P[] = [
  ['Fresh Tomatoes', 'Fresh Vegetables', 'Local Farms', '500 g', 60, 49, 260, 20, 'photo-1546094096-0df4bcaaa337'],
  ['Onions', 'Fresh Vegetables', 'Local Farms', '1 kg', 36, 28, 300, 25, 'photo-1618512496248-a07fe83aa8cb'],
  ['Potatoes', 'Fresh Vegetables', 'Local Farms', '1 kg', 32, 26, 280, 25, 'photo-1518977676601-b53f82aba655'],
  ['Carrots', 'Fresh Vegetables', 'Local Farms', '500 g', 30, 24, 150, 15, 'photo-1598170845058-32b9d6a5da37'],
  ['Spinach', 'Fresh Vegetables', 'Green Valley', '250 g', 25, 20, 9, 15, 'photo-1576045057995-568f588f82fb'],
  ['Bananas', 'Fruits', 'Local Farms', '1 dozen', 70, 58, 120, 20, 'photo-1571771894821-ce9b6c11b08e'],
  ['Apples (Shimla)', 'Fruits', 'Himalayan Orchards', '1 kg', 220, 189, 80, 15, 'photo-1560806887-1e4cd0b6cbd6'],
  ['Organic Rice', 'Rice & Grains', "Nature's Best", '1 kg', 140, 120, 125, 20, 'photo-1586201375761-83865001e31c'],
  ['Basmati Rice', 'Rice & Grains', 'India Gate', '5 kg', 650, 579, 5, 10, 'photo-1516684732162-798a0062be99'],
  ['Toor Dal', 'Rice & Grains', 'Tata Sampann', '1 kg', 180, 159, 4, 10, 'photo-1585996177220-bf5bbcd6a4b4'],
  ['Aashirvaad Atta', 'Rice & Grains', 'Aashirvaad', '5 kg', 310, 275, 18, 20, 'photo-1574323347407-f5e1ad6d020b'],
  ['Sunpure Sunflower Oil', 'Oils & Ghee', 'Sunpure', '1 L', 210, 189, 13, 15, 'photo-1474979266404-7eaacbcd87c5'],
  ['Cow Ghee', 'Oils & Ghee', 'Amul', '500 ml', 340, 315, 60, 10, 'photo-1631209121750-a9f656d30a6b'],
  ['Masala Chai Tea', 'Snacks & Beverages', 'Tata Tea', '500 g', 280, 249, 70, 10, 'photo-1597318181409-cf64d0b5d8a2'],
  ['Coffee Powder', 'Snacks & Beverages', 'Bru', '200 g', 190, 172, 0, 10, 'photo-1559056199-641a0ac8b55e'],
  ['Toned Milk', 'Milk', 'Amul', '1 L', 70, 62, 45, 10, 'photo-1563636619-e9143da7973b'],
  ['Fresh Eggs (12 pcs)', 'Eggs', 'Nandini', '12 pcs', 85, 72, 0, 10, 'photo-1582722872445-44dc5f7e3c8f'],
  ['Brown Bread', 'Bakery', 'Britannia', '400 g', 55, 45, 68, 10, 'photo-1509440159596-0249088772ff'],
  ['Herbal Shampoo', 'Personal Care', 'Dove', '400 ml', 180, 149, 37, 15, 'photo-1631729371254-42c2892f0e6e'],
  ['Aloe Face Wash', 'Personal Care', 'Himalaya', '150 ml', 199, 169, 54, 10, 'photo-1556228578-8c89e6adf883'],
  ['Wireless Headphones', 'Electronics', 'boAt', '1 pc', 3499, 2499, 16, 15, 'photo-1505740420928-5e560c06d30e'],
  ['LED Bulb (9W)', 'Electronics', 'Philips', '1 pc', 120, 99, 0, 10, 'photo-1532007271951-c487760934ae'],
  ["Men's Cotton T-Shirt", 'Fashion', "Levi's", 'M', 1299, 799, 0, 5, 'photo-1521572163474-6864f9cf17ab'],
  ['Detergent Powder', 'Household', 'Tide', '1 kg', 120, 99, 20, 10, 'photo-1585421514738-01798e348b17'],
  ['Steel Water Bottle', 'Home & Kitchen', 'Milton', '1 L', 650, 499, 40, 10, 'photo-1602143407151-7111542de6e8'],
  ['Hyderabadi Chicken Biryani', 'Meals', 'Amma’s Kitchen', '1 plate', 320, 279, 30, 5, 'photo-1563379091339-03b21ab4a4f8', 'homemade'],
  ['Veg Thali', 'Meals', 'Annapurna Home Foods', '1 thali', 220, 189, 25, 5, 'photo-1546833999-b9f581a1996d', 'homemade'],
  ['Paneer Butter Masala', 'Meals', 'Amma’s Kitchen', '500 g', 260, 229, 20, 5, 'photo-1631452180519-c014fe946bc7', 'homemade'],
  ['Besan Laddoo', 'Sweets & Snacks', 'Nani’s Sweets', '250 g', 220, 199, 40, 5, 'photo-1601050690597-df0568f70950', 'homemade'],
  ['Organic Honey', 'Snacks & Beverages', 'Dabur', '250 g', 260, 229, 50, 10, 'photo-1587049352846-4a222e784d38'],
];

const FIRST = [['Priya Sharma', 'women', 44], ['Ravi Kumar', 'men', 32], ['Anil Reddy', 'men', 11], ['Sneha Patel', 'women', 68], ['Karthik Verma', 'men', 76], ['Meera Iyer', 'women', 33], ['Suresh Babu', 'men', 85], ['Pooja Nair', 'women', 90], ['Amit Verma', 'men', 22], ['Sneha Iyer', 'women', 12], ['Karthik Reddy', 'men', 61], ['Nithya Verma', 'women', 57], ['Ajay Mehta', 'men', 41], ['Lokesh Rao', 'men', 3], ['Nandini Rao', 'women', 26], ['Suresh Reddy', 'men', 15], ['Divya Menon', 'women', 8], ['Rahul Gupta', 'men', 67], ['Lakshmi Devi', 'women', 79], ['Arjun Das', 'men', 29]] as const;
const AREAS: [string, string][] = [['Miyapur', '500049'], ['Hyderabad', '500034'], ['Secunderabad', '500003'], ['Kukatpally', '500072'], ['Gachibowli', '500032'], ['Madhapur', '500081'], ['Ameerpet', '500016'], ['Banjara Hills', '500034']];

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

export async function runSeed() {
  console.log('[seed] seeding database…');
  await Promise.all([User, Session, Otp, Category, Product, InventoryMovement, Review, Order, Payment, Refund, Cart, Counter, DeliveryPartner, Banner, Coupon, SupportTicket, Notification, AuditLog, Kitchen].map((m) => (m as typeof User).deleteMany({})));

  const pw = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const staff = await User.insertMany(SEED_STAFF.map((s) => ({ ...s, roles: [...s.roles], passwordHash: pw, emailVerified: true })));
  const superAdmin = staff[0];

  const customerPw = await hashPassword('Customer@123');
  const customers = await User.insertMany(
    FIRST.map(([name, g, n], i) => {
      const [area, pin] = AREAS[i % AREAS.length];
      const email = i === 0 ? 'priya@gmail.com' : `${name.split(' ')[0].toLowerCase()}${i}@gmail.com`;
      return {
        name,
        email,
        phone: `+9198765432${String(10 + i).padStart(2, '0')}`,
        passwordHash: customerPw,
        roles: ['customer'],
        avatar: avatar(g, n),
        emailVerified: true,
        status: i === 5 ? 'inactive' : 'active',
        tags: i === 0 ? ['VIP'] : [],
        createdAt: new Date(Date.now() - (180 - i * 8) * 864e5),
        addresses: [
          { label: 'Home', recipient: name, phone: `+9198765432${String(10 + i).padStart(2, '0')}`, line1: `Flat No. ${200 + i}, Sai Residency`, line2: area, landmark: 'Near D-Mart', city: 'Hyderabad', state: 'Telangana', postalCode: pin, isDefault: true },
          ...(i < 3 ? [{ label: 'Work', recipient: name, phone: `+9198765432${String(10 + i).padStart(2, '0')}`, line1: 'VSR Tech Park, HITEC City', line2: 'Madhapur', city: 'Hyderabad', state: 'Telangana', postalCode: '500081' }, { label: 'Other', recipient: name, phone: `+9198765432${String(10 + i).padStart(2, '0')}`, line1: 'Plot No. 45, Madhapur', line2: 'Madhapur', city: 'Hyderabad', state: 'Telangana', postalCode: '500081' }] : []),
        ],
        notes: i === 0 ? [{ text: 'Prefers organic products and home-made food. Regular customer.', by: superAdmin._id }] : [],
      };
    }),
  );

  // Categories
  const catByName = new Map<string, Types.ObjectId>();
  const parentOf = new Map<string, Types.ObjectId>();
  for (const [i, c] of CATS.entries()) {
    const parent = await Category.create({ name: c.name, slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: c.desc, image: c.image, sortOrder: i + 1 });
    catByName.set(c.name, parent._id);
    for (const [j, [sn, sd, si]] of c.subs.entries()) {
      const sub = await Category.create({ name: sn, slug: sn.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: sd, image: si, parent: parent._id, sortOrder: j + 1 });
      catByName.set(sn, sub._id);
      parentOf.set(sn, parent._id);
    }
  }

  // Products
  const products = await Product.insertMany(
    PRODUCTS.map(([name, cat, brand, unit, mrp, price, stock, threshold, image, type], i) => {
      const isSub = parentOf.has(cat);
      const code = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      return {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sku: `VSR-${code}-${String(i + 1).padStart(3, '0')}`,
        brand,
        unit,
        type: type ?? 'physical',
        category: isSub ? parentOf.get(cat) : catByName.get(cat),
        subcategory: isSub ? catByName.get(cat) : undefined,
        shortDescription: `${name} from ${brand}. Quality checked and delivered fresh.`,
        description: `${name} (${unit}) sourced from ${brand}. Handpicked and packed with care for everyday use.`,
        images: [{ url: img(image) }],
        mrp,
        price,
        taxRate: type === 'homemade' ? 5 : cat === 'Electronics' || cat === 'Fashion' ? 18 : 5,
        stock: { onHand: stock, reserved: 0, threshold },
        tags: [cat.toLowerCase(), brand.toLowerCase()],
        badges: i % 4 === 0 ? ['Best Seller'] : i % 5 === 0 ? ['New Arrival'] : [],
        variants: name === 'Fresh Tomatoes' ? [{ name: '500 g', sku: 'VSR-TOM-001-500', price: 49, stock: 250, isDefault: true }, { name: '1 kg', sku: 'VSR-TOM-001-1KG', price: 90, stock: 150 }] : [],
        rating: Math.round((4 + rand()) * 10) / 10,
        reviewCount: int(40, 1300),
        allergens: type === 'homemade' ? 'May contain dairy, nuts and gluten.' : undefined,
        createdAt: new Date(Date.now() - (60 - i) * 864e5),
      };
    }),
  );
  await InventoryMovement.insertMany(products.map((p) => ({ product: p._id, delta: p.stock.onHand, reason: 'initial', actor: staff[3]._id, createdAt: p.get('createdAt') })));

  // Delivery partners
  const partners = await DeliveryPartner.insertMany(
    [['Ramesh T', 'men', 75, 'online', 2.1, 320, 4.8], ['Karthik R', 'men', 36, 'online', 3.4, 180, 4.6], ['Sahid M', 'men', 18, 'online', 4.2, 142, 4.5], ['Ravi Kumar', 'men', 50, 'on_delivery', 1.8, 500, 4.8], ['Mahesh P', 'men', 9, 'online', 5.0, 95, 4.4], ['Imran K', 'men', 64, 'offline', 6.2, 210, 4.7]].map(
      ([name, g, n, availability, distanceKm, deliveries, rating]) => ({ name, phone: `+91900000${int(1000, 9999)}`, avatar: avatar(g as 'men', n as number), vehicle: 'Bike', serviceArea: 'Hyderabad West', availability, distanceKm, deliveries, rating, kycStatus: 'verified' }),
    ),
  );

  // Orders over the last 30 days
  const coupons = await Coupon.insertMany([
    { code: 'WELCOME10', name: 'Welcome offer', type: 'percent', value: 10, maxDiscount: 100, minOrder: 299, usageLimit: 500, used: 124, startDate: new Date(Date.now() - 20 * 864e5), endDate: new Date(Date.now() + 10 * 864e5) },
    { code: 'FREESHIP', name: 'Free delivery', type: 'free_delivery', value: 0, minOrder: 399, usageLimit: 300, used: 86, startDate: new Date(Date.now() - 10 * 864e5), endDate: new Date(Date.now() + 6 * 864e5) },
    { code: 'FESTIVE50', name: 'Festive sale', type: 'percent', value: 50, maxDiscount: 200, minOrder: 499, usageLimit: 200, used: 42, startDate: new Date(Date.now() + 2 * 864e5), endDate: new Date(Date.now() + 12 * 864e5) },
    { code: 'FLAT75', name: 'Flat ₹75 off', type: 'flat', value: 75, minOrder: 599, usageLimit: 400, used: 61, endDate: new Date(Date.now() + 30 * 864e5) },
  ]);

  const flows: OrderState[][] = [
    ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivered'],
  ];
  const statusPool: OrderState[] = ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'out_for_delivery', 'picking', 'confirmed', 'packed', 'cancelled', 'placed', 'assigned', 'rejected', 'delivered'];
  const methods = ['upi', 'upi', 'card', 'cod', 'wallet', 'netbanking', 'upi', 'card'] as const;
  const orders = [];
  const payments = [];
  let seq = 0;
  const now = Date.now();
  const sellable = products.filter((p) => p.stock.onHand > 20);
  for (let d = 30; d >= 0; d--) {
    const perDay = d === 0 ? 8 : int(2, 6);
    for (let k = 0; k < perDay; k++) {
      seq++;
      const created = new Date(now - d * 864e5 - int(1, 10) * 3600e3 - int(0, 59) * 60e3);
      if (created.getTime() > now) created.setTime(now - 60e3 * (k + 1));
      const customer = d === 0 && k === 0 ? customers[1] : pick(customers);
      const lines = Array.from({ length: int(1, 4) }, () => pick(sellable)).filter((p, i, a) => a.indexOf(p) === i);
      const items = lines.map((p) => {
        const q = int(1, 3);
        return { product: p._id, name: p.name, sku: p.sku, unit: p.unit, image: p.images[0]?.url, mrp: p.mrp, unitPrice: p.price, quantity: q, lineTotal: p.price * q };
      });
      const itemTotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const useCoupon = rand() < 0.25 && itemTotal >= 299;
      const discount = useCoupon ? Math.min(100, Math.round(itemTotal * 0.1)) : 0;
      const deliveryFee = itemTotal >= 499 ? 0 : 30;
      const totals = { itemTotal, discount, couponCode: useCoupon ? 'WELCOME10' : undefined, deliveryFee, packagingFee: 10, tax: Math.round(itemTotal * 0.05 / 1.05), grandTotal: itemTotal - discount + deliveryFee + 10 };
      let status: OrderState = d > 3 ? (rand() < 0.88 ? 'delivered' : pick(['cancelled', 'rejected'] as OrderState[])) : pick(statusPool);
      if (d === 0 && k < 3) status = 'placed';
      const method = pick(methods);
      const path = flows[0];
      const history: { from: string | null; to: string; actorRole: string; at: Date; actor?: Types.ObjectId; reason?: string }[] = [];
      let t = created.getTime();
      if (status === 'cancelled' || status === 'rejected') {
        history.push({ from: null, to: 'placed', actorRole: 'customer', at: new Date(t), actor: customer._id });
        history.push({ from: 'placed', to: status, actorRole: status === 'rejected' ? 'order_manager' : 'customer', at: new Date(t + 20 * 60e3), actor: status === 'rejected' ? staff[1]._id : customer._id, reason: status === 'rejected' ? 'Item unavailable in service area' : 'Ordered by mistake' });
      } else {
        for (let i = 0; i <= path.indexOf(status); i++) {
          history.push({ from: i ? path[i - 1] : null, to: path[i], actorRole: i === 0 ? 'customer' : 'order_manager', at: new Date(t), actor: i === 0 ? customer._id : staff[1]._id });
          t += int(10, 40) * 60e3;
        }
      }
      const paid = method !== 'cod' ? status !== 'placed' || rand() < 0.9 : status === 'delivered';
      let paymentStatus = paid ? 'paid' : 'pending';
      if (status === 'rejected' && method !== 'cod') paymentStatus = 'refund_pending';
      if (status === 'cancelled' && method !== 'cod') paymentStatus = 'refunded';
      const addr = JSON.parse(JSON.stringify(customer.addresses[0]));
      const partner = ['assigned', 'out_for_delivery', 'delivered'].includes(status) ? pick(partners) : undefined;
      const dateKey = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}`;
      orders.push({
        _id: new Types.ObjectId(),
        orderNumber: `VSR${dateKey}-${String(seq).padStart(5, '0')}`,
        customer: customer._id,
        items,
        address: addr,
        instructions: k % 3 === 0 ? 'Call before delivery. Use main gate.' : undefined,
        totals,
        paymentMethod: method,
        paymentStatus,
        status,
        deliveryPartner: partner?._id,
        history,
        rejectionReason: status === 'rejected' ? 'Item unavailable in service area' : undefined,
        cancelReason: status === 'cancelled' ? 'Ordered by mistake' : undefined,
        deliveredAt: status === 'delivered' ? new Date(t) : undefined,
        rating: status === 'delivered' && rand() < 0.6 ? int(4, 5) : undefined,
        deliveryOtp: status === 'out_for_delivery' ? { codeHash: sha256('123456'), plain: '123456', expiresAt: new Date(now + 6 * 3600e3), attempts: 0 } : undefined,
        createdAt: created,
        updatedAt: new Date(t),
      });
    }
  }
  // Make the newest "placed" order match the reference: Ravi Kumar, 3 items incl. a low-stock line
  const hero = orders.filter((o) => o.status === 'placed').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (hero) {
    const [tom, rice, oil] = ['Fresh Tomatoes', 'Organic Rice', 'Sunpure Sunflower Oil'].map((n) => products.find((p) => p.name === n)!);
    hero.customer = customers[1]._id;
    hero.address = JSON.parse(JSON.stringify(customers[1].addresses[0]));
    hero.instructions = 'Call before delivery. Use main gate.';
    hero.items = [
      { product: tom._id, name: tom.name, sku: tom.sku, unit: tom.unit, image: tom.images[0].url, mrp: tom.mrp, unitPrice: tom.price, quantity: 2, lineTotal: tom.price * 2 },
      { product: rice._id, name: rice.name, sku: rice.sku, unit: rice.unit, image: rice.images[0].url, mrp: rice.mrp, unitPrice: rice.price, quantity: 1, lineTotal: rice.price },
      { product: oil._id, name: oil.name, sku: oil.sku, unit: oil.unit, image: oil.images[0].url, mrp: oil.mrp, unitPrice: oil.price, quantity: 1, lineTotal: oil.price },
    ];
    const it = hero.items.reduce((s, i) => s + i.lineTotal, 0);
    hero.totals = { itemTotal: it, discount: 40, couponCode: 'WELCOME10', deliveryFee: 0, packagingFee: 10, tax: Math.round((it * 0.05) / 1.05), grandTotal: it - 40 + 10 };
    hero.paymentMethod = 'upi';
    hero.paymentStatus = 'paid';
    hero.history[0].actor = customers[1]._id;
  }
  await Order.insertMany(orders);
  await Counter.create({ _id: `order-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, seq: seq + 1 });

  // Stock effects of seeded orders
  for (const o of orders) {
    for (const i of o.items) {
      if (RESERVED_STATES.includes(o.status)) await Product.updateOne({ _id: i.product }, { $inc: { 'stock.reserved': i.quantity } });
      if (o.status === 'delivered') await Product.updateOne({ _id: i.product }, { $inc: { soldCount: i.quantity } });
    }
  }

  for (const o of orders) {
    const ps = o.paymentStatus === 'refund_pending' ? 'refund_pending' : o.paymentStatus === 'refunded' ? 'refunded' : o.paymentStatus === 'paid' ? 'paid' : rand() < 0.1 && o.paymentMethod !== 'cod' ? 'failed' : 'pending';
    const isRzp = o.paymentMethod !== 'cod';
    const pref = { upi: 'PAY', card: 'CH', wallet: 'WAL', netbanking: 'NB', cod: 'COD' }[o.paymentMethod];
    payments.push({
      order: o._id,
      customer: o.customer,
      provider: isRzp ? 'razorpay' : 'cod',
      method: o.paymentMethod,
      providerOrderId: isRzp ? `order_${o._id.toString().slice(-12)}` : undefined,
      providerPaymentId: isRzp && ps !== 'pending' ? `${pref}_${o._id.toString().slice(-14)}` : undefined,
      amount: o.totals.grandTotal,
      status: ps,
      verifiedAt: ps === 'paid' ? o.createdAt : undefined,
      logs: [{ event: 'Payment initiated', at: o.createdAt }, ...(ps === 'paid' ? [{ event: 'Payment verified', at: o.createdAt }] : []), ...(ps === 'failed' ? [{ event: 'Payment failed', at: o.createdAt }] : [])],
      createdAt: o.createdAt,
    });
  }
  const insertedPayments = await Payment.insertMany(payments);
  for (const p of insertedPayments.filter((x) => x.status === 'refund_pending' || x.status === 'refunded')) {
    await Refund.create({ payment: p._id, order: p.order, amount: p.amount, reason: 'Order rejected/cancelled', status: p.status === 'refunded' ? 'processed' : 'pending' });
  }

  // Reviews on delivered orders
  const reviewTexts = ['Great quality products and fast delivery!', 'Very fresh, will order again.', 'Good packaging and on-time delivery.', 'Tasty and homely, loved it.'];
  const reviewDocs = orders.filter((o) => o.rating).slice(0, 40).flatMap((o) => o.items.slice(0, 1).map((i) => ({ product: i.product, order: o._id, customer: o.customer, rating: o.rating!, text: pick(reviewTexts), createdAt: o.deliveredAt })));
  await Review.insertMany(reviewDocs);

  // Banners
  await Banner.insertMany([
    { title: 'Fresh & Organic Vegetables', subtitle: 'Farm Fresh | Naturally Grown | Healthy Living', buttonText: 'Shop Now', linkType: 'category', linkValue: 'Groceries', image: img('photo-1540420773420-3366772f4999'), position: 'homepage', priority: 1, startDate: new Date(now - 2 * 864e5), endDate: new Date(now + 12 * 864e5) },
    { title: 'Homemade Food With Love', subtitle: 'Home-cooked meals from verified kitchens', buttonText: 'Order Now', linkType: 'category', linkValue: 'Homemade Food', image: img('photo-1563379091339-03b21ab4a4f8'), position: 'homepage', priority: 2, startDate: new Date(now - 6 * 864e5), endDate: new Date(now + 11 * 864e5) },
    { title: 'Mega Discounts', subtitle: 'Up to 50% off on daily essentials', buttonText: 'Grab Deals', linkType: 'offer', image: img('photo-1542838132-92c53300491e'), position: 'category', priority: 1, startDate: new Date(now - 9 * 864e5), endDate: new Date(now + 6 * 864e5) },
    { title: 'Healthy Snacks', subtitle: 'Guilt-free munching', buttonText: 'Explore', linkType: 'category', image: img('photo-1621939514649-280e2ee25f60'), position: 'app', priority: 1, startDate: new Date(now + 3 * 864e5), endDate: new Date(now + 20 * 864e5) },
    { title: 'Kitchen Essentials', subtitle: 'Upgrade your kitchen', buttonText: 'Shop', linkType: 'category', image: img('photo-1556909114-f6e7ad7d3136'), position: 'category', priority: 2, status: 'inactive', startDate: new Date(now - 20 * 864e5), endDate: new Date(now + 10 * 864e5) },
  ]);

  await Kitchen.insertMany([
    { name: 'Amma’s Kitchen', chef: 'Lakshmi Amma', image: img('photo-1556910103-1c02745aae4d'), area: 'Miyapur', openingHours: '11:00 AM – 9:00 PM', rating: 4.8 },
    { name: 'Annapurna Home Foods', chef: 'Savitri Devi', image: img('photo-1556911220-bff31c812dba'), area: 'Kukatpally', openingHours: '12:00 PM – 10:00 PM', rating: 4.6 },
    { name: 'Nani’s Sweets', chef: 'Kamala Nani', image: img('photo-1601050690597-df0568f70950'), area: 'Ameerpet', openingHours: '10:00 AM – 8:00 PM', rating: 4.7 },
  ]);

  // Support tickets
  const issues: [string, string, string, string, boolean][] = [
    ['return_refund', 'Wrong item received', 'high', 'open', true],
    ['delivery', 'Delayed delivery', 'medium', 'in_progress', false],
    ['product', 'Product quality issue', 'low', 'resolved', false],
    ['payment', 'Payment failed', 'high', 'open', false],
    ['order', 'Cancel order request', 'medium', 'in_progress', false],
    ['return_refund', 'Size issue', 'low', 'resolved', true],
    ['delivery', 'Delivery partner not reachable', 'medium', 'open', false],
    ['product', 'Damaged product', 'high', 'in_progress', true],
    ['order', 'Missing item in order', 'medium', 'resolved', false],
    ['other', 'Change registered phone number', 'low', 'resolved', false],
  ];
  const delivered = orders.filter((o) => o.status === 'delivered').slice(-12);
  await SupportTicket.insertMany(
    issues.map(([issueType, subject, priority, status, isReturn], i) => {
      const o = delivered[i % delivered.length];
      const c = i === 0 ? customers[0] : customers[i % customers.length];
      const desc = i === 0 ? 'I ordered fresh tomatoes but received damaged tomatoes. Please arrange a return and refund.' : `${subject}. Please help me with this.`;
      return {
        ticketNumber: `TKT-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
        customer: c._id,
        order: o._id,
        issueType,
        subject,
        description: desc,
        priority,
        status,
        isReturn,
        assignedTo: staff[5]._id,
        dueDate: new Date(now + 3 * 864e5),
        attachments: i === 0 ? [img('photo-1546094096-0df4bcaaa337'), img('photo-1607082348824-0a96f2a4b9da')] : [],
        messages: [{ from: 'customer', author: c._id, text: desc, at: new Date(now - (i + 1) * 5 * 3600e3) }],
        createdAt: new Date(now - (i + 1) * 5 * 3600e3),
        updatedAt: new Date(now - i * 3 * 3600e3),
      };
    }),
  );

  await Notification.insertMany([
    { audience: 'all_customers', kind: 'offer', title: 'Special Offer', body: 'Flat 50% off on fresh vegetables!', createdAt: new Date(now - 3600e3) },
    { audience: 'all_customers', kind: 'system', title: 'Welcome to VSR', body: 'Shop groceries, essentials and homemade food in one place.', createdAt: new Date(now - 3 * 864e5) },
  ]);

  await AuditLog.insertMany([
    { actor: customers[1]._id, action: 'order.placed', resourceType: 'Order', summary: `New order ${hero?.orderNumber ?? ''} from Ravi Kumar`, createdAt: new Date(now - 5 * 60e3) },
    { actor: staff[4]._id, action: 'payment.verified', resourceType: 'Payment', summary: 'Payment confirmed (UPI)', createdAt: new Date(now - 18 * 60e3) },
    { actor: staff[1]._id, action: 'order.packed', resourceType: 'Order', summary: 'Order packed and ready', createdAt: new Date(now - 32 * 60e3) },
    { actor: staff[1]._id, action: 'order.assigned', resourceType: 'Order', summary: 'Delivery partner Karthik R assigned', createdAt: new Date(now - 60 * 60e3) },
    { actor: staff[2]._id, action: 'product.create', resourceType: 'Product', summary: 'New product "Organic Honey" added', createdAt: new Date(now - 2 * 3600e3) },
  ]);

  console.log('[seed] done. Staff logins (password: %s):', env.SEED_ADMIN_PASSWORD);
  for (const s of SEED_STAFF) console.log(`   ${s.email.padEnd(22)} → ${s.roles[0]}`);
  console.log('   Customer (mobile app): priya@gmail.com / Customer@123');
}

if (require.main === module) {
  // `npm run seed` against MONGO_URI
  (async () => {
    if (!env.MONGO_URI) {
      console.error('Set MONGO_URI to seed a persistent database (the dev server auto-seeds its in-memory DB).');
      process.exit(1);
    }
    await mongoose.connect(env.MONGO_URI);
    await runSeed();
    await mongoose.disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
