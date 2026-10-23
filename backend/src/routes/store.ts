import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Category, Product, Review, availableOf } from '../models/Catalog';
import { Order, Payment, Cart } from '../models/Order';
import { Banner, Coupon, Kitchen, Notification, SupportTicket, DeliveryPartner } from '../models/Ops';
import { User } from '../models/User';
import { ah, parse, paginate, escapeRegex, badRequest, notFound, conflict, forbidden } from '../utils/http';
import { authenticate, requireCustomer } from '../middleware/auth';
import { priceCart, nextOrderNumber, assertTransition, variantFor, lineKey } from '../utils/orders';
import multer from 'multer';
import { StockAlert } from '../utils/restock';
import { categoryRowAuto, getHomeLayout, homeCategories, sectionProducts, type SectionKey } from '../utils/homeLayout';
import { razorpay, verifyRazorpaySignature, notify, sendMail, otpEmail, uploadImage } from '../utils/services';
import { createOtp, consumeOtp } from '../utils/security';
import { env, features, isProd } from '../config/env';

const r = Router();
const activeProduct = { status: 'active' };

// ------------------------------ Public catalogue ------------------------------
const pincodes = () => env.SERVICE_PINCODES.split(',').map((s) => s.trim()).filter(Boolean);
export const isServiceable = (pin?: string) => !pincodes().length || (!!pin && pincodes().some((p) => pin.startsWith(p)));

r.get('/config', (_req, res) => {
  res.json({
    razorpayKeyId: features.razorpay ? env.RAZORPAY_KEY_ID : null,
    paymentMethods: features.razorpay ? ['upi', 'card', 'netbanking', 'wallet', 'cod'] : ['cod'],
    app: { minVersion: env.APP_MIN_VERSION, latestVersion: env.APP_LATEST_VERSION, unsupportedBelow: env.APP_UNSUPPORTED_BELOW },
    maintenance: { enabled: env.MAINTENANCE_MODE === 'true', message: env.MAINTENANCE_MESSAGE },
    support: { phone: '+919876543210', email: 'support@vsr.in' },
  });
});

r.get('/serviceability', (req, res) => {
  const pin = String(req.query.pincode ?? '').trim();
  const ok = isServiceable(pin);
  res.json({ pincode: pin, serviceable: ok, message: ok ? 'We deliver here.' : 'We don’t deliver to this area yet.' });
});

r.get(
  '/products/:id/reviews',
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = { product: req.params.id, status: 'approved' };
    const [items, total, dist] = await Promise.all([
      Review.find(filter).populate('customer', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments(filter),
      Review.aggregate([{ $match: { product: new Types.ObjectId(req.params.id), status: 'approved' } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]),
    ]);
    res.json({ items, total, page, limit, distribution: Object.fromEntries(dist.map((d) => [d._id, d.n])) });
  }),
);

r.get(
  '/kitchens/:id',
  ah(async (req, res) => {
    const kitchen = await Kitchen.findById(req.params.id);
    if (!kitchen) throw notFound('Kitchen not found');
    // Dishes are linked to a kitchen by the product's brand name
    const menu = await Product.find({ type: 'homemade', brand: kitchen.name, status: { $in: ['active', 'inactive'] } }).sort({ soldCount: -1 });
    res.json({ kitchen, menu });
  }),
);


r.get(
  '/home',
  ah(async (_req, res) => {
    const now = new Date();
    const layout = await getHomeLayout();
    const sec = (k: SectionKey) => layout.sections.find((x) => x.key === k)!;
    const homemade: never[] = []; // kept in the response for older app builds; homemade now comes via category rows
    const [banners, categories, bestSellers, deals, recommended] = await Promise.all([
      Banner.find({ status: 'active', position: { $in: ['homepage', 'app'] }, $and: [{ $or: [{ startDate: null }, { startDate: { $lte: now } }] }, { $or: [{ endDate: null }, { endDate: { $gte: now } }] }] }).sort({ priority: 1 }),
      homeCategories(layout.categoryIds),
      sectionProducts(sec('bestSellers'), () => Product.find(activeProduct).sort({ soldCount: -1 }).limit(30)),
      sectionProducts(sec('deals'), async () => {
        const recent = await Product.find({ ...activeProduct, $expr: { $gt: ['$mrp', '$price'] } }).sort({ createdAt: -1 }).limit(30);
        return recent.sort((a, b) => b.mrp - b.price - (a.mrp - a.price));
      }),
      // Guests see the admin's picks (+ best sellers); signed-in customers get /me/recommendations
      sectionProducts(sec('recommended'), () => Product.find(activeProduct).sort({ soldCount: -1 }).limit(30)),
    ]);
    // Order + titles + visibility of each row, as set in Admin → Home Screen.
    // Category rows (admin-added) bring their own products; empty or inactive ones are skipped.
    const activeCats = new Set((await Category.find({ status: 'active' }).select('_id')).map((c) => String(c._id)));
    const sections = (
      await Promise.all(
        layout.sections
          .filter((x) => x.enabled)
          .map(async (x) => {
            if (x.key !== 'category') return { key: x.key, title: x.title };
            const id = String(x.categoryId);
            if (!activeCats.has(id)) return null;
            const items = await sectionProducts(x, categoryRowAuto(id));
            return items.length ? { key: 'category', title: x.title, categoryId: id, items } : null;
          }),
      )
    ).filter(Boolean);
    res.json({ banners, categories, bestSellers, homemade, deals, recommended, sections });
  }),
);

r.get(
  '/categories',
  ah(async (_req, res) => {
    const cats = await Category.find({ status: 'active' }).sort({ sortOrder: 1 }).lean();
    const parents = cats.filter((c) => !c.parent).map((c) => ({ ...c, children: cats.filter((s) => String(s.parent) === String(c._id)) }));
    res.json({ categories: parents });
  }),
);

r.get(
  '/products',
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = { ...activeProduct };
    if (req.query.category) {
      const id = String(req.query.category);
      filter.$or = [{ category: id }, { subcategory: id }];
    }
    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.minPrice || req.query.maxPrice) filter.price = { $gte: Number(req.query.minPrice) || 0, $lte: Number(req.query.maxPrice) || 1e9 };
    if (req.query.inStock === '1') filter.$expr = { $gt: [{ $subtract: ['$stock.onHand', '$stock.reserved'] }, 0] };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$and = [{ $or: [{ name: rx }, { brand: rx }, { tags: rx }] }];
    }
    const sorts: Record<string, Record<string, 1 | -1>> = { price_asc: { price: 1 }, price_desc: { price: -1 }, popular: { soldCount: -1 }, latest: { createdAt: -1 } };
    if (req.query.sort === 'discount') {
      // Biggest % off first; computed in the pipeline since it's a ratio of two fields
      const [rows, total] = await Promise.all([
        Product.aggregate([
          { $match: filter },
          { $addFields: { _off: { $cond: [{ $gt: ['$mrp', 0] }, { $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 0] } } },
          { $match: { _off: { $gt: 0 } } },
          { $sort: { _off: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1 } },
        ]),
        Product.countDocuments({ ...filter, $expr: { $and: [filter.$expr ?? true, { $gt: ['$mrp', '$price'] }] } }),
      ]);
      const docs = await Product.find({ _id: { $in: rows.map((r) => r._id) } });
      const items = rows.map((r) => docs.find((d) => d._id.equals(r._id))).filter(Boolean);
      return res.json({ items, total, page, limit });
    }
    const sort = sorts[String(req.query.sort)] ?? { soldCount: -1 };
    const [items, total] = await Promise.all([Product.find(filter).sort(sort).skip(skip).limit(limit), Product.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  }),
);

r.get(
  '/products/:id',
  ah(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, ...activeProduct }).populate('category', 'name');
    if (!product) throw notFound('Product not found');
    const [reviews, similar] = await Promise.all([
      Review.find({ product: product._id, status: 'approved' }).populate('customer', 'name avatar').sort({ createdAt: -1 }).limit(10),
      Product.find({ ...activeProduct, category: product.category, _id: { $ne: product._id } }).limit(8),
    ]);
    res.json({ product, reviews, similar });
  }),
);

r.get('/kitchens', ah(async (_req, res) => res.json({ kitchens: await Kitchen.find({ status: 'active' }) })));

// ------------------------------ Customer (authenticated) ------------------------------
const c = Router();
c.use(authenticate, requireCustomer);

c.get('/profile', ah(async (req, res) => res.json({ user: await User.findById(req.user!.id) })));
c.patch(
  '/profile',
  ah(async (req, res) => {
    const body = parse(z.object({ name: z.string().min(2).max(80).optional(), avatar: z.string().url().optional() }), req.body);
    res.json({ user: await User.findByIdAndUpdate(req.user!.id, body, { new: true }) });
  }),
);

const addressInput = z.object({
  label: z.enum(['Home', 'Work', 'Other']).default('Home'),
  recipient: z.string().min(2),
  phone: z.string().min(10).max(15),
  line1: z.string().min(3),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});
c.get('/addresses', ah(async (req, res) => res.json({ addresses: (await User.findById(req.user!.id))?.addresses ?? [] })));
c.post(
  '/addresses',
  ah(async (req, res) => {
    const body = parse(addressInput, req.body);
    const user = (await User.findById(req.user!.id))!;
    if (body.isDefault || user.addresses.length === 0) user.addresses.forEach((a) => (a.isDefault = false));
    user.addresses.push({ ...body, isDefault: body.isDefault || user.addresses.length === 0 });
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  }),
);
c.put(
  '/addresses/:aid',
  ah(async (req, res) => {
    const body = parse(addressInput, req.body);
    const user = (await User.findById(req.user!.id))!;
    const addr = user.addresses.id(req.params.aid);
    if (!addr) throw notFound('Address not found');
    if (body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    addr.set(body);
    await user.save();
    res.json({ addresses: user.addresses });
  }),
);
c.delete(
  '/addresses/:aid',
  ah(async (req, res) => {
    const user = (await User.findById(req.user!.id))!;
    user.addresses.pull({ _id: req.params.aid });
    if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) user.addresses[0].isDefault = true;
    await user.save();
    res.json({ addresses: user.addresses });
  }),
);

// Cart: stored server-side; totals always recomputed on the server
async function cartView(customer: string) {
  const cart = (await Cart.findOne({ customer })) ?? (await Cart.create({ customer, items: [] }));
  const priced = await priceCart(
    cart.items.map((i) => ({ product: i.product!, quantity: i.quantity!, variant: i.variant ?? null })),
    cart.couponCode,
  );
  // Flag lines whose price moved since they were added (cleared via /cart/acknowledge-prices)
  const priceChanges = priced.items.flatMap((it) => {
    const line = cart.items.find((c) => lineKey(c) === lineKey(it));
    return line?.priceAtAdd != null && line.priceAtAdd !== it.unitPrice ? [{ key: lineKey(it), product: String(it.product), name: it.name, was: line.priceAtAdd, now: it.unitPrice }] : [];
  });
  return { ...priced, items: priced.items.map((it) => ({ ...it, previousPrice: priceChanges.find((x) => x.key === lineKey(it))?.was ?? null })), priceChanges, couponCode: cart.couponCode ?? null };
}
c.get('/cart', ah(async (req, res) => res.json(await cartView(req.user!.id))));
c.put(
  '/cart/items',
  ah(async (req, res) => {
    const { productId, quantity, variantId } = parse(z.object({ productId: z.string(), quantity: z.number().int().min(0).max(50), variantId: z.string().nullable().optional() }), req.body);
    const cart = (await Cart.findOne({ customer: req.user!.id })) ?? new Cart({ customer: req.user!.id, items: [] });
    const prod = await Product.findOne({ _id: productId, ...activeProduct });
    // Products with pack sizes always carry a size on the line (requested, else the default)
    const v = prod ? variantFor(prod, variantId) : null;
    if (prod && v === undefined) throw notFound('This size is no longer available');
    const vid = v?._id ? String(v._id) : variantId ?? null;
    const same = (i: { product?: unknown; variant?: unknown }) => String(i.product) === productId && String(i.variant ?? '') === String(vid ?? '');
    const existing = cart.items.find(same);
    if (quantity === 0) {
      const keep = cart.items.filter((i) => !same(i));
      cart.items.splice(0, cart.items.length, ...keep);
    } else if (existing) existing.quantity = quantity;
    else {
      if (!prod) throw notFound('Product not available');
      cart.items.push({ product: new Types.ObjectId(productId), variant: vid ? new Types.ObjectId(vid) : undefined, quantity, priceAtAdd: v ? v.price : prod.price });
    }
    await cart.save();
    res.json(await cartView(req.user!.id));
  }),
);
c.delete('/cart', ah(async (req, res) => {
  await Cart.updateOne({ customer: req.user!.id }, { items: [], couponCode: null });
  res.json(await cartView(req.user!.id));
}));
c.post(
  '/cart/coupon',
  ah(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().nullable() }), req.body);
    await Cart.updateOne({ customer: req.user!.id }, { couponCode: code ? code.toUpperCase() : null }, { upsert: true });
    const view = await cartView(req.user!.id);
    if (code && view.couponError) {
      await Cart.updateOne({ customer: req.user!.id }, { couponCode: null });
      throw badRequest(view.couponError);
    }
    res.json(view);
  }),
);
c.get('/coupons', ah(async (_req, res) => res.json({ coupons: await Coupon.find({ status: 'active', $or: [{ endDate: null }, { endDate: { $gte: new Date() } }] }) })));

// Place order (idempotent on Idempotency-Key header)
c.post(
  '/orders',
  ah(async (req, res) => {
    const body = parse(z.object({ addressId: z.string(), paymentMethod: z.enum(['upi', 'card', 'netbanking', 'wallet', 'cod']), instructions: z.string().max(300).optional() }), req.body);
    const key = req.header('idempotency-key');
    if (key) {
      const prior = await Order.findOne({ idempotencyKey: `${req.user!.id}:${key}` });
      if (prior) return res.json({ order: prior, payment: await Payment.findOne({ order: prior._id }) });
    }
    if (body.paymentMethod !== 'cod' && !razorpay) throw badRequest('Online payments are not available. Please choose Cash on Delivery.');
    const user = (await User.findById(req.user!.id))!;
    const address = user.addresses.id(body.addressId);
    if (!address) throw badRequest('Please select a delivery address');
    const view = await cartView(req.user!.id);
    if (!view.items.length) throw badRequest('Your cart is empty');
    if (view.items.some((i) => i.outOfStock)) throw conflict(view.warnings.join(' ') || 'Some items are out of stock');

    const orderNumber = await nextOrderNumber();
    const order = await Order.create({
      orderNumber,
      customer: user._id,
      items: view.items.map(({ taxRate: _t, available: _a, outOfStock: _o, ...i }) => i),
      address: address.toObject(),
      instructions: body.instructions,
      totals: view.totals,
      paymentMethod: body.paymentMethod,
      paymentStatus: 'pending',
      status: 'placed',
      idempotencyKey: key ? `${req.user!.id}:${key}` : undefined,
      history: [{ from: null, to: 'placed', actor: user._id, actorRole: 'customer' }],
    });

    let payment;
    let razorpayOrder = null;
    if (body.paymentMethod === 'cod') {
      payment = await Payment.create({ order: order._id, customer: user._id, provider: 'cod', method: 'cod', amount: view.totals.grandTotal, logs: [{ event: 'COD selected' }] });
    } else {
      razorpayOrder = await razorpay!.orders.create({ amount: Math.round(view.totals.grandTotal * 100), currency: 'INR', receipt: orderNumber });
      payment = await Payment.create({ order: order._id, customer: user._id, provider: 'razorpay', method: body.paymentMethod, providerOrderId: razorpayOrder.id, amount: view.totals.grandTotal, logs: [{ event: 'Payment initiated' }] });
    }
    if (view.totals.couponCode) await Coupon.updateOne({ code: view.totals.couponCode }, { $inc: { used: 1 } });
    await Cart.updateOne({ customer: user._id }, { items: [], couponCode: null });
    await notify(String(user._id), 'Order placed', `Your order #${orderNumber} has been placed and is awaiting confirmation.`);
    if (user.email) await sendMail(user.email, `Order #${orderNumber} placed`, `<p>Thanks for shopping with VSR! Your order <b>#${orderNumber}</b> for ₹${view.totals.grandTotal} has been received.</p>`);
    res.status(201).json({
      order,
      payment,
      razorpay: razorpayOrder ? { keyId: env.RAZORPAY_KEY_ID, orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: 'INR' } : null,
    });
  }),
);

// Client callback — verified by signature; webhook remains the source of truth for late events
c.post(
  '/payments/verify',
  ah(async (req, res) => {
    const body = parse(z.object({ razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpaySignature: z.string() }), req.body);
    const payment = await Payment.findOne({ providerOrderId: body.razorpayOrderId, customer: req.user!.id });
    if (!payment) throw notFound('Payment not found');
    if (!verifyRazorpaySignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      payment.status = 'failed';
      payment.logs.push({ event: 'Signature verification failed' });
      await payment.save();
      await Order.updateOne({ _id: payment.order }, { paymentStatus: 'failed' });
      throw badRequest('Payment could not be verified');
    }
    if (payment.status !== 'paid') {
      payment.status = 'paid';
      payment.providerPaymentId = body.razorpayPaymentId;
      payment.verifiedAt = new Date();
      payment.logs.push({ event: 'Payment verified' });
      await payment.save();
      await Order.updateOne({ _id: payment.order }, { paymentStatus: 'paid' });
    }
    res.json({ payment });
  }),
);

c.get(
  '/orders',
  ah(async (req, res) => {
    const tab = String(req.query.tab ?? 'all');
    const map: Record<string, string[]> = {
      ongoing: ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'],
      delivered: ['delivered', 'return_requested', 'returned'],
      cancelled: ['cancelled', 'rejected'],
    };
    const filter: Record<string, unknown> = { customer: req.user!.id };
    if (map[tab]) filter.status = { $in: map[tab] };
    res.json({ orders: await Order.find(filter).sort({ createdAt: -1 }).limit(50) });
  }),
);
c.get(
  '/orders/:id',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id }).select('+deliveryOtp.plain').populate('deliveryPartner', 'name phone avatar rating deliveries vehicle');
    if (!order) throw notFound('Order not found');
    const o = order.toObject();
    const otp = order.status === 'out_for_delivery' || order.status === 'assigned' ? order.deliveryOtp?.plain : undefined;
    if (o.deliveryOtp) delete (o.deliveryOtp as Record<string, unknown>).plain;
    res.json({ order: { ...o, deliveryCode: otp ?? null }, payment: await Payment.findOne({ order: order._id }).select('-logs') });
  }),
);
c.post(
  '/orders/:id/cancel',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().min(3).max(200) }), req.body);
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!order) throw notFound('Order not found');
    if (order.status !== 'placed') throw conflict('This order is already being processed. Please contact support to cancel.');
    assertTransition(order.status, 'cancelled');
    order.history.push({ from: order.status, to: 'cancelled', actor: new Types.ObjectId(req.user!.id), actorRole: 'customer', reason });
    order.status = 'cancelled';
    order.cancelReason = reason;
    if (order.paymentStatus === 'paid') order.paymentStatus = 'refund_pending';
    await order.save();
    res.json({ order });
  }),
);
c.post(
  '/orders/:id/reorder',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!order) throw notFound('Order not found');
    const cart = (await Cart.findOne({ customer: req.user!.id })) ?? new Cart({ customer: req.user!.id, items: [] });
    for (const it of order.items) {
      const ex = cart.items.find((i) => lineKey(i) === lineKey(it));
      if (ex) ex.quantity = (ex.quantity ?? 0) + (it.quantity ?? 1);
      else cart.items.push({ product: it.product, variant: it.variant ?? undefined, quantity: it.quantity });
    }
    await cart.save();
    res.json(await cartView(req.user!.id));
  }),
);
c.post(
  '/orders/:id/review',
  ah(async (req, res) => {
    const body = parse(z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(1000).optional() }), req.body);
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id, status: 'delivered' });
    if (!order) throw badRequest('You can review an order after it is delivered');
    order.rating = body.rating;
    await order.save();
    for (const it of order.items) {
      const exists = await Review.exists({ product: it.product, order: order._id });
      if (exists) continue;
      await Review.create({ product: it.product, order: order._id, customer: req.user!.id, rating: body.rating, text: body.text });
      const stats = await Review.aggregate([{ $match: { product: it.product, status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
      if (stats[0]) await Product.updateOne({ _id: it.product }, { rating: Math.round(stats[0].avg * 10) / 10, reviewCount: stats[0].n });
    }
    res.json({ ok: true });
  }),
);
c.get('/orders/:id/partner', ah(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
  if (!order?.deliveryPartner) return res.json({ partner: null });
  res.json({ partner: await DeliveryPartner.findById(order.deliveryPartner).select('name phone avatar rating deliveries vehicle') });
}));

c.get('/wishlist', ah(async (req, res) => res.json({ items: (await User.findById(req.user!.id).populate('wishlist'))?.wishlist ?? [] })));
c.post(
  '/wishlist/:productId',
  ah(async (req, res) => {
    const user = (await User.findById(req.user!.id))!;
    const has = user.wishlist.some((p) => String(p) === req.params.productId);
    if (has) user.wishlist = user.wishlist.filter((p) => String(p) !== req.params.productId);
    else user.wishlist.push(new Types.ObjectId(req.params.productId));
    await user.save();
    res.json({ wishlisted: !has, ids: user.wishlist });
  }),
);

c.get(
  '/notifications',
  ah(async (req, res) => {
    const items = await Notification.find({ $or: [{ recipient: req.user!.id }, { audience: 'all_customers' }] }).sort({ createdAt: -1 }).limit(50);
    res.json({ items: items.map((n) => ({ ...n.toObject(), read: n.readBy.some((u) => String(u) === req.user!.id) })) });
  }),
);
// "Notify Me" (back in stock): list / request / cancel. Only out-of-stock products can be requested.
c.get('/stock-alerts', ah(async (req, res) => {
  const alerts = await StockAlert.find({ customer: req.user!.id, notifiedAt: null }).select('product');
  res.json({ productIds: alerts.map((a) => String(a.product)) });
}));
c.post('/stock-alerts/:productId', ah(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.productId, status: 'active' });
  if (!p) throw notFound();
  if (availableOf(p) > 0) throw badRequest('This product is in stock now. Add it to your cart.');
  await StockAlert.updateOne({ customer: req.user!.id, product: p._id, notifiedAt: null }, { $setOnInsert: { customer: req.user!.id, product: p._id } }, { upsert: true });
  res.json({ subscribed: true });
}));
c.delete('/stock-alerts/:productId', ah(async (req, res) => {
  await StockAlert.deleteOne({ customer: req.user!.id, product: req.params.productId, notifiedAt: null });
  res.json({ subscribed: false });
}));
c.post('/notifications/read-all', ah(async (req, res) => {
  await Notification.updateMany({ $or: [{ recipient: req.user!.id }, { audience: 'all_customers' }] }, { $addToSet: { readBy: req.user!.id } });
  res.json({ ok: true });
}));

c.get('/tickets', ah(async (req, res) => res.json({ tickets: await SupportTicket.find({ customer: req.user!.id }).sort({ createdAt: -1 }) })));
c.post(
  '/tickets',
  ah(async (req, res) => {
    const body = parse(
      z.object({ orderId: z.string().optional(), issueType: z.enum(['order', 'return_refund', 'delivery', 'product', 'payment', 'other']), subject: z.string().min(3).max(120), description: z.string().min(5).max(2000) }),
      req.body,
    );
    if (body.orderId && !(await Order.exists({ _id: body.orderId, customer: req.user!.id }))) throw badRequest('Order not found');
    const count = await SupportTicket.countDocuments();
    const ticket = await SupportTicket.create({
      ticketNumber: `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
      customer: req.user!.id,
      order: body.orderId,
      issueType: body.issueType,
      subject: body.subject,
      description: body.description,
      isReturn: body.issueType === 'return_refund',
      messages: [{ from: 'customer', author: req.user!.id, text: body.description }],
    });
    res.status(201).json({ ticket });
  }),
);


c.post(
  '/cart/acknowledge-prices',
  ah(async (req, res) => {
    const cart = await Cart.findOne({ customer: req.user!.id });
    if (cart) {
      const prods = await Product.find({ _id: { $in: cart.items.map((i) => i.product) } }).select('price variants');
      cart.items.forEach((i) => {
        const p = prods.find((x) => x._id.equals(i.product!));
        const v = p?.variants?.find((x) => String(x._id) === String(i.variant ?? ''));
        i.priceAtAdd = v?.price ?? p?.price ?? i.priceAtAdd;
      });
      await cart.save();
    }
    res.json(await cartView(req.user!.id));
  }),
);

// Retry an online payment for an order whose payment failed or was abandoned (same order, new gateway order)
c.post(
  '/orders/:id/retry-payment',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!order) throw notFound('Order not found');
    if (order.paymentMethod === 'cod') throw badRequest('This order is Cash on Delivery');
    if (order.paymentStatus === 'paid') throw conflict('This order is already paid');
    if (order.status !== 'placed') throw conflict('This order can no longer be paid online. Please contact support.');
    if (!razorpay) throw badRequest('Online payments are not available right now');
    const rzp = await razorpay.orders.create({ amount: Math.round(order.totals!.grandTotal! * 100), currency: 'INR', receipt: `${order.orderNumber}-r${Date.now().toString(36)}`.slice(0, 40) });
    await Payment.updateOne({ order: order._id }, { providerOrderId: rzp.id, status: 'pending', $push: { logs: { event: 'Payment retried' } } });
    order.paymentStatus = 'pending';
    await order.save();
    res.json({ order, razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: rzp.id, amount: rzp.amount, currency: 'INR' } });
  }),
);

c.post(
  '/payments/abandon',
  ah(async (req, res) => {
    const { orderId, reason } = parse(z.object({ orderId: z.string(), reason: z.enum(['cancelled', 'failed']) }), req.body);
    const p = await Payment.findOne({ order: orderId, customer: req.user!.id });
    if (p && p.status === 'pending') {
      p.logs.push({ event: reason === 'cancelled' ? 'Customer closed checkout' : 'Gateway reported failure' });
      if (reason === 'failed') p.status = 'failed';
      await p.save();
      if (reason === 'failed') await Order.updateOne({ _id: orderId }, { paymentStatus: 'failed' });
    }
    res.json({ ok: true });
  }),
);

// Returns / replacements: delivered orders, within each product's return window
c.get(
  '/orders/:id/return-eligibility',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!order) throw notFound('Order not found');
    const prods = await Product.find({ _id: { $in: order.items.map((i) => i.product) } }).select('returnable returnWindowDays');
    const deliveredAt = order.deliveredAt ?? order.updatedAt;
    const items = order.items.map((i) => {
      const p = prods.find((x) => x._id.equals(i.product));
      const days = p?.returnWindowDays ?? 2;
      const until = new Date(deliveredAt.getTime() + days * 864e5);
      const returnable = p?.returnable ?? true;
      const eligible = order.status === 'delivered' && returnable && until > new Date();
      const reason = eligible ? null : order.status !== 'delivered' ? 'Order not delivered yet' : !returnable ? 'This item is not returnable' : 'Return window has closed';
      return { product: i.product, name: i.name, image: i.image, unit: i.unit, quantity: i.quantity, eligible, until, reason };
    });
    const existing = await SupportTicket.findOne({ order: order._id, isReturn: true }).sort({ createdAt: -1 });
    res.json({ orderStatus: order.status, items, eligible: items.some((i) => i.eligible) && !existing, existing });
  }),
);
c.post(
  '/orders/:id/return',
  ah(async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(['return', 'replacement']),
        items: z.array(z.object({ product: z.string(), quantity: z.number().int().min(1) })).min(1),
        reason: z.string().min(3).max(120),
        details: z.string().max(1000).optional(),
        photos: z.array(z.string().url()).max(5).default([]),
      }),
      req.body,
    );
    const order = await Order.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!order) throw notFound('Order not found');
    if (order.status !== 'delivered') throw conflict('Only delivered orders can be returned');
    if (await SupportTicket.exists({ order: order._id, isReturn: true })) throw conflict('A return request already exists for this order');
    const lines = body.items.map((it) => {
      const o = order.items.find((x) => String(x.product) === it.product);
      if (!o) throw badRequest('Item not in this order');
      if (it.quantity > (o.quantity ?? 0)) throw badRequest(`You can return at most ${o.quantity} of ${o.name}`);
      return { product: o.product, name: o.name, quantity: it.quantity };
    });
    const count = await SupportTicket.countDocuments();
    const ticket = await SupportTicket.create({
      ticketNumber: `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
      customer: req.user!.id,
      order: order._id,
      issueType: 'return_refund',
      subject: `${body.type === 'return' ? 'Return' : 'Replacement'}: ${body.reason}`,
      description: body.details || body.reason,
      isReturn: true,
      priority: 'medium',
      attachments: body.photos,
      returnItems: lines,
      returnReason: body.reason,
      messages: [{ from: 'customer', author: req.user!.id, text: body.details || body.reason }],
    });
    assertTransition(order.status, 'return_requested');
    order.history.push({ from: order.status, to: 'return_requested', actor: new Types.ObjectId(req.user!.id), actorRole: 'customer', reason: body.reason });
    order.status = 'return_requested';
    await order.save();
    res.status(201).json({ ticket });
  }),
);

// Customer evidence uploads (Cloudinary, server-side so secrets stay off the device)
const customerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)),
});
c.post(
  '/uploads',
  customerUpload.single('file'),
  ah(async (req, res) => {
    if (!features.cloudinary) throw badRequest('Uploads are not available right now');
    if (!req.file) throw badRequest('Attach a JPG, PNG or WebP image up to 5MB');
    res.status(201).json(await uploadImage(req.file.buffer, 'support'));
  }),
);

c.get(
  '/tickets/:id',
  ah(async (req, res) => {
    const t = await SupportTicket.findOne({ _id: req.params.id, customer: req.user!.id }).populate('order', 'orderNumber').populate('messages.author', 'name avatar');
    if (!t) throw notFound('Ticket not found');
    const o = t.toObject();
    // never expose staff-only notes
    res.json({ ticket: { ...o, messages: o.messages.filter((m) => m.from !== 'internal') } });
  }),
);
c.post(
  '/tickets/:id/messages',
  ah(async (req, res) => {
    const { text, attachments } = parse(z.object({ text: z.string().min(1).max(2000), attachments: z.array(z.string().url()).max(5).default([]) }), req.body);
    const t = await SupportTicket.findOne({ _id: req.params.id, customer: req.user!.id });
    if (!t) throw notFound('Ticket not found');
    if (t.status === 'closed') throw conflict('This ticket is closed. Please open a new one.');
    t.messages.push({ from: 'customer', author: req.user!.id as never, text, at: new Date() });
    if (attachments?.length) t.attachments.push(...attachments);
    if (t.status === 'resolved') t.status = 'open';
    await t.save();
    res.json({ ok: true });
  }),
);

c.get('/preferences', ah(async (req, res) => res.json({ preferences: (await User.findById(req.user!.id))?.preferences })));
c.patch(
  '/preferences',
  ah(async (req, res) => {
    const body = parse(z.object({ orderUpdates: z.boolean().optional(), offers: z.boolean().optional(), email: z.boolean().optional(), push: z.boolean().optional() }), req.body);
    const set = Object.fromEntries(Object.entries(body).map(([k, v]) => [`preferences.${k}`, v]));
    const u = await User.findByIdAndUpdate(req.user!.id, { $set: set }, { new: true });
    res.json({ preferences: u?.preferences });
  }),
);

// Change email / phone: OTP goes to the NEW contact and must be verified before it is saved
c.post(
  '/contact/change',
  ah(async (req, res) => {
    const { kind, value } = parse(z.object({ kind: z.enum(['email', 'phone']), value: z.string().min(5) }), req.body);
    const digits = value.replace(/\D/g, '');
    const v = kind === 'email' ? value.trim().toLowerCase() : digits.length === 10 ? `+91${digits}` : digits.length === 12 ? `+${digits}` : value.trim();
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest('Enter a valid email');
    if (kind === 'phone' && !/^\+91[6-9]\d{9}$/.test(v)) throw badRequest('Enter a valid mobile number');
    if (await User.exists({ [kind]: v, _id: { $ne: req.user!.id } })) throw badRequest('This contact can’t be used. Try another.');
    const code = await createOtp(`change:${req.user!.id}:${v}`, 'verify');
    if (kind === 'email') await sendMail(v, 'Verify your new email', otpEmail(code, 'confirm your new email'), `otp=${code}`);
    else if (!isProd) console.log(`[sms:dev] to=${v} otp=${code}`); // SMS needs a separate provider (PRD 13.3)
    res.json({ sent: true, value: v, ...(isProd ? {} : { devOtp: code }) });
  }),
);
c.post(
  '/contact/verify',
  ah(async (req, res) => {
    const { kind, value, code } = parse(z.object({ kind: z.enum(['email', 'phone']), value: z.string(), code: z.string().length(6) }), req.body);
    if (!(await consumeOtp(`change:${req.user!.id}:${value}`, 'verify', code))) throw badRequest('Invalid or expired code');
    const u = await User.findByIdAndUpdate(req.user!.id, kind === 'email' ? { email: value, emailVerified: true } : { phone: value, phoneVerified: true }, { new: true });
    res.json({ user: u });
  }),
);

c.post(
  '/account-deletion',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().max(300).optional() }), req.body);
    const u = (await User.findById(req.user!.id))!;
    if (u.deletionStatus === 'requested' || u.deletionStatus === 'processing') return res.json({ status: u.deletionStatus, requestedAt: u.deletionRequestedAt });
    u.deletionStatus = 'requested';
    u.deletionRequestedAt = new Date();
    await u.save();
    const count = await SupportTicket.countDocuments();
    await SupportTicket.create({
      ticketNumber: `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
      customer: u._id,
      issueType: 'other',
      subject: 'Account deletion request',
      description: reason || 'Customer requested account deletion.',
      priority: 'medium',
      messages: [{ from: 'customer', author: u._id, text: reason || 'Please delete my account.' }],
    });
    res.json({ status: u.deletionStatus, requestedAt: u.deletionRequestedAt });
  }),
);
c.delete(
  '/account-deletion',
  ah(async (req, res) => {
    const u = await User.findOneAndUpdate({ _id: req.user!.id, deletionStatus: 'requested' }, { deletionStatus: 'none', deletionRequestedAt: null }, { new: true });
    res.json({ status: u?.deletionStatus ?? 'none' });
  }),
);


c.post(
  '/notifications/:id/read',
  ah(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, $or: [{ recipient: req.user!.id }, { audience: 'all_customers' }] }, { $addToSet: { readBy: req.user!.id } });
    res.json({ ok: true });
  }),
);

// Recommendations: popular products from categories the customer buys, excluding items already bought; falls back to best sellers
c.get(
  '/recommendations',
  ah(async (req, res) => {
    const orders = await Order.find({ customer: req.user!.id, status: { $nin: ['cancelled', 'rejected'] } }).select('items.product').limit(20);
    const bought = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product))))];
    const cats = bought.length ? await Product.distinct('category', { _id: { $in: bought } }) : [];
    // Admin-pinned picks (Admin → Home Screen → Recommended) come first, then matches from past orders
    const rec = (await getHomeLayout()).sections.find((x) => x.key === 'recommended')!;
    const pinned = await sectionProducts({ productIds: rec.productIds, autoFill: false }, async () => []);
    const pinnedIds = pinned.map((p) => p._id);
    const hidden = ((rec as { excludedIds?: unknown[] }).excludedIds ?? []).map(String);
    let items = cats.length ? await Product.find({ ...activeProduct, category: { $in: cats }, _id: { $nin: [...bought, ...pinnedIds, ...hidden] } }).sort({ soldCount: -1 }).limit(10) : [];
    items = [...pinned, ...items].slice(0, 10);
    if (items.length < 4) {
      const more = await Product.find({ ...activeProduct, _id: { $nin: [...bought, ...hidden, ...items.map((i) => i._id)] } }).sort({ soldCount: -1 }).limit(10 - items.length);
      items = [...items, ...more];
    }
    res.json({ items, basedOnHistory: cats.length > 0 });
  }),
);


// Product review by the customer: allowed only for products in one of their delivered orders; one review per product (editable)
async function recomputeRating(productId: Types.ObjectId | string) {
  const stats = await Review.aggregate([{ $match: { product: new Types.ObjectId(String(productId)), status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Product.updateOne({ _id: productId }, { rating: stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0, reviewCount: stats[0]?.n ?? 0 });
}
c.get(
  '/products/:id/review',
  ah(async (req, res) => {
    const [order, review] = await Promise.all([
      Order.findOne({ customer: req.user!.id, status: 'delivered', 'items.product': req.params.id }).select('_id'),
      Review.findOne({ customer: req.user!.id, product: req.params.id }).sort({ createdAt: -1 }),
    ]);
    res.json({ eligible: Boolean(order), review });
  }),
);
c.put(
  '/products/:id/review',
  ah(async (req, res) => {
    const body = parse(z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(1000).optional() }), req.body);
    const order = await Order.findOne({ customer: req.user!.id, status: 'delivered', 'items.product': req.params.id }).select('_id');
    if (!order) throw forbidden('You can review a product after it has been delivered to you.');
    const review = await Review.findOneAndUpdate(
      { customer: req.user!.id, product: req.params.id },
      { $set: { rating: body.rating, text: body.text, status: 'approved' }, $setOnInsert: { order: order._id } },
      { upsert: true, new: true },
    );
    await recomputeRating(req.params.id);
    res.json({ review });
  }),
);

r.use('/me', c);
export default r;
