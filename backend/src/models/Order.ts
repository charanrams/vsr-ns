import { Schema, model } from 'mongoose';

export const ORDER_STATES = [
  'placed',
  'confirmed',
  'picking',
  'packed',
  'assigned',
  'out_for_delivery',
  'delivered',
  'rejected',
  'cancelled',
  'return_requested',
  'returned',
  'delivery_failed',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const PAYMENT_STATES = ['pending', 'authorized', 'paid', 'failed', 'refund_pending', 'partially_refunded', 'refunded'] as const;

const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId },
    variantName: String,
    name: String,
    sku: String,
    unit: String,
    image: String,
    mrp: Number,
    unitPrice: Number,
    quantity: { type: Number, min: 1 },
    lineTotal: Number,
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [itemSchema],
    address: {
      label: String,
      recipient: String,
      phone: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      postalCode: String,
    },
    instructions: String,
    totals: {
      itemTotal: Number,
      discount: Number,
      couponCode: String,
      deliveryFee: Number,
      packagingFee: Number,
      tax: Number,
      grandTotal: Number,
    },
    paymentMethod: { type: String, enum: ['upi', 'card', 'netbanking', 'wallet', 'cod'], required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATES, default: 'pending' },
    status: { type: String, enum: ORDER_STATES, default: 'placed', index: true },
    channel: { type: String, default: 'Mobile App' },
    deliveryPartner: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner' },
    deliveryOtp: {
      codeHash: { type: String, select: false },
      plain: { type: String, select: false }, // shown to the customer only; never returned to admins
      expiresAt: Date,
      attempts: { type: Number, default: 0 },
      usedAt: Date,
    },
    history: [
      {
        from: String,
        to: String,
        actor: { type: Schema.Types.ObjectId, ref: 'User' },
        actorRole: String,
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],
    notes: [{ text: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
    rejectionReason: String,
    cancelReason: String,
    idempotencyKey: { type: String, index: { unique: true, sparse: true } },
    deliveredAt: Date,
    rating: Number,
  },
  { timestamps: true },
);
export const Order = model('Order', orderSchema);

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User' },
    provider: { type: String, enum: ['razorpay', 'cod'], required: true },
    method: String,
    providerOrderId: String,
    providerPaymentId: { type: String, index: { unique: true, sparse: true } },
    amount: Number,
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refund_pending', 'refunded'], default: 'pending' },
    verifiedAt: Date,
    logs: [{ event: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);
export const Payment = model('Payment', paymentSchema);

const refundSchema = new Schema(
  {
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: Number,
    reason: String,
    providerRefundId: String,
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  },
  { timestamps: true },
);
export const Refund = model('Refund', refundSchema);

const cartSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{ product: { type: Schema.Types.ObjectId, ref: 'Product' }, variant: { type: Schema.Types.ObjectId }, quantity: { type: Number, min: 1 }, priceAtAdd: Number }],
    couponCode: String,
  },
  { timestamps: true },
);
export const Cart = model('Cart', cartSchema);

const counterSchema = new Schema({ _id: String, seq: Number });
export const Counter = model('Counter', counterSchema);
