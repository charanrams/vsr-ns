import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ImagePlus, ClipboardList, IndianRupee, Layers, Boxes, Truck, Search, Plus, Trash2, Save, Send, BadgeCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Field, Input, Select, Textarea, Toggle, Loading, ErrorState, IconButton, Badge, PageHeader, KV, cx } from '../components/ui';
import { ImagePicker } from '../components/ImagePicker';

interface Cat { _id: string; name: string }
interface Variant { name: string; sku: string; price: number; stock: number; isDefault?: boolean }
const blank = {
  name: '', sku: '', brand: '', unit: '1 pc', type: 'physical', category: '', subcategory: '', shortDescription: '', description: '',
  images: [] as { url: string; publicId?: string }[], mrp: '', price: '', taxRate: '5', variants: [] as Variant[], initialStock: '0', threshold: '10',
  tags: '', deliveryType: 'standard', weightGrams: '', allergens: '', seoTitle: '', seoDescription: '', status: 'active',
};
type Form = typeof blank;

function Section({ icon, title, sub, children, action }: { icon: ReactNode; title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden>{icon}</span>
          <div><h2 className="font-bold">{title}</h2>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variantDraft, setVariantDraft] = useState<Variant | null>(null);
  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const cats = useQuery({ queryKey: ['cats-root'], queryFn: async () => (await api.get<{ items: Cat[] }>('/admin/categories')).data.items });
  const subs = useQuery({ queryKey: ['cats-sub', f.category], queryFn: async () => (await api.get<{ items: Cat[] }>('/admin/categories', { params: { parent: f.category } })).data.items, enabled: !!f.category });
  const existing = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await api.get(`/admin/products/${id}`)).data.product,
    enabled: editing,
  });
  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setF({
      name: p.name, sku: p.sku, brand: p.brand ?? '', unit: p.unit ?? '', type: p.type, category: p.category, subcategory: p.subcategory ?? '',
      shortDescription: p.shortDescription ?? '', description: p.description ?? '', images: p.images ?? [], mrp: String(p.mrp), price: String(p.price),
      taxRate: String(p.taxRate ?? 5), variants: p.variants ?? [], initialStock: String(p.stock.onHand), threshold: String(p.stock.threshold),
      tags: (p.tags ?? []).join(', '), deliveryType: p.deliveryType ?? 'standard', weightGrams: p.weightGrams ? String(p.weightGrams) : '',
      allergens: p.allergens ?? '', seoTitle: p.seo?.title ?? '', seoDescription: p.seo?.description ?? '', status: p.status,
    });
  }, [existing.data]);

  const discount = useMemo(() => {
    const m = Number(f.mrp), s = Number(f.price);
    return m > 0 && s >= 0 && s <= m ? Math.round((1 - s / m) * 100) : 0;
  }, [f.mrp, f.price]);

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Enter a product name';
    if (f.sku.trim().length < 2) e.sku = 'Enter a unique SKU';
    if (!f.category) e.category = 'Choose a category';
    if (!f.shortDescription.trim()) e.shortDescription = 'Add a short description';
    if (!(Number(f.mrp) > 0)) e.mrp = 'Enter the MRP';
    if (!(Number(f.price) > 0)) e.price = 'Enter the selling price';
    else if (Number(f.price) > Number(f.mrp)) e.price = 'Selling price cannot exceed MRP';
    if (!f.images.length) e.images = 'Add at least one product image';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const save = useMutation({
    mutationFn: async (status: string) => {
      const body = {
        name: f.name.trim(), sku: f.sku.trim().toUpperCase(), brand: f.brand || undefined, unit: f.unit || '1 pc', type: f.type, category: f.category,
        subcategory: f.subcategory || null, shortDescription: f.shortDescription, description: f.description, images: f.images,
        mrp: Number(f.mrp), price: Number(f.price), taxRate: Number(f.taxRate), variants: f.variants, initialStock: Number(f.initialStock) || 0,
        threshold: Number(f.threshold) || 0, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), deliveryType: f.deliveryType,
        weightGrams: f.weightGrams ? Number(f.weightGrams) : undefined, allergens: f.allergens || undefined,
        seo: { title: f.seoTitle || undefined, description: f.seoDescription || undefined }, status,
      };
      return editing ? (await api.put(`/admin/products/${id}`, body)).data : (await api.post('/admin/products', body)).data;
    },
    onSuccess: (_d, status) => {
      toast.success(status === 'draft' ? 'Saved as draft' : editing ? 'Product updated' : 'Product published');
      qc.invalidateQueries({ queryKey: ['products'] });
      nav('/admin/products');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = (status: string) => {
    if (status === 'draft' ? f.name.trim().length >= 2 && f.sku && f.category && Number(f.mrp) > 0 && Number(f.price) > 0 : validate()) save.mutate(status);
    else if (status === 'draft') {
      validate();
      toast.error('Name, SKU, category and prices are needed even for a draft.');
    } else toast.error('Fix the highlighted fields to publish.');
  };

  if (editing && existing.isLoading) return <Loading label="Loading product…" />;
  if (editing && existing.error) return <Card><ErrorState message={errorMessage(existing.error)} onRetry={() => existing.refetch()} /></Card>;

  const reserved = existing.data?.stock.reserved ?? 0;
  const onHand = Number(f.initialStock) || 0;

  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Products', to: '/admin/products' }, { label: editing ? 'Edit Product' : 'Add Product' }]}
        title={editing ? 'Edit Product' : 'Add New Product'}
        sub={editing ? 'Update images, details, pricing and visibility. Stock changes go through Inventory.' : 'Create a new product and manage all the details including images, pricing, inventory and more.'}
        actions={<Button icon={<ArrowLeft size={16} />} onClick={() => nav('/admin/products')}>Back to Products</Button>}
      />
      <form onSubmit={(e) => { e.preventDefault(); submit('active'); }} noValidate className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Section icon={<ImagePlus size={18} />} title="Product Images" sub="Upload high quality images (min 800×800 px). You can upload up to 10 images.">
            <ImagePicker value={f.images} onChange={(v) => upd('images', v)} folder="products" />
            {errors.images && <p role="alert" className="mt-2 text-xs text-danger">{errors.images}</p>}
          </Section>

          <Section icon={<ClipboardList size={18} />} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <Field label="Product Name" required error={errors.name}><Input value={f.name} onChange={(e) => upd('name', e.target.value)} aria-invalid={!!errors.name} /></Field>
              <Field label="SKU" required error={errors.sku}><Input value={f.sku} onChange={(e) => upd('sku', e.target.value)} placeholder="VSR-TOM-001" aria-invalid={!!errors.sku} /></Field>
              <Field label="Category" required error={errors.category}>
                <Select value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value, subcategory: '' }))} aria-invalid={!!errors.category}>
                  <option value="">Select category</option>{cats.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Subcategory">
                <Select value={f.subcategory} onChange={(e) => upd('subcategory', e.target.value)} disabled={!subs.data?.length}>
                  <option value="">{subs.data?.length ? 'Select subcategory' : 'None'}</option>{subs.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Brand"><Input value={f.brand} onChange={(e) => upd('brand', e.target.value)} /></Field>
              <Field label="Unit / Pack size"><Input value={f.unit} onChange={(e) => upd('unit', e.target.value)} placeholder="500 g" /></Field>
              <fieldset className="md:col-span-2 2xl:col-span-2">
                <legend className="mb-1.5 text-[13px] font-medium">Product Type <span className="text-danger">*</span></legend>
                <div className="flex flex-wrap gap-2">
                  {[['physical', 'Physical Product'], ['digital', 'Digital Product'], ['homemade', 'Homemade Food']].map(([v, l]) => (
                    <label key={v} className={cx('flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-medium', f.type === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line')}>
                      <input type="radio" name="type" value={v} checked={f.type === v} onChange={() => upd('type', v)} className="accent-brand-700" />{l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Short Description" required error={errors.shortDescription} className="md:col-span-2 2xl:col-span-4" hint={`${f.shortDescription.length}/200`}>
                <Input maxLength={200} value={f.shortDescription} onChange={(e) => upd('shortDescription', e.target.value)} aria-invalid={!!errors.shortDescription} />
              </Field>
              <Field label="Full Description" className="md:col-span-2 2xl:col-span-4" hint={`${f.description.length}/2000`}>
                <Textarea maxLength={2000} rows={4} value={f.description} onChange={(e) => upd('description', e.target.value)} />
              </Field>
              {f.type === 'homemade' && (
                <Field label="Ingredients & allergens" className="md:col-span-2 2xl:col-span-4" hint="Shown to customers. Only list verified information."><Input value={f.allergens} onChange={(e) => upd('allergens', e.target.value)} placeholder="Contains dairy, nuts" /></Field>
              )}
            </div>
          </Section>

          <Section icon={<IndianRupee size={18} />} title="Product Pricing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <Field label="MRP (₹)" required error={errors.mrp}><Input inputMode="decimal" value={f.mrp} onChange={(e) => upd('mrp', e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!errors.mrp} /></Field>
              <Field label="Selling Price (₹)" required error={errors.price}><Input inputMode="decimal" value={f.price} onChange={(e) => upd('price', e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!errors.price} /></Field>
              <Field label="Discount"><div className="flex"><Input value={discount} readOnly className="rounded-r-none bg-line-soft" /><span className="grid w-10 place-items-center rounded-r-[10px] border border-l-0 border-line text-sm">%</span></div></Field>
              <Field label="GST (%)"><Select value={f.taxRate} onChange={(e) => upd('taxRate', e.target.value)}>{['0', '5', '12', '18', '28'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Discounted Price (₹)"><Input value={f.price ? Number(f.price).toFixed(2) : ''} readOnly className="bg-line-soft" /></Field>
            </div>
          </Section>

          <Section
            icon={<Layers size={18} />}
            title="Product Variants (Optional)"
            sub="Add different pack sizes, weights or variations for this product."
            action={<Button type="button" size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setVariantDraft({ name: '', sku: `${f.sku}-`, price: Number(f.price) || 0, stock: 0, isDefault: f.variants.length === 0 })}>Add Variant</Button>}
          >
            {f.variants.length === 0 && !variantDraft ? <p className="text-[13px] text-muted">No variants. The product is sold as a single item.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead><tr className="bg-[#faf8f3] text-xs">{['Variant Name', 'SKU', 'Price (₹)', 'Stock', '', 'Actions'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {f.variants.map((v, i) => (
                      <tr key={i} className="border-b border-line-soft">
                        <td className="px-3 py-2">{v.name}</td><td className="tabular px-3 py-2">{v.sku}</td><td className="tabular px-3 py-2 text-success">{v.price}</td><td className="tabular px-3 py-2">{v.stock}</td>
                        <td className="px-3 py-2">{v.isDefault ? <Badge tone="success">Default</Badge> : <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => upd('variants', f.variants.map((x, j) => ({ ...x, isDefault: j === i })))}>Set default</button>}</td>
                        <td className="px-3 py-2"><IconButton type="button" tone="danger" label={`Remove ${v.name}`} onClick={() => upd('variants', f.variants.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton></td>
                      </tr>
                    ))}
                    {variantDraft && (
                      <tr>
                        <td className="px-1 py-2"><Input aria-label="Variant name" value={variantDraft.name} onChange={(e) => setVariantDraft({ ...variantDraft, name: e.target.value })} placeholder="1 kg" /></td>
                        <td className="px-1 py-2"><Input aria-label="Variant SKU" value={variantDraft.sku} onChange={(e) => setVariantDraft({ ...variantDraft, sku: e.target.value })} /></td>
                        <td className="px-1 py-2"><Input aria-label="Variant price" inputMode="decimal" value={variantDraft.price} onChange={(e) => setVariantDraft({ ...variantDraft, price: Number(e.target.value) || 0 })} /></td>
                        <td className="px-1 py-2"><Input aria-label="Variant stock" inputMode="numeric" value={variantDraft.stock} onChange={(e) => setVariantDraft({ ...variantDraft, stock: Number(e.target.value) || 0 })} /></td>
                        <td colSpan={2} className="px-1 py-2">
                          <div className="flex gap-1.5">
                            <Button type="button" size="sm" variant="primary" disabled={!variantDraft.name || !variantDraft.sku} onClick={() => { upd('variants', [...f.variants, variantDraft]); setVariantDraft(null); }}>Add</Button>
                            <Button type="button" size="sm" onClick={() => setVariantDraft(null)}>Cancel</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><BadgeCheck size={18} aria-hidden /></span><div><h2 className="font-bold">Product Status</h2><p className="text-xs text-muted">Product will be visible on the app when active.</p></div></div>
              <Toggle checked={f.status === 'active'} onChange={(v) => upd('status', v ? 'active' : 'inactive')} label="Product active" />
            </div>
          </Card>

          <Section icon={<Boxes size={18} />} title="Inventory Management" sub="Track your stock and set low stock alerts.">
            <div className="grid grid-cols-2 gap-3">
              <Field label={editing ? 'On-hand stock' : 'Initial Stock'} required hint={editing ? 'Change stock from Inventory → Adjust' : undefined}>
                <Input inputMode="numeric" value={f.initialStock} onChange={(e) => upd('initialStock', e.target.value.replace(/\D/g, ''))} disabled={editing} />
              </Field>
              <Field label="Low Stock Alert" required><Input inputMode="numeric" value={f.threshold} onChange={(e) => upd('threshold', e.target.value.replace(/\D/g, ''))} /></Field>
            </div>
            <div className="mt-3 rounded-xl border border-line-soft px-3 py-1">
              <KV k="Reserved Stock" v={reserved} />
              <KV k="Available Stock" v={Math.max(0, onHand - reserved)} />
            </div>
            <div className="mt-2 flex justify-between rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-bold"><span>Total Stock</span><span className="tabular">{onHand}</span></div>
          </Section>

          <Section icon={<Truck size={18} />} title="Delivery Settings" sub="Applicable for physical products.">
            <fieldset className="mb-3"><legend className="mb-1.5 text-[13px] font-medium">Delivery Type</legend>
              <div className="flex flex-wrap gap-4 text-[13px]">
                {[['standard', 'Standard Delivery'], ['instant', 'Instant Delivery (if applicable)']].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2"><input type="radio" name="dt" checked={f.deliveryType === v} onChange={() => upd('deliveryType', v)} className="size-4 accent-brand-700" />{l}</label>
                ))}
              </div></fieldset>
            <Field label="Weight (grams, optional)"><Input inputMode="numeric" value={f.weightGrams} onChange={(e) => upd('weightGrams', e.target.value.replace(/\D/g, ''))} /></Field>
          </Section>

          <Section icon={<Search size={18} />} title="SEO & Search Settings" sub="Help customers find this product easily.">
            <div className="space-y-3">
              <Field label="SEO Title"><Input value={f.seoTitle} onChange={(e) => upd('seoTitle', e.target.value)} /></Field>
              <Field label="SEO Description"><Textarea rows={3} value={f.seoDescription} onChange={(e) => upd('seoDescription', e.target.value)} /></Field>
              <Field label="Tags (comma separated)"><Input value={f.tags} onChange={(e) => upd('tags', e.target.value)} placeholder="tomato, fresh vegetables, organic" /></Field>
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" size="lg" icon={<Save size={16} />} loading={save.isPending && save.variables === 'draft'} onClick={() => submit('draft')}>Save as Draft</Button>
            <Button type="submit" size="lg" variant="primary" icon={<Send size={16} />} loading={save.isPending && save.variables !== 'draft'}>{editing ? 'Save Changes' : 'Publish Product'}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
