import { Schema, model } from 'mongoose';

const imageSchema = new Schema({ url: { type: String, required: true }, publicId: String }, { _id: false });

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    image: String,
    icon: String,
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);
export const Category = model('Category', categorySchema);

// Pack/size option with its own price and stock. `stock` = on hand; `reserved` = held by accepted orders.
const variantSchema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  isDefault: { type: Boolean, default: false },
});

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    brand: String,
    unit: { type: String, default: '1 pc' },
    type: { type: String, enum: ['physical', 'digital', 'homemade'], default: 'physical' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategory: { type: Schema.Types.ObjectId, ref: 'Category' },
    shortDescription: String,
    description: String,
    images: [imageSchema],
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 5 },
    variants: [variantSchema],
    // Inventory (PRD §7.6): available = onHand - reserved
    stock: {
      type: new Schema(
        {
          onHand: { type: Number, default: 0, min: 0, required: true },
          reserved: { type: Number, default: 0, min: 0, required: true },
          threshold: { type: Number, default: 10, min: 0, required: true },
        },
        { _id: false },
      ),
      default: () => ({}),
      required: true,
    },
    tags: [String],
    badges: [String],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    deliveryType: { type: String, enum: ['standard', 'instant'], default: 'standard' },
    weightGrams: Number,
    allergens: String,
    prepTimeMins: Number, // homemade food
    returnable: { type: Boolean, default: true },
    returnWindowDays: { type: Number, default: 2 },
    seo: { title: String, description: String },
    status: { type: String, enum: ['draft', 'active', 'inactive', 'archived'], default: 'active', index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
// Products with pack sizes sell from variant stock; others from product stock.
export function availableOf(p: { stock?: { onHand?: number; reserved?: number } | null; variants?: { stock?: number | null; reserved?: number | null }[] }) {
  if (p.variants?.length) return p.variants.reduce((s, v) => s + Math.max(0, (v.stock ?? 0) - (v.reserved ?? 0)), 0);
  return Math.max(0, (p.stock?.onHand ?? 0) - (p.stock?.reserved ?? 0));
}
productSchema.virtual('available').get(function () {
  return availableOf(this);
});
productSchema.virtual('stockStatus').get(function () {
  const a = availableOf(this);
  if (a <= 0) return 'out_of_stock';
  if (a <= (this.stock?.threshold ?? 0)) return 'low_stock';
  return 'in_stock';
});
productSchema.index({ name: 'text', tags: 'text', brand: 'text' });
export const Product = model('Product', productSchema);

const movementSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variant: { type: Schema.Types.ObjectId },
    delta: { type: Number, required: true },
    field: { type: String, enum: ['onHand', 'reserved'], default: 'onHand' },
    reason: {
      type: String,
      enum: ['initial', 'restock', 'adjustment', 'damaged', 'expired', 'order_reserved', 'order_released', 'order_fulfilled', 'return'],
      required: true,
    },
    note: String,
    reference: String,
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const InventoryMovement = model('InventoryMovement', movementSchema);

const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  },
  { timestamps: true },
);
export const Review = model('Review', reviewSchema);
