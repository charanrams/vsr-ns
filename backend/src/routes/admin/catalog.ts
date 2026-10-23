import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Category, Product, InventoryMovement, Review } from '../../models/Catalog';
import { Order } from '../../models/Order';
import { ah, parse, paginate, escapeRegex, notFound, badRequest, conflict } from '../../utils/http';
import { can } from '../../middleware/auth';
import { adjustStock } from '../../utils/orders';
import { audit, uploadImage } from '../../utils/services';
import { features } from '../../config/env';

const r = Router();
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---------------- Uploads (Cloudinary, server-side so secrets never reach clients) ----------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
r.post(
  '/uploads',
  can('products', 'categories', 'marketing', 'homemade'),
  upload.single('file'),
  ah(async (req, res) => {
    if (!features.cloudinary) throw badRequest('Image uploads are not configured. Paste an image URL instead.');
    if (!req.file) throw badRequest('Upload a JPG, PNG or WebP image up to 5MB');
    res.status(201).json(await uploadImage(req.file.buffer, String(req.query.folder ?? 'misc')));
  }),
);

// ---------------- Categories ----------------
import { homeRowCategoryIds, setCategoryHomeRow } from '../../utils/homeLayout';

const categoryInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  image: z.string().url().optional().or(z.literal('')),
  parent: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
  /** Top-level: list in "Shop by Category". Subcategory: own product row on Home (after Best Sellers). */
  showOnHome: z.boolean().optional(),
});

r.get(
  '/categories',
  can('categories', 'products', 'inventory'),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = { parent: req.query.parent ? String(req.query.parent) : null };
    if (req.query.all === '1') delete filter.parent;
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q)), 'i');
    const cats = await Category.find(filter).sort({ sortOrder: 1 }).lean();
    const ids = cats.map((c) => c._id);
    const [subCounts, byCat, bySub] = await Promise.all([
      Category.aggregate([{ $match: { parent: { $in: ids } } }, { $group: { _id: '$parent', n: { $sum: 1 } } }]),
      Product.aggregate([{ $match: { status: { $ne: 'archived' }, category: { $in: ids } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
      Product.aggregate([{ $match: { status: { $ne: 'archived' }, subcategory: { $in: ids } } }, { $group: { _id: '$subcategory', n: { $sum: 1 } } }]),
    ]);
    const count = (arr: { _id: unknown; n: number }[], id: unknown) => arr.find((x) => String(x._id) === String(id))?.n ?? 0;
    const onHome = await homeRowCategoryIds();
    const items = cats.map((c) => ({ ...c, subcategoryCount: count(subCounts, c._id), productCount: count(byCat, c._id) + count(bySub, c._id), showOnHome: onHome.has(String(c._id)) }));
    res.json({ items });
  }),
);
r.post(
  '/categories',
  can('categories'),
  ah(async (req, res) => {
    const { showOnHome, ...body } = parse(categoryInput, req.body);
    const cat = await Category.create({ ...body, parent: body.parent || null, slug: `${slugify(body.name)}-${Date.now().toString(36)}` });
    if (showOnHome !== undefined) await setCategoryHomeRow(String(cat._id), cat.name, showOnHome, !cat.parent);
    await audit(req, 'category.create', 'Category', String(cat._id), `Category "${cat.name}" created`);
    res.status(201).json({ category: cat });
  }),
);
r.put(
  '/categories/:id',
  can('categories'),
  ah(async (req, res) => {
    const { showOnHome, ...body } = parse(categoryInput, req.body);
    const cat = await Category.findByIdAndUpdate(req.params.id, { ...body, parent: body.parent || null }, { new: true });
    if (!cat) throw notFound();
    if (showOnHome !== undefined) await setCategoryHomeRow(String(cat._id), cat.name, showOnHome, !cat.parent);
    await audit(req, 'category.update', 'Category', String(cat._id), `Category "${cat.name}" updated`);
    res.json({ category: cat });
  }),
);
r.delete(
  '/categories/:id',
  can('categories'),
  ah(async (req, res) => {
    const id = req.params.id;
    // Protect dependent products and subcategories (PRD §7.5)
    if (await Product.exists({ $or: [{ category: id }, { subcategory: id }] })) throw conflict('Reassign this category’s products before deleting it.');
    if (await Category.exists({ parent: id })) throw conflict('Delete or move its subcategories first.');
    await Category.deleteOne({ _id: id });
    await audit(req, 'category.delete', 'Category', id);
    res.json({ ok: true });
  }),
);

// ---------------- Products ----------------
const productInput = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(2).max(40),
  brand: z.string().max(60).optional(),
  unit: z.string().max(30).default('1 pc'),
  type: z.enum(['physical', 'digital', 'homemade']).default('physical'),
  category: z.string(),
  subcategory: z.string().optional().nullable(),
  shortDescription: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.object({ url: z.string().url(), publicId: z.string().optional() })).max(10).default([]),
  mrp: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(28).default(5),
  variants: z.array(z.object({ name: z.string(), sku: z.string(), price: z.coerce.number().min(0), mrp: z.coerce.number().min(0).optional(), stock: z.coerce.number().int().min(0), isDefault: z.boolean().optional() })).default([]),
  initialStock: z.coerce.number().int().min(0).optional(),
  threshold: z.coerce.number().int().min(0).default(10),
  tags: z.array(z.string()).default([]),
  badges: z.array(z.string()).default([]),
  deliveryType: z.enum(['standard', 'instant']).default('standard'),
  weightGrams: z.coerce.number().optional(),
  allergens: z.string().optional(),
  seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
}).refine((p) => p.price <= p.mrp, { message: 'Selling price cannot exceed MRP', path: ['price'] });

r.get(
  '/products',
  can('products', 'inventory', 'marketing'), // marketing: product search in the Home Screen editor
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter: Record<string, unknown> = { status: { $ne: 'archived' } };
    if (req.query.status && req.query.status !== 'all') filter.status = String(req.query.status);
    // A category or subcategory id: matches products filed under either
    const and: Record<string, unknown>[] = [];
    if (req.query.category) and.push({ $or: [{ category: String(req.query.category) }, { subcategory: String(req.query.category) }] });
    if (req.query.brand) filter.brand = String(req.query.brand);
    if (req.query.minPrice || req.query.maxPrice) filter.price = { $gte: Number(req.query.minPrice) || 0, $lte: Number(req.query.maxPrice) || 1e9 };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      and.push({ $or: [{ name: rx }, { sku: rx }, { brand: rx }] });
    }
    if (and.length) filter.$and = and;
    const avail = { $subtract: ['$stock.onHand', '$stock.reserved'] };
    const stockFilters: Record<string, unknown> = {
      in_stock: { $expr: { $gt: [avail, '$stock.threshold'] } },
      low_stock: { $expr: { $and: [{ $gt: [avail, 0] }, { $lte: [avail, '$stock.threshold'] }] } },
      out_of_stock: { $expr: { $lte: [avail, 0] } },
    };
    if (req.query.stock && stockFilters[String(req.query.stock)]) Object.assign(filter, stockFilters[String(req.query.stock)]);
    const sorts: Record<string, Record<string, 1 | -1>> = { latest: { createdAt: -1 }, name: { name: 1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, updated: { updatedAt: -1 } };
    const [items, total, byCategory, brands, summary] = await Promise.all([
      Product.find(filter).populate('category', 'name').sort(sorts[String(req.query.sort)] ?? { createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
      Product.aggregate([{ $match: { status: { $ne: 'archived' } } }, { $group: { _id: '$category', n: { $sum: 1 } } }, { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } }, { $project: { n: 1, name: { $first: '$c.name' } } }, { $sort: { n: -1 } }]),
      Product.distinct('brand', { status: { $ne: 'archived' } }),
      Product.aggregate([
        { $match: { status: { $ne: 'archived' } } },
        { $project: { status: 1, a: avail, t: '$stock.threshold', value: { $multiply: ['$stock.onHand', '$price'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $ne: ['$status', 'active'] }, 1, 0] } },
            out: { $sum: { $cond: [{ $lte: ['$a', 0] }, 1, 0] } },
            low: { $sum: { $cond: [{ $and: [{ $gt: ['$a', 0] }, { $lte: ['$a', '$t'] }] }, 1, 0] } },
            value: { $sum: '$value' },
          },
        },
      ]),
    ]);
    const s = summary[0] ?? { total: 0, active: 0, out: 0, low: 0, value: 0, inactive: 0 };
    res.json({ items, total, page, limit, byCategory, brands: brands.filter(Boolean).sort(), summary: { ...s, inStock: s.total - s.out - s.low } });
  }),
);
r.get(
  '/products/:id',
  can('products', 'inventory'),
  ah(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw notFound();
    res.json({ product });
  }),
);
r.post(
  '/products',
  can('products'),
  ah(async (req, res) => {
    const { initialStock, threshold, ...body } = parse(productInput, req.body);
    const product = await Product.create({
      ...body,
      subcategory: body.subcategory || undefined,
      slug: `${slugify(body.name)}-${Date.now().toString(36)}`,
      stock: { onHand: initialStock ?? 0, reserved: 0, threshold },
    });
    if (initialStock) await InventoryMovement.create({ product: product._id, delta: initialStock, reason: 'initial', actor: req.user!.id });
    await audit(req, 'product.create', 'Product', String(product._id), `New product "${product.name}" added`);
    res.status(201).json({ product });
  }),
);
r.put(
  '/products/:id',
  can('products'),
  ah(async (req, res) => {
    // Stock is never edited here — only via inventory adjustments, so every change is audited
    const { initialStock: _ignored, threshold, ...body } = parse(productInput, req.body);
    // Keep each size's id and reserved count (matched by SKU) so open orders stay linked
    const current = await Product.findById(req.params.id).select('variants');
    if (current) {
      const incoming = body.variants ?? [];
      (body as { variants: Record<string, unknown>[] }).variants = incoming.map((v) => {
        const prev = current.variants.find((x) => x.sku === v.sku);
        return prev ? { ...v, _id: prev._id, reserved: prev.reserved ?? 0 } : v;
      });
      const dropped = current.variants.filter((x) => (x.reserved ?? 0) > 0 && !incoming.some((v) => v.sku === x.sku));
      if (dropped.length) throw badRequest(`Size "${dropped[0].name}" has stock reserved for open orders and can’t be removed yet.`);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { ...body, subcategory: body.subcategory || undefined, 'stock.threshold': threshold }, { new: true, runValidators: true });
    if (!product) throw notFound();
    await audit(req, 'product.update', 'Product', String(product._id), `Product "${product.name}" updated`);
    res.json({ product });
  }),
);
r.patch(
  '/products/:id/status',
  can('products'),
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['draft', 'active', 'inactive', 'archived']) }), req.body);
    const product = await Product.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!product) throw notFound();
    await audit(req, `product.${status}`, 'Product', String(product._id), product.name);
    res.json({ product });
  }),
);
r.post(
  '/products/:id/duplicate',
  can('products'),
  ah(async (req, res) => {
    const p = await Product.findById(req.params.id).lean();
    if (!p) throw notFound();
    const { _id, createdAt: _c, updatedAt: _u, ...rest } = p as typeof p & { createdAt: Date; updatedAt: Date };
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const copy = await Product.create({ ...rest, name: `${p.name} (Copy)`, sku: `${p.sku}-${suffix}`, slug: `${p.slug}-${suffix.toLowerCase()}`, status: 'draft', stock: { onHand: 0, reserved: 0, threshold: p.stock.threshold }, soldCount: 0, rating: 0, reviewCount: 0 });
    await audit(req, 'product.duplicate', 'Product', String(copy._id), `Duplicated "${p.name}" as a draft`);
    res.status(201).json({ product: copy });
  }),
);
// Archive rather than hard-delete: order snapshots keep history intact (PRD §10.15)
r.delete(
  '/products/:id',
  can('products'),
  ah(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!product) throw notFound();
    await audit(req, 'product.archive', 'Product', String(product._id), product.name);
    res.json({ ok: true });
  }),
);

r.get(
  '/reviews',
  can('products'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const [items, total] = await Promise.all([
      Review.find(filter).populate('product', 'name images').populate('customer', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);
r.patch(
  '/reviews/:id',
  can('products'),
  ah(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['approved', 'rejected', 'pending']) }), req.body);
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) throw notFound();
    await audit(req, `review.${status}`, 'Review', String(review._id));
    res.json({ review });
  }),
);

// ---------------- Inventory ----------------
r.get(
  '/inventory/overview',
  can('inventory'),
  ah(async (req, res) => {
    const avail = { $subtract: ['$stock.onHand', '$stock.reserved'] };
    const [low, out, activity] = await Promise.all([
      Product.find({ status: 'active', $expr: { $and: [{ $gt: [avail, 0] }, { $lte: [avail, '$stock.threshold'] }] } }).sort({ 'stock.onHand': 1 }).limit(6),
      Product.find({ status: 'active', $expr: { $lte: [avail, 0] } }).limit(6),
      InventoryMovement.find().populate('product', 'name unit').populate('actor', 'name').sort({ createdAt: -1 }).limit(8),
    ]);
    // Reconstruct month-end stock from the movement ledger: stock then = stock now − movements since.
    const months = Math.min(12, Math.max(3, Number(req.query.months) || 6));
    const prods = await Product.find({ status: { $ne: 'archived' } }).select('price stock');
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1, 1);
    since.setHours(0, 0, 0, 0);
    const moves = await InventoryMovement.find({ createdAt: { $gte: since } }).select('product delta field createdAt').lean();
    const trend: { label: string; value: number; low: number; out: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const end = new Date();
      end.setMonth(end.getMonth() - i + 1, 1);
      end.setHours(0, 0, 0, 0); // first day of the following month = end of this month
      const label = new Date(end.getFullYear(), end.getMonth() - 1, 1).toLocaleString('en-IN', { month: 'short' });
      let value = 0, low = 0, out = 0;
      for (const p of prods) {
        let onHand = p.stock.onHand, reserved = p.stock.reserved;
        for (const m of moves) {
          if (String(m.product) !== String(p._id) || m.createdAt < end) continue;
          if (m.field === 'reserved') reserved -= m.delta;
          else onHand -= m.delta;
        }
        onHand = Math.max(0, onHand);
        const avail = onHand - Math.max(0, reserved);
        value += onHand * p.price;
        if (avail <= 0) out++;
        else if (avail <= p.stock.threshold) low++;
      }
      trend.push({ label, value: Math.round(value), low, out });
    }
    res.json({ low, out, activity, trend });
  }),
);
r.post(
  '/inventory/adjust',
  can('inventory'),
  ah(async (req, res) => {
    const body = parse(
      z.object({ productId: z.string(), delta: z.coerce.number().int().refine((n) => n !== 0, 'Quantity cannot be 0'), reason: z.enum(['restock', 'adjustment', 'damaged', 'expired', 'return']), note: z.string().max(200).optional(), threshold: z.coerce.number().int().min(0).optional() }),
      req.body,
    );
    const product = await adjustStock(body.productId, body.delta, body.reason, body.note, req.user!.id);
    if (body.threshold !== undefined) {
      product.stock.threshold = body.threshold;
      await product.save();
    }
    await audit(req, 'inventory.adjust', 'Product', body.productId, `${product.name}: ${body.delta > 0 ? '+' : ''}${body.delta} (${body.reason})`);
    res.json({ product });
  }),
);
r.get(
  '/inventory/movements',
  can('inventory'),
  ah(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = req.query.product ? { product: String(req.query.product) } : {};
    const [items, total] = await Promise.all([
      InventoryMovement.find(filter).populate('product', 'name sku images unit').populate('actor', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      InventoryMovement.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);
r.get(
  '/inventory/export',
  can('inventory'),
  ah(async (_req, res) => {
    const products = await Product.find({ status: { $ne: 'archived' } }).populate('category', 'name');
    const rows = [['SKU', 'Name', 'Category', 'Brand', 'On hand', 'Reserved', 'Available', 'Threshold']];
    for (const p of products) {
      const cat = p.category as unknown as { name?: string };
      rows.push([p.sku, p.name, cat?.name ?? '', p.brand ?? '', String(p.stock.onHand), String(p.stock.reserved), String(p.stock.onHand - p.stock.reserved), String(p.stock.threshold)]);
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vsr-inventory.csv"');
    res.send(rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'));
  }),
);

// Check whether category referenced by orders — used by UI to warn
r.get('/products/:id/orders-count', can('products'), ah(async (req, res) => res.json({ count: await Order.countDocuments({ 'items.product': req.params.id }) })));

export default r;
