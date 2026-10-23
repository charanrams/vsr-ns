import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { MessageSquare, Clock, Loader, CheckCircle2, Undo2, Eye, Pencil, Check, Send, FileText, Download } from 'lucide-react';
import { api, errorMessage, downloadFile } from '../lib/api';
import { money, num, dateTime, title } from '../lib/format';
import { Button, Card, CardHeader, StatCard, Table, StatusBadge, Pagination, SearchInput, Select, IconButton, Avatar, Img, Menu, QueryState, Panel, Tabs, Field, Textarea, Badge, Loading, Legend, Dialog, KV, RangeSelect } from '../components/ui';
import { Donut, C, SERIES, axisProps, ChartTooltip } from '../components/charts';

interface Ticket { _id: string; ticketNumber: string; customer: { _id: string; name: string; avatar?: string; phone?: string; email?: string; tags?: string[] }; order?: { _id: string; orderNumber: string; items?: { name: string; image: string; unit: string; unitPrice: number; quantity: number }[] }; issueType: string; subject: string; description?: string; priority: string; status: string; createdAt: string; assignedTo?: { _id: string; name: string; avatar?: string }; dueDate?: string; attachments: string[]; messages: { from: string; author?: { name: string; avatar?: string }; text: string; at: string }[] }
interface Res { items: Ticket[]; total: number; counts: Record<string, number>; returns: number; types: { _id: string; n: number }[]; trend: { label: string; created: number; resolved: number; open: number }[] }
const ISSUE: Record<string, string> = { order: 'Order Related', return_refund: 'Return & Refund', delivery: 'Delivery Issue', product: 'Product Related', payment: 'Payment Issue', other: 'Others' };

function TicketPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const q = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await api.get<{ ticket: Ticket; agents: { _id: string; name: string }[] }>(`/admin/support/${id}`)).data });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', id] });
    qc.invalidateQueries({ queryKey: ['support'] });
  };
  const patch = useMutation({ mutationFn: async (b: object) => api.patch(`/admin/support/${id}`, b), onSuccess: () => { toast.success('Ticket updated'); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const send = useMutation({ mutationFn: async () => api.post(`/admin/support/${id}/messages`, { text: reply, internal }), onSuccess: () => { toast.success(internal ? 'Internal note added' : 'Reply sent'); setReply(''); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  if (!q.data) return <Panel title="Ticket Details" onClose={onClose}><Loading /></Panel>;
  const { ticket: t, agents } = q.data;
  const item = t.order?.items?.[0];
  return (
    <Panel title={<span className="flex items-center gap-2">Ticket Details <StatusBadge status={t.status} /></span>} onClose={onClose}>
      <p className="tabular -mt-1 mb-4 text-xs text-muted">{t.ticketNumber}</p>
      <div className="flex items-center gap-3">
        <Avatar src={t.customer.avatar} name={t.customer.name} size={52} />
        <div className="text-[13px]"><p className="flex items-center gap-2 font-bold">{t.customer.name}{t.customer.tags?.includes('VIP') && <Badge tone="accent" dot>VIP</Badge>}</p><p className="text-muted">{t.customer.phone}</p><p className="text-muted">{t.customer.email}</p></div>
      </div>
      {t.order && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-bold">Order Information</h3>
          <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
            <Img src={item?.image} alt="" className="size-14 rounded-lg" />
            <div className="min-w-0 flex-1 text-[13px]"><p className="truncate font-semibold">{item?.name} {item?.unit && `(${item.unit})`}</p><p className="tabular text-xs text-muted">Order ID: #{t.order.orderNumber}</p><p className="tabular text-xs">{money(item?.unitPrice)} · Qty: {item?.quantity}</p></div>
            <Button size="sm" onClick={() => nav(`/admin/orders/${t.order!._id}`)}>View Order</Button>
          </div>
        </>
      )}
      <h3 className="mt-5 mb-1 text-sm font-bold">Issue Details</h3>
      <KV k="Issue Type" v={ISSUE[t.issueType]} />
      <KV k="Subject" v={t.subject} />
      <p className="mt-1 text-[13px] text-muted">Description</p>
      <p className="text-[13px]">{t.description}</p>
      {t.attachments.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-bold">Attachments</h3>
          <div className="flex gap-2">{t.attachments.map((a) => <a key={a} href={a} target="_blank" rel="noreferrer"><Img src={a} alt="Customer attachment" className="size-20 rounded-lg" /></a>)}</div>
          <p className="mt-1 text-xs text-muted">{t.attachments.length} files attached</p>
        </>
      )}
      <h3 className="mt-5 mb-2 text-sm font-bold">Status & Assignment</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Status"><Select value={t.status} onChange={(e) => patch.mutate({ status: e.target.value })}>{['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{title(s)}</option>)}</Select></Field>
        <Field label="Priority"><Select value={t.priority} onChange={(e) => patch.mutate({ priority: e.target.value })}>{['low', 'medium', 'high'].map((s) => <option key={s} value={s}>{title(s)}</option>)}</Select></Field>
        <Field label="Assigned To"><Select value={t.assignedTo?._id ?? ''} onChange={(e) => patch.mutate({ assignedTo: e.target.value || null })}><option value="">Unassigned</option>{agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</Select></Field>
        <Field label="Due Date"><input type="date" className="h-10 w-full rounded-[10px] border border-line px-2 text-sm" value={t.dueDate ? t.dueDate.slice(0, 10) : ''} onChange={(e) => patch.mutate({ dueDate: e.target.value || null })} /></Field>
      </div>
      <h3 className="mt-5 mb-2 text-sm font-bold">Conversation</h3>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {t.messages.map((m, i) => (
          <li key={i} className={`rounded-xl p-2.5 text-[13px] ${m.from === 'customer' ? 'bg-line-soft/70' : m.from === 'internal' ? 'border border-dashed border-warning/50 bg-warning-bg/50' : 'bg-brand-50'}`}>
            <div className="flex justify-between gap-2"><b>{m.author?.name ?? title(m.from)}{m.from === 'internal' && ' · internal'}</b><span className="text-[11px] text-muted">{dateTime(m.at)}</span></div>
            <p className="mt-0.5">{m.text}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }} className="mt-3">
        <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? 'Internal note (not visible to the customer)…' : 'Reply to customer…'} aria-label="Reply" />
        <label className="mt-1.5 flex items-center gap-2 text-xs"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-brand-700" /> Internal note</label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="submit" icon={<Send size={14} />} loading={send.isPending} disabled={!reply.trim()}>{internal ? 'Add Note' : 'Reply to Customer'}</Button>
          <Button type="button" variant="primary" icon={<Check size={14} />} disabled={t.status === 'resolved'} loading={patch.isPending} onClick={() => patch.mutate({ status: 'resolved' })}>Resolve Ticket</Button>
        </div>
      </form>
    </Panel>
  );
}

export default function Support() {
  const [sp, setSp] = useSearchParams();
  const p = Object.fromEntries(sp.entries());
  const page = Number(p.page ?? 1);
  const limit = Number(p.limit ?? 8);
  const tab = (p.tab ?? 'tickets') as 'tickets' | 'returns';
  const [policyOpen, setPolicyOpen] = useState(false);
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch) && !('id' in patch)) n.delete('page');
    setSp(n);
  };
  const [trendDays, setTrendDays] = useState('7');
  const q = useQuery({ queryKey: ['support', p, trendDays], queryFn: async () => (await api.get<Res>('/admin/support', { params: { ...p, page, limit, trendDays } })).data, placeholderData: keepPreviousData });
  const c = q.data?.counts ?? {};
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const pctOf = (n?: number) => (total ? Math.round(((n ?? 0) / total) * 100) : 0);
  useEffect(() => { if (!p.id && q.data?.items[0] && window.innerWidth >= 1280 && !sp.has('closed')) set({ id: q.data.items[0]._id }); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 text-[13px] text-muted"><span className="text-ink">Support</span> › Support & Returns</nav>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Support & Returns</h1>
          <p className="mt-1 text-sm text-muted">Manage customer support tickets, return requests and refund processing.</p>
        </div>
        <div className="flex gap-2.5">
          <Button icon={<FileText size={16} />} onClick={() => setPolicyOpen(true)}>View Return Policy</Button>
          <Button icon={<Download size={16} />} onClick={() => downloadFile('/admin/reports/export', 'vsr-orders.csv').catch((e) => toast.error(errorMessage(e)))}>Export</Button>
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-4 ${p.id ? 'xl:grid-cols-[1fr_330px]' : ''}`}>
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-5">
            <StatCard tone="brand" icon={<MessageSquare size={22} />} label="Total Tickets" value={num(total)} />
            <StatCard tone="info" icon={<Clock size={22} />} label="Open Tickets" value={num(c.open)} deltaLabel={`${pctOf(c.open)}% of total`} />
            <StatCard tone="accent" icon={<Loader size={22} />} label="In Progress" value={num(c.in_progress)} deltaLabel={`${pctOf(c.in_progress)}% of total`} />
            <StatCard tone="brand" icon={<CheckCircle2 size={22} />} label="Resolved" value={num(c.resolved)} deltaLabel={`${pctOf(c.resolved)}% of total`} />
            <StatCard tone="danger" icon={<Undo2 size={22} />} label="Return Requests" value={num(q.data?.returns)} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader title="Support Ticket Trends" action={<RangeSelect label="Trend range" value={trendDays} onChange={setTrendDays} options={[['7', 'Last 7 Days'], ['14', 'Last 14 Days'], ['30', 'Last 30 Days']]} />} />
              <div className="flex justify-end gap-4 px-5 text-xs"><Legend color={C.green} label="Created" /><Legend color={C.blue} label="Resolved" /><Legend color={C.orange} label="Open" /></div>
              <div className="h-[200px] px-2 pb-3">
                <ResponsiveContainer>
                  <LineChart data={q.data?.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f0ebe2" />
                    <XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} allowDecimals={false} />
                    <ChartTooltip />
                    <Line dataKey="created" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} />
                    <Line dataKey="resolved" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
                    <Line dataKey="open" stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Issue Type Distribution" />
              <div className="px-5 pb-5"><Donut size={140} center={num(total)} sub="Tickets" valueLabel={(x, t) => `${t ? Math.round((x.value / t) * 100) : 0}%`} data={(q.data?.types ?? []).map((t, i) => ({ name: ISSUE[t._id] ?? t._id, value: t.n, color: SERIES[i] }))} /></div>
            </Card>
          </div>
          <Card>
            <div className="p-4"><Tabs value={tab} onChange={(v) => set({ tab: v === 'tickets' ? '' : v, id: '' })} items={[{ value: 'tickets', label: 'Support Tickets' }, { value: 'returns', label: 'Return & Refund Requests' }]} /></div>
            <div className="flex flex-wrap items-center gap-2.5 px-4 pb-4">
              <SearchInput value={p.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Search by ticket ID, subject, customer name…" className="min-w-[220px] flex-1" />
              <Select aria-label="Issue type" value={p.issueType ?? ''} onChange={(e) => set({ issueType: e.target.value })} className="w-40"><option value="">All Issue Types</option>{Object.entries(ISSUE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              <Select aria-label="Status" value={p.status ?? ''} onChange={(e) => set({ status: e.target.value })} className="w-36"><option value="">All Status</option>{['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{title(s)}</option>)}</Select>
              <Button onClick={() => setSp(new URLSearchParams(tab === 'returns' ? { tab } : {}))}>Reset</Button>
            </div>
            <QueryState q={q}>
              {(d) => (
                <>
                  <div className="px-4">
                    <Table minWidth={820} head={['Ticket', 'Customer', 'Issue', 'Status', 'Priority', 'Created On', 'Actions']}>
                      {d.items.map((t) => (
                        <tr key={t._id} className={p.id === t._id ? '[&>td]:bg-brand-50' : ''}>
                          <td><p className="tabular font-medium">{t.ticketNumber}</p><p className="tabular text-xs text-muted">{t.order ? `#${t.order.orderNumber}` : 'No order'}</p></td>
                          <td><div className="flex items-center gap-2"><Avatar src={t.customer?.avatar} name={t.customer?.name ?? '?'} size={28} />{t.customer?.name}</div></td>
                          <td className="whitespace-normal!"><p className="min-w-[150px] font-medium">{t.subject}</p><p className="text-xs text-muted">{ISSUE[t.issueType]}</p></td>
                          <td><StatusBadge status={t.status} /></td>
                          <td><StatusBadge status={t.priority} /></td>
                          <td className="tabular text-xs text-muted">{dateTime(t.createdAt)}</td>
                          <td><div className="flex gap-1.5"><IconButton label={`Open ${t.ticketNumber}`} onClick={() => set({ id: t._id })}><Eye size={14} /></IconButton><IconButton label={`Edit ${t.ticketNumber}`} onClick={() => set({ id: t._id })}><Pencil size={14} /></IconButton><Menu items={[{ label: 'Open details', onClick: () => set({ id: t._id }) }]} /></div></td>
                        </tr>
                      ))}
                    </Table>
                    {!d.items.length && <p className="py-12 text-center text-sm text-muted">No tickets here. Nice work.</p>}
                  </div>
                  <Pagination page={page} total={d.total} limit={limit} noun="tickets" onPage={(n) => set({ page: String(n) })} onLimit={(l) => set({ limit: String(l) })} />
                </>
              )}
            </QueryState>
          </Card>
        </div>
        {p.id && <TicketPanel id={p.id} onClose={() => set({ id: '', closed: '1' })} />}
      </div>
      <Dialog open={policyOpen} onClose={() => setPolicyOpen(false)} title="Return & refund policy">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Fresh produce, dairy and homemade food: report damaged or wrong items within 24 hours of delivery with photos.</li>
          <li>Packaged goods, electronics and fashion: return within 7 days, unused and in original packaging.</li>
          <li>Refunds go back to the original payment method once the gateway confirms; COD refunds are settled by bank transfer.</li>
          <li>Refunds are never marked complete until the payment provider confirms them.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Final policy wording needs approval from the business owner (PRD §21).</p>
      </Dialog>
    </div>
  );
}
