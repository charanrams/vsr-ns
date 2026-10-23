import { Router } from 'express';
import { z } from 'zod';
import { Order, Payment, Refund } from '../../models/Order';
import { Product, Category } from '../../models/Catalog';
import { User } from '../../models/User';
import { Banner, Coupon, DeliveryPartner, Notification, SupportTicket, AuditLog } from '../../models/Ops';
import { ah, parse, paginate, escapeRegex, notFound, badRequest } from '../../utils/http';
import { can } from '../../middleware/auth';
import { audit, notify, razorpay } from '../../utils/services';
import { HomeLayout, SECTION_KEYS, getHomeLayout } from '../../utils/homeLayout';

const r = Router();
const DAY = 864e5;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const rangeStart = (range: unknown) => {
  const days: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '3m': 90, '6m': 180, '1y': 365 };
  return new Date(startOfDay().getTime() - ((days[String(range)] ?? 30) - 1) * DAY);
};
const pct = (now: number, prev: number) => (prev === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - prev) / prev) * 100));
const validOrders = { status: { $nin: ['cancelled', 'rejected'] } };

async function dailySeries(from: Date, days: number) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: from }, ...validOrders } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } }, orders: { $sum: 1 }, revenue: { $sum: '$totals.grandTotal' } } },
  ]);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + i * DAY);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const row = rows.find((x) => x._id === key);
    return { date: key, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 };
  });
}

async function monthlySeries(from: Date) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: from }, ...validOrders } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: '+05:30' } }, orders: { $sum: 1 }, revenue: { $sum: '$totals.grandTotal' } } },
  ]);
  const out = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= new Date()) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = rows.find((x) => x._id === key);
    out.push({ date: key, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Revenue/orders series for a named range: daily up to a month, monthly beyond. */
function seriesFor(range: unknown) {
  if (range === 'month') {
    const t = startOfDay();
    return dailySeries(new Date(t.getFullYear(), t.getMonth(), 1), t.getDate());
  }
  const from = rangeStart(range);
  const days = Math.round((startOfDay().getTime() - from.getTime()) / DAY) + 1;
  return days <= 31 ? dailySeries(from, days) : monthlySeries(from);
}
const rangeMatch = (range: unknown) => (range === 'all' ? {} : { createdAt: { $gte: range === 'month' ? new Date(startOfDay().getFullYear(), startOfDay().getMonth(), 1) : rangeStart(range) } });

async function salesByCategory(from?: Date) {
  return Order.aggregate([
    { $match: { ...(from ? { createdAt: { $gte: from } } : {}), ...validOrders } },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
    { $lookup: { from: 'categories', localField: 'p.0.category', foreignField: '_id', as: 'c' } },
    { $group: { _id: { $ifNull: [{ $first: '$c.name' }, 'Others'] }, value: { $sum: '$items.lineTotal' } } },
    { $sort: { value: -1 } },
  ]);
}

// ---------------- Dashboard ----------------
r.get(
  '/dashboard',
  can('dashboard'),
  ah(async (req, res) => {
    const today = startOfDay();
    const yesterday = new Date(today.getTime() - DAY);
    const perms = req.user!.permissions;
    const sum = async (from: Date, to?: Date) => {
      const m = await Order.aggregate([{ $match: { createdAt: { $gte: from, ...(to ? { $lt: to } : {}) }, ...validOrders } }, { $group: { _id: null, n: { $sum: 1 }, rev: { $sum: '$totals.grandTotal' } } }]);
      return { n: m[0]?.n ?? 0, rev: m[0]?.rev ?? 0 };
    };
    const avail = { $subtract: ['$stock.onHand', '$stock.reserved'] };
    const [
      totalOrders, totalRevenue, todayS, yestS, customers, custToday, products, pending, pendingYest,
      byStatus, trend, categories, lowStock, best, newCustomers, partners, recent, activity, earnings, refundsPending,
    ] = await Promise.all([
      Order.countDocuments(validOrders),
      Order.aggregate([{ $match: validOrders }, { $group: { _id: null, v: { $sum: '$totals.grandTotal' } } }]),
      sum(today),
      sum(yesterday, today),
      User.countDocuments({ roles: 'customer' }),
      User.countDocuments({ roles: 'customer', createdAt: { $gte: today } }),
      Product.countDocuments({ status: 'active' }),
      Order.countDocuments({ status: 'placed' }),
      Order.countDocuments({ status: 'placed', createdAt: { $lt: today } }),
      Order.aggregate([{ $match: rangeMatch(req.query.statusRange ?? 'all') }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      seriesFor(req.query.trendRange ?? '7d'),
      salesByCategory(req.query.catRange === 'all' ? undefined : rangeStart(req.query.catRange ?? '30d')),
      Product.find({ status: 'active', $expr: { $lte: [avail, '$stock.threshold'] } }).sort({ 'stock.onHand': 1 }).limit(5).select('name unit images stock'),
      Order.aggregate([
        { $match: { ...rangeMatch(req.query.bestRange ?? '30d'), ...validOrders } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, image: { $first: '$items.image' }, price: { $first: '$items.unitPrice' }, orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
        { $limit: 5 },
      ]),
      User.find({ roles: 'customer' }).sort({ createdAt: -1 }).limit(5).select('name avatar phone createdAt'),
      DeliveryPartner.aggregate([{ $group: { _id: '$availability', n: { $sum: 1 } } }]),
      Order.find().populate('customer', 'name').sort({ createdAt: -1 }).limit(5).select('orderNumber customer items totals status createdAt'),
      AuditLog.find().populate('actor', 'name').sort({ createdAt: -1 }).limit(5),
      seriesFor(req.query.earnRange ?? 'month'),
      Refund.countDocuments({ status: 'pending' }),
    ]);
    const newCustStats = await Order.aggregate([
      { $match: { customer: { $in: newCustomers.map((c) => c._id) } } },
      { $group: { _id: '$customer', n: { $sum: 1 }, spent: { $sum: '$totals.grandTotal' } } },
    ]);
    const catTotal = categories.reduce((s, c) => s + c.value, 0) || 1;
    res.json({
      kpis: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.v ?? 0,
        ordersChange: pct(todayS.n, yestS.n),
        revenueChange: pct(todayS.rev, yestS.rev),
        totalCustomers: customers,
        customersChange: customers ? Math.round((custToday / customers) * 1000) / 10 : 0,
        totalProducts: products,
        pendingOrders: pending,
        pendingChange: pct(pending, pendingYest),
        refundsPending,
        ordersToday: todayS.n,
        revenueToday: todayS.rev,
      },
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      trend,
      categories: categories.map((c) => ({ name: c._id, value: c.value, pct: Math.round((c.value / catTotal) * 100) })),
      lowStock,
      bestSellers: best,
      newCustomers: newCustomers.map((c) => ({ ...c.toJSON(), orders: newCustStats.find((s) => String(s._id) === String(c._id))?.n ?? 0, spent: newCustStats.find((s) => String(s._id) === String(c._id))?.spent ?? 0 })),
      partners: Object.fromEntries(partners.map((p) => [p._id, p.n])),
      recentOrders: perms.includes('orders') ? recent : [],
      activity,
      earnings,
    });
  }),
);

// ---------------- Payments ----------------
r.get(
  '/payments',
  can('payments'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.method && req.query.method !== 'all') filter.method = String(req.query.method);
    if (req.query.status && req.query.status !== 'all') filter.status = String(req.query.status);
    if (req.query.from) filter.createdAt = { $gte: rangeStart(req.query.from) };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      const [orders, users] = await Promise.all([Order.find({ orderNumber: rx }).select('_id'), User.find({ name: rx }).select('_id')]);
      filter.$or = [{ order: { $in: orders.map((o) => o._id) } }, { customer: { $in: users.map((u) => u._id) } }, { providerPaymentId: rx }, { providerOrderId: rx }];
    }
    const trendDays = [7, 30, 90].includes(Number(req.query.trendDays)) ? Number(req.query.trendDays) : 30;
    const from30 = new Date(startOfDay().getTime() - (trendDays - 1) * DAY);
    const [items, total, summary, methods, trend] = await Promise.all([
      Payment.find(filter).populate('order', 'orderNumber totals').populate('customer', 'name phone email avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $group: { _id: '$method', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: from30 } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } }, s: '$status' }, amount: { $sum: '$amount' } } },
      ]),
    ]);
    const series = Array.from({ length: trendDays }, (_, i) => {
      const d = new Date(from30.getTime() + i * DAY);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const get = (s: string) => trend.filter((t) => t._id.d === key && (s === 'refunded' ? ['refunded', 'refund_pending'].includes(t._id.s) : t._id.s === s)).reduce((a, t) => a + t.amount, 0);
      return { label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), successful: get('paid'), failed: get('failed'), refunded: get('refunded') };
    });
    res.json({ items, total, page, limit, summary: Object.fromEntries(summary.map((s) => [s._id, { n: s.n, amount: s.amount }])), methods, trend: series });
  }),
);
r.get(
  '/payments/:id',
  can('payments'),
  ah(async (req, res) => {
    const payment = await Payment.findById(req.params.id).populate('order').populate('customer', 'name phone email avatar');
    if (!payment) throw notFound();
    res.json({ payment, refunds: await Refund.find({ payment: payment._id }) });
  }),
);
r.post(
  '/payments/:id/refund',
  can('payments'),
  ah(async (req, res) => {
    const { reason, amount } = parse(z.object({ reason: z.string().min(3), amount: z.number().positive().optional() }), req.body);
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw notFound();
    if (payment.status !== 'paid') throw badRequest('Only successful payments can be refunded');
    const refundAmount = Math.min(amount ?? payment.amount!, payment.amount!);
    let providerRefundId: string | undefined;
    let status: 'pending' | 'processed' = 'pending';
    if (payment.provider === 'razorpay' && razorpay && payment.providerPaymentId) {
      const rf = await razorpay.payments.refund(payment.providerPaymentId, { amount: Math.round(refundAmount * 100) });
      providerRefundId = rf.id;
    }
    if (payment.provider === 'cod') status = 'processed'; // cash refunds are settled offline by finance
    const refund = await Refund.create({ payment: payment._id, order: payment.order, amount: refundAmount, reason, providerRefundId, status });
    payment.status = status === 'processed' ? 'refunded' : 'refund_pending';
    payment.logs.push({ event: `Refund ${status === 'processed' ? 'processed' : 'initiated'} (₹${refundAmount})` });
    await payment.save();
    await Order.updateOne({ _id: payment.order }, { paymentStatus: payment.status });
    await audit(req, 'payment.refund', 'Payment', String(payment._id), `₹${refundAmount}: ${reason}`);
    res.json({ payment, refund });
  }),
);
r.post(
  '/payments/:id/mark-failed',
  can('payments'),
  ah(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw notFound();
    if (payment.status !== 'pending') throw badRequest('Only pending payments can be marked as failed');
    payment.status = 'failed';
    payment.logs.push({ event: 'Marked failed by finance' });
    await payment.save();
    await Order.updateOne({ _id: payment.order }, { paymentStatus: 'failed' });
    await audit(req, 'payment.mark_failed', 'Payment', String(payment._id));
    res.json({ payment });
  }),
);
r.get('/refunds', can('payments'), ah(async (_req, res) => res.json({ items: await Refund.find().populate('order', 'orderNumber').sort({ createdAt: -1 }).limit(100) })));
r.patch(
  '/refunds/:id',
  can('payments'),
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['processed', 'failed']) }), req.body);
    const refund = await Refund.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!refund) throw notFound();
    if (status === 'processed') {
      await Payment.updateOne({ _id: refund.payment }, { status: 'refunded', $push: { logs: { event: 'Refund processed' } } });
      await Order.updateOne({ _id: refund.order }, { paymentStatus: 'refunded' });
      const order = await Order.findById(refund.order);
      if (order) await notify(String(order.customer), 'Refund processed', `Your refund of ₹${refund.amount} for #${order.orderNumber} has been processed.`, 'order', { order: order._id });
    }
    await audit(req, `refund.${status}`, 'Refund', String(refund._id));
    res.json({ refund });
  }),
);

// ---------------- Reports ----------------
r.get(
  '/reports',
  can('reports'),
  ah(async (req, res) => {
    const from = rangeStart(req.query.range ?? '30d');
    const days = Math.round((Date.now() - from.getTime()) / DAY) + 1;
    const prevFrom = new Date(from.getTime() - days * DAY);
    const totals = async (a: Date, b?: Date) => {
      const m = await Order.aggregate([{ $match: { createdAt: { $gte: a, ...(b ? { $lt: b } : {}) }, ...validOrders } }, { $group: { _id: null, n: { $sum: 1 }, rev: { $sum: '$totals.grandTotal' } } }]);
      return { n: m[0]?.n ?? 0, rev: m[0]?.rev ?? 0 };
    };
    const { page, limit, skip } = paginate(req.query);
    const tableFilter: Record<string, unknown> = { createdAt: { $gte: from } };
    if (req.query.status && req.query.status !== 'all') tableFilter.status = String(req.query.status);
    if (req.query.method && req.query.method !== 'all') tableFilter.paymentMethod = String(req.query.method);
    const [cur, prev, customers, custPrev, series, byCategory, byStatus, byMethod, repeat, topProducts, topCustomers, rows, rowCount] = await Promise.all([
      totals(from),
      totals(prevFrom, from),
      User.countDocuments({ roles: 'customer' }),
      User.countDocuments({ roles: 'customer', createdAt: { $lt: from } }),
      seriesFor(req.query.range ?? '30d'),
      salesByCategory(from),
      Order.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: '$paymentMethod', n: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: '$customer', n: { $sum: 1 } } }, { $group: { _id: { $gt: ['$n', 1] }, c: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from }, ...validOrders } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, unit: { $first: '$items.unit' }, image: { $first: '$items.image' }, orders: { $sum: 1 }, revenue: { $sum: '$items.lineTotal' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from }, ...validOrders } },
        { $group: { _id: '$customer', orders: { $sum: 1 }, revenue: { $sum: '$totals.grandTotal' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { orders: 1, revenue: 1, name: { $first: '$u.name' }, avatar: { $first: '$u.avatar' } } },
      ]),
      Order.find(tableFilter).populate('customer', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).select('orderNumber customer items totals paymentMethod status createdAt'),
      Order.countDocuments(tableFilter),
    ]);
    const catTotal = byCategory.reduce((s, c) => s + c.value, 0) || 1;
    res.json({
      kpis: {
        sales: cur.rev,
        salesChange: pct(cur.rev, prev.rev),
        orders: cur.n,
        ordersChange: pct(cur.n, prev.n),
        customers,
        customersChange: pct(customers, custPrev),
        aov: cur.n ? Math.round(cur.rev / cur.n) : 0,
        aovChange: pct(cur.n ? cur.rev / cur.n : 0, prev.n ? prev.rev / prev.n : 0),
      },
      series,
      byCategory: byCategory.map((c) => ({ name: c._id, value: c.value, pct: Math.round((c.value / catTotal) * 100) })),
      byStatus,
      byMethod,
      customerTypes: { returning: repeat.find((r) => r._id === true)?.c ?? 0, new: repeat.find((r) => r._id === false)?.c ?? 0 },
      topProducts,
      topCustomers,
      rows,
      total: rowCount,
      page,
      limit,
    });
  }),
);
r.get(
  '/reports/export',
  can('reports'),
  ah(async (req, res) => {
    const from = rangeStart(req.query.range ?? '30d');
    const orders = await Order.find({ createdAt: { $gte: from } }).populate('customer', 'name').sort({ createdAt: -1 });
    const rows = [['Date', 'Order ID', 'Customer', 'Items', 'Amount', 'Payment Method', 'Payment Status', 'Order Status']];
    for (const o of orders) {
      const c = o.customer as unknown as { name?: string };
      rows.push([o.createdAt.toISOString(), o.orderNumber, c?.name ?? '', String(o.items.length), String(o.totals?.grandTotal ?? 0), o.paymentMethod, o.paymentStatus, o.status]);
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vsr-sales-report.csv"`);
    res.send(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
  }),
);

// ---------------- Banners & coupons ----------------
const bannerInput = z.object({
  title: z.string().min(2).max(80),
  subtitle: z.string().max(140).optional(),
  buttonText: z.string().max(30).optional(),
  linkType: z.enum(['category', 'product', 'offer', 'url']).default('category'),
  linkValue: z.string().optional(),
  image: z.string().url(),
  position: z.enum(['homepage', 'category', 'offer', 'app']).default('homepage'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  priority: z.coerce.number().int().min(1).default(1),
  status: z.enum(['active', 'inactive']).default('active'),
}).refine((b) => !b.startDate || !b.endDate || b.endDate >= b.startDate, { message: 'End date must be after start date', path: ['endDate'] });

r.get(
  '/banners',
  can('marketing'),
  ah(async (req, res) => {
    const now = new Date();
    const filter: Record<string, unknown> = {};
    if (req.query.tab === 'active') Object.assign(filter, { status: 'active', $or: [{ endDate: null }, { endDate: { $gte: now } }] });
    if (req.query.tab === 'expired') filter.endDate = { $lt: now };
    if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q)), 'i');
    const [items, total, activeOffers, coupons, revenue] = await Promise.all([
      Banner.find(filter).sort({ position: 1, priority: 1 }),
      Banner.countDocuments(),
      Coupon.countDocuments({ status: 'active' }),
      Coupon.find().sort({ createdAt: -1 }),
      Order.aggregate([{ $match: { 'totals.couponCode': { $ne: null }, ...validOrders } }, { $group: { _id: null, v: { $sum: '$totals.grandTotal' } } }]),
    ]);
    res.json({ items, stats: { banners: total, activeOffers, coupons: coupons.length, couponUsage: coupons.reduce((s, c) => s + c.used, 0), offerRevenue: revenue[0]?.v ?? 0 }, coupons });
  }),
);
// ------------------------------------------------------------ Home screen layout (app + web storefront)
r.get('/home-layout', can('marketing'), ah(async (_req, res) => {
  const layout = await getHomeLayout();
  const ids = layout.sections.flatMap((x) => [...(x.productIds as unknown[]), ...(((x as { excludedIds?: unknown[] }).excludedIds) ?? [])].map(String));
  const [products, categories] = await Promise.all([
    Product.find({ _id: { $in: ids } }).select('name images price mrp status unit'),
    Category.find({ _id: { $in: layout.categoryIds.map(String) } }).select('name image parent status').populate('parent', 'name'),
  ]);
  res.json({ ...layout, products, categories });
}));
const homeLayoutInput = z.object({
  sections: z
    .array(
      z.object({
        key: z.enum([...SECTION_KEYS, 'category']),
        categoryId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
        title: z.string().trim().min(1).max(40),
        enabled: z.boolean(),
        autoFill: z.boolean(),
        productIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(20),
        excludedIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200).default([]),
      }),
    )
    .max(SECTION_KEYS.length + 10)
    .refine((a) => SECTION_KEYS.every((k) => a.filter((x) => x.key === k).length === 1), 'Each built-in row must appear exactly once')
    .refine((a) => a.every((x) => x.key !== 'category' || x.categoryId), 'Pick a category for each category row')
    .refine((a) => a.filter((x) => x.key === 'category').length <= 10, 'Up to 10 category rows'),
  categoryIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(24),
});
r.put('/home-layout', can('marketing'), ah(async (req, res) => {
  const body = parse(homeLayoutInput, req.body);
  const subs = await Category.countDocuments({ _id: { $in: body.categoryIds }, parent: { $ne: null } });
  if (subs) throw badRequest('Shop by Category lists top-level categories only. Show a subcategory as a product row instead.');
  await HomeLayout.findOneAndUpdate({ singleton: 'home' }, { singleton: 'home', ...body }, { upsert: true, new: true });
  await audit(req, 'home_layout.update', 'HomeLayout', 'home', 'Home screen layout updated');
  res.json(await getHomeLayout());
}));

r.post('/banners', can('marketing'), ah(async (req, res) => {
  const b = await Banner.create(parse(bannerInput, req.body));
  await audit(req, 'banner.create', 'Banner', String(b._id), b.title);
  res.status(201).json({ banner: b });
}));
r.put('/banners/:id', can('marketing'), ah(async (req, res) => {
  const b = await Banner.findByIdAndUpdate(req.params.id, parse(bannerInput, req.body), { new: true });
  if (!b) throw notFound();
  await audit(req, 'banner.update', 'Banner', String(b._id), b.title);
  res.json({ banner: b });
}));
r.post('/banners/:id/duplicate', can('marketing'), ah(async (req, res) => {
  const b = await Banner.findById(req.params.id).lean();
  if (!b) throw notFound();
  const { _id, ...rest } = b;
  res.status(201).json({ banner: await Banner.create({ ...rest, title: `${b.title} (Copy)`, status: 'inactive' }) });
}));
r.delete('/banners/:id', can('marketing'), ah(async (req, res) => {
  await Banner.deleteOne({ _id: req.params.id });
  await audit(req, 'banner.delete', 'Banner', req.params.id);
  res.json({ ok: true });
}));

const couponInput = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only'),
  name: z.string().optional(),
  type: z.enum(['percent', 'flat', 'free_delivery']),
  value: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  minOrder: z.coerce.number().min(0).default(0),
  usageLimit: z.coerce.number().int().min(1).default(1000),
  perCustomerLimit: z.coerce.number().int().min(1).default(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
}).refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'Percent cannot exceed 100', path: ['value'] });
r.post('/coupons', can('marketing'), ah(async (req, res) => {
  const c = await Coupon.create(parse(couponInput, req.body));
  await audit(req, 'coupon.create', 'Coupon', String(c._id), c.code);
  res.status(201).json({ coupon: c });
}));
r.put('/coupons/:id', can('marketing'), ah(async (req, res) => {
  const c = await Coupon.findByIdAndUpdate(req.params.id, parse(couponInput, req.body), { new: true });
  if (!c) throw notFound();
  await audit(req, 'coupon.update', 'Coupon', String(c._id), c.code);
  res.json({ coupon: c });
}));
r.delete('/coupons/:id', can('marketing'), ah(async (req, res) => {
  await Coupon.deleteOne({ _id: req.params.id });
  await audit(req, 'coupon.delete', 'Coupon', req.params.id);
  res.json({ ok: true });
}));

// ---------------- Notifications ----------------
r.get('/notifications', can('dashboard'), ah(async (req, res) => {
  const [items, staff] = await Promise.all([
    Notification.find({ audience: { $in: ['all_customers', 'user'] } }).populate('recipient', 'name').sort({ createdAt: -1 }).limit(100),
    // Staff bell: new orders + low stock + open tickets
    Promise.all([Order.countDocuments({ status: 'placed' }), SupportTicket.countDocuments({ status: 'open' }), Refund.countDocuments({ status: 'pending' })]),
  ]);
  res.json({ items, bell: { newOrders: staff[0], openTickets: staff[1], pendingRefunds: staff[2] } });
}));
r.post('/notifications', can('notifications'), ah(async (req, res) => {
  const body = parse(z.object({ title: z.string().min(2).max(80), body: z.string().min(2).max(300), kind: z.enum(['offer', 'system', 'order']).default('offer'), customerId: z.string().optional() }), req.body);
  // Promotional messages go only to all customers here; consent handling is a provider concern (PRD §7.11)
  const n = await Notification.create({ title: body.title, body: body.body, kind: body.kind, recipient: body.customerId ?? null, audience: body.customerId ? 'user' : 'all_customers' });
  await audit(req, 'notification.send', 'Notification', String(n._id), body.title);
  res.status(201).json({ notification: n });
}));

// ---------------- Support & returns ----------------
r.get(
  '/support',
  can('support'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = { isReturn: req.query.tab === 'returns' };
    if (req.query.issueType && req.query.issueType !== 'all') filter.issueType = String(req.query.issueType);
    if (req.query.status && req.query.status !== 'all') filter.status = String(req.query.status);
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      const users = await User.find({ name: rx }).select('_id');
      filter.$or = [{ ticketNumber: rx }, { subject: rx }, { customer: { $in: users.map((u) => u._id) } }];
    }
    const trendDays = [7, 14, 30].includes(Number(req.query.trendDays)) ? Number(req.query.trendDays) : 7;
    const from7 = new Date(startOfDay().getTime() - (trendDays - 1) * DAY);
    const [items, total, counts, returns, types, trendRaw] = await Promise.all([
      SupportTicket.find(filter).populate('customer', 'name avatar').populate('order', 'orderNumber').sort({ createdAt: -1 }).skip(skip).limit(limit),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      SupportTicket.countDocuments({ isReturn: true }),
      SupportTicket.aggregate([{ $group: { _id: '$issueType', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      SupportTicket.aggregate([
        { $match: { $or: [{ createdAt: { $gte: from7 } }, { updatedAt: { $gte: from7 } }] } },
        { $project: { c: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } }, u: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt', timezone: '+05:30' } }, status: 1 } },
      ]),
    ]);
    const trend = Array.from({ length: trendDays }, (_, i) => {
      const d = new Date(from7.getTime() + i * DAY);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return {
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        created: trendRaw.filter((t) => t.c === key).length,
        resolved: trendRaw.filter((t) => t.u === key && t.status === 'resolved').length,
        open: trendRaw.filter((t) => t.c === key && t.status === 'open').length,
      };
    });
    res.json({ items, total, page, limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])), returns, types, trend });
  }),
);
r.get(
  '/support/:id',
  can('support'),
  ah(async (req, res) => {
    const t = await SupportTicket.findById(req.params.id)
      .populate('customer', 'name phone email avatar tags')
      .populate('order', 'orderNumber items totals status')
      .populate('assignedTo', 'name avatar')
      .populate('messages.author', 'name avatar');
    if (!t) throw notFound();
    res.json({ ticket: t, agents: await User.find({ roles: { $in: ['support_agent', 'super_admin'] }, status: 'active' }).select('name avatar') });
  }),
);
r.patch(
  '/support/:id',
  can('support'),
  ah(async (req, res) => {
    const body = parse(z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'medium', 'high']).optional(), assignedTo: z.string().nullable().optional(), dueDate: z.coerce.date().nullable().optional() }), req.body);
    const t = await SupportTicket.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!t) throw notFound();
    if (body.status === 'resolved') await notify(String(t.customer), `Ticket ${t.ticketNumber} resolved`, `Your support request "${t.subject}" has been resolved.`, 'system');
    await audit(req, 'ticket.update', 'SupportTicket', String(t._id), JSON.stringify(body));
    res.json({ ticket: t });
  }),
);
r.post(
  '/support/:id/messages',
  can('support'),
  ah(async (req, res) => {
    const { text, internal } = parse(z.object({ text: z.string().min(1).max(2000), internal: z.boolean().default(false) }), req.body);
    const t = await SupportTicket.findById(req.params.id);
    if (!t) throw notFound();
    t.messages.push({ from: internal ? 'internal' : 'agent', author: req.user!.id as never, text, at: new Date() });
    if (t.status === 'open' && !internal) t.status = 'in_progress';
    await t.save();
    if (!internal) await notify(String(t.customer), `Reply on ${t.ticketNumber}`, text.slice(0, 120), 'system');
    res.json({ ticket: t });
  }),
);

// Global search (header)
r.get(
  '/search',
  can('dashboard'),
  ah(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ orders: [], customers: [], products: [] });
    const rx = new RegExp(escapeRegex(q), 'i');
    const p = req.user!.permissions;
    const [orders, customers, products, categories] = await Promise.all([
      p.includes('orders') ? Order.find({ orderNumber: rx }).limit(5).select('orderNumber status') : [],
      p.includes('customers') ? User.find({ roles: 'customer', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).limit(5).select('name email') : [],
      p.includes('products') || p.includes('inventory') ? Product.find({ $or: [{ name: rx }, { sku: rx }] }).limit(5).select('name sku') : [],
      p.includes('categories') ? Category.find({ name: rx }).limit(3).select('name') : [],
    ]);
    res.json({ orders, customers, products, categories });
  }),
);

export default r;
