import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Upload, Package, PackageCheck, PackageX, AlertCircle, Pencil, Copy, Eye, Filter, LayoutGrid, List } from 'lucide-react';
import { api, errorMessage, downloadFile } from '../lib/api';
import { money, num } from '../lib/format';
import { Button, Card, PageHeader, StatCard, Table, StatusBadge, Pagination, SearchInput, Select, IconButton, Img, Menu, QueryState, Badge, Dialog, cx } from '../components/ui';

export interface ProductRow {
  _id: string;
  name: string;
  sku: string;
  brand?: string;
  unit: string;
  category?: { _id: string; name: string };
  images: { url: string }[];
  mrp: number;
  price: number;
  stock: { onHand: number; reserved: number; threshold: number };
  available: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  status: string;
  type: string;
}
interface ListRes {
  items: ProductRow[];
  total: number;
  byCategory: { _id: string; name: string; n: number }[];
  brands: string[];
  summary: { total: number; active: number; out: number; low: number; inStock: number; value: number; inactive: number };
}

const CAT_TONES = ['success', 'info', 'violet', 'accent', 'warning', 'brand'] as const;
export const catTone = (name?: string) => CAT_TONES[(name ?? '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % CAT_TONES.length];

export default function Products() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [grid, setGrid] = useState(false);
  const [preview, setPreview] = useState<ProductRow | null>(null);
  const [draft, setDraft] = useState({ minPrice: sp.get('minPrice') ?? '', maxPrice: sp.get('maxPrice') ?? '', stock: sp.get('stock') ?? '' });
  const p = Object.fromEntries(sp.entries());
  const page = Number(p.page ?? 1);
  const limit = Number(p.limit ?? 10);
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    setSp(n);
  };

  const q = useQuery({
    queryKey: ['products', p],
    queryFn: async () => (await api.get<ListRes>('/admin/products', { params: { ...p, page, limit } })).data,
    placeholderData: keepPreviousData,
  });
  const dup = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/products/${id}/duplicate`)).data,
    onSuccess: (d) => {
      toast.success('Product duplicated as a draft');
      qc.invalidateQueries({ queryKey: ['products'] });
      nav(`/admin/products/${d.product._id}/edit`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.patch(`/admin/products/${id}/status`, { status })).data,
    onSuccess: (_d, v) => {
      toast.success(v.status === 'archived' ? 'Product archived' : `Product marked ${v.status}`);
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = q.data?.summary;
  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Products' }, { label: 'All Products' }]}
        title="Products"
        sub="Manage your product catalogue, inventory and pricing."
        actions={<>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/admin/products/new')}>Add Product</Button>
          <Button icon={<Upload size={16} />} onClick={() => downloadFile('/admin/inventory/export', 'vsr-products.csv').catch((e) => toast.error(errorMessage(e)))}>Export</Button>
        </>}
      />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="brand" icon={<Package size={22} />} label="Total Products" value={num(s?.total)} />
        <StatCard tone="accent" icon={<PackageCheck size={22} />} label="Active Products" value={num(s?.active)} deltaLabel={`${num(s?.inactive)} inactive or draft`} />
        <StatCard tone="danger" icon={<PackageX size={22} />} label="Out of Stock" value={num(s?.out)} deltaLabel="need restocking" />
        <StatCard tone="violet" icon={<AlertCircle size={22} />} label="Low Stock" value={num(s?.low)} deltaLabel="at or below threshold" />
      </div>

      <div className={cx('grid grid-cols-1 gap-4', showFilters && '2xl:grid-cols-[1fr_260px]')}>
        <Card className="min-w-0">
          <div className="space-y-3 p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => set({ category: '' })} className={cx('h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold', !p.category ? 'border-brand-900 bg-brand-900 text-white' : 'border-line bg-white')}>All Categories ({s?.total ?? 0})</button>
              {q.data?.byCategory.map((c) => (
                <button key={c._id} onClick={() => set({ category: c._id })} className={cx('h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold', p.category === c._id ? 'border-brand-900 bg-brand-900 text-white' : 'border-line bg-white hover:border-brand-600/40')}>{c.name} ({c.n})</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <SearchInput value={p.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Search products, SKU, brand…" className="min-w-[220px] flex-1" />
              <Select aria-label="Status" value={p.status ?? 'all'} onChange={(e) => set({ status: e.target.value === 'all' ? '' : e.target.value })} className="w-[140px]">
                <option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option>
              </Select>
              <Select aria-label="Brand" value={p.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} className="w-[150px]">
                <option value="">Brand: All</option>{q.data?.brands.map((b) => <option key={b}>{b}</option>)}
              </Select>
              <Select aria-label="Sort by" value={p.sort ?? 'latest'} onChange={(e) => set({ sort: e.target.value })} className="w-[170px]">
                <option value="latest">Sort by: Latest</option><option value="name">Name A–Z</option><option value="price_asc">Price: Low to High</option><option value="price_desc">Price: High to Low</option>
              </Select>
              <div className="flex rounded-[10px] border border-line bg-white p-0.5">
                <button aria-label="Grid view" aria-pressed={grid} onClick={() => setGrid(true)} className={cx('grid size-8 place-items-center rounded-lg', grid && 'bg-brand-50 text-brand-800')}><LayoutGrid size={16} /></button>
                <button aria-label="List view" aria-pressed={!grid} onClick={() => setGrid(false)} className={cx('grid size-8 place-items-center rounded-lg', !grid && 'bg-brand-50 text-brand-800')}><List size={16} /></button>
              </div>
              <Button icon={<Filter size={15} />} onClick={() => setShowFilters((f) => !f)} aria-expanded={showFilters}>Filters</Button>
            </div>
          </div>
          <QueryState q={q}>
            {(d) => (
              <>
                {grid ? (
                  <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
                    {d.items.map((r) => (
                      <button key={r._id} onClick={() => nav(`/admin/products/${r._id}/edit`)} className="rounded-xl border border-line p-3 text-left hover:border-brand-600/40">
                        <Img src={r.images[0]?.url} alt={r.name} className="aspect-square w-full rounded-lg" />
                        <p className="mt-2 truncate text-[13px] font-semibold">{r.name}</p>
                        <div className="mt-1 flex items-center justify-between"><span className="tabular font-bold">{money(r.price)}</span><StatusBadge status={r.stockStatus === 'in_stock' ? r.status : r.stockStatus} /></div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4">
                    <Table minWidth={880} head={['Product', 'Category', 'Brand', 'Price', 'Stock', 'Status', 'Actions']}>
                      {d.items.map((r) => (
                        <tr key={r._id}>
                          <td>
                            <div className="flex min-w-[220px] items-center gap-3 whitespace-normal">
                              <Img src={r.images[0]?.url} alt={r.name} className="size-12 shrink-0 rounded-lg" />
                              <div><p className="font-semibold">{r.name}{r.unit && r.unit !== '1 pc' ? ` (${r.unit})` : ''}</p><p className="tabular text-xs text-muted">SKU: {r.sku}</p></div>
                            </div>
                          </td>
                          <td><Badge tone={catTone(r.category?.name)}>{r.category?.name ?? '—'}</Badge></td>
                          <td className="text-muted">{r.brand}</td>
                          <td className="tabular whitespace-nowrap">
                            <p className="font-semibold">{money(r.price)}</p>
                            {r.mrp > r.price && <p className="text-xs"><span className="text-muted line-through">{money(r.mrp)}</span> <span className="ml-1 font-semibold text-success">{Math.round((1 - r.price / r.mrp) * 100)}% OFF</span></p>}
                          </td>
                          <td className="tabular whitespace-nowrap"><p className={r.available <= r.stock.threshold ? 'font-semibold text-danger' : ''}>{r.stock.onHand}</p><p className="text-xs text-muted">({r.available} available)</p></td>
                          <td><StatusBadge status={r.status !== 'active' ? r.status : r.stockStatus === 'in_stock' ? 'active' : r.stockStatus} /></td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <IconButton label={`Edit ${r.name}`} onClick={() => nav(`/admin/products/${r._id}/edit`)}><Pencil size={14} /></IconButton>
                              <IconButton label={`Duplicate ${r.name}`} onClick={() => dup.mutate(r._id)}><Copy size={14} /></IconButton>
                              <IconButton label={`Preview ${r.name}`} onClick={() => setPreview(r)}><Eye size={14} /></IconButton>
                              <Menu items={[
                                { label: r.status === 'active' ? 'Mark inactive' : 'Mark active', onClick: () => setStatus.mutate({ id: r._id, status: r.status === 'active' ? 'inactive' : 'active' }) },
                                { label: 'Adjust stock', onClick: () => nav(`/admin/inventory?adjust=${r._id}`) },
                                { label: 'Archive', danger: true, onClick: () => confirm(`Archive “${r.name}”? It will be hidden from customers; past orders keep their records.`) && setStatus.mutate({ id: r._id, status: 'archived' }) },
                              ]} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                )}
                {!d.items.length && <div className="py-12 text-center text-sm text-muted">No products match these filters.</div>}
                <Pagination page={page} total={d.total} limit={limit} noun="products" onPage={(n) => set({ page: String(n) })} onLimit={(l) => set({ limit: String(l) })} />
              </>
            )}
          </QueryState>
        </Card>

        {showFilters && (
          <Card className="h-fit p-4 2xl:sticky 2xl:top-[84px]">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Filter size={16} aria-hidden /> Filters</h2><button className="text-xs text-muted hover:text-ink" onClick={() => { setDraft({ minPrice: '', maxPrice: '', stock: '' }); setSp(new URLSearchParams()); }}>Clear All</button></div>
            <div className="space-y-4">
              <div><p className="mb-1.5 text-[13px] font-semibold">Category</p>
                <Select aria-label="Category filter" value={p.category ?? ''} onChange={(e) => set({ category: e.target.value })}><option value="">All Categories</option>{q.data?.byCategory.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
              <div><p className="mb-1.5 text-[13px] font-semibold">Brand</p>
                <Select aria-label="Brand filter" value={p.brand ?? ''} onChange={(e) => set({ brand: e.target.value })}><option value="">All Brands</option>{q.data?.brands.map((b) => <option key={b}>{b}</option>)}</Select></div>
              <div><p className="mb-1.5 text-[13px] font-semibold">Price Range (₹)</p>
                <div className="flex gap-2">
                  <input aria-label="Minimum price" inputMode="numeric" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value.replace(/\D/g, '') })} placeholder="0" className="h-10 w-full rounded-[10px] border border-line px-3 text-sm" />
                  <input aria-label="Maximum price" inputMode="numeric" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value.replace(/\D/g, '') })} placeholder="5000+" className="h-10 w-full rounded-[10px] border border-line px-3 text-sm" />
                </div></div>
              <fieldset><legend className="mb-1.5 text-[13px] font-semibold">Stock Status</legend>
                {[['in_stock', 'In Stock', s?.inStock], ['low_stock', 'Low Stock', s?.low], ['out_of_stock', 'Out of Stock', s?.out]].map(([v, l, n]) => (
                  <label key={v as string} className="flex items-center gap-2.5 py-1 text-[13px]"><input type="radio" name="stock" checked={draft.stock === v} onChange={() => setDraft({ ...draft, stock: v as string })} className="size-4 accent-brand-700" />{l} <span className="text-muted">({num(n as number)})</span></label>
                ))}</fieldset>
              <Button variant="primary" className="w-full" icon={<Filter size={15} />} onClick={() => set(draft)}>Apply Filters</Button>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={!!preview} onClose={() => setPreview(null)} title="Customer preview" width={380}>
        {preview && (
          <div>
            <Img src={preview.images[0]?.url} alt={preview.name} className="aspect-square w-full rounded-2xl" />
            <p className="mt-3 text-lg font-bold">{preview.name}</p>
            <p className="text-sm text-muted">{preview.unit} · {preview.brand}</p>
            <p className="mt-2"><span className="tabular text-xl font-extrabold">{money(preview.price)}</span> {preview.mrp > preview.price && <span className="ml-1 text-sm text-muted line-through">{money(preview.mrp)}</span>}</p>
            <div className="mt-2"><StatusBadge status={preview.stockStatus} /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
