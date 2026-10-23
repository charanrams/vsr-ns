import { Router, Request } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Order, Payment, Refund, OrderState, ORDER_STATES } from '../../models/Order';
import { Product } from '../../models/Catalog';
import { DeliveryPartner } from '../../models/Ops';
import { User } from '../../models/User';
import { ah, parse, paginate, escapeRegex, notFound, badRequest, conflict } from '../../utils/http';
import { can } from '../../middleware/auth';
import { assertTransition, reserveStock, releaseStock, fulfillStock, RESERVED_STATES } from '../../utils/orders';
import { audit, notify } from '../../utils/services';
import { generateOtp, sha256 } from '../../utils/security';

const r = Router();
r.use(can('orders'));

const STATUS_COPY: Partial<Record<OrderState, string>> = {
  confirmed: 'Your order has been confirmed and will be prepared shortly.',
  picking: 'We are picking your items.',
  packed: 'Your order is packed and ready.',
  assigned: 'A delivery partner has been assigned to your order.',
  out_for_delivery: 'Your order is out for delivery.',
  delivered: 'Your order has been delivered. Enjoy!',
  rejected: 'Unfortunately we could not accept your order.',
  cancelled: 'Your order has been cancelled.',
};

async function transition(req: Request, orderId: string, to: OrderState, reason?: string, extra?: (o: InstanceType<typeof Order>) => void | Promise<void>) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order not found');
  const from = order.status as OrderState;
  assertTransition(from, to);
  if (extra) await extra(order);
  order.history.push({ from, to, actor: new Types.ObjectId(req.user!.id), actorRole: req.user!.roles[0], reason, at: new Date() });
  order.status = to;
  await order.save();
  await audit(req, `order.${to}`, 'Order', String(order._id), `${order.orderNumber}: ${from} → ${to}${reason ? ` (${reason})` : ''}`);
  if (STATUS_COPY[to]) await notify(String(order.customer), `Order #${order.orderNumber}`, STATUS_COPY[to]! + (reason && to !== 'cancelled' ? ` Reason: ${reason}` : ''), 'order', { order: order._id });
  return order;
}

async function createRefundIfPaid(order: InstanceType<typeof Order>, reason: string) {
  if (order.paymentStatus !== 'paid') return;
  const payment = await Payment.findOne({ order: order._id, status: 'paid' });
  await Refund.create({ order: order._id, payment: payment?._id, amount: order.totals?.grandTotal, reason, status: 'pending' });
  if (payment) {
    payment.status = 'refund_pending';
    payment.logs.push({ event: 'Refund requested' });
    await payment.save();
  }
  order.paymentStatus = 'refund_pending';
}

r.get(
  '/',
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = {};
    const status = String(req.query.status ?? '');
    if (status === 'processing') filter.status = { $in: ['confirmed', 'picking', 'packed', 'assigned'] };
    else if (status === 'returns') filter.status = { $in: ['return_requested', 'returned'] };
    else if (status === 'cancelled') filter.status = { $in: ['cancelled', 'rejected'] };
    else if ((ORDER_STATES as readonly string[]).includes(status)) filter.status = status;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      const customers = await User.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(50);
      filter.$or = [{ orderNumber: rx }, { customer: { $in: customers.map((c) => c._id) } }];
    }
    const [items, total, counts] = await Promise.all([
      Order.find(filter).populate('customer', 'name phone email avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
      Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    res.json({ items, total, page, limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone email avatar createdAt')
      .populate('deliveryPartner')
      .populate('history.actor', 'name')
      .populate('notes.by', 'name avatar');
    if (!order) throw notFound('Order not found');
    const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } }).select('stock images variants');
    // Keyed by product, and by "product:variant" for sized lines
    const stock: Record<string, { onHand: number; reserved: number; available: number; threshold: number }> = {};
    for (const p of products) {
      stock[String(p._id)] = { onHand: p.stock.onHand, reserved: p.stock.reserved, available: Math.max(0, p.stock.onHand - p.stock.reserved), threshold: p.stock.threshold };
      for (const v of p.variants ?? []) {
        const onHand = v.stock ?? 0, reserved = v.reserved ?? 0;
        stock[`${p._id}:${v._id}`] = { onHand, reserved, available: Math.max(0, onHand - reserved), threshold: p.stock.threshold };
      }
    }
    const customer = order.customer as unknown as { _id: Types.ObjectId };
    const [stats, payment, partners, neighbours] = await Promise.all([
      Order.aggregate([{ $match: { customer: customer._id, status: { $nin: ['cancelled', 'rejected'] } } }, { $group: { _id: null, n: { $sum: 1 }, spent: { $sum: '$totals.grandTotal' }, rating: { $avg: '$rating' } } }]),
      Payment.findOne({ order: order._id }),
      DeliveryPartner.find({ availability: 'online', kycStatus: 'verified' }).sort({ distanceKm: 1 }).limit(6),
      Promise.all([
        Order.findOne({ createdAt: { $lt: order.createdAt } }).sort({ createdAt: -1 }).select('_id'),
        Order.findOne({ createdAt: { $gt: order.createdAt } }).sort({ createdAt: 1 }).select('_id'),
      ]),
    ]);
    res.json({
      order,
      stock,
      payment,
      customerStats: { orders: stats[0]?.n ?? 0, spent: stats[0]?.spent ?? 0, rating: stats[0]?.rating ? Math.round(stats[0].rating * 10) / 10 : null },
      partners,
      prevId: neighbours[0]?._id ?? null,
      nextId: neighbours[1]?._id ?? null,
    });
  }),
);

// Accept: revalidate, reserve atomically, verify payment (PRD §7.3)
r.post(
  '/:id/accept',
  ah(async (req, res) => {
    const order = await transition(req, req.params.id, 'confirmed', undefined, async (o) => {
      if (o.paymentMethod !== 'cod' && o.paymentStatus !== 'paid') throw conflict('Payment is not confirmed yet. Wait for payment verification before accepting.');
      await reserveStock(o._id, o.orderNumber, o.items.map((i) => ({ product: i.product, quantity: i.quantity!, variant: i.variant ?? null })), req.user!.id);
    });
    res.json({ order });
  }),
);

r.post(
  '/:id/reject',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().min(3, 'A rejection reason is required').max(300) }), req.body);
    const order = await transition(req, req.params.id, 'rejected', reason, async (o) => {
      o.rejectionReason = reason;
      await createRefundIfPaid(o, `Order rejected: ${reason}`);
    });
    res.json({ order });
  }),
);

r.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().min(3).max(300) }), req.body);
    const order = await transition(req, req.params.id, 'cancelled', reason, async (o) => {
      if (RESERVED_STATES.includes(o.status as OrderState)) await releaseStock(o.orderNumber, o.items.map((i) => ({ product: i.product, quantity: i.quantity!, variant: i.variant ?? null })), req.user!.id);
      o.cancelReason = reason;
      await createRefundIfPaid(o, `Order cancelled: ${reason}`);
    });
    res.json({ order });
  }),
);

// Simple forward steps
r.post(
  '/:id/status',
  ah(async (req, res) => {
    const { status, reason } = parse(z.object({ status: z.enum(['picking', 'packed', 'out_for_delivery', 'delivery_failed', 'returned', 'delivered']), reason: z.string().max(300).optional() }), req.body);
    if (status === 'delivered') throw badRequest('Use delivery OTP verification to mark delivered');
    const order = await transition(req, req.params.id, status, reason, async (o) => {
      if (status === 'out_for_delivery') {
        const code = generateOtp();
        o.deliveryOtp = { codeHash: sha256(code), plain: code, expiresAt: new Date(Date.now() + 6 * 3600e3), attempts: 0 };
        if (o.deliveryPartner) await DeliveryPartner.updateOne({ _id: o.deliveryPartner }, { availability: 'on_delivery' });
      }
      if (status === 'returned') {
        for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { 'stock.onHand': i.quantity! } });
        await createRefundIfPaid(o, 'Order returned');
      }
    });
    res.json({ order });
  }),
);

r.post(
  '/:id/assign',
  ah(async (req, res) => {
    const { partnerId } = parse(z.object({ partnerId: z.string() }), req.body);
    const partner = await DeliveryPartner.findOne({ _id: partnerId, kycStatus: 'verified' });
    if (!partner) throw badRequest('Delivery partner not available');
    const order = await transition(req, req.params.id, 'assigned', `Assigned to ${partner.name}`, (o) => {
      o.deliveryPartner = partner._id;
    });
    res.json({ order });
  }),
);

// Delivery OTP: single-use, time-limited, attempt-limited (PRD §6.7)
r.post(
  '/:id/deliver',
  ah(async (req, res) => {
    const { otp } = parse(z.object({ otp: z.string().length(6) }), req.body);
    const o = await Order.findById(req.params.id).select('+deliveryOtp.codeHash');
    if (!o) throw notFound('Order not found');
    if (o.status !== 'out_for_delivery') throw conflict('Order is not out for delivery');
    const d = o.deliveryOtp;
    if (!d?.codeHash || d.usedAt || !d.expiresAt || d.expiresAt < new Date()) throw badRequest('Delivery code expired. Mark as failed and reassign.');
    if ((d.attempts ?? 0) >= 5) throw badRequest('Too many incorrect attempts');
    if (d.codeHash !== sha256(otp)) {
      await Order.updateOne({ _id: o._id }, { $inc: { 'deliveryOtp.attempts': 1 } });
      throw badRequest('Incorrect delivery code');
    }
    const order = await transition(req, req.params.id, 'delivered', 'Delivery code verified', async (x) => {
      x.deliveryOtp = { ...x.deliveryOtp, usedAt: new Date(), plain: undefined } as typeof x.deliveryOtp;
      x.deliveredAt = new Date();
      if (x.paymentMethod === 'cod') {
        x.paymentStatus = 'paid';
        await Payment.updateOne({ order: x._id }, { status: 'paid', verifiedAt: new Date(), $push: { logs: { event: 'Cash collected on delivery' } } });
      }
      await fulfillStock(x.orderNumber, x.items.map((i) => ({ product: i.product, quantity: i.quantity!, variant: i.variant ?? null })), req.user!.id);
      if (x.deliveryPartner) await DeliveryPartner.updateOne({ _id: x.deliveryPartner }, { availability: 'online', $inc: { deliveries: 1 } });
    });
    res.json({ order });
  }),
);

r.post(
  '/:id/notes',
  ah(async (req, res) => {
    const { text } = parse(z.object({ text: z.string().min(1).max(500) }), req.body);
    const order = await Order.findByIdAndUpdate(req.params.id, { $push: { notes: { text, by: req.user!.id, at: new Date() } } }, { new: true }).populate('notes.by', 'name avatar');
    if (!order) throw notFound();
    res.json({ notes: order.notes });
  }),
);

export default r;
