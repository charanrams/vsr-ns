import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { BarChart3, ShoppingCart, Users, Package, FileText, FileSpreadsheet, Eye, CalendarDays, Boxes, Truck, CreditCard, Tag } from 'lucide-react';
import { api, errorMessage, downloadFile } from '../lib/api';
import { money, num, dateTime, shortK, title } from '../lib/format';
import { Button, Card, CardHeader, StatCard, Table, StatusBadge, Pagination, Select, IconButton, Img, Avatar, QueryState, Badge, Legend, Tabs, cx } from '../components/ui';
import { Donut, C, SERIES, STATUS_COLOR, axisProps, ChartTooltip } from '../components/charts';

interface Res {
  kpis: Record<string, number>;
  series: { label: string; orders: number; revenue: number }[];
  byCategory: { name: string; value: number; pct: number }[];
  byStatus: { _id: string; n: number }[];
  byMethod: { _id: string; n: number }[];
  customerTypes: { returning: number; new: number };
  topProducts: { _id: string; name: string; unit: string; image: string; orders: number; revenue: number }[];
  topCustomers: { _id: string; name: string; avatar?: string; orders: number; revenue: number }[];
  rows: { _id: string; orderNumber: string; customer: { name: string }; items: unknown[]; totals: { grandTotal: number }; paymentMethod: string; status: string; createdAt: string }[];
  total: number;
}
const RANGES = [['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['3m', '3 Months'], ['6m', '6 Months'], ['1y', '1 Year']] as const;
const REPORT_TYPES = [['sales', 'Sales Report', BarChart3], ['orders', 'Orders Report', FileText], ['customers', 'Customer Report', Users], ['products', 'Product Report', Package], ['inventory', 'Inventory Report', Boxes], ['delivery', 'Delivery Report', Truck], ['payments', 'Payment Report', CreditCard], ['offers', 'Offer Report', Tag]] as const;

export default function Reports() {
  const nav = useNavigate();
  const [range, setRange] = useState<string>('30d');
  const [report, setReport] = useState<string>('sales');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const q = useQuery({ queryKey: ['reports', range, page, limit, status, method], queryFn: async () => (await api.get<Res>('/admin/reports', { params: { range, page, limit, status, method } })).data, placeholderData: keepPreviousData });
  const d = q.data;
  const exportCsv = () => downloadFile(`/admin/reports/export?range=${range}`, `vsr-${report}-report-${range}.csv`).then(() => toast.success('Report downloaded')).catch((e) => toast.error(errorMessage(e)));
  const statusTotal = d?.byStatus.reduce((s, x) => s + x.n, 0) ?? 0;
  const methodTotal = d?.byMethod.reduce((s, x) => s + x.n, 0) ?? 0;
  const custTotal = (d?.customerTypes.new ?? 0) + (d?.customerTypes.returning ?? 0);
  const from = new Date(Date.now() - ({ today: 0, '7d': 6, '30d': 29, '3m': 89, '6m': 179, '1y': 364 }[range] ?? 29) * 864e5);

  return (
    <div className="animate-rise">
      <div className="mb-5">
        <nav aria-label="Breadcrumb" className="mb-1 text-[13px] text-muted"><span className="text-ink">Reports</span> › Overview</nav>
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Reports</h1>
        <p className="mt-1 text-sm text-muted">Get detailed insights about your business performance, sales, customers and operations.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard tone="brand" icon={<BarChart3 size={22} />} label="Total Sales" value={money(d?.kpis.sales)} delta={d?.kpis.salesChange} deltaLabel="vs previous period" />
            <StatCard tone="info" icon={<ShoppingCart size={22} />} label="Total Orders" value={num(d?.kpis.orders)} delta={d?.kpis.ordersChange} deltaLabel="vs previous period" />
            <StatCard tone="danger" icon={<Users size={22} />} label="Total Customers" value={num(d?.kpis.customers)} delta={d?.kpis.customersChange} deltaLabel="growth" />
            <StatCard tone="accent" icon={<Package size={22} />} label="Avg. Order Value" value={money(d?.kpis.aov)} delta={d?.kpis.aovChange} deltaLabel="vs previous period" />
          </div>
          <Tabs value={report} onChange={setReport} items={REPORT_TYPES.map(([v, l]) => ({ value: v, label: l }))} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Sales Overview" action={<Badge>{RANGES.find((r) => r[0] === range)?.[1]}</Badge>} />
              <div className="flex justify-end gap-4 px-5 text-xs"><Legend color={C.green} label="Sales Amount" /><Legend color={C.orange} label="Orders" /></div>
              <div className="h-[230px] px-2 pb-3">
                <ResponsiveContainer>
                  <ComposedChart data={d?.series} margin={{ top: 10, right: 6, left: -6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f0ebe2" />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis yAxisId="r" {...axisProps} tickFormatter={shortK} />
                    <YAxis yAxisId="o" orientation="right" hide />
                    <ChartTooltip formatter={(v, n) => [n === 'revenue' ? money(v) : String(v), n === 'revenue' ? 'Sales' : 'Orders']} />
                    <Bar yAxisId="r" dataKey="revenue" fill="#1d8a57" radius={[4, 4, 0, 0]} barSize={26} />
                    <Line yAxisId="o" dataKey="orders" stroke={C.orange} strokeWidth={2} dot={{ r: 3.5, fill: '#fff', stroke: C.orange, strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Sales by Category" />
              <div className="px-5 pb-5"><Donut size={150} center={shortK(d?.kpis.sales ?? 0)} sub="Total Sales" valueLabel={(x, t) => `${t ? Math.round((x.value / t) * 100) : 0}%`} data={(d?.byCategory ?? []).slice(0, 6).map((c, i) => ({ name: c.name, value: c.value, color: SERIES[i] }))} /></div>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card><CardHeader title="Order Status Report" /><div className="px-5 pb-5"><Donut size={120} center={num(statusTotal)} sub="Total Orders" valueLabel={(x, t) => `${t ? Math.round((x.value / t) * 100) : 0}%`} data={(d?.byStatus ?? []).map((s) => ({ name: title(s._id === 'placed' ? 'pending' : s._id), value: s.n, color: STATUS_COLOR[s._id] ?? C.grey }))} /></div></Card>
            <Card><CardHeader title="Payment Method Report" /><div className="px-5 pb-5"><Donut size={120} center={num(methodTotal)} sub="Total Orders" valueLabel={(x, t) => `${t ? Math.round((x.value / t) * 100) : 0}%`} data={(d?.byMethod ?? []).map((m, i) => ({ name: m._id === 'cod' ? 'COD' : m._id === 'upi' ? 'UPI' : title(m._id), value: m.n, color: SERIES[i] }))} /></div></Card>
            <Card><CardHeader title="Customer Type Report" /><div className="px-5 pb-5"><Donut size={120} center={num(custTotal)} sub="Customers" valueLabel={(x, t) => `${t ? Math.round((x.value / t) * 100) : 0}%`} data={[{ name: 'New Customers', value: d?.customerTypes.new ?? 0, color: C.greenDark }, { name: 'Returning', value: d?.customerTypes.returning ?? 0, color: C.greenLight }]} /></div></Card>
          </div>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <h2 className="text-[15px] font-bold">Sales Details</h2>
              <div className="flex flex-wrap gap-2">
                <Select aria-label="Payment method" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="w-44"><option value="">All Payment Methods</option><option value="upi">UPI</option><option value="card">Card</option><option value="cod">COD</option><option value="wallet">Wallet</option><option value="netbanking">Net Banking</option></Select>
                <Select aria-label="Order status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40"><option value="">All Order Status</option>{['placed', 'confirmed', 'picking', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'].map((s) => <option key={s} value={s}>{title(s)}</option>)}</Select>
                <Button icon={<FileSpreadsheet size={15} />} onClick={exportCsv}>Export</Button>
              </div>
            </div>
            <QueryState q={q}>
              {(r) => (
                <>
                  <div className="px-4">
                    <Table head={['#', 'Date', 'Order ID', 'Customer', 'Items', 'Amount', 'Payment Method', 'Status', 'Actions']}>
                      {r.rows.map((o, i) => (
                        <tr key={o._id}>
                          <td className="tabular text-muted">{(page - 1) * limit + i + 1}</td>
                          <td className="tabular text-muted">{dateTime(o.createdAt)}</td>
                          <td className="tabular font-medium">#{o.orderNumber}</td>
                          <td>{o.customer?.name}</td>
                          <td className="tabular">{o.items.length}</td>
                          <td className="tabular font-semibold">{money(o.totals.grandTotal)}</td>
                          <td className={cx(o.paymentMethod === 'upi' && 'font-semibold text-violet')}>{o.paymentMethod === 'cod' ? 'COD' : o.paymentMethod.toUpperCase()}</td>
                          <td><StatusBadge status={o.status} /></td>
                          <td><IconButton label="View order" onClick={() => nav(`/admin/orders/${o._id}`)}><Eye size={14} /></IconButton></td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                  <Pagination page={page} total={r.total} limit={limit} noun="orders" onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
                </>
              )}
            </QueryState>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Date Range</h2>
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <CalendarDays size={18} className="text-brand-700" aria-hidden />
              <div className="text-[13px]"><p className="font-semibold">{RANGES.find((r) => r[0] === range)?.[1]}</p><p className="text-xs text-muted">{from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {RANGES.map(([v, l]) => <button key={v} onClick={() => { setRange(v); setPage(1); }} aria-pressed={range === v} className={cx('h-9 rounded-[9px] border text-[13px] font-semibold', range === v ? 'border-brand-900 bg-brand-900 text-white' : 'border-line hover:bg-brand-50')}>{l}</button>)}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Generate Report</h2>
            <div className="grid grid-cols-3 gap-2">
              {REPORT_TYPES.map(([v, l, Icon]) => (
                <button key={v} onClick={() => setReport(v)} aria-pressed={report === v} className={cx('grid place-items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-[11px] font-medium', report === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line hover:bg-brand-50')}>
                  <Icon size={20} className="text-brand-700" aria-hidden />{l}
                </button>
              ))}
            </div>
            <h3 className="mt-5 mb-2 text-sm font-bold">Export Report</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" icon={<FileText size={14} className="text-danger" />} onClick={() => window.print()}>Print / PDF</Button>
              <Button size="sm" icon={<FileSpreadsheet size={14} className="text-success" />} onClick={exportCsv}>Export Excel</Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Top Selling Products" />
            <ul className="px-5 pb-4">
              {d?.topProducts.map((p, i) => (
                <li key={p._id} className="flex items-center gap-3 py-1.5">
                  <span className="tabular grid size-6 place-items-center rounded-full bg-accent-50 text-xs font-bold text-accent-600">{i + 1}</span>
                  <Img src={p.image} alt="" className="size-9 rounded-lg" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{p.name} ({p.unit})</p><p className="text-xs text-muted">{p.orders} orders</p></div>
                  <span className="tabular text-[13px] font-bold">{money(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Top Customers by Revenue" />
            <ul className="px-5 pb-4">
              {d?.topCustomers.map((c, i) => (
                <li key={c._id} className="flex items-center gap-3 py-1.5">
                  <span className="tabular w-4 text-xs text-muted">{i + 1}</span>
                  <Avatar src={c.avatar} name={c.name ?? '?'} size={30} />
                  <span className="flex-1 text-[13px] font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.orders} orders</span>
                  <span className="tabular text-[13px] font-bold">{money(c.revenue)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
