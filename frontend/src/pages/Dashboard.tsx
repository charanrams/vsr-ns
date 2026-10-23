import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ShoppingCart, IndianRupee, Users, Package, ClipboardList, Plus, Tag, Send, ArrowRight, Eye, ShoppingBag, CreditCard, PackageCheck, Bike, PackagePlus, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, num, date, time, ago, shortK } from '../lib/format';
import { Button, Card, CardHeader, StatCard, StatusBadge, Img, Avatar, Table, IconButton, Badge, Skeleton, ErrorState, Legend, RangeSelect } from '../components/ui';
import { Donut, C, STATUS_COLOR, axisProps, ChartTooltip, SERIES } from '../components/charts';

interface DashboardData {
  kpis: Record<string, number>;
  byStatus: Record<string, number>;
  trend: { label: string; orders: number; revenue: number }[];
  categories: { name: string; value: number; pct: number }[];
  lowStock: { _id: string; name: string; unit: string; images: { url: string }[]; stock: { onHand: number; reserved: number } }[];
  bestSellers: { _id: string; name: string; image: string; price: number; orders: number }[];
  newCustomers: { _id: string; name: string; avatar: string; phone: string; createdAt: string; orders: number; spent: number }[];
  partners: Record<string, number>;
  recentOrders: { _id: string; orderNumber: string; customer: { name: string }; items: unknown[]; totals: { grandTotal: number }; status: string; createdAt: string }[];
  activity: { _id: string; action: string; summary: string; createdAt: string; actor?: { name: string } }[];
  earnings: { label: string; revenue: number; orders: number }[];
}

const ACTION_LABEL: Record<string, string> = {
  'order.placed': 'New order received', 'order.confirmed': 'Order accepted', 'order.rejected': 'Order rejected', 'order.cancelled': 'Order cancelled',
  'order.picking': 'Picking started', 'order.packed': 'Order packed', 'order.assigned': 'Delivery partner assigned', 'order.out_for_delivery': 'Out for delivery',
  'order.delivered': 'Order delivered', 'payment.verified': 'Payment confirmed', 'payment.refund': 'Refund issued', 'payment.mark_failed': 'Payment marked failed',
  'product.create': 'Product added', 'product.update': 'Product updated', 'product.duplicate': 'Product duplicated', 'product.archive': 'Product archived',
  'category.create': 'Category created', 'category.update': 'Category updated', 'category.delete': 'Category deleted', 'inventory.adjust': 'Stock adjusted',
  'banner.create': 'Banner created', 'coupon.create': 'Offer created', 'ticket.update': 'Ticket updated', 'notification.send': 'Notification sent', 'user.create': 'Staff account created',
};
const activityTitle = (a: { action: string }) => ACTION_LABEL[a.action] ?? a.action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
// Older log rows stored raw ids or bare names; only show summaries that read as sentences
const activityDetail = (a: { action: string; summary?: string; actor?: { name: string } }) => {
  const s = a.summary && !/^from [0-9a-f]{24}$/.test(a.summary) && !a.summary.startsWith('{') ? a.summary : '';
  return [s, a.actor?.name && `by ${a.actor.name}`].filter(Boolean).join(' · ') || '—';
};

const ACTIVITY_ICON: Record<string, typeof ShoppingBag> = { order: ShoppingBag, payment: CreditCard, product: PackagePlus, inventory: PackageCheck };

export default function Dashboard() {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const [ranges, setRanges] = useState({ trendRange: '7d', statusRange: 'all', catRange: '30d', bestRange: '30d', earnRange: 'month' });
  const setRange = (k: keyof typeof ranges) => (v: string) => setRanges((r) => ({ ...r, [k]: v }));
  const q = useQuery({
    queryKey: ['dashboard', ranges],
    queryFn: async () => (await api.get<DashboardData>('/admin/dashboard', { params: ranges })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const d = q.data;

  const statusRows = [
    ['Pending', (d?.byStatus.placed ?? 0), STATUS_COLOR.placed],
    ['Confirmed', d?.byStatus.confirmed ?? 0, STATUS_COLOR.confirmed],
    ['Preparing', (d?.byStatus.picking ?? 0) + (d?.byStatus.packed ?? 0), C.blue],
    ['Out for Delivery', (d?.byStatus.out_for_delivery ?? 0) + (d?.byStatus.assigned ?? 0), '#7fb2f0'],
    ['Delivered', d?.byStatus.delivered ?? 0, C.green],
    ['Cancelled', (d?.byStatus.cancelled ?? 0) + (d?.byStatus.rejected ?? 0), C.red],
  ] as const;
  const totalStatus = statusRows.reduce((s, r) => s + r[1], 0);
  const partnersTotal = (d?.partners.online ?? 0) + (d?.partners.on_delivery ?? 0) + (d?.partners.offline ?? 0);

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {user?.name.split(' ')[0]}! Here’s what’s happening with your store today.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {can('products') && <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/admin/products/new')}>Add Product</Button>}
          {can('orders') && <Button icon={<ClipboardList size={16} />} onClick={() => nav('/admin/orders?status=placed')}>Manage Orders</Button>}
          {can('marketing') && <Button icon={<Tag size={16} />} onClick={() => nav('/admin/marketing')}>Add Offer</Button>}
          {can('notifications') && <Button icon={<Send size={16} />} onClick={() => nav('/admin/notifications')}>Send Notification</Button>}
        </div>
      </div>

      {q.error ? (
        <Card><ErrorState message="Couldn’t load the dashboard." onRetry={() => q.refetch()} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {!d ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[104px]" />) : (
              <>
                <StatCard tone="brand" icon={<ShoppingCart size={22} />} label="Total Orders" value={num(d.kpis.totalOrders)} delta={d.kpis.ordersChange} deltaLabel="from yesterday" />
                <StatCard tone="accent" icon={<IndianRupee size={22} />} label="Total Revenue" value={money(d.kpis.totalRevenue)} delta={d.kpis.revenueChange} deltaLabel="from yesterday" />
                <StatCard tone="info" icon={<Users size={22} />} label="Total Customers" value={num(d.kpis.totalCustomers)} delta={d.kpis.customersChange} deltaLabel="joined today" />
                <StatCard tone="warning" icon={<Package size={22} />} label="Active Products" value={num(d.kpis.totalProducts)} deltaLabel={`${d.lowStock.length} need restock`} />
                <StatCard tone="danger" icon={<ClipboardList size={22} />} label="Pending Orders" value={num(d.kpis.pendingOrders)} delta={d.kpis.pendingChange} invertDelta deltaLabel="vs. before today" />
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="Sales & Orders Trend" action={<RangeSelect label="Trend range" value={ranges.trendRange} onChange={setRange('trendRange')} options={[['7d', 'Last 7 Days'], ['30d', 'Last 30 Days'], ['3m', 'Last 3 Months'], ['1y', 'Last 12 Months']]} />} />
              <div className="flex justify-end gap-4 px-5 text-xs"><Legend color={C.greenLight} label="Orders" /><Legend color={C.orange} label="Revenue" /></div>
              <div className="h-[230px] px-2 pb-3">
                {d && (
                  <ResponsiveContainer>
                    <ComposedChart data={d.trend} margin={{ top: 10, right: 6, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f0ebe2" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis yAxisId="o" {...axisProps} allowDecimals={false} />
                      <YAxis yAxisId="r" orientation="right" {...axisProps} tickFormatter={shortK} />
                      <ChartTooltip formatter={(v, n) => [n === 'revenue' ? money(v) : String(v), n === 'revenue' ? 'Revenue' : 'Orders']} />
                      <Bar yAxisId="o" dataKey="orders" fill={C.greenLight} radius={[4, 4, 0, 0]} barSize={22} />
                      <Line yAxisId="r" dataKey="revenue" stroke={C.orange} strokeWidth={2} dot={{ r: 3, fill: C.orange }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Orders by Status" action={<RangeSelect label="Status range" value={ranges.statusRange} onChange={setRange('statusRange')} options={[['today', 'Today'], ['7d', 'Last 7 Days'], ['30d', 'Last 30 Days'], ['all', 'All Time']]} />} />
              <div className="px-5 pb-5">
                <Donut center={num(totalStatus)} sub="Total Orders" data={statusRows.map(([name, value, color]) => ({ name, value, color }))} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Top Categories" action={<RangeSelect label="Category range" value={ranges.catRange} onChange={setRange('catRange')} options={[['7d', 'Last 7 Days'], ['30d', 'This Month'], ['3m', 'Last 3 Months'], ['all', 'All Time']]} />} />
              <ul className="space-y-3 px-5 pb-5">
                {d?.categories.slice(0, 7).map((c, i) => (
                  <li key={c.name} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-[13px]">
                    <span className="truncate">{c.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-line-soft"><span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: i === 0 ? C.green : SERIES[i % SERIES.length] }} /></span>
                    <span className="tabular text-right text-muted">{c.pct}%</span>
                  </li>
                ))}
                {d && !d.categories.length && <p className="text-sm text-muted">No sales in this period.</p>}
              </ul>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2">Low Stock Alert {d && <Badge tone="danger">{d.lowStock.length} Products</Badge>}</span>} action={can('inventory') ? <Link to="/admin/inventory?stock=low_stock" className="flex items-center gap-1 text-xs font-semibold text-brand-700">View All <ArrowRight size={13} /></Link> : null} />
              <ul className="divide-y divide-line-soft px-5 pb-3">
                {d?.lowStock.map((p) => {
                  const a = p.stock.onHand - p.stock.reserved;
                  return (
                    <li key={p._id} className="flex items-center gap-3 py-2">
                      <Img src={p.images[0]?.url} alt={p.name} className="size-10 rounded-lg" />
                      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{p.name}</p><p className="text-xs text-muted">{p.unit} · <span className="tabular font-semibold text-danger">{a} units</span></p></div>
                      <StatusBadge status={a <= 0 ? 'out_of_stock' : 'low_stock'} label={a <= 0 ? 'Out' : 'Low'} />
                    </li>
                  );
                })}
                {d && !d.lowStock.length && <p className="py-6 text-center text-sm text-muted">All products are well stocked.</p>}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Best Selling Products" action={<RangeSelect label="Best sellers range" value={ranges.bestRange} onChange={setRange('bestRange')} options={[['7d', 'This Week'], ['30d', 'This Month'], ['3m', '3 Months'], ['all', 'All Time']]} />} />
              <ul className="divide-y divide-line-soft px-5 pb-3">
                {d && !d.bestSellers.length && <p className="py-6 text-center text-sm text-muted">No sales in this period.</p>}
                {d?.bestSellers.map((p) => (
                  <li key={p._id} className="flex items-center gap-3 py-2">
                    <Img src={p.image} alt={p.name} className="size-10 rounded-lg" />
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{p.name}</p><p className="text-xs text-muted">{p.orders} orders</p></div>
                    <span className="tabular text-[13px] font-semibold">{money(p.price)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="New Customers" action={<Badge tone="neutral">Latest</Badge>} />
              <ul className="divide-y divide-line-soft px-5 pb-3">
                {d?.newCustomers.map((c) => (
                  <li key={c._id} className="flex items-center gap-3 py-2">
                    <Avatar src={c.avatar} name={c.name} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{c.name}</p><p className="text-xs text-muted">{c.orders} order{c.orders === 1 ? '' : 's'} · {money(c.spent)}</p></div>
                    <span className="text-xs text-muted">{date(c.createdAt)}</span>
                    {c.phone && <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name}`} className="text-success"><MessageCircle size={16} /></a>}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Delivery Partners Status" action={can('delivery') ? <Link to="/admin/delivery-partners" className="flex items-center gap-1 text-xs font-semibold text-brand-700">View All <ArrowRight size={13} /></Link> : null} />
              <div className="px-5 pb-5">
                <Donut size={140} center={partnersTotal} sub="Total Partners" valueLabel={(x) => x.value} data={[{ name: 'Online', value: d?.partners.online ?? 0, color: C.green }, { name: 'On Delivery', value: d?.partners.on_delivery ?? 0, color: C.blue }, { name: 'Offline', value: d?.partners.offline ?? 0, color: C.grey }]} />
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[['Online', d?.partners.online ?? 0, 'bg-brand-50 text-brand-800'], ['On Delivery', d?.partners.on_delivery ?? 0, 'bg-info-bg text-info'], ['Offline', d?.partners.offline ?? 0, 'bg-danger-bg text-danger']].map(([l, v, cls]) => (
                    <div key={l as string} className={`rounded-xl py-2.5 ${cls}`}><p className="tabular text-lg font-extrabold">{v}</p><p className="text-[11px]">{l}</p></div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr_1fr]">
            {can('orders') && (
              <Card>
                <CardHeader title="Recent Orders" action={<Link to="/admin/orders" className="flex items-center gap-1 text-xs font-semibold text-brand-700">View All <ArrowRight size={13} /></Link>} />
                <div className="px-3 pb-3">
                  <Table minWidth={560} head={['# Order ID', 'Customer', 'Items', 'Amount', 'Status', 'Time', 'Action']}>
                    {d?.recentOrders.map((o) => (
                      <tr key={o._id}>
                        <td className="tabular font-medium">{o.orderNumber}</td>
                        <td>{o.customer?.name}</td>
                        <td className="tabular">{o.items.length}</td>
                        <td className="tabular">{money(o.totals.grandTotal)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td className="tabular text-muted">{time(o.createdAt)}</td>
                        <td><IconButton label={`View order ${o.orderNumber}`} onClick={() => nav(`/admin/orders/${o._id}`)}><Eye size={15} /></IconButton></td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Latest Activities" />
              <ol className="relative mx-5 mb-4 border-l border-dashed border-line pl-5">
                {d?.activity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.action.split('.')[0]] ?? Bike;
                  return (
                    <li key={a._id} className="relative pb-3.5 last:pb-0">
                      <span className="absolute top-0 -left-[33px] grid size-6 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon size={13} aria-hidden /></span>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] font-semibold">{activityTitle(a)}</p>
                        <span className="shrink-0 text-xs text-muted">{ago(a.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted">{activityDetail(a)}</p>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card>
              <CardHeader title="Earnings Overview" action={<RangeSelect label="Earnings range" value={ranges.earnRange} onChange={setRange('earnRange')} options={[['month', 'This Month'], ['30d', 'Last 30 Days'], ['3m', 'Last 3 Months'], ['1y', 'Last 12 Months']]} />} />
              <div className="h-[230px] px-2 pb-3">
                {d && (
                  <ResponsiveContainer>
                    <AreaChart data={d.earnings} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.22} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#f0ebe2" />
                      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis {...axisProps} tickFormatter={shortK} />
                      <ChartTooltip formatter={(v, n) => [n === 'revenue' ? money(v) : String(v), n === 'revenue' ? 'Revenue' : 'Orders']} />
                      <Area dataKey="revenue" stroke={C.green} strokeWidth={2} fill="url(#earn)" dot={{ r: 2.5, fill: C.green }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
