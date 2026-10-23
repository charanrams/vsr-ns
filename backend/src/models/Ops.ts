import { Schema, model } from 'mongoose';

const partnerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    phone: String,
    avatar: String,
    vehicle: String,
    serviceArea: String,
    kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'verified' },
    availability: { type: String, enum: ['online', 'on_delivery', 'offline'], default: 'offline' },
    rating: { type: Number, default: 4.5 },
    deliveries: { type: Number, default: 0 },
    distanceKm: Number,
  },
  { timestamps: true },
);
export const DeliveryPartner = model('DeliveryPartner', partnerSchema);

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    buttonText: String,
    linkType: { type: String, enum: ['category', 'product', 'offer', 'url'], default: 'category' },
    linkValue: String,
    image: { type: String, required: true },
    position: { type: String, enum: ['homepage', 'category', 'offer', 'app'], default: 'homepage' },
    startDate: Date,
    endDate: Date,
    priority: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);
export const Banner = model('Banner', bannerSchema);

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: String,
    type: { type: String, enum: ['percent', 'flat', 'free_delivery'], required: true },
    value: { type: Number, default: 0 },
    maxDiscount: Number,
    minOrder: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 1000 },
    perCustomerLimit: { type: Number, default: 1 },
    used: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);
export const Coupon = model('Coupon', couponSchema);

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    issueType: { type: String, enum: ['order', 'return_refund', 'delivery', 'product', 'payment', 'other'], default: 'other' },
    subject: { type: String, required: true },
    description: String,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    isReturn: { type: Boolean, default: false },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    attachments: [String],
    returnItems: [{ product: { type: Schema.Types.ObjectId, ref: 'Product' }, name: String, quantity: Number }],
    returnReason: String,
    messages: [
      {
        from: { type: String, enum: ['customer', 'agent', 'internal'] },
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        text: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);
export const SupportTicket = model('SupportTicket', ticketSchema);

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // null = broadcast
    audience: { type: String, enum: ['user', 'all_customers', 'staff'], default: 'user' },
    kind: { type: String, enum: ['order', 'offer', 'system'], default: 'system' },
    title: { type: String, required: true },
    body: String,
    /** Optional in-app destination, e.g. /product/<id> for "Back in stock". */
    link: String,
    /** Order this is about, so a tapped push opens it (each client maps it to its own route) */
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    /** Customers who swiped this away / cleared all (broadcasts are shared, so they're hidden per user) */
    hiddenBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);
// Every saved notification is also pushed to the recipient's phones/browsers (utils/push.ts).
// insertMany (seed data) doesn't fire this, so seeding never pushes.
notificationSchema.post('save', function (doc) {
  if (process.env.NODE_ENV === 'test') return;
  void import('../utils/push').then((m) => m.pushNotification(doc));
});
export const Notification = model('Notification', notificationSchema);

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resourceType: String,
    resourceId: String,
    summary: String,
    requestId: String,
  },
  { timestamps: true },
);
export const AuditLog = model('AuditLog', auditSchema);

const kitchenSchema = new Schema(
  {
    name: { type: String, required: true },
    chef: String,
    image: String,
    area: String,
    openingHours: String,
    rating: { type: Number, default: 4.5 },
    bio: String,
    verification: { type: String, enum: ['pending', 'verified'], default: 'verified' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);
export const Kitchen = model('Kitchen', kitchenSchema);
