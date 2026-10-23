import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { SlidersHorizontal, Download, History, Box, Layers, AlertTriangle, XCircle, Pencil, LineChart, CircleAlert, PackageCheck, PackagePlus, Wrench } from 'lucide-react';
import { api, errorMessage, downloadFile } from '../lib/api';
import { money, num, dateTime, ago } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, StatCard, Table, StatusBadge, Pagination, SearchInput, Select, IconButton, Img, Menu, QueryState, Badge, Dialog, Field, Input, Textarea, RangeSelect } from '../components/ui';
import { Donut, C, axisProps, ChartTooltip } from '../components/charts';
import { catTone, type ProductRow } from './Products';

interface Overview {
  low: ProductRow[];
  out: ProductRow[];
  activity: { _id: string; product: { name: string; unit: string }; delta: number; reason: string; actor?: { name: string }; createdAt: string }[];
  trend: { label: string; value: number; low: number; out: number }[];
}

export default function Inventory() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const p = Object.fromEntries(sp.entries());
  const page = Number(p.page ?? 1);
  const limit = Number(p.limit ?? 8);
  const [adjusting, setAdjusting] = useState<ProductRow | null>(null);
  const [form, setForm] = useState({ mode: 'add', qty: '', reason: 'restock', note: '', threshold: '' });
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    setSp(n);
  };

  const list = useQuery({
    queryKey: ['products', 'inventory', p],
    queryFn: async () => (await api.get<{ items: ProductRow[]; total: number; summary: Record<string, number>; byCategory: { _id: string; name: string }[]; brands: string[] }>('/admin/products', { params: { ...p, page, limit, sort: p.sort ?? 'updated' } })).data,
    placeholderData: keepPreviousData,
  });
  const [months, setMonths] = useState('6');
  const ov = useQuery({ queryKey: ['inventory-overview', months], queryFn: async () => (await api.get<Overview>('/admin/inventory/overview', { params: { months } })).data, placeholderData: (p) => p });

  // Deep link from Products → "Adjust stock"
  useEffect(() => {
    if (!p.adjust) return;
    api.get(`/admin/products/${p.adjust}`).then(({ data }) => openAdjust(data.product)).catch(() => undefined);
  }, [p.adjust]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdjust(r: ProductRow) {
    setAdjusting(r);
    setForm({ mode: 'add', qty: '', reason: 'restock', note: '', threshold: String(r.stock.threshold) });
  }
  const adjust = useMutation({
    mutationFn: async () => {
      const qty = Number(form.qty);
      return api.post('/admin/inventory/adjust', { productId: adjusting!._id, delta: form.mode === 'add' ? qty : -qty, reason: form.reason, note: form.note || undefined, threshold: form.threshold === '' ? undefined : Number(form.threshold) });
    },
    onSuccess: () => {
      toast.success('Stock updated and logged');
      setAdjusting(null);
      if (p.adjust) set({ adjust: '' });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory-overview'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = list.data?.summary;
  const total = s?.total ?? 0;
  const pctOf = (n?: number) => (total ? Math.round(((n ?? 0) / total) * 100) : 0);
  const available = adjusting ? adjusting.stock.onHand - adjusting.stock.reserved : 0;
  const qtyN = Number(form.qty) || 0;
  const tooMuch = form.mode === 'remove' && qtyN > available;

  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Inventory' }, { label: 'Stock Overview' }]}
        title="Inventory Management"
        sub="Track your stock, manage inventory levels and get low-stock alerts."
        actions={<>
          <Button icon={<SlidersHorizontal size={16} />} onClick={() => document.getElementById('inv-table')?.scrollIntoView({ behavior: 'smooth' })}>Stock Adjustment</Button>
          <Button icon={<Download size={16} />} onClick={() => downloadFile('/admin/inventory/export', 'vsr-inventory.csv').catch((e) => toast.error(errorMessage(e)))}>Export CSV</Button>
          <Button icon={<History size={16} />} onClick={() => nav('/admin/inventory/history')}>Inventory History</Button>
        </>}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard tone="brand" icon={<Box size={22} />} label="Total Products" value={num(total)} />
            <StatCard tone="info" icon={<Layers size={22} />} label="In Stock" value={num(s?.inStock)} deltaLabel={`${pctOf(s?.inStock)}% of total`} />
            <StatCard tone="accent" icon={<AlertTriangle size={22} />} label="Low Stock" value={num(s?.low)} deltaLabel={`${pctOf(s?.low)}% of total`} />
            <StatCard tone="danger" icon={<XCircle size={22} />} label="Out of Stock" value={num(s?.out)} deltaLabel={`${pctOf(s?.out)}% of total`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Stock Status Overview" />
              <div className="px-5 pb-5">
                <Donut size={140} center={num(total)} sub="Products" data={[{ name: 'In Stock', value: s?.inStock ?? 0, color: C.green }, { name: 'Low Stock', value: s?.low ?? 0, color: C.orange }, { name: 'Out of Stock', value: s?.out ?? 0, color: C.red }]} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Inventory Value" action={<RangeSelect label="Months" value={months} onChange={setMonths} options={[['3', 'Last 3 Months'], ['6', 'Last 6 Months'], ['12', 'Last 12 Months']]} />} />
              <div className="px-5"><p className="tabular text-2xl font-extrabold">{money(s?.value)}</p><p className="text-xs text-muted">On-hand stock × selling price, month end</p></div>
              <div className="h-[140px] px-3 pb-3">
                <ResponsiveContainer><BarChart data={ov.data?.trend} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}><XAxis dataKey="label" {...axisProps} /><ChartTooltip formatter={(v) => [money(v), 'Value']} /><Bar dataKey="value" fill={C.green} radius={[4, 4, 0, 0]} barSize={22} /></BarChart></ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Low Stock Trend" action={<RangeSelect label="Months" value={months} onChange={setMonths} options={[['3', 'Last 3 Months'], ['6', 'Last 6 Months'], ['12', 'Last 12 Months']]} />} />
              <div className="h-[190px] px-3 pb-3">
                <ResponsiveContainer>
                  <AreaChart data={ov.data?.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs><linearGradient id="lowg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.orange} stopOpacity={0.25} /><stop offset="100%" stopColor={C.orange} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#f0ebe2" />
                    <XAxis dataKey="label" {...axisProps} />
                    <ChartTooltip formatter={(v, n) => [String(v), n === 'out' ? 'Out of stock' : 'Low stock']} />
                    <Area dataKey="low" stroke={C.orange} strokeWidth={2} fill="url(#lowg)" dot={{ r: 3, fill: '#fff', stroke: C.orange, strokeWidth: 2 }} />
                    <Area dataKey="out" stroke={C.red} strokeWidth={1.5} fill="none" dot={{ r: 2.5, fill: C.red }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card id="inv-table">
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <SearchInput value={p.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Search products by name, SKU…" className="min-w-[220px] flex-1" />
              <Select aria-label="Category" value={p.category ?? ''} onChange={(e) => set({ category: e.target.value })} className="w-40"><option value="">All Categories</option>{list.data?.byCategory.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>
              <Select aria-label="Brand" value={p.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} className="w-36"><option value="">All Brands</option>{list.data?.brands.map((b) => <option key={b}>{b}</option>)}</Select>
              <Select aria-label="Stock status" value={p.stock ?? ''} onChange={(e) => set({ stock: e.target.value })} className="w-40"><option value="">All Stock Status</option><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="out_of_stock">Out of Stock</option></Select>
              <Button onClick={() => setSp(new URLSearchParams())}>Reset</Button>
            </div>
            <QueryState q={list}>
              {(d) => (
                <>
                  <div className="px-4">
                    <Table minWidth={760} head={['Product', 'SKU', 'Category', 'Stock Info', 'Status', 'Last Updated', 'Actions']}>
                      {d.items.map((r) => (
                        <tr key={r._id}>
                          <td className="whitespace-normal!"><div className="flex min-w-[170px] items-center gap-3"><Img src={r.images[0]?.url} alt={r.name} className="size-11 shrink-0 rounded-lg" /><div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{r.unit}{r.brand ? ` · ${r.brand}` : ''}</p></div></div></td>
                          <td className="tabular text-muted">{r.sku}</td>
                          <td><Badge tone={catTone(r.category?.name)}>{r.category?.name}</Badge></td>
                          <td className="tabular text-xs leading-5 text-muted">Available: <b className={r.stockStatus !== 'in_stock' ? 'text-danger' : 'text-ink'}>{r.available}</b><br />Reserved: {r.stock.reserved}<br />Total: {r.stock.onHand}</td>
                          <td><StatusBadge status={r.stockStatus} /></td>
                          <td className="tabular text-xs text-muted">{dateTime((r as unknown as { updatedAt: string }).updatedAt)}</td>
                          <td>
                            <div className="flex gap-1.5">
                              <IconButton label={`Adjust stock for ${r.name}`} onClick={() => openAdjust(r)}><Pencil size={14} /></IconButton>
                              <IconButton label={`Stock history for ${r.name}`} onClick={() => nav(`/admin/inventory/history?product=${r._id}&name=${encodeURIComponent(r.name)}`)}><LineChart size={14} /></IconButton>
                              <Menu items={[{ label: 'Edit product', onClick: () => nav(`/admin/products/${r._id}/edit`) }, { label: 'Mark damaged/expired', onClick: () => { openAdjust(r); setForm((f) => ({ ...f, mode: 'remove', reason: 'damaged' })); } }]} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Table>
                    {!d.items.length && <p className="py-12 text-center text-sm text-muted">No products match these filters.</p>}
                  </div>
                  <Pagination page={page} total={d.total} limit={limit} noun="products" onPage={(n) => set({ page: String(n) })} onLimit={(l) => set({ limit: String(l) })} />
                </>
              )}
            </QueryState>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><CircleAlert size={17} className="text-accent-600" aria-hidden /> Low Stock Alerts ({s?.low ?? 0})</span>} action={<Link to="/admin/inventory?stock=low_stock" className="text-xs font-semibold text-brand-700">View All</Link>} />
            <ul className="px-5 pb-4">
              {ov.data?.low.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2">
                  <Img src={r.images[0]?.url} alt="" className="size-11 rounded-lg" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{r.name} ({r.unit})</p><p className="text-xs text-danger">{r.stock.onHand - r.stock.reserved} units left</p></div>
                  <Button size="sm" onClick={() => openAdjust(r)}>Restock</Button>
                </li>
              ))}
              {ov.data && !ov.data.low.length && <p className="py-4 text-sm text-muted">No low-stock alerts.</p>}
            </ul>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><XCircle size={17} className="text-danger" aria-hidden /> Out of Stock ({s?.out ?? 0})</span>} action={<Link to="/admin/inventory?stock=out_of_stock" className="text-xs font-semibold text-brand-700">View All</Link>} />
            <ul className="px-5 pb-4">
              {ov.data?.out.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2">
                  <Img src={r.images[0]?.url} alt="" className="size-11 rounded-lg" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{r.name} ({r.unit})</p><p className="text-xs text-danger">Out of stock</p></div>
                  <Button size="sm" onClick={() => openAdjust(r)}>Restock</Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Recent Inventory Activity" action={<Link to="/admin/inventory/history" className="text-xs font-semibold text-brand-700">View All</Link>} />
            <ul className="space-y-3 px-5 pb-5">
              {ov.data?.activity.map((a) => {
                const Icon = a.reason === 'initial' ? PackagePlus : a.delta > 0 ? PackageCheck : Wrench;
                return (
                  <li key={a._id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon size={15} aria-hidden /></span>
                    <div className="min-w-0 flex-1 text-[13px]">
                      <div className="flex justify-between gap-2"><b className="truncate">{a.reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</b><span className="shrink-0 text-xs text-muted">{ago(a.createdAt)}</span></div>
                      <p className="text-xs text-muted">{a.product?.name} ({a.delta > 0 ? '+' : ''}{a.delta} units)</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!adjusting}
        onClose={() => { setAdjusting(null); if (p.adjust) set({ adjust: '' }); }}
        title="Adjust stock"
        footer={<><Button onClick={() => setAdjusting(null)}>Cancel</Button><Button variant="primary" loading={adjust.isPending} disabled={!qtyN || tooMuch} onClick={() => adjust.mutate()}>Save Adjustment</Button></>}
      >
        {adjusting && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-line-soft/60 p-3">
              <Img src={adjusting.images[0]?.url} alt="" className="size-12 rounded-lg" />
              <div className="flex-1 text-sm"><p className="font-bold">{adjusting.name}</p><p className="tabular text-xs text-muted">On hand {adjusting.stock.onHand} · Reserved {adjusting.stock.reserved} · Available {available}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['add', 'Add stock'], ['remove', 'Remove stock']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, mode: v, reason: v === 'add' ? 'restock' : 'damaged' })} aria-pressed={form.mode === v} className={`h-10 rounded-[10px] border text-sm font-semibold ${form.mode === v ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line'}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" required error={tooMuch ? `Only ${available} available to remove` : undefined}><Input inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, '') })} autoFocus aria-invalid={tooMuch} /></Field>
              <Field label="Reason" required>
                <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                  {form.mode === 'add' ? <><option value="restock">Restock / purchase</option><option value="return">Customer return</option><option value="adjustment">Count correction</option></> : <><option value="damaged">Damaged</option><option value="expired">Expired</option><option value="adjustment">Count correction</option></>}
                </Select>
              </Field>
            </div>
            <Field label="Low-stock threshold"><Input inputMode="numeric" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Note / reference"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Invoice #, supplier, batch…" /></Field>
            <p className="text-xs text-muted">Every adjustment is recorded with your name, time, reason and quantity.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
