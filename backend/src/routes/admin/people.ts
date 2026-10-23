import { Router } from 'express';
import { z } from 'zod';
import { User } from '../../models/User';
import { Order } from '../../models/Order';
import { DeliveryPartner, Kitchen, AuditLog, SupportTicket } from '../../models/Ops';
import { ah, parse, paginate, escapeRegex, notFound, badRequest } from '../../utils/http';
import { can } from '../../middleware/auth';
import { audit } from '../../utils/services';
import { hashPassword } from '../../utils/security';
import { STAFF_ROLES } from '../../utils/roles';

const r = Router();

// ---------------- Customers ----------------
r.get(
  '/customers',
  can('customers'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = { roles: 'customer' };
    if (req.query.status && req.query.status !== 'all') filter.status = String(req.query.status);
    if (req.query.city) filter['addresses.city'] = String(req.query.city);
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const sort: Record<string, 1 | -1> = req.query.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const [users, total] = await Promise.all([User.find(filter).sort(sort).skip(skip).limit(limit), User.countDocuments(filter)]);
    const stats = await Order.aggregate([
      { $match: { customer: { $in: users.map((u) => u._id) }, status: { $nin: ['cancelled', 'rejected'] } } },
      { $group: { _id: '$customer', orders: { $sum: 1 }, spent: { $sum: '$totals.grandTotal' } } },
    ]);
    const items = users.map((u) => {
      const s = stats.find((x) => String(x._id) === String(u._id));
      const def = u.addresses.find((a) => a.isDefault) ?? u.addresses[0];
      return { ...u.toJSON(), location: def?.city ?? def?.line2 ?? '—', totalOrders: s?.orders ?? 0, totalSpent: s?.spent ?? 0 };
    });
    res.json({ items, total, page, limit });
  }),
);

r.get(
  '/customers/insights',
  can('customers'),
  ah(async (req, res) => {
    const months = Math.min(12, Math.max(3, Number(req.query.months) || 6));
    const growthFrom = new Date();
    growthFrom.setMonth(growthFrom.getMonth() - months + 1, 1);
    growthFrom.setHours(0, 0, 0, 0);
    const monthAgo = new Date(Date.now() - 30 * 864e5);
    const twoMonthsAgo = new Date(Date.now() - 60 * 864e5);
    const [total, newThis, newPrev, active, inactive, growth, locations, top] = await Promise.all([
      User.countDocuments({ roles: 'customer' }),
      User.countDocuments({ roles: 'customer', createdAt: { $gte: monthAgo } }),
      User.countDocuments({ roles: 'customer', createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
      User.countDocuments({ roles: 'customer', status: 'active' }),
      User.countDocuments({ roles: 'customer', status: { $ne: 'active' } }),
      User.aggregate([
        { $match: { roles: 'customer', createdAt: { $gte: growthFrom } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      User.aggregate([{ $match: { roles: 'customer' } }, { $unwind: '$addresses' }, { $match: { 'addresses.isDefault': true } }, { $group: { _id: '$addresses.line2', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
        { $group: { _id: '$customer', orders: { $sum: 1 }, spent: { $sum: '$totals.grandTotal' } } },
        { $sort: { orders: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { orders: 1, spent: 1, name: { $first: '$u.name' }, avatar: { $first: '$u.avatar' } } },
      ]),
    ]);
    const filled = [];
    for (const d = new Date(growthFrom); d <= new Date(); d.setMonth(d.getMonth() + 1)) {
      const row = growth.find((g) => g._id.y === d.getFullYear() && g._id.m === d.getMonth() + 1);
      filled.push({ _id: { y: d.getFullYear(), m: d.getMonth() + 1 }, n: row?.n ?? 0 });
    }
    res.json({ total, newThis, newPrev, active, inactive, growth: filled, locations, top });
  }),
);

r.get(
  '/customers/:id',
  can('customers'),
  ah(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, roles: 'customer' }).populate('notes.by', 'name');
    if (!user) throw notFound('Customer not found');
    const [orders, stats, tickets] = await Promise.all([
      Order.find({ customer: user._id }).sort({ createdAt: -1 }).limit(10).select('orderNumber status totals createdAt items'),
      Order.aggregate([{ $match: { customer: user._id, status: { $nin: ['cancelled', 'rejected'] } } }, { $group: { _id: null, n: { $sum: 1 }, spent: { $sum: '$totals.grandTotal' }, rating: { $avg: '$rating' } } }]),
      SupportTicket.find({ customer: user._id }).sort({ createdAt: -1 }).limit(5).select('ticketNumber subject status createdAt'),
    ]);
    res.json({ customer: user, orders, tickets, stats: { orders: stats[0]?.n ?? 0, spent: stats[0]?.spent ?? 0, rating: stats[0]?.rating ? Math.round(stats[0].rating * 10) / 10 : null } });
  }),
);
r.patch(
  '/customers/:id/status',
  can('customers'),
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['active', 'inactive', 'blocked']) }), req.body);
    const user = await User.findOneAndUpdate({ _id: req.params.id, roles: 'customer' }, { status }, { new: true });
    if (!user) throw notFound();
    await audit(req, `customer.${status}`, 'User', String(user._id), user.name);
    res.json({ customer: user });
  }),
);
r.post(
  '/customers/:id/notes',
  can('customers'),
  ah(async (req, res) => {
    const { text } = parse(z.object({ text: z.string().min(1).max(500) }), req.body);
    const user = await User.findOneAndUpdate({ _id: req.params.id, roles: 'customer' }, { $push: { notes: { text, by: req.user!.id, at: new Date() } } }, { new: true }).populate('notes.by', 'name');
    if (!user) throw notFound();
    res.json({ notes: user.notes });
  }),
);
r.post(
  '/customers',
  can('customers'),
  ah(async (req, res) => {
    const body = parse(z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().min(10), password: z.string().min(8) }), req.body);
    const user = await User.create({ ...body, email: body.email.toLowerCase(), passwordHash: await hashPassword(body.password), roles: ['customer'] });
    await audit(req, 'customer.create', 'User', String(user._id), user.name);
    res.status(201).json({ customer: user });
  }),
);

// ---------------- Delivery partners ----------------
const partnerInput = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  vehicle: z.string().optional(),
  serviceArea: z.string().optional(),
  avatar: z.string().url().optional().or(z.literal('')),
  kycStatus: z.enum(['pending', 'verified', 'rejected']).default('pending'),
  availability: z.enum(['online', 'on_delivery', 'offline']).default('offline'),
});
r.get(
  '/delivery-partners',
  can('delivery', 'orders'),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.availability) filter.availability = String(req.query.availability);
    if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q)), 'i');
    const [items, counts, active] = await Promise.all([
      DeliveryPartner.find(filter).sort({ availability: 1, rating: -1 }),
      DeliveryPartner.aggregate([{ $group: { _id: '$availability', n: { $sum: 1 } } }]),
      Order.find({ status: { $in: ['assigned', 'out_for_delivery'] } }).populate('customer', 'name').select('orderNumber status deliveryPartner address customer'),
    ]);
    res.json({ items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])), active });
  }),
);
r.post('/delivery-partners', can('delivery'), ah(async (req, res) => {
  const p = await DeliveryPartner.create(parse(partnerInput, req.body));
  await audit(req, 'partner.create', 'DeliveryPartner', String(p._id), p.name);
  res.status(201).json({ partner: p });
}));
r.put('/delivery-partners/:id', can('delivery'), ah(async (req, res) => {
  const p = await DeliveryPartner.findByIdAndUpdate(req.params.id, parse(partnerInput, req.body), { new: true });
  if (!p) throw notFound();
  await audit(req, 'partner.update', 'DeliveryPartner', String(p._id), p.name);
  res.json({ partner: p });
}));

// ---------------- Homemade kitchens ----------------
const kitchenInput = z.object({ name: z.string().min(2), chef: z.string().optional(), image: z.string().url().optional().or(z.literal('')), area: z.string().optional(), openingHours: z.string().optional(), verification: z.enum(['pending', 'verified']).default('pending'), status: z.enum(['active', 'inactive']).default('active') });
r.get('/kitchens', can('homemade'), ah(async (_req, res) => res.json({ items: await Kitchen.find().sort({ createdAt: -1 }) })));
r.post('/kitchens', can('homemade'), ah(async (req, res) => res.status(201).json({ kitchen: await Kitchen.create(parse(kitchenInput, req.body)) })));
r.put('/kitchens/:id', can('homemade'), ah(async (req, res) => {
  const k = await Kitchen.findByIdAndUpdate(req.params.id, parse(kitchenInput, req.body), { new: true });
  if (!k) throw notFound();
  res.json({ kitchen: k });
}));

// ---------------- Staff users (super admin) ----------------
r.get('/users', can('users'), ah(async (_req, res) => res.json({ items: await User.find({ roles: { $in: STAFF_ROLES } }).sort({ createdAt: 1 }) })));
r.post(
  '/users',
  can('users'),
  ah(async (req, res) => {
    const body = parse(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), roles: z.array(z.enum(STAFF_ROLES)).min(1) }), req.body);
    const user = await User.create({ name: body.name, email: body.email.toLowerCase(), roles: body.roles, passwordHash: await hashPassword(body.password), emailVerified: true });
    await audit(req, 'user.create', 'User', String(user._id), `${user.email} [${body.roles.join(', ')}]`);
    res.status(201).json({ user });
  }),
);
r.patch(
  '/users/:id',
  can('users'),
  ah(async (req, res) => {
    const body = parse(z.object({ roles: z.array(z.enum(STAFF_ROLES)).min(1).optional(), status: z.enum(['active', 'inactive']).optional() }), req.body);
    if (req.params.id === req.user!.id && (body.status === 'inactive' || (body.roles && !body.roles.includes('super_admin')))) throw badRequest('You cannot remove your own super admin access');
    const user = await User.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!user) throw notFound();
    await audit(req, 'user.update', 'User', String(user._id), JSON.stringify(body));
    res.json({ user });
  }),
);

r.get(
  '/audit-logs',
  can('settings', 'users'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const [items, total] = await Promise.all([AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit), AuditLog.countDocuments()]);
    res.json({ items, total, page, limit });
  }),
);

export default r;
