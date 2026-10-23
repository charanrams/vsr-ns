import mongoose, { ClientSession, Types } from 'mongoose';
import { Product, InventoryMovement } from '../models/Catalog';
import { Order, Counter, OrderState } from '../models/Order';
import { Coupon } from '../models/Ops';
import { badRequest, conflict } from './http';

export const FREE_DELIVERY_ABOVE = 499;
export const DELIVERY_FEE = 30;
export const PACKAGING_FEE = 10;

/** Allowed state machine transitions (PRD §6.7). Clients can never jump arbitrarily. */
export const TRANSITIONS: Record<OrderState, OrderState[]> = {
  placed: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['assigned', 'cancelled'],
  assigned: ['out_for_delivery', 'packed'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivery_failed: ['assigned', 'cancelled'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: [],
  rejected: [],
  cancelled: [],
};
/** States in which stock is reserved for the order. */
export const RESERVED_STATES: OrderState[] = ['confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'];

export function assertTransition(from: OrderState, to: OrderState) {
  if (!TRANSITIONS[from]?.includes(to)) throw conflict(`Order cannot move from "${from}" to "${to}"`);
}

export async function nextOrderNumber() {
  const d = new Date();
  const key = `order-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `VSR${key.slice(6)}-${String(c!.seq).padStart(5, '0')}`;
}

export interface LineInput {
  product: string | Types.ObjectId;
  quantity: number;
  variant?: string | Types.ObjectId | null;
}

type ProductDoc = InstanceType<typeof Product>;
/** The variant a line sells: the requested one, else the product's default/first; null for products without sizes. */
export function variantFor(p: ProductDoc, variant?: string | Types.ObjectId | null) {
  if (!p.variants?.length) return null;
  if (variant) return p.variants.find((v) => String(v._id) === String(variant)) ?? undefined;
  return p.variants.find((v) => v.isDefault) ?? p.variants[0];
}
export const lineKey = (l: { product?: unknown; variant?: unknown }) => `${String(l.product)}:${l.variant ? String(l.variant) : ''}`;

/** Server-side pricing: revalidates status, price and availability for every line (PRD §6.5/6.6). */
export async function priceCart(lines: LineInput[], couponCode?: string | null) {
  const ids = lines.map((l) => l.product);
  const products = await Product.find({ _id: { $in: ids } });
  const warnings: string[] = [];
  const items = [];
  for (const line of lines) {
    const p = products.find((x) => x._id.equals(line.product));
    if (!p || p.status !== 'active') {
      warnings.push('An item in your cart is no longer available and was skipped.');
      continue;
    }
    const v = variantFor(p, line.variant);
    if (v === undefined) {
      warnings.push(`A size of ${p.name} in your cart is no longer available and was skipped.`);
      continue;
    }
    const available = v ? Math.max(0, (v.stock ?? 0) - (v.reserved ?? 0)) : Math.max(0, p.stock.onHand - p.stock.reserved);
    const price = v ? v.price : p.price;
    const outOfStock = available < line.quantity;
    if (outOfStock) warnings.push(`${p.name}${v ? ` (${v.name})` : ''}: only ${available} left in stock.`);
    items.push({
      product: p._id,
      variant: v?._id ?? null,
      variantName: v?.name ?? null,
      name: p.name,
      sku: v?.sku ?? p.sku,
      unit: v?.name ?? p.unit,
      image: p.images?.[0]?.url,
      mrp: v ? v.mrp ?? v.price : p.mrp,
      unitPrice: price,
      quantity: line.quantity,
      lineTotal: price * line.quantity,
      taxRate: p.taxRate,
      available,
      outOfStock,
    });
  }
  const itemTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  let discount = 0;
  let freeDelivery = itemTotal >= FREE_DELIVERY_ABOVE;
  let appliedCoupon: string | undefined;
  let couponError: string | undefined;
  if (couponCode) {
    const c = await Coupon.findOne({ code: couponCode.toUpperCase(), status: 'active' });
    const now = new Date();
    if (!c || (c.startDate && c.startDate > now) || (c.endDate && c.endDate < now) || c.used >= c.usageLimit) {
      couponError = 'This coupon is not valid right now.';
    } else if (itemTotal < c.minOrder) {
      couponError = `Add ₹${c.minOrder - itemTotal} more to use ${c.code}.`;
    } else {
      appliedCoupon = c.code;
      if (c.type === 'percent') discount = Math.round((itemTotal * c.value) / 100);
      else if (c.type === 'flat') discount = c.value;
      else freeDelivery = true;
      if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
      discount = Math.min(discount, itemTotal);
    }
  }
  const deliveryFee = items.length === 0 || freeDelivery ? 0 : DELIVERY_FEE;
  const packagingFee = items.length ? PACKAGING_FEE : 0;
  const tax = Math.round(items.reduce((s, i) => s + (i.lineTotal * (i.taxRate ?? 0)) / (100 + (i.taxRate ?? 0)), 0)); // GST included in price; shown for transparency
  const grandTotal = Math.max(0, itemTotal - discount + deliveryFee + packagingFee);
  return {
    items,
    warnings,
    couponError,
    totals: { itemTotal, discount, couponCode: appliedCoupon, deliveryFee, packagingFee, tax, grandTotal },
  };
}

async function inTxn<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

/** Atomically reserve stock for every line or none (PRD §7.3 Accept order). */
export function reserveStock(orderId: Types.ObjectId, orderNumber: string, items: LineInput[], actor?: string) {
  return inTxn(async (session) => {
    for (const it of items) {
      if (it.variant) {
        const p = await Product.findOne({ _id: it.product, status: 'active' }).session(session);
        const v = p?.variants.find((x) => String(x._id) === String(it.variant));
        if (!p || !v || (v.stock ?? 0) - (v.reserved ?? 0) < it.quantity) throw conflict(`Insufficient stock for ${p?.name ?? 'an item'}${v ? ` (${v.name})` : ''}. Recheck inventory before accepting.`);
        // Optimistic guard: only succeeds if reserved hasn't changed since the read (all inside the transaction)
        const r = await Product.updateOne(
          { _id: it.product, variants: { $elemMatch: { _id: v._id, reserved: v.reserved ? v.reserved : { $in: [0, null] } } } },
          { $inc: { 'variants.$.reserved': it.quantity } },
          { session },
        );
        if (!r.modifiedCount) throw conflict('Stock changed while accepting. Please try again.');
      } else {
        const updated = await Product.findOneAndUpdate(
          { _id: it.product, status: 'active', $expr: { $gte: [{ $subtract: ['$stock.onHand', '$stock.reserved'] }, it.quantity] } },
          { $inc: { 'stock.reserved': it.quantity } },
          { session, new: true },
        );
        if (!updated) {
          const p = await Product.findById(it.product).session(session);
          throw conflict(`Insufficient stock for ${p?.name ?? 'an item'}. Recheck inventory before accepting.`);
        }
      }
      await InventoryMovement.create(
        [{ product: it.product, variant: it.variant ?? undefined, delta: it.quantity, field: 'reserved', reason: 'order_reserved', reference: orderNumber, actor }],
        { session },
      );
    }
    return orderId;
  });
}

export function releaseStock(orderNumber: string, items: LineInput[], actor?: string) {
  return inTxn(async (session) => {
    for (const it of items) {
      if (it.variant) await Product.updateOne({ _id: it.product }, { $inc: { 'variants.$[v].reserved': -it.quantity } }, { session, arrayFilters: [{ 'v._id': new Types.ObjectId(String(it.variant)) }] });
      else await Product.updateOne({ _id: it.product }, { $inc: { 'stock.reserved': -it.quantity } }, { session });
      await InventoryMovement.create(
        [{ product: it.product, variant: it.variant ?? undefined, delta: -it.quantity, field: 'reserved', reason: 'order_released', reference: orderNumber, actor }],
        { session },
      );
    }
  });
}

export function fulfillStock(orderNumber: string, items: LineInput[], actor?: string) {
  return inTxn(async (session) => {
    for (const it of items) {
      if (it.variant) {
        await Product.updateOne(
          { _id: it.product },
          { $inc: { 'variants.$[v].reserved': -it.quantity, 'variants.$[v].stock': -it.quantity, soldCount: it.quantity } },
          { session, arrayFilters: [{ 'v._id': new Types.ObjectId(String(it.variant)) }] },
        );
      } else {
        await Product.updateOne(
          { _id: it.product },
          { $inc: { 'stock.reserved': -it.quantity, 'stock.onHand': -it.quantity, soldCount: it.quantity } },
          { session },
        );
      }
      await InventoryMovement.create(
        [{ product: it.product, variant: it.variant ?? undefined, delta: -it.quantity, reason: 'order_fulfilled', reference: orderNumber, actor }],
        { session },
      );
    }
  });
}

export async function adjustStock(productId: string, delta: number, reason: string, note: string | undefined, actor: string) {
  return inTxn(async (session) => {
    const p = await Product.findOneAndUpdate(
      { _id: productId, ...(delta < 0 ? { $expr: { $gte: [{ $subtract: ['$stock.onHand', '$stock.reserved'] }, -delta] } } : {}) },
      { $inc: { 'stock.onHand': delta } },
      { session, new: true },
    );
    if (!p) throw badRequest('Adjustment would make available stock negative');
    await InventoryMovement.create([{ product: productId, delta, reason, note, actor }], { session });
    return p;
  });
}

export async function loadOrder(id: string) {
  const o = await Order.findById(id);
  if (!o) throw badRequest('Order not found');
  return o;
}
