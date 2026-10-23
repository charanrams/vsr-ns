import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Copy, Check, X, ChevronDown, Info, RefreshCw, User, Phone, Mail, MapPin, Map, Truck, Star, Clock,
  ShoppingBag, CheckCircle2, PackageSearch, PackageCheck, Bike, Home, AlertTriangle, MessageCircle, Plus, KeyRound,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { money, dateTime, date, title } from '../lib/format';
import { Button, Card, CardHeader, StatusBadge, Badge, Img, Avatar, Table, KV, Dialog, Textarea, Input, Field, Loading, ErrorState, cx } from '../components/ui';

interface Item { product: string; variant?: string | null; variantName?: string | null; name: string; sku: string; unit: string; image: string; mrp: number; unitPrice: number; quantity: number; lineTotal: number }
interface Detail {
  order: {
    _id: string; orderNumber: string; status: string; paymentMethod: string; paymentStatus: string; channel: string; createdAt: string; instructions?: string;
    customer: { _id: string; name: string; phone: string; email: string; avatar?: string; createdAt: string };
    items: Item[];
    address: { label: string; recipient: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; postalCode: string };
    totals: { itemTotal: number; discount: number; couponCode?: string; deliveryFee: number; packagingFee: number; tax: number; grandTotal: number };
    deliveryPartner?: { _id: string; name: string; phone: string; avatar?: string; rating: number; deliveries: number };
    history: { from?: string; to: string; actor?: { name: string }; actorRole?: string; reason?: string; at: string }[];
    notes: { text: string; by?: { name: string; avatar?: string }; at: string }[];
    rejectionReason?: string;
  };
  stock: Record<string, { onHand: number; reserved: number; available: number; threshold: number }>;
  payment?: { providerPaymentId?: string; status: string; amount: number; verifiedAt?: string; createdAt: string };
  customerStats: { orders: number; spent: number; rating: number | null };
  partners: { _id: string; name: string; avatar?: string; rating: number; deliveries: number; distanceKm: number }[];
  prevId: string | null;
  nextId: string | null;
}

const STEPS = [
  { key: 'placed', label: 'Order Placed', icon: ShoppingBag },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'picking', label: 'Picking', icon: PackageSearch },
  { key: 'packed', label: 'Packed', icon: PackageCheck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: Home },
];
const ORDER_FLOW = ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivered'];
const ROLE_ACTOR: Record<string, string> = { customer: 'Customer', super_admin: 'Admin', order_manager: 'Admin', support_agent: 'Support' };

export default function OrderDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const q = useQuery({ queryKey: ['order', id], queryFn: async () => (await api.get<Detail>(`/admin/orders/${id}`)).data });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['order', id] });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['order-counts'] });
  };
  const act = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: object; ok: string }) => (await api.post(`/admin/orders/${id}/${path}`, body ?? {})).data,
    onSuccess: (_d, v) => {
      toast.success(v.ok);
      refresh();
      setRejectOpen(false);
      setCancelOpen(false);
      setDeliverOpen(false);
      setReason('');
      setOtp('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addNote = useMutation({
    mutationFn: async () => (await api.post(`/admin/orders/${id}/notes`, { text: note })).data,
    onSuccess: () => {
      setNote('');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Loading label="Loading order…" />;
  if (q.error || !q.data) return <Card><ErrorState message={errorMessage(q.error, 'Order not found.')} onRetry={() => q.refetch()} /></Card>;
  const { order: o, stock, payment, customerStats, partners, prevId, nextId } = q.data;

  const terminal = ['rejected', 'cancelled'].includes(o.status);
  const flowIdx = ORDER_FLOW.indexOf(o.status);
  const stepDone = (k: string) => !terminal && flowIdx >= ORDER_FLOW.indexOf(k);
  const historyAt = (k: string) => o.history.find((h) => h.to === k)?.at;
  const stockOf = (i: Item) => stock[i.variant ? `${i.product}:${i.variant}` : i.product];
  const insufficient = o.items.some((i) => (stockOf(i)?.available ?? 0) < i.quantity);
  const paidOk = o.paymentMethod === 'cod' || o.paymentStatus === 'paid';
  const amountPaid = o.paymentStatus === 'paid' ? payment?.amount ?? o.totals.grandTotal : 0;
  const balance = Math.max(0, o.totals.grandTotal - amountPaid);
  const fullAddress = [o.address.line1, o.address.landmark, o.address.line2, `${o.address.city}, ${o.address.state} - ${o.address.postalCode}`].filter(Boolean);

  const NEXT: Record<string, { label: string; sub: string; path: string; body?: object; ok: string; icon: typeof Check } | undefined> = {
    confirmed: { label: 'Start Picking', sub: 'Move to warehouse picking', path: 'status', body: { status: 'picking' }, ok: 'Picking started', icon: PackageSearch },
    picking: { label: 'Mark as Packed', sub: 'Items packed and ready', path: 'status', body: { status: 'packed' }, ok: 'Order packed', icon: PackageCheck },
    assigned: { label: 'Out for Delivery', sub: 'Generates the customer delivery code', path: 'status', body: { status: 'out_for_delivery' }, ok: 'Order is out for delivery', icon: Bike },
  };
  const next = NEXT[o.status];

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-[13px] text-muted"><button onClick={() => nav('/admin/orders')} className="text-ink hover:text-brand-700">Orders</button> › <span>Order Details</span></nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="tabular text-[28px] font-extrabold tracking-[-0.02em]">#{o.orderNumber}</h1>
            <button
              aria-label="Copy order number"
              onClick={() => {
                navigator.clipboard?.writeText(o.orderNumber);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-muted hover:text-ink"
            >
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
            </button>
            <StatusBadge status={o.status} label={o.status === 'placed' ? 'New Order' : undefined} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>Placed on {dateTime(o.createdAt)}</span><span>{o.items.length} items</span><span>Channel: {o.channel}</span>
            <span>Payment: {o.paymentMethod === 'cod' ? 'Cash on Delivery' : `Online (${o.paymentMethod.toUpperCase()})`}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<ArrowLeft size={16} />} onClick={() => nav('/admin/orders')}>Back to Orders</Button>
          <Button icon={<ArrowLeft size={16} />} disabled={!nextId} onClick={() => nav(`/admin/orders/${nextId}`)} aria-label="Newer order">Previous</Button>
          <Button disabled={!prevId} onClick={() => nav(`/admin/orders/${prevId}`)} aria-label="Older order">Next <ArrowRight size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_390px]">
        <div className="min-w-0 space-y-4">
          {/* Progress */}
          <Card className="overflow-x-auto p-4">
            {terminal ? (
              <div className="flex items-center gap-3 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
                <AlertTriangle size={18} aria-hidden />
                <span><b>{title(o.status)}</b>{o.rejectionReason ? ` — ${o.rejectionReason}` : o.history[o.history.length - 1]?.reason ? ` — ${o.history[o.history.length - 1]?.reason}` : ''}</span>
              </div>
            ) : (
              <ol className="grid min-w-[640px] grid-cols-6">
                {STEPS.map((s, i) => {
                  const done = stepDone(s.key);
                  const current = o.status === s.key || (s.key === 'out_for_delivery' && o.status === 'assigned');
                  const Icon = s.icon;
                  return (
                    <li key={s.key} className="relative flex flex-col items-center px-1 text-center">
                      {/* connector runs from this icon's edge to the next icon's edge, at icon centre height */}
                      {i < STEPS.length - 1 && (
                        <span className={cx('absolute top-[34px] right-[calc(-50%+30px)] left-[calc(50%+30px)] h-0.5 rounded-full', done && stepDone(STEPS[i + 1].key) ? 'bg-brand-700' : 'bg-line')} aria-hidden />
                      )}
                      <div className={cx('flex w-full max-w-[150px] flex-col items-center rounded-xl px-2 py-3', current && 'bg-accent-50 ring-1 ring-accent-500/60')}>
                        <span className={cx('relative grid size-11 place-items-center rounded-full', done ? 'bg-brand-800 text-white' : 'bg-line-soft text-muted')}><Icon size={20} aria-hidden /></span>
                        <span className="mt-2 text-[13px] leading-tight font-semibold">{s.label}</span>
                        <span className="mt-0.5 text-[11px] leading-snug text-muted">{historyAt(s.key) ? dateTime(historyAt(s.key)) : 'Pending'}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Items */}
          <Card>
            <CardHeader title={`Order Items (${o.items.length})`} action={<Button size="sm" variant="outline-brand" icon={<RefreshCw size={14} />} onClick={() => q.refetch()} loading={q.isFetching}>Recheck Inventory</Button>} />
            <div className="px-4 pb-4">
              <Table minWidth={760} head={['Product', 'Price', 'Quantity', 'Total', 'Inventory Status', 'Stock Details']}>
                {o.items.map((it) => {
                  const s = stockOf(it);
                  const a = s?.available ?? 0;
                  const st = a < it.quantity ? 'out_of_stock' : a <= (s?.threshold ?? 0) ? 'low_stock' : 'in_stock';
                  return (
                    <tr key={`${it.product}:${it.variant ?? ''}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Img src={it.image} alt={it.name} className="size-12 rounded-lg" />
                          <div><p className="font-semibold">{it.name}</p><p className="text-xs text-muted">{it.variantName ? <span className="font-semibold text-ink">Size: {it.variantName}</span> : it.unit} · {it.sku}</p></div>
                        </div>
                      </td>
                      <td className="tabular">
                        <p className="font-semibold">{money(it.unitPrice)}</p>
                        {it.mrp > it.unitPrice && <><p className="text-xs text-muted line-through">{money(it.mrp)}</p><p className="text-xs text-success">({Math.round((1 - it.unitPrice / it.mrp) * 100)}% off)</p></>}
                      </td>
                      <td className="tabular"><span className="inline-grid h-8 min-w-10 place-items-center rounded-lg border border-line px-2 font-semibold">{it.quantity}</span></td>
                      <td className="tabular font-semibold">{money(it.lineTotal)}</td>
                      <td><StatusBadge status={st} label={st === 'out_of_stock' ? 'Insufficient' : undefined} /></td>
                      <td className="tabular text-xs leading-5 text-muted">
                        Available: <b className={a < it.quantity || st === 'low_stock' ? 'text-danger' : 'text-ink'}>{a}</b><br />Reserved: {s?.reserved ?? 0}<br />Requested: {it.quantity}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><User size={17} aria-hidden /> Customer Details</span>} action={<Button size="sm" onClick={() => nav(`/admin/customers?id=${o.customer._id}`)}>View Profile</Button>} />
              <div className="px-5 pb-5">
                <div className="flex items-start gap-3">
                  <Avatar src={o.customer.avatar} name={o.customer.name} size={48} />
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{o.customer.name}</p><Badge>Customer since {date(o.customer.createdAt)}</Badge></div>
                    <p className="flex items-center gap-2"><Phone size={14} className="text-muted" aria-hidden /><a href={`tel:${o.customer.phone}`} className="hover:underline">{o.customer.phone}</a><a href={`https://wa.me/${o.customer.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp customer" className="text-success"><MessageCircle size={15} /></a></p>
                    <p className="flex items-center gap-2"><Mail size={14} className="text-muted" aria-hidden /><a href={`mailto:${o.customer.email}`} className="truncate hover:underline">{o.customer.email}</a></p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-line-soft/70 py-2.5"><p className="tabular font-extrabold">{customerStats.orders}</p><p className="text-[11px] text-muted">Total Orders</p></div>
                  <div className="rounded-xl bg-line-soft/70 py-2.5"><p className="tabular font-extrabold">{money(customerStats.spent)}</p><p className="text-[11px] text-muted">Total Spent</p></div>
                  <div className="rounded-xl bg-line-soft/70 py-2.5"><p className="tabular flex items-center justify-center gap-1 font-extrabold text-accent-600">{customerStats.rating ?? '—'} <Star size={14} fill="currentColor" aria-hidden /></p><p className="text-[11px] text-muted">Rating</p></div>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><MapPin size={17} aria-hidden /> Delivery Address</span>} action={<a className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] font-semibold hover:bg-brand-50" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress.join(', '))}`}><Map size={14} aria-hidden /> View on Map</a>} />
              <div className="px-5 pb-5 text-sm leading-6">
                <p className="font-bold">{o.address.label}</p>
                <p>{o.address.recipient}</p>
                {fullAddress.map((l) => <p key={l}>{l}</p>)}
                <p>{o.address.phone}</p>
                {o.instructions && (
                  <div className="mt-3 flex gap-2.5 rounded-xl bg-accent-50 px-3 py-2.5 text-[13px]">
                    <Info size={16} className="mt-0.5 shrink-0 text-accent-600" aria-hidden />
                    <div><p className="font-semibold">Delivery Instructions</p><p>{o.instructions}</p></div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Truck size={17} aria-hidden /> Delivery Assignment</span>} />
              <div className="px-5 pb-5">
                {o.deliveryPartner ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <Avatar src={o.deliveryPartner.avatar} name={o.deliveryPartner.name} size={44} />
                    <div className="flex-1 text-sm"><p className="font-bold">{o.deliveryPartner.name}</p><p className="text-xs text-muted">★ {o.deliveryPartner.rating} · {o.deliveryPartner.deliveries} deliveries · {o.deliveryPartner.phone}</p></div>
                    <StatusBadge status={o.status} />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Not Assigned</p>
                    <p className="text-[13px] text-muted">{o.status === 'packed' ? 'Choose an available partner nearby.' : 'Assign a delivery partner after the order is packed.'}</p>
                    <p className="mt-4 mb-2 text-[13px] font-semibold">Available Delivery Partners (Nearby)</p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                      {partners.slice(0, 3).map((p) => (
                        <div key={p._id} className="flex min-w-0 flex-col rounded-xl border border-line p-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={p.avatar} name={p.name} size={32} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold" title={p.name}>{p.name}</p>
                              <Badge tone="success" dot className="mt-0.5">Online</Badge>
                            </div>
                          </div>
                          <dl className="mt-2.5 space-y-0.5 text-xs text-muted">
                            <div className="flex justify-between gap-2"><dt>Rating</dt><dd className="tabular font-medium text-ink">★ {p.rating} ({p.deliveries})</dd></div>
                            <div className="flex justify-between gap-2"><dt>Distance</dt><dd className="tabular font-medium text-ink">{p.distanceKm} km</dd></div>
                            <div className="flex justify-between gap-2"><dt>ETA</dt><dd className="tabular font-medium text-ink">~{Math.round(p.distanceKm * 7 + 6)} min</dd></div>
                          </dl>
                          <Button size="sm" className="mt-3 w-full" disabled={o.status !== 'packed'} loading={act.isPending && act.variables?.path === 'assign' && (act.variables.body as { partnerId: string })?.partnerId === p._id} onClick={() => act.mutate({ path: 'assign', body: { partnerId: p._id }, ok: `Assigned to ${p.name}` })}>Assign</Button>
                        </div>
                      ))}
                      {!partners.length && <p className="text-[13px] text-muted">No partners are online right now.</p>}
                    </div>
                  </>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Clock size={17} aria-hidden /> Order Timeline</span>} />
              <ol className="relative mx-5 mb-5 border-l-2 border-line pl-5">
                {o.history.map((h, i) => (
                  <li key={i} className="relative pb-3 last:pb-0">
                    <span className="absolute top-1 -left-[27px] size-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" aria-hidden />
                    <div className="flex justify-between gap-3 text-[13px]">
                      <div><p className="font-semibold">{title(h.to === 'placed' ? 'order_placed' : h.to)}</p><p className="text-xs text-muted">{dateTime(h.at)}{h.reason ? ` · ${h.reason}` : ''}</p></div>
                      <span className="text-xs text-muted">{h.actor?.name ?? ROLE_ACTOR[h.actorRole ?? ''] ?? 'System'}</span>
                    </div>
                  </li>
                ))}
                {!terminal && ORDER_FLOW.slice(Math.max(flowIdx + 1, 1)).filter((s) => s !== 'assigned').map((s) => (
                  <li key={s} className="relative pb-3 text-[13px] text-muted last:pb-0">
                    <span className="absolute top-1 -left-[27px] size-3 rounded-full border-2 border-white bg-line" aria-hidden />
                    <p>{title(s)}</p><p className="text-xs">Pending</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-base font-bold">Order Actions</h2>
            {o.status === 'placed' && (
              <div className="space-y-2.5">
                <button
                  disabled={act.isPending || insufficient || !paidOk}
                  onClick={() => act.mutate({ path: 'accept', ok: 'Order accepted — stock reserved' })}
                  className="flex w-full items-center gap-3 rounded-xl bg-brand-900 px-4 py-3 text-left text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-white/15"><Check size={18} aria-hidden /></span>
                  <span><span className="block font-bold">Accept Order</span><span className="text-xs text-white/75">Confirm stock & move to processing</span></span>
                </button>
                <button onClick={() => setRejectOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-left text-danger hover:bg-[#fbd9d5]">
                  <span className="grid size-9 place-items-center rounded-full bg-danger text-white"><X size={18} aria-hidden /></span>
                  <span className="flex-1"><span className="block font-bold">Reject Order</span><span className="text-xs">Cancel this order</span></span>
                  <ChevronDown size={16} aria-hidden />
                </button>
                <p className="flex items-center gap-2 rounded-xl bg-warning-bg px-3 py-2.5 text-xs text-ink">
                  <Info size={15} className="shrink-0 text-warning" aria-hidden />
                  {insufficient ? 'Not enough stock for one or more items. Restock before accepting.' : !paidOk ? 'Waiting for payment verification before this order can be accepted.' : 'Stock will be reserved once order is confirmed.'}
                </p>
              </div>
            )}
            {next && (
              <button disabled={act.isPending} onClick={() => act.mutate({ path: next.path, body: next.body, ok: next.ok })} className="flex w-full items-center gap-3 rounded-xl bg-brand-900 px-4 py-3 text-left text-white hover:bg-brand-800 disabled:opacity-55">
                <span className="grid size-9 place-items-center rounded-full bg-white/15"><next.icon size={18} aria-hidden /></span>
                <span><span className="block font-bold">{next.label}</span><span className="text-xs text-white/75">{next.sub}</span></span>
              </button>
            )}
            {o.status === 'packed' && <p className="rounded-xl bg-info-bg px-3 py-2.5 text-[13px] text-info">Assign a delivery partner from the Delivery Assignment panel.</p>}
            {o.status === 'out_for_delivery' && (
              <div className="space-y-2">
                <Button variant="primary" className="w-full" icon={<KeyRound size={16} />} onClick={() => setDeliverOpen(true)}>Verify Delivery Code</Button>
                <Button variant="danger-soft" className="w-full" onClick={() => act.mutate({ path: 'status', body: { status: 'delivery_failed', reason: 'Customer unavailable' }, ok: 'Marked as delivery failed' })}>Mark Delivery Failed</Button>
              </div>
            )}
            {o.status === 'delivered' && <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-[13px] text-success"><CheckCircle2 size={16} aria-hidden /> Delivered and verified with the customer’s code.</p>}
            {terminal && <p className="text-[13px] text-muted">This order is closed. No further actions are available.</p>}
            {['confirmed', 'picking', 'packed', 'delivery_failed'].includes(o.status) && (
              <Button variant="ghost" className="mt-2 w-full text-danger" onClick={() => setCancelOpen(true)}>Cancel order</Button>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-bold">Payment Information</h2><StatusBadge status={o.paymentStatus} /></div>
            <KV k="Payment Method" v={o.paymentMethod === 'cod' ? 'Cash on Delivery' : o.paymentMethod.toUpperCase()} />
            <KV k="Transaction ID" v={<span className="tabular">{payment?.providerPaymentId ?? '—'}</span>} />
            <KV k="Payment Status" v={<span className={o.paymentStatus === 'paid' ? 'text-success' : ''}>{o.paymentStatus === 'paid' ? 'Paid Successfully' : title(o.paymentStatus)}</span>} />
            <KV k="Paid Amount" v={<span className="tabular text-lg font-extrabold">{money(amountPaid)}</span>} />
            <KV k="Payment Time" v={payment?.verifiedAt ? dateTime(payment.verifiedAt) : '—'} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-base font-bold">Price Breakdown</h2>
            <KV k={`Item Total (${o.items.length} items)`} v={money(o.totals.itemTotal)} />
            <KV k="Delivery Fee" v={o.totals.deliveryFee ? money(o.totals.deliveryFee) : 'Free'} />
            {o.totals.discount > 0 && <KV k={`Discount${o.totals.couponCode ? ` (${o.totals.couponCode})` : ''}`} v={<span className="text-success">-{money(o.totals.discount)}</span>} />}
            <KV k="Packaging Fee" v={money(o.totals.packagingFee)} />
            <KV k="Tax (GST incl.)" v={money(o.totals.tax)} />
            <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5"><span className="font-bold">Total Amount</span><span className="tabular text-lg font-extrabold">{money(o.totals.grandTotal)}</span></div>
            <KV k="Amount Paid" v={money(amountPaid)} className="mt-1 px-3" />
            {balance > 0 && <div className="flex items-center justify-between rounded-xl bg-danger-bg px-3 py-2.5 text-danger"><span className="font-semibold">{o.paymentMethod === 'cod' ? 'Collect on Delivery' : 'Balance Amount'}</span><span className="tabular text-lg font-extrabold">{money(balance)}</span></div>}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-base font-bold">Order Notes</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate();
              }}
              className="flex gap-2"
            >
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal notes about this order…" aria-label="Internal note" />
              <Button type="submit" icon={<Plus size={15} />} loading={addNote.isPending} disabled={!note.trim()}>Add</Button>
            </form>
            <ul className="mt-3 space-y-3">
              {o.notes.map((n, i) => (
                <li key={i} className="flex gap-2.5">
                  <Avatar src={n.by?.avatar} name={n.by?.name ?? 'Staff'} size={30} />
                  <div className="flex-1 text-[13px]"><div className="flex justify-between gap-2"><b>{n.by?.name ?? 'Staff'}</b><span className="text-xs text-muted">{dateTime(n.at)}</span></div><p>{n.text}</p></div>
                </li>
              ))}
              {!o.notes.length && <li className="text-[13px] text-muted">No internal notes yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this order?"
        footer={<><Button onClick={() => setRejectOpen(false)}>Keep order</Button><Button variant="danger" loading={act.isPending} disabled={reason.trim().length < 3} onClick={() => act.mutate({ path: 'reject', body: { reason }, ok: 'Order rejected' })}>Reject Order</Button></>}
      >
        <p className="mb-3 text-sm text-muted">The customer will be notified. {o.paymentStatus === 'paid' && 'A refund task will be created for the paid amount — it is not marked complete until the gateway confirms.'}</p>
        <Field label="Reason for rejection" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item unavailable in this service area" autoFocus />
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['Item out of stock', 'Address not serviceable', 'Suspected fraudulent order'].map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-brand-50">{r}</button>)}
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        footer={<><Button onClick={() => setCancelOpen(false)}>Keep order</Button><Button variant="danger" loading={act.isPending} disabled={reason.trim().length < 3} onClick={() => act.mutate({ path: 'cancel', body: { reason }, ok: 'Order cancelled — stock released' })}>Cancel Order</Button></>}
      >
        <p className="mb-3 text-sm text-muted">Reserved stock is released back to inventory{o.paymentStatus === 'paid' ? ' and a refund task is created' : ''}.</p>
        <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </Dialog>

      <Dialog
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        title="Verify delivery code"
        footer={<><Button onClick={() => setDeliverOpen(false)}>Cancel</Button><Button variant="primary" loading={act.isPending} disabled={!/^\d{6}$/.test(otp)} onClick={() => act.mutate({ path: 'deliver', body: { otp }, ok: 'Delivery confirmed' })}>Confirm Delivery</Button></>}
      >
        <p className="mb-3 text-sm text-muted">Ask the customer for the 6-digit code shown in their VSR app. Codes are single-use and lock after 5 wrong attempts.</p>
        <Field label="Delivery code" required>
          <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tabular h-12 text-center text-xl tracking-[0.5em]" autoFocus />
        </Field>
      </Dialog>
    </div>
  );
}
