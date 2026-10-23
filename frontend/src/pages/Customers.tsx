import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, ShoppingBag, UserX, Eye, Pencil, Phone, Mail, MapPin, Plus, ClipboardList, IndianRupee, Star, Ban, Home, Building2, MessageCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { money, num, date } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, StatCard, Table, StatusBadge, Pagination, SearchInput, Select, IconButton, Avatar, Img, Menu, QueryState, Panel, Tabs, Dialog, Field, Input, Textarea, Badge, Loading, RangeSelect } from '../components/ui';
import { Donut, SERIES, axisProps, ChartTooltip } from '../components/charts';

interface Row { _id: string; name: string; phone: string; email: string; avatar?: string; location: string; totalOrders: number; totalSpent: number; status: string; createdAt: string }
interface Insights { total: number; newThis: number; newPrev: number; active: number; inactive: number; growth: { _id: { y: number; m: number }; n: number }[]; locations: { _id: string; n: number }[]; top: { _id: string; name: string; avatar?: string; orders: number }[] }
interface Detail {
  customer: { _id: string; name: string; phone: string; email: string; avatar?: string; status: string; createdAt: string; tags: string[]; addresses: { _id: string; label: string; line1: string; line2?: string; city: string; postalCode: string; isDefault: boolean }[]; notes: { text: string; by?: { name: string }; at: string }[] };
  orders: { _id: string; orderNumber: string; status: string; totals: { grandTotal: number }; createdAt: string; items: { image: string }[] }[];
  tickets: { _id: string; ticketNumber: string; subject: string; status: string }[];
  stats: { orders: number; spent: number; rating: number | null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

function CustomerPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tab, setTab] = useState<'overview' | 'addresses' | 'orders' | 'notes'>('overview');
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: ['customer', id], queryFn: async () => (await api.get<Detail>(`/admin/customers/${id}`)).data });
  const status = useMutation({
    mutationFn: async (s: string) => api.patch(`/admin/customers/${id}/status`, { status: s }),
    onSuccess: () => {
      toast.success('Customer updated');
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addNote = useMutation({
    mutationFn: async () => api.post(`/admin/customers/${id}/notes`, { text: note }),
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading || !q.data) return <Panel title="Customer Details" onClose={onClose}><Loading /></Panel>;
  const { customer: c, orders, stats } = q.data;
  const blocked = c.status !== 'active';

  const addresses = (
    <ul className="space-y-3">
      {c.addresses.map((a) => (
        <li key={a._id} className="flex gap-3 text-[13px]">
          {a.label === 'Work' ? <Building2 size={17} className="mt-0.5 shrink-0 text-brand-700" aria-hidden /> : a.label === 'Home' ? <Home size={17} className="mt-0.5 shrink-0 text-brand-700" aria-hidden /> : <MapPin size={17} className="mt-0.5 shrink-0 text-brand-700" aria-hidden />}
          <div className="flex-1"><p className="font-semibold">{a.label}</p><p className="text-muted">{a.line1}<br />{a.line2 ? `${a.line2}, ` : ''}{a.city} - {a.postalCode}</p></div>
          {a.isDefault && <Badge tone="success">Default</Badge>}
        </li>
      ))}
    </ul>
  );
  const orderList = (
    <ul className="space-y-2.5">
      {orders.map((o) => (
        <li key={o._id}>
          <button onClick={() => nav(`/admin/orders/${o._id}`)} className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-brand-50">
            <Img src={o.items[0]?.image} alt="" className="size-11 rounded-lg" />
            <div className="flex-1"><p className="tabular text-[13px] font-bold">#{o.orderNumber}</p><StatusBadge status={o.status} /></div>
            <div className="text-right"><p className="tabular text-[13px] font-bold">{money(o.totals.grandTotal)}</p><p className="text-[11px] text-muted">{date(o.createdAt)}</p></div>
          </button>
        </li>
      ))}
      {!orders.length && <li className="text-[13px] text-muted">No orders yet.</li>}
    </ul>
  );
  const notes = (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }} className="mb-3">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note visible to staff only…" aria-label="Customer note" />
        <Button size="sm" type="submit" className="mt-2" icon={<Plus size={14} />} loading={addNote.isPending} disabled={!note.trim()}>Add Note</Button>
      </form>
      {c.notes.map((n, i) => <div key={i} className="mb-2 rounded-xl border border-line p-3 text-[13px]"><p>{n.text}</p><p className="mt-1 text-[11px] text-muted">{n.by?.name ?? 'Staff'} · {date(n.at)}</p></div>)}
    </div>
  );

  return (
    <Panel title="Customer Details" onClose={onClose}>
      <div className="flex items-center gap-3">
        <Avatar src={c.avatar} name={c.name} size={60} />
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-lg font-bold">{c.name}</p><StatusBadge status={c.status} />{c.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</div>
          <p className="text-xs text-muted">Customer since {date(c.createdAt)}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant={blocked ? 'outline-brand' : 'danger-soft'} className="flex-1" icon={<Ban size={14} />} loading={status.isPending} onClick={() => status.mutate(blocked ? 'active' : 'blocked')}>{blocked ? 'Unblock Customer' : 'Block Customer'}</Button>
        <Menu items={[{ label: c.status === 'inactive' ? 'Mark active' : 'Mark inactive', onClick: () => status.mutate(c.status === 'inactive' ? 'active' : 'inactive') }]} />
      </div>
      <Tabs className="mt-4" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'addresses', label: 'Addresses' }, { value: 'orders', label: 'Orders' }, { value: 'notes', label: 'Notes' }]} />
      <div className="mt-4">
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-line-soft/70 py-3"><ClipboardList size={18} className="mx-auto text-brand-700" aria-hidden /><p className="tabular mt-1 font-extrabold">{stats.orders}</p><p className="text-[11px] text-muted">Total Orders</p></div>
              <div className="rounded-xl bg-line-soft/70 py-3"><IndianRupee size={18} className="mx-auto text-brand-700" aria-hidden /><p className="tabular mt-1 font-extrabold">{money(stats.spent)}</p><p className="text-[11px] text-muted">Total Spent</p></div>
              <div className="rounded-xl bg-line-soft/70 py-3"><Star size={18} className="mx-auto text-accent-500" fill="currentColor" aria-hidden /><p className="tabular mt-1 font-extrabold">{stats.rating ?? '—'}</p><p className="text-[11px] text-muted">Avg Rating</p></div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Contact Information</h3>
              <p className="flex items-center gap-2 py-1 text-[13px]"><Phone size={14} className="text-muted" aria-hidden /><a href={`tel:${c.phone}`}>{c.phone}</a><a href={`https://wa.me/${c.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-success"><MessageCircle size={14} /></a></p>
              <p className="flex items-center gap-2 py-1 text-[13px]"><Mail size={14} className="text-muted" aria-hidden /><a href={`mailto:${c.email}`}>{c.email}</a></p>
            </div>
            <div><div className="mb-2 flex justify-between"><h3 className="text-sm font-bold">Recent Orders</h3><button className="text-xs font-semibold text-brand-700" onClick={() => setTab('orders')}>View All</button></div>{orderList}</div>
            <div><div className="mb-2 flex justify-between"><h3 className="text-sm font-bold">Addresses ({c.addresses.length})</h3></div>{addresses}</div>
            <div><h3 className="mb-2 text-sm font-bold">Notes</h3>{notes}</div>
          </div>
        )}
        {tab === 'addresses' && addresses}
        {tab === 'orders' && orderList}
        {tab === 'notes' && notes}
      </div>
    </Panel>
  );
}

export default function Customers() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const p = Object.fromEntries(sp.entries());
  const page = Number(p.page ?? 1);
  const limit = Number(p.limit ?? 8);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: '', email: '', phone: '', password: '' });
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch) && !('id' in patch)) n.delete('page');
    setSp(n);
  };
  const list = useQuery({ queryKey: ['customers', p], queryFn: async () => (await api.get<{ items: Row[]; total: number }>('/admin/customers', { params: { ...p, page, limit } })).data, placeholderData: keepPreviousData });
  const [months, setMonths] = useState('6');
  const ins = useQuery({ queryKey: ['customer-insights', months], queryFn: async () => (await api.get<Insights>('/admin/customers/insights', { params: { months } })).data, placeholderData: (p) => p });
  const create = useMutation({
    mutationFn: async () => api.post('/admin/customers', nf),
    onSuccess: () => {
      toast.success('Customer created');
      setAdding(false);
      setNf({ name: '', email: '', phone: '', password: '' });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const i = ins.data;
  const growth = i?.growth.map((g) => ({ label: `${MONTHS[g._id.m - 1]} ${String(g._id.y).slice(2)}`, n: g.n })) ?? [];
  const locTotal = i?.locations.reduce((s, l) => s + l.n, 0) || 1;
  const locs = (i?.locations ?? []).slice(0, 4).map((l, k) => ({ name: l._id ?? 'Other', value: l.n, color: SERIES[k] }));
  const otherN = (i?.locations ?? []).slice(4).reduce((s, l) => s + l.n, 0);
  if (otherN) locs.push({ name: 'Other', value: otherN, color: '#c9c4b8' });

  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Customers' }, { label: 'All Customers' }]} title="Customers" sub="Manage your customers, view their details, orders and activity." actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add Customer</Button>} />
      <div className={`grid grid-cols-1 gap-4 ${p.id ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard tone="brand" icon={<Users size={22} />} label="Total Customers" value={num(i?.total)} />
            <StatCard tone="info" icon={<UserPlus size={22} />} label="New Customers" value={num(i?.newThis)} delta={i ? pct(i.newThis, i.newPrev) : undefined} deltaLabel="vs. previous 30 days" />
            <StatCard tone="accent" icon={<ShoppingBag size={22} />} label="Active Customers" value={num(i?.active)} />
            <StatCard tone="danger" icon={<UserX size={22} />} label="Inactive / Blocked" value={num(i?.inactive)} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Customer Growth" action={<RangeSelect label="Months" value={months} onChange={setMonths} options={[['3', 'Last 3 Months'], ['6', 'Last 6 Months'], ['12', 'Last 12 Months']]} />} />
              <div className="h-[200px] px-2 pb-3">
                <ResponsiveContainer><BarChart data={growth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#f0ebe2" /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} allowDecimals={false} /><ChartTooltip formatter={(v) => [String(v), 'New customers']} /><Bar dataKey="n" fill="#1d8a57" radius={[4, 4, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Customers by Location" />
              <div className="px-5 pb-5"><Donut size={130} center="" data={locs} valueLabel={(d) => `${Math.round((d.value / locTotal) * 100)}%`} /></div>
            </Card>
            <Card>
              <CardHeader title="Top Customers by Orders" />
              <ul className="px-5 pb-4">
                {i?.top.map((t) => (
                  <li key={t._id}><button onClick={() => set({ id: t._id })} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-brand-50"><Avatar src={t.avatar} name={t.name} size={32} /><span className="flex-1 text-[13px] font-medium">{t.name}</span><span className="tabular text-xs text-muted">{t.orders} orders</span></button></li>
                ))}
              </ul>
            </Card>
          </div>
          <Card>
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <SearchInput value={p.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Search customers by name, phone, email…" className="min-w-[220px] flex-1" />
              <Select aria-label="Status" value={p.status ?? ''} onChange={(e) => set({ status: e.target.value })} className="w-36"><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></Select>
              <Select aria-label="Sort" value={p.sort ?? ''} onChange={(e) => set({ sort: e.target.value })} className="w-40"><option value="">Sort by: Latest</option><option value="name">Name A–Z</option></Select>
            </div>
            <QueryState q={list}>
              {(d) => (
                <>
                  <div className="px-4">
                    <Table head={['#', 'Customer', 'Phone', 'Email', 'Location', 'Total Orders', 'Total Spent', 'Status', 'Joined On', 'Actions']} minWidth={1000}>
                      {d.items.map((r, k) => (
                        <tr key={r._id} aria-selected={p.id === r._id} className={p.id === r._id ? '[&>td]:bg-brand-50' : ''}>
                          <td className="tabular text-muted">{(page - 1) * limit + k + 1}</td>
                          <td><div className="flex items-center gap-2.5"><Avatar src={r.avatar} name={r.name} size={32} /><span className="font-semibold">{r.name}</span></div></td>
                          <td className="tabular">{r.phone}</td>
                          <td className="text-muted">{r.email}</td>
                          <td>{r.location}</td>
                          <td className="tabular text-center">{r.totalOrders}</td>
                          <td className="tabular">{money(r.totalSpent)}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td className="text-muted">{date(r.createdAt)}</td>
                          <td><div className="flex gap-1.5"><IconButton label={`View ${r.name}`} onClick={() => set({ id: r._id })}><Eye size={14} /></IconButton><IconButton label={`Notes for ${r.name}`} onClick={() => set({ id: r._id })}><Pencil size={14} /></IconButton></div></td>
                        </tr>
                      ))}
                    </Table>
                    {!d.items.length && <p className="py-12 text-center text-sm text-muted">No customers found.</p>}
                  </div>
                  <Pagination page={page} total={d.total} limit={limit} noun="customers" onPage={(n) => set({ page: String(n) })} onLimit={(l) => set({ limit: String(l) })} />
                </>
              )}
            </QueryState>
          </Card>
        </div>
        {p.id && <CustomerPanel id={p.id} onClose={() => set({ id: '' })} />}
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add customer" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>Create Customer</Button></>}>
        <div className="space-y-3">
          <Field label="Full name" required><Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} /></Field>
          <Field label="Phone" required><Input inputMode="tel" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="+91 98765 43210" /></Field>
          <Field label="Temporary password" required hint="At least 8 characters. Ask the customer to change it after signing in."><Input type="password" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} /></Field>
        </div>
      </Dialog>
    </div>
  );
}
