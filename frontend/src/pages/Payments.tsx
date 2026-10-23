import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Download, Wallet, CheckCircle2, XCircle, RotateCcw, Eye, RefreshCw, ClipboardList, Receipt, X } from 'lucide-react';
import { api, errorMessage, downloadFile } from '../lib/api';
import { money, num, dateTime, title } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, StatCard, Table, StatusBadge, Pagination, SearchInput, Select, IconButton, Avatar, Menu, QueryState, Panel, KV, Dialog, Field, Textarea, Input, Loading, Legend, RangeSelect } from '../components/ui';
import { Donut, C, axisProps, ChartTooltip, SERIES } from '../components/charts';

interface Pay {
  _id: string; order: { _id: string; orderNumber: string; totals: { itemTotal: number; discount: number; couponCode?: string; deliveryFee: number; packagingFee: number; tax: number; grandTotal: number } };
  customer: { name: string; phone: string; email: string; avatar?: string }; provider: string; method: string; providerPaymentId?: string; providerOrderId?: string;
  amount: number; status: string; verifiedAt?: string; createdAt: string; logs: { event: string; at: string }[];
}
interface Res { items: Pay[]; total: number; summary: Record<string, { n: number; amount: number }>; methods: { _id: string; n: number }[]; trend: { label: string; successful: number; failed: number; refunded: number }[] }
const METHOD_LABEL: Record<string, string> = { upi: 'UPI', card: 'Card', wallet: 'Wallet', cod: 'COD', netbanking: 'Net Banking' };

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const q = useQuery({ queryKey: ['payment', id], queryFn: async () => (await api.get<{ payment: Pay }>(`/admin/payments/${id}`)).data.payment });
  const done = (msg: string) => () => {
    toast.success(msg);
    setRefundOpen(false);
    qc.invalidateQueries({ queryKey: ['payment', id] });
    qc.invalidateQueries({ queryKey: ['payments'] });
  };
  const refund = useMutation({ mutationFn: async () => api.post(`/admin/payments/${id}/refund`, { reason, amount: amount ? Number(amount) : undefined }), onSuccess: done('Refund initiated'), onError: (e) => toast.error(errorMessage(e)) });
  const fail = useMutation({ mutationFn: async () => api.post(`/admin/payments/${id}/mark-failed`), onSuccess: done('Payment marked as failed'), onError: (e) => toast.error(errorMessage(e)) });
  if (!q.data) return <Panel title="Payment Details" onClose={onClose}><Loading /></Panel>;
  const p = q.data;
  const t = p.order?.totals;
  const banner = p.status === 'paid' ? ['bg-brand-900 text-white', 'Payment Successful', 'This payment has been completed successfully.'] : p.status === 'failed' ? ['bg-danger text-white', 'Payment Failed', 'The gateway reported a failure.'] : p.status.startsWith('refund') ? ['bg-accent-600 text-white', title(p.status), 'Refund lifecycle in progress.'] : ['bg-warning-bg text-ink', 'Payment Pending', p.provider === 'cod' ? 'Cash will be collected on delivery.' : 'Awaiting gateway confirmation.'];
  return (
    <Panel title="Payment Details" onClose={onClose}>
      <div className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-3 ${banner[0]}`}>
        {p.status === 'paid' ? <CheckCircle2 size={22} aria-hidden /> : p.status === 'failed' ? <XCircle size={22} aria-hidden /> : <RotateCcw size={22} aria-hidden />}
        <div><p className="font-bold">{banner[1]}</p><p className="text-xs opacity-85">{banner[2]}</p></div>
      </div>
      <KV k="Order ID" v={`#${p.order?.orderNumber}`} />
      <KV k="Transaction ID" v={<span className="tabular break-all">{p.providerPaymentId ?? p.providerOrderId ?? '—'}</span>} />
      <KV k="Amount" v={money(p.amount)} />
      <KV k="Payment Method" v={METHOD_LABEL[p.method] ?? p.method} />
      <KV k="Payment Status" v={<StatusBadge status={p.status === 'paid' ? 'successful' : p.status} />} />
      <KV k="Payment Time" v={dateTime(p.verifiedAt ?? p.createdAt)} />
      <KV k="Customer" v={<span className="flex items-center gap-2"><Avatar src={p.customer?.avatar} name={p.customer?.name ?? '?'} size={22} />{p.customer?.name}</span>} />
      <KV k="Phone" v={p.customer?.phone} />
      <KV k="Email" v={p.customer?.email} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" icon={<ClipboardList size={14} />} onClick={() => nav(`/admin/orders/${p.order?._id}`)}>View Order</Button>
        <Button size="sm" icon={<Receipt size={14} />} onClick={() => window.print()}>Print Receipt</Button>
      </div>
      {t && (
        <>
          <h3 className="mt-5 mb-1 text-sm font-bold">Payment Breakdown</h3>
          <KV k="Item Total" v={money(t.itemTotal)} />
          <KV k="Delivery Fee" v={money(t.deliveryFee)} />
          {t.discount > 0 && <KV k={`Discount${t.couponCode ? ` (${t.couponCode})` : ''}`} v={<span className="text-success">-{money(t.discount)}</span>} />}
          <KV k="Packaging Fee" v={money(t.packagingFee)} />
          <KV k="Tax (GST incl.)" v={money(t.tax)} />
          <div className="mt-1 flex justify-between rounded-xl bg-brand-50 px-3 py-2.5 font-bold"><span>Total Amount</span><span className="tabular">{money(t.grandTotal)}</span></div>
        </>
      )}
      <h3 className="mt-5 mb-2 text-sm font-bold">Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" icon={<RotateCcw size={14} />} disabled={p.status !== 'paid'} onClick={() => { setAmount(String(p.amount)); setRefundOpen(true); }}>Issue Refund</Button>
        <Button size="sm" icon={<Download size={14} />} onClick={() => window.print()}>Download Invoice</Button>
        <Button size="sm" variant="danger-soft" className="col-span-2" icon={<X size={14} />} disabled={p.status !== 'pending'} loading={fail.isPending} onClick={() => confirm('Mark this pending payment as failed?') && fail.mutate()}>Mark as Failed</Button>
      </div>
      <h3 className="mt-5 mb-2 text-sm font-bold">Payment Logs</h3>
      <ol className="relative ml-1.5 border-l-2 border-brand-100 pl-4">
        {p.logs.map((l, i) => (
          <li key={i} className="relative pb-3 text-[13px] last:pb-0"><span className="absolute top-1 -left-[23px] size-3 rounded-full bg-brand-800" aria-hidden /><div className="flex justify-between gap-2"><span>{l.event}</span><span className="text-xs text-muted">{dateTime(l.at)}</span></div></li>
        ))}
      </ol>
      <Dialog open={refundOpen} onClose={() => setRefundOpen(false)} title="Issue refund" footer={<><Button onClick={() => setRefundOpen(false)}>Cancel</Button><Button variant="primary" loading={refund.isPending} disabled={reason.trim().length < 3} onClick={() => refund.mutate()}>Issue Refund</Button></>}>
        <div className="space-y-3">
          <Field label="Amount (₹)" hint={`Up to ${money(p.amount)}`}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
          <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <p className="text-xs text-muted">Online refunds are sent to Razorpay and stay “Refund Pending” until the gateway confirms.</p>
        </div>
      </Dialog>
    </Panel>
  );
}

export default function Payments() {
  const [sp, setSp] = useSearchParams();
  const p = Object.fromEntries(sp.entries());
  const page = Number(p.page ?? 1);
  const limit = Number(p.limit ?? 10);
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch) && !('id' in patch)) n.delete('page');
    setSp(n);
  };
  const [trendDays, setTrendDays] = useState('30');
  const q = useQuery({ queryKey: ['payments', p, trendDays], queryFn: async () => (await api.get<Res>('/admin/payments', { params: { ...p, page, limit, trendDays } })).data, placeholderData: keepPreviousData });
  const s = q.data?.summary ?? {};
  const totalTx = Object.values(s).reduce((a, x) => a + x.n, 0);
  const refunded = (s.refunded?.amount ?? 0) + (s.refund_pending?.amount ?? 0);
  const rate = (n?: number) => (totalTx ? Math.round(((n ?? 0) / totalTx) * 100) : 0);

  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Payments' }, { label: 'All Transactions' }]}
        title="Payments"
        sub="Track all payments, refunds and settlements. Manage payment methods and view transaction details."
        actions={<Button variant="primary" icon={<Download size={16} />} onClick={() => downloadFile('/admin/reports/export?range=30d', 'vsr-transactions.csv').catch((e) => toast.error(errorMessage(e)))}>Export</Button>}
      />
      <div className={`grid grid-cols-1 gap-4 ${p.id ? 'xl:grid-cols-[1fr_340px]' : ''}`}>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard tone="brand" icon={<Wallet size={22} />} label="Total Revenue" value={money(s.paid?.amount)} deltaLabel="verified payments" />
            <StatCard tone="info" icon={<CheckCircle2 size={22} />} label="Successful Payments" value={num(s.paid?.n)} deltaLabel={`${rate(s.paid?.n)}% success rate`} />
            <StatCard tone="danger" icon={<XCircle size={22} />} label="Failed Payments" value={num(s.failed?.n)} deltaLabel={`${rate(s.failed?.n)}% failure rate`} />
            <StatCard tone="accent" icon={<RotateCcw size={22} />} label="Refunded Amount" value={money(refunded)} deltaLabel={`${num(s.refund_pending?.n)} pending`} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
            <Card>
              <CardHeader title="Payment Trends" action={<RangeSelect label="Trend range" value={trendDays} onChange={setTrendDays} options={[['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 90 Days']]} />} />
              <div className="flex justify-end gap-4 px-5 text-xs"><Legend color={C.green} label="Successful" /><Legend color={C.red} label="Failed" /><Legend color={C.orange} label="Refunded" /></div>
              <div className="h-[190px] px-2 pb-3">
                <ResponsiveContainer>
                  <AreaChart data={q.data?.trend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.2} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#f0ebe2" />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={30} />
                    <YAxis {...axisProps} tickFormatter={(v) => `₹${Math.round(v / 1000)}K`} />
                    <ChartTooltip formatter={(v, n) => [money(v), title(n)]} />
                    <Area dataKey="successful" stroke={C.green} strokeWidth={2} fill="url(#pg)" />
                    <Area dataKey="failed" stroke={C.red} strokeWidth={1.5} fill="none" />
                    <Area dataKey="refunded" stroke={C.orange} strokeWidth={1.5} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Payment Methods" />
              <div className="px-5 pb-5"><Donut size={130} center={num(totalTx)} sub="Transactions" valueLabel={(d, t) => `${t ? Math.round((d.value / t) * 100) : 0}%`} data={(q.data?.methods ?? []).map((m, i) => ({ name: METHOD_LABEL[m._id] ?? m._id, value: m.n, color: SERIES[i] }))} /></div>
            </Card>
            <Card>
              <CardHeader title="Payment Status" />
              <div className="px-5 pb-5"><Donut size={130} center={num(totalTx)} sub="Transactions" valueLabel={(d, t) => `${t ? Math.round((d.value / t) * 100) : 0}%`} data={[{ name: 'Successful', value: s.paid?.n ?? 0, color: C.green }, { name: 'Pending', value: s.pending?.n ?? 0, color: C.amber }, { name: 'Failed', value: s.failed?.n ?? 0, color: C.red }, { name: 'Refunded', value: (s.refunded?.n ?? 0) + (s.refund_pending?.n ?? 0), color: C.orange }]} /></div>
            </Card>
          </div>
          <Card>
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <SearchInput value={p.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Search by order ID, transaction ID, customer name…" className="min-w-[240px] flex-1" />
              <Select aria-label="Payment method" value={p.method ?? ''} onChange={(e) => set({ method: e.target.value })} className="w-44"><option value="">All Payment Methods</option>{Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              <Select aria-label="Status" value={p.status ?? ''} onChange={(e) => set({ status: e.target.value })} className="w-36"><option value="">All Status</option><option value="paid">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refund_pending">Refund Pending</option><option value="refunded">Refunded</option></Select>
              <Select aria-label="Date range" value={p.from ?? ''} onChange={(e) => set({ from: e.target.value })} className="w-36"><option value="">All Dates</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></Select>
              <Button onClick={() => setSp(new URLSearchParams())}>Reset</Button>
            </div>
            <QueryState q={q}>
              {(d) => (
                <>
                  <div className="px-4">
                    <Table minWidth={980} head={['#', 'Order ID', 'Customer', 'Amount', 'Payment Method', 'Transaction ID', 'Status', 'Date & Time', 'Actions']}>
                      {d.items.map((x, i) => (
                        <tr key={x._id} className={p.id === x._id ? '[&>td]:bg-brand-50' : ''}>
                          <td className="tabular text-muted">{(page - 1) * limit + i + 1}</td>
                          <td className="tabular font-medium">#{x.order?.orderNumber}</td>
                          <td>{x.customer?.name}</td>
                          <td className="tabular font-semibold">{money(x.amount)}</td>
                          <td>{METHOD_LABEL[x.method] ?? x.method}</td>
                          <td className="tabular text-xs text-muted">{x.providerPaymentId ?? (x.provider === 'cod' ? `COD_${x.order?.orderNumber.slice(3)}` : '—')}</td>
                          <td><StatusBadge status={x.status === 'paid' ? 'successful' : x.status} /></td>
                          <td className="tabular text-xs text-muted">{dateTime(x.createdAt)}</td>
                          <td>
                            <div className="flex gap-1.5">
                              <IconButton label="View payment" onClick={() => set({ id: x._id })}><Eye size={14} /></IconButton>
                              <IconButton label="Refresh status" onClick={() => q.refetch()}><RefreshCw size={14} /></IconButton>
                              <Menu items={[{ label: 'Open details', onClick: () => set({ id: x._id }) }]} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Table>
                    {!d.items.length && <p className="py-12 text-center text-sm text-muted">No transactions match these filters.</p>}
                  </div>
                  <Pagination page={page} total={d.total} limit={limit} noun="transactions" onPage={(n) => set({ page: String(n) })} onLimit={(l) => set({ limit: String(l) })} />
                </>
              )}
            </QueryState>
          </Card>
        </div>
        {p.id && <Detail id={p.id} onClose={() => set({ id: '' })} />}
      </div>
    </div>
  );
}
