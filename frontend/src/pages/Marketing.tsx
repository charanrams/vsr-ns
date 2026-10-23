import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Image as ImageIcon, Tag, Percent, Users, Pencil, Copy, Trash2, ChevronLeft, ChevronRight, ArrowRight, CalendarDays } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { money, num, date } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, StatCard, Table, StatusBadge, Tabs, SearchInput, Img, IconButton, QueryState, Field, Input, Select, Toggle, cx } from '../components/ui';
import { ImagePicker } from '../components/ImagePicker';

interface Banner { _id: string; title: string; subtitle?: string; buttonText?: string; linkType: string; linkValue?: string; image: string; position: string; startDate?: string; endDate?: string; priority: number; status: string }
interface Coupon { _id: string; code: string; name?: string; type: string; value: number; maxDiscount?: number; minOrder: number; usageLimit: number; used: number; startDate?: string; endDate?: string; status: string }
interface Res { items: Banner[]; coupons: Coupon[]; stats: { banners: number; activeOffers: number; coupons: number; couponUsage: number; offerRevenue: number } }

const POSITIONS = [['homepage', 'Homepage Banner', '1920 × 600 px'], ['category', 'Category Banner', '1200 × 400 px'], ['offer', 'Offer Banner', '800 × 300 px'], ['app', 'App Banner', '1080 × 1920 px']] as const;
const toInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const lifecycle = (x: { status: string; startDate?: string; endDate?: string }) => {
  const now = Date.now();
  if (x.endDate && new Date(x.endDate).getTime() < now) return 'expired';
  if (x.status !== 'active') return 'inactive';
  if (x.startDate && new Date(x.startDate).getTime() > now) return 'scheduled';
  return 'active';
};
const emptyBanner = { title: '', subtitle: '', buttonText: 'Shop Now', linkType: 'category', linkValue: '', image: [] as { url: string }[], position: 'homepage', startDate: toInput(new Date().toISOString()), endDate: '', priority: '1', status: 'active' };
const emptyCoupon = { code: '', name: '', type: 'percent', value: '10', maxDiscount: '', minOrder: '0', usageLimit: '500', perCustomerLimit: '1', startDate: toInput(new Date().toISOString()), endDate: '', status: 'active' };

export default function Marketing() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'' | 'active' | 'expired'>('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'banner' | 'coupon'>('banner');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [b, setB] = useState(emptyBanner);
  const [c, setC] = useState(emptyCoupon);
  const [slide, setSlide] = useState(0);
  const [couponTab, setCouponTab] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');

  const q = useQuery({ queryKey: ['banners', tab, search], queryFn: async () => (await api.get<Res>('/admin/banners', { params: { tab, q: search } })).data });
  const cats = useQuery({ queryKey: ['cats-root'], queryFn: async () => (await api.get<{ items: { _id: string; name: string }[] }>('/admin/categories')).data.items });
  const homepage = (q.data?.items ?? []).filter((x) => x.position === 'homepage' && lifecycle(x) === 'active');
  useEffect(() => setSlide(0), [homepage.length]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['banners'] });
  const onErr = (e: unknown) => toast.error(errorMessage(e));

  const saveBanner = useMutation({
    mutationFn: async () => {
      const body = { title: b.title, subtitle: b.subtitle, buttonText: b.buttonText, linkType: b.linkType, linkValue: b.linkValue, image: b.image[0]?.url, position: b.position, startDate: b.startDate || undefined, endDate: b.endDate || undefined, priority: Number(b.priority) || 1, status: b.status };
      return editingId ? api.put(`/admin/banners/${editingId}`, body) : api.post('/admin/banners', body);
    },
    onSuccess: () => { toast.success('Banner saved'); reset(); invalidate(); },
    onError: onErr,
  });
  const saveCoupon = useMutation({
    mutationFn: async () => {
      const body = { ...c, code: c.code.toUpperCase(), value: Number(c.value) || 0, maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : undefined, minOrder: Number(c.minOrder) || 0, usageLimit: Number(c.usageLimit) || 1, perCustomerLimit: Number(c.perCustomerLimit) || 1, startDate: c.startDate || undefined, endDate: c.endDate || undefined };
      return editingId ? api.put(`/admin/coupons/${editingId}`, body) : api.post('/admin/coupons', body);
    },
    onSuccess: () => { toast.success('Offer saved'); reset(); invalidate(); },
    onError: onErr,
  });
  const delBanner = useMutation({ mutationFn: (id: string) => api.delete(`/admin/banners/${id}`), onSuccess: () => { toast.success('Banner deleted'); invalidate(); }, onError: onErr });
  const dupBanner = useMutation({ mutationFn: (id: string) => api.post(`/admin/banners/${id}/duplicate`), onSuccess: () => { toast.success('Banner duplicated (inactive)'); invalidate(); }, onError: onErr });
  const delCoupon = useMutation({ mutationFn: (id: string) => api.delete(`/admin/coupons/${id}`), onSuccess: () => { toast.success('Offer deleted'); invalidate(); }, onError: onErr });

  function reset() {
    setEditingId(null);
    setB(emptyBanner);
    setC(emptyCoupon);
  }
  function editBanner(x: Banner) {
    setMode('banner');
    setEditingId(x._id);
    setB({ title: x.title, subtitle: x.subtitle ?? '', buttonText: x.buttonText ?? '', linkType: x.linkType, linkValue: x.linkValue ?? '', image: [{ url: x.image }], position: x.position, startDate: toInput(x.startDate), endDate: toInput(x.endDate), priority: String(x.priority), status: x.status });
  }
  function editCoupon(x: Coupon) {
    setMode('coupon');
    setEditingId(x._id);
    setC({ code: x.code, name: x.name ?? '', type: x.type, value: String(x.value), maxDiscount: x.maxDiscount ? String(x.maxDiscount) : '', minOrder: String(x.minOrder), usageLimit: String(x.usageLimit), perCustomerLimit: '1', startDate: toInput(x.startDate), endDate: toInput(x.endDate), status: x.status });
  }
  const bannerValid = b.title.trim().length >= 2 && b.image.length > 0 && (!b.endDate || b.endDate >= b.startDate);
  const couponValid = /^[A-Za-z0-9]{3,20}$/.test(c.code) && (c.type !== 'percent' || Number(c.value) <= 100);

  const s = q.data?.stats;
  const coupons = (q.data?.coupons ?? []).filter((x) => couponTab === 'all' || lifecycle(x) === couponTab);
  const current = homepage[slide];

  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Marketing' }, { label: 'Banners & Offers' }]}
        title="Banners & Offers"
        sub="Manage homepage banners, promotional offers, coupons and campaigns to attract more customers."
        actions={<><Button variant="outline-brand" icon={<Plus size={16} />} onClick={() => { reset(); setMode('banner'); }}>Add Banner</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => { reset(); setMode('coupon'); }}>Create Offer</Button></>}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard tone="brand" icon={<ImageIcon size={22} />} label="Total Banners" value={num(s?.banners)} />
            <StatCard tone="brand" icon={<Tag size={22} />} label="Active Offers" value={num(s?.activeOffers)} />
            <StatCard tone="danger" icon={<Percent size={22} />} label="Total Coupons" value={num(s?.coupons)} deltaLabel={`${num(s?.couponUsage)} redemptions`} />
            <StatCard tone="accent" icon={<Users size={22} />} label="Offer Revenue" value={money(s?.offerRevenue)} deltaLabel="from coupon orders" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_250px]">
            <Card>
              <CardHeader title="Homepage Banner Preview" />
              <div className="px-5 pb-5">
                <div className="relative aspect-[16/5.6] overflow-hidden rounded-xl bg-line-soft">
                  {current ? (
                    <>
                      <Img src={current.image} alt="" className="absolute inset-0 size-full" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#fbf7ee] via-[#fbf7ee]/85 to-transparent" />
                      <div className="relative flex h-full max-w-[55%] flex-col justify-center p-6 sm:p-8">
                        <p className="text-[clamp(18px,2.6vw,34px)] leading-[1.05] font-extrabold tracking-[-0.02em] text-brand-800">{current.title}</p>
                        {current.subtitle && <p className="mt-2 text-[clamp(11px,1.1vw,15px)] text-ink">{current.subtitle}</p>}
                        {current.buttonText && <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white">{current.buttonText} <ArrowRight size={15} /></span>}
                      </div>
                      {homepage.length > 1 && (
                        <>
                          <button aria-label="Previous banner" onClick={() => setSlide((slide - 1 + homepage.length) % homepage.length)} className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow"><ChevronLeft size={18} /></button>
                          <button aria-label="Next banner" onClick={() => setSlide((slide + 1) % homepage.length)} className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow"><ChevronRight size={18} /></button>
                        </>
                      )}
                    </>
                  ) : <p className="grid h-full place-items-center text-sm text-muted">No live homepage banners.</p>}
                </div>
                <div className="mt-3 flex justify-center gap-1.5">{homepage.map((_, i) => <button key={i} aria-label={`Show banner ${i + 1}`} onClick={() => setSlide(i)} className={cx('h-2 rounded-full transition-all', i === slide ? 'w-5 bg-brand-800' : 'w-2 bg-line')} />)}</div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Banner Positions" />
              <ul className="space-y-2 px-4 pb-4">
                {POSITIONS.map(([v, l, size]) => (
                  <li key={v}>
                    <button onClick={() => { setMode('banner'); setB((x) => ({ ...x, position: v })); }} className={cx('flex w-full items-center gap-3 rounded-xl border p-2.5 text-left', b.position === v && mode === 'banner' ? 'border-accent-500 bg-accent-50' : 'border-line hover:bg-brand-50')}>
                      <span className="grid h-10 w-14 place-items-center rounded-lg bg-line-soft"><ImageIcon size={17} className="text-muted" aria-hidden /></span>
                      <span><span className="block text-[13px] font-semibold">{l}</span><span className="text-xs text-muted">({size})</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Tabs value={tab} onChange={setTab} items={[{ value: '', label: 'All Banners' }, { value: 'active', label: 'Active Banners' }, { value: 'expired', label: 'Expired Banners' }]} />
              <SearchInput value={search} onChange={setSearch} placeholder="Search banners…" className="w-64" />
            </div>
            <QueryState q={q}>
              {(d) => (
                <div className="px-4 pb-4">
                  <Table head={['#', 'Banner', 'Title', 'Position', 'Start Date', 'End Date', 'Status', 'Actions']}>
                    {d.items.map((x, i) => (
                      <tr key={x._id}>
                        <td className="tabular text-muted">{i + 1}</td>
                        <td><Img src={x.image} alt="" className="h-10 w-24 rounded-lg" /></td>
                        <td className="font-medium">{x.title}</td>
                        <td className="text-muted capitalize">{x.position === 'app' ? 'App Banner' : x.position}</td>
                        <td className="tabular text-muted">{date(x.startDate)}</td>
                        <td className="tabular text-muted">{date(x.endDate)}</td>
                        <td><StatusBadge status={lifecycle(x)} /></td>
                        <td>
                          <div className="flex gap-1.5">
                            <IconButton label={`Edit ${x.title}`} onClick={() => editBanner(x)}><Pencil size={14} /></IconButton>
                            <IconButton label={`Duplicate ${x.title}`} onClick={() => dupBanner.mutate(x._id)}><Copy size={14} /></IconButton>
                            <IconButton tone="danger" label={`Delete ${x.title}`} onClick={() => confirm(`Delete banner “${x.title}”?`) && delBanner.mutate(x._id)}><Trash2 size={14} /></IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                  {!d.items.length && <p className="py-10 text-center text-sm text-muted">No banners here.</p>}
                </div>
              )}
            </QueryState>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3"><h2 className="text-[15px] font-bold">Offers & Coupons</h2><Tabs value={couponTab} onChange={setCouponTab} items={[{ value: 'all', label: 'All Offers' }, { value: 'active', label: 'Active' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'expired', label: 'Expired' }]} /></div>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { reset(); setMode('coupon'); }}>Create Offer</Button>
            </div>
            <div className="px-4 pb-4">
              <Table head={['#', 'Offer Name', 'Type', 'Discount', 'Min Order', 'Usage', 'Start Date', 'End Date', 'Status', 'Actions']}>
                {coupons.map((x, i) => (
                  <tr key={x._id}>
                    <td className="tabular text-muted">{i + 1}</td>
                    <td className="tabular font-semibold">{x.code}</td>
                    <td className="text-muted">{x.type === 'free_delivery' ? 'Free Delivery' : 'Coupon Code'}</td>
                    <td className="font-semibold text-success">{x.type === 'percent' ? `${x.value}%` : x.type === 'flat' ? money(x.value) : 'Free Delivery'}</td>
                    <td className="tabular">{money(x.minOrder)}</td>
                    <td className="tabular">{x.used} / {x.usageLimit}</td>
                    <td className="tabular text-muted">{date(x.startDate)}</td>
                    <td className="tabular text-muted">{date(x.endDate)}</td>
                    <td><StatusBadge status={lifecycle(x)} /></td>
                    <td><div className="flex gap-1.5"><IconButton label={`Edit ${x.code}`} onClick={() => editCoupon(x)}><Pencil size={14} /></IconButton><IconButton tone="danger" label={`Delete ${x.code}`} onClick={() => confirm(`Delete offer ${x.code}?`) && delCoupon.mutate(x._id)}><Trash2 size={14} /></IconButton></div></td>
                  </tr>
                ))}
              </Table>
              {!coupons.length && <p className="py-10 text-center text-sm text-muted">No offers here.</p>}
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5 xl:sticky xl:top-[84px]">
          <h2 className="mb-3 text-base font-bold">{editingId ? 'Edit' : 'Add'} {mode === 'banner' ? 'Banner' : 'Offer / Coupon'}</h2>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-line-soft p-1">
            {(['banner', 'coupon'] as const).map((m) => <button key={m} onClick={() => { setMode(m); setEditingId(null); }} aria-pressed={mode === m} className={cx('h-9 rounded-lg text-[13px] font-semibold', mode === m ? 'bg-brand-900 text-white' : 'text-ink')}>{m === 'banner' ? 'Banner' : 'Offer / Coupon'}</button>)}
          </div>
          {mode === 'banner' ? (
            <form onSubmit={(e) => { e.preventDefault(); if (bannerValid) saveBanner.mutate(); else toast.error('Add a title, an image and valid dates.'); }} className="space-y-3.5" noValidate>
              <Field label="Title" required><Input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} /></Field>
              <Field label="Subtitle"><Input value={b.subtitle} onChange={(e) => setB({ ...b, subtitle: e.target.value })} /></Field>
              <Field label="Button Text"><Input value={b.buttonText} onChange={(e) => setB({ ...b, buttonText: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Button Link"><Select value={b.linkType} onChange={(e) => setB({ ...b, linkType: e.target.value })}><option value="category">Category Page</option><option value="offer">Offer</option><option value="url">URL</option></Select></Field>
                <Field label="Target">{b.linkType === 'category' ? <Select value={b.linkValue} onChange={(e) => setB({ ...b, linkValue: e.target.value })}><option value="">Select</option>{cats.data?.map((x) => <option key={x._id}>{x.name}</option>)}</Select> : <Input value={b.linkValue} onChange={(e) => setB({ ...b, linkValue: e.target.value })} />}</Field>
              </div>
              <div><span className="mb-1.5 block text-[13px] font-medium">Banner Image <span className="text-danger">*</span></span><ImagePicker single value={b.image} onChange={(v) => setB({ ...b, image: v })} folder="banners" /></div>
              <fieldset><legend className="mb-1.5 text-[13px] font-medium">Display Position</legend>
                <div className="grid grid-cols-2 gap-1.5 text-[13px]">{POSITIONS.map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="pos" checked={b.position === v} onChange={() => setB({ ...b, position: v })} className="size-4 accent-brand-700" />{l.replace(' Banner', '')}</label>)}</div>
              </fieldset>
              <div className="flex items-center justify-between"><span className="text-[13px] font-medium">Status</span><Toggle checked={b.status === 'active'} onChange={(v) => setB({ ...b, status: v ? 'active' : 'inactive' })} label="Banner active" /></div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start Date"><div className="relative"><CalendarDays size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" /><Input type="date" value={b.startDate} onChange={(e) => setB({ ...b, startDate: e.target.value })} className="pl-8" /></div></Field>
                <Field label="End Date" error={b.endDate && b.endDate < b.startDate ? 'Before start' : undefined}><Input type="date" value={b.endDate} min={b.startDate} onChange={(e) => setB({ ...b, endDate: e.target.value })} /></Field>
              </div>
              <Field label="Priority Order" hint="Lower number shows first"><Input inputMode="numeric" value={b.priority} onChange={(e) => setB({ ...b, priority: e.target.value.replace(/\D/g, '') })} /></Field>
              <div className="grid grid-cols-2 gap-2 pt-1"><Button type="button" onClick={reset}>Cancel</Button><Button type="submit" variant="primary" loading={saveBanner.isPending}>Save Banner</Button></div>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (couponValid) saveCoupon.mutate(); else toast.error('Use a 3–20 character code (letters/numbers) and a valid discount.'); }} className="space-y-3.5" noValidate>
              <Field label="Coupon code" required><Input value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="WELCOME10" className="tabular" /></Field>
              <Field label="Offer name"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type"><Select value={c.type} onChange={(e) => setC({ ...c, type: e.target.value })}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option><option value="free_delivery">Free delivery</option></Select></Field>
                <Field label={c.type === 'percent' ? 'Percent' : 'Amount (₹)'}><Input inputMode="numeric" value={c.value} disabled={c.type === 'free_delivery'} onChange={(e) => setC({ ...c, value: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Min order (₹)"><Input inputMode="numeric" value={c.minOrder} onChange={(e) => setC({ ...c, minOrder: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="Max discount (₹)"><Input inputMode="numeric" value={c.maxDiscount} onChange={(e) => setC({ ...c, maxDiscount: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Usage limit"><Input inputMode="numeric" value={c.usageLimit} onChange={(e) => setC({ ...c, usageLimit: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="Per customer"><Input inputMode="numeric" value={c.perCustomerLimit} onChange={(e) => setC({ ...c, perCustomerLimit: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start Date"><Input type="date" value={c.startDate} onChange={(e) => setC({ ...c, startDate: e.target.value })} /></Field>
                <Field label="End Date"><Input type="date" value={c.endDate} min={c.startDate} onChange={(e) => setC({ ...c, endDate: e.target.value })} /></Field>
              </div>
              <div className="flex items-center justify-between"><span className="text-[13px] font-medium">Status</span><Toggle checked={c.status === 'active'} onChange={(v) => setC({ ...c, status: v ? 'active' : 'inactive' })} label="Offer active" /></div>
              <div className="grid grid-cols-2 gap-2 pt-1"><Button type="button" onClick={reset}>Cancel</Button><Button type="submit" variant="primary" loading={saveCoupon.isPending}>Save Offer</Button></div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
