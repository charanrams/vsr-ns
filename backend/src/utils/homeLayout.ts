import { Schema, model, type Types } from 'mongoose';
import { Category, Product } from '../models/Catalog';

/**
 * Admin-controlled Home screen (app + web storefront).
 * - sections: which product rows show, in what order, with what title; each can pin products to the
 *   front and optionally fill the rest automatically (best sellers, deals…).
 * - categoryIds: which categories / subcategories appear in "Shop by Category", in order (empty = all top-level).
 * - category rows (key 'category' + categoryId): any number of extra product rows for one category or
 *   subcategory, placed anywhere in the order (e.g. "Sweets" right after Best Sellers).
 */
// No built-in Homemade row: homemade (like every category) shows only when switched on as a category row
export const SECTION_KEYS = ['categories', 'recommended', 'deals', 'bestSellers', 'recent'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const DEFAULT_TITLES: Record<SectionKey, string> = {
  categories: 'Shop by Category',
  recommended: 'Recommended for You',
  deals: 'Today’s Deals',
  bestSellers: 'Best Sellers',
  recent: 'Recently Viewed',
};
export const DEFAULT_SECTIONS = SECTION_KEYS.map((key) => ({ key: key as SectionKey | 'category', categoryId: undefined as Types.ObjectId | string | undefined, title: DEFAULT_TITLES[key], enabled: true, autoFill: true, productIds: [] as Types.ObjectId[], excludedIds: [] as Types.ObjectId[] }));

const sectionSchema = new Schema(
  {
    key: { type: String, enum: [...SECTION_KEYS, 'category'], required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    title: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    autoFill: { type: Boolean, default: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    /** Products the admin hid from this row's automatic picks. */
    excludedIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { _id: false },
);
const homeLayoutSchema = new Schema(
  {
    singleton: { type: String, default: 'home', unique: true },
    sections: { type: [sectionSchema], default: DEFAULT_SECTIONS },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  },
  { timestamps: true },
);
export const HomeLayout = model('HomeLayout', homeLayoutSchema);

/** Current layout, with any missing sections (added in later versions) appended in default order. */
export async function getHomeLayout() {
  const doc = await HomeLayout.findOne({ singleton: 'home' }).lean();
  const sections = (doc?.sections ?? DEFAULT_SECTIONS).filter((s) => SECTION_KEYS.includes(s.key as SectionKey) || (s.key === 'category' && s.categoryId));
  for (const d of DEFAULT_SECTIONS) if (!sections.some((s) => s.key === d.key)) sections.push(d);
  return { sections, categoryIds: doc?.categoryIds ?? [] };
}

const activeProduct = { status: 'active' };
const LIMIT = 10;

/** Pinned products (in the admin's order, active only) followed by automatic ones when autoFill is on. */
export async function sectionProducts(s: { productIds: ReadonlyArray<unknown>; autoFill: boolean; excludedIds?: ReadonlyArray<unknown> }, auto: () => Promise<InstanceType<typeof Product>[]>) {
  const ids = s.productIds.map(String);
  const pinnedDocs = ids.length ? await Product.find({ ...activeProduct, _id: { $in: ids } }) : [];
  const pinned = ids.map((id) => pinnedDocs.find((p) => String(p._id) === id)).filter(Boolean) as InstanceType<typeof Product>[];
  if (!s.autoFill || pinned.length >= LIMIT) return pinned.slice(0, LIMIT);
  // Pinned products and ones the admin hid never come back through automatic fill
  const seen = new Set([...pinned.map((p) => String(p._id)), ...(s.excludedIds ?? []).map(String)]);
  const rest = (await auto()).filter((p) => !seen.has(String(p._id)));
  return [...pinned, ...rest].slice(0, LIMIT);
}

/** "Shop by Category": admin's picks (categories or subcategories, in order) or all active top-level ones. */
export async function homeCategories(categoryIds: ReadonlyArray<unknown>) {
  if (!categoryIds.length) return Category.find({ parent: null, status: 'active' }).sort({ sortOrder: 1 });
  const ids = categoryIds.map(String);
  // Top-level only: subcategories saved here earlier are ignored (they belong in product rows)
  const docs = await Category.find({ _id: { $in: ids }, status: 'active', parent: null });
  const picked = ids.map((id) => docs.find((c) => String(c._id) === id)).filter(Boolean);
  return picked.length ? picked : Category.find({ parent: null, status: 'active' }).sort({ sortOrder: 1 });
}

/** Auto-fill for a category row: most-sold products whose category or subcategory is this one. */
export const categoryRowAuto = (categoryId: unknown) => () =>
  Product.find({ ...activeProduct, $or: [{ category: String(categoryId) }, { subcategory: String(categoryId) }] }).sort({ soldCount: -1 }).limit(LIMIT * 3);

/** Active top-level categories in their category order (what "Shop by Category" shows when not customised). */
async function allTopLevelIds() {
  return (await Category.find({ parent: null, status: 'active' }).sort({ sortOrder: 1 }).select('_id')).map((c) => String(c._id));
}

/**
 * Category ids whose "Show on Home screen" switch is on:
 * - top-level categories: shown in "Shop by Category" (all of them while the list isn't customised)
 * - subcategories: have their own product row
 */
export async function homeRowCategoryIds() {
  const { sections, categoryIds } = await getHomeLayout();
  const all = await allTopLevelIds();
  const picked = categoryIds.map(String).filter((id) => all.includes(id));
  const strip = picked.length ? picked : all;
  const rows = sections.filter((x) => x.key === 'category' && x.categoryId).map((x) => String(x.categoryId));
  return new Set([...strip, ...rows]);
}

/**
 * Category form switch "Show on Home screen". Same layout the Home Screen editor edits, so both agree.
 * - top-level category → add to / remove from "Shop by Category"
 * - subcategory → its own product row right after Best Sellers
 */
export async function setCategoryHomeRow(categoryId: string, name: string, on: boolean, isTopLevel: boolean) {
  const layout = await getHomeLayout();
  let { categoryIds } = layout;
  let sections = layout.sections.map((x) => ({ ...x }));
  if (isTopLevel) {
    // Not customised yet = "all top-level"; turning one off makes the list explicit, minus that one
    // Top-level categories never get a product row (clears rows made by the earlier switch behaviour)
    const hadRow = sections.some((x) => x.key === 'category' && String(x.categoryId) === categoryId);
    sections = sections.filter((x) => !(x.key === 'category' && String(x.categoryId) === categoryId));
    const tops = await allTopLevelIds();
    const kept = categoryIds.map(String).filter((id) => tops.includes(id)); // drops stray subcategories
    const current = kept.length ? kept : tops;
    const has = current.includes(categoryId);
    if (on === has && !hadRow) return;
    const next = on ? (has ? current : [...current, categoryId]) : current.filter((id) => id !== categoryId);
    const all = await allTopLevelIds();
    // Back to "automatic" when the list again equals every active top-level category, in order
    categoryIds = (next.length === all.length && next.every((id, n) => id === all[n]) ? [] : next) as unknown as typeof categoryIds;
  } else {
    const has = sections.some((x) => x.key === 'category' && String(x.categoryId) === categoryId);
    if (on === has) return;
    if (on) {
      const at = sections.findIndex((x) => x.key === 'bestSellers') + 1 || sections.length;
      const row = { key: 'category', categoryId, title: name.slice(0, 40), enabled: true, autoFill: true, productIds: [], excludedIds: [] };
      sections = [...sections.slice(0, at), row as (typeof sections)[number], ...sections.slice(at)];
    } else {
      sections = sections.filter((x) => !(x.key === 'category' && String(x.categoryId) === categoryId));
    }
  }
  await HomeLayout.findOneAndUpdate({ singleton: 'home' }, { singleton: 'home', sections, categoryIds }, { upsert: true });
}
