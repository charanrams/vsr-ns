import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight, CircleX, HelpCircle, KeyRound, MapPin, Phone, Receipt, RotateCcw, Star, Wallet } from 'lucide-react';
import { dateTime, date as fmtDate, money } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { isActiveOrder, oneLine, useOrder, useOrders, type Order } from '../data';
import { Bill, Btn, ButtonLink, cx, EmptyState, Page, PageTitle, Panel, ProductImage, Sheet, SkeletonList, StatusPill, TextArea, View } from '../ui';

const TABS: [string, string][] = [
  ['all', 'All'],
  ['ongoing', 'Ongoing'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];

export function OrdersPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'all';
  const q = useOrders(tab);
  return (
    <Page narrow>
      <PageTitle>My orders</PageTitle>
      <div role="tablist" aria-label="Order status" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setSp(v === 'all' ? {} : { tab: v }, { replace: true })} className={cx('h-10 shrink-0 rounded-full border px-4 text-sm font-bold', tab === v ? 'border-brand-700 bg-brand-100 text-ink' : 'border-line bg-surface text-muted hover:text-ink')}>
            {l}
          </button>
        ))}
      </div>
      <View
        q={q}
        empty={(l) =>
          l.length ? null : (
            <EmptyState icon={<Receipt className="size-8" />} title="No orders here" message={tab === 'all' ? 'Your orders will appear here once you place one.' : undefined} action={tab === 'all' ? <ButtonLink to="/" className="w-full">Start shopping</ButtonLink> : undefined} />
          )
        }
      >
        {(l) => (
          <ul className="space-y-3">
            {l.map((o) => (
              <li key={o._id}>
                <OrderRow o={o} />
              </li>
            ))}
          </ul>
        )}
      </View>
    </Page>
  );
}

function OrderRow({ o }: { o: Order }) {
  const count = o.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Link to={`/account/orders/${o._id}`} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-700/50">
      <span className="relative shrink-0">
        <ProductImage src={o.items[0]?.image} alt="" className="size-16 rounded-xl" />
        {o.items.length > 1 ? <span className="absolute bottom-1 right-1 rounded-md bg-brand-900 px-1.5 text-[11px] font-bold text-white">+{o.items.length - 1}</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-bold">#{o.orderNumber}</span>
          <span className="tabular font-extrabold">{money(o.totals.grandTotal)}</span>
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">{fmtDate(o.createdAt)} · {count} item{count === 1 ? '' : 's'}</span>
        <span className="mt-2 flex items-center justify-between">
          <StatusPill status={o.status} />
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

const STEPS: [string, string][] = [
  ['placed', 'Order placed'],
  ['confirmed', 'Confirmed'],
  ['picking', 'Preparing'],
  ['packed', 'Packed'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];
const FLOW = ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivered'];
const REASONS = ['Ordered by mistake', 'Want to change items', 'Delivery time too long', 'Found a better price', 'Other'];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const q = useOrder(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['shop', 'order', id] });
    qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await shopApi.post(`/store/me/orders/${id}/cancel`, { reason });
      setCancelOpen(false);
      refresh();
      toast.success('Order cancelled');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const reorder = async () => {
    setBusy(true);
    try {
      const { data } = await shopApi.post(`/store/me/orders/${id}/reorder`);
      qc.setQueryData(['shop', 'cart'], data);
      nav('/cart');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <View q={q} skeleton={<SkeletonList n={4} />}>
        {(o) => {
          const terminal = o.status === 'cancelled' || o.status === 'rejected';
          const idx = FLOW.indexOf(o.status);
          const at = (s: string) => o.history?.find((h) => h.to === s)?.at;
          const count = o.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold">Order #{o.orderNumber}</h1>
                  <p className="mt-1 text-sm text-muted">{dateTime(o.createdAt)}</p>
                </div>
                <StatusPill status={o.status} />
              </div>

              {o.deliveryCode ? (
                <div className="flex gap-4 rounded-2xl bg-brand-900 p-5 text-white" aria-label={`Delivery code ${o.deliveryCode.split('').join(' ')}. Share only with your delivery partner at your door.`}>
                  <KeyRound className="mt-1 size-6 shrink-0 text-accent-500" aria-hidden />
                  <div>
                    <p className="text-sm text-white/80">Delivery code</p>
                    <p className="tabular mt-1 text-3xl font-extrabold tracking-[0.3em]">{o.deliveryCode}</p>
                    <p className="mt-1 text-[13px] text-white/80">Share only with your delivery partner at your door.</p>
                  </div>
                </div>
              ) : null}

              <Panel className="p-5">
                {terminal ? (
                  <div className="flex gap-3">
                    <CircleX className="size-5 shrink-0 text-danger" aria-hidden />
                    <p>
                      <span className="font-semibold">{o.status === 'cancelled' ? 'Cancelled' : 'Rejected'}</span>
                      {o.rejectionReason ? <span className="text-muted"> — {o.rejectionReason}</span> : null}
                      {o.paymentStatus.startsWith('refund') ? <span className="mt-1 block text-sm text-muted">Refund: {o.paymentStatus.replace('_', ' ')}</span> : null}
                    </p>
                  </div>
                ) : (
                  <ol aria-label="Order progress">
                    {STEPS.map(([s, label], i) => {
                      const done = idx >= FLOW.indexOf(s);
                      const current = o.status === s || (s === 'out_for_delivery' && o.status === 'assigned');
                      const when = at(s) ?? (s === 'out_for_delivery' ? at('assigned') : undefined);
                      return (
                        <li key={s} className="flex gap-3">
                          <span className="flex flex-col items-center">
                            <span className={cx('grid size-8 place-items-center rounded-full', done ? 'bg-brand-800 text-white' : 'bg-line-soft text-muted', current && 'ring-2 ring-accent-500 ring-offset-2 ring-offset-surface')}>
                              {done ? <Check className="size-4" aria-hidden /> : <span className="size-2 rounded-full bg-current" />}
                            </span>
                            {i < STEPS.length - 1 ? <span className={cx('my-0.5 w-0.5 flex-1', done ? 'bg-brand-700' : 'bg-line')} /> : null}
                          </span>
                          <span className={cx('pb-5 pt-1', i === STEPS.length - 1 && 'pb-0')}>
                            <span className={cx('block font-semibold', !done && !current && 'text-muted')}>{label}</span>
                            <span className="text-[13px] text-muted">{when ? dateTime(when) : current ? 'In progress' : 'Pending'}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Panel>

              {o.deliveryPartner ? (
                <Panel className="flex items-center gap-3 p-4">
                  <ProductImage src={o.deliveryPartner.avatar} alt="" className="size-11 rounded-full" />
                  <span className="flex-1">
                    <span className="block font-bold">{o.deliveryPartner.name}</span>
                    <span className="text-[13px] text-muted">Your delivery partner{o.deliveryPartner.rating ? ` · ★ ${o.deliveryPartner.rating}` : ''}</span>
                  </span>
                  {o.deliveryPartner.phone ? (
                    <a href={`tel:${o.deliveryPartner.phone}`} className="grid size-11 place-items-center rounded-full bg-brand-900 text-white" aria-label="Call delivery partner">
                      <Phone className="size-5" />
                    </a>
                  ) : null}
                </Panel>
              ) : null}

              <Panel className="p-5">
                <h2 className="font-extrabold">Items ({o.items.length})</h2>
                <ul className="mt-2 divide-y divide-line">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 py-3">
                      <ProductImage src={it.image} alt="" className="size-12 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-semibold">{it.name}</span>
                        <span className="text-[13px] text-muted">{it.variantName ?? it.unit} · ×{it.quantity}</span>
                      </span>
                      <span className="tabular font-bold">{money(it.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel className="divide-y divide-line">
                {o.address ? (
                  <div className="flex gap-3 p-4">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
                    <span>
                      <span className="block font-semibold">Delivering to {o.address.label}</span>
                      <span className="text-[13px] text-muted">{o.address.recipient} · {oneLine(o.address)}</span>
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-3 p-4">
                  <Wallet className="size-5 shrink-0 text-brand-700" aria-hidden />
                  <span className="flex-1 font-semibold">{o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase()}</span>
                  <StatusPill status={o.paymentStatus} />
                </div>
              </Panel>

              <Bill totals={o.totals} count={count} />

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                {o.status === 'delivered' && o.rating == null ? <ButtonLink to={`/account/orders/${o._id}/rate`}><Star className="size-4" /> Rate & review</ButtonLink> : null}
                {!isActiveOrder(o.status) ? <Btn tone="outline" loading={busy && !cancelOpen} onClick={reorder}><RotateCcw className="size-4" /> Reorder</Btn> : null}
                {o.status === 'placed' ? <Btn tone="danger" onClick={() => setCancelOpen(true)}>Cancel order</Btn> : null}
                <ButtonLink to={`/account/help?order=${o._id}`} tone="ghost"><HelpCircle className="size-4" /> Need help with this order?</ButtonLink>
              </div>
            </div>
          );
        }}
      </View>
      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Why are you cancelling?"
        footer={<Btn tone="danger" block disabled={!reason} loading={busy} onClick={cancel}>Cancel order</Btn>}
      >
        <p className="mb-3 text-sm text-muted">Pick the closest reason. It helps us improve.</p>
        <div role="radiogroup" className="space-y-1">
          {REASONS.map((r) => (
            <label key={r} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-line-soft">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-[var(--color-danger)]" />
              <span className="text-[15px]">{r}</span>
            </label>
          ))}
        </div>
      </Sheet>
    </Page>
  );
}

export function RateOrderPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await shopApi.post(`/store/me/orders/${id}/review`, { rating: stars, ...(text.trim() ? { text: text.trim() } : {}) });
      qc.invalidateQueries({ queryKey: ['shop', 'order', id] });
      toast.success('Thanks for your review!');
      nav(`/account/orders/${id}`, { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page narrow>
      <Panel className="p-6 text-center sm:p-10">
        <h1 className="text-2xl font-extrabold">How was your order?</h1>
        <p className="mt-1 text-sm text-muted">Rate the products and the delivery.</p>
        <div className="mt-6 flex justify-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setStars(i)} className="grid size-12 place-items-center rounded-xl hover:bg-accent-50">
              <Star className={cx('size-9', i <= stars ? 'fill-accent-500 text-accent-500' : 'text-line')} />
            </button>
          ))}
        </div>
        <TextArea className="mt-6 text-left" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us about the quality and delivery…" aria-label="Your review" />
        <Btn block size="lg" className="mt-6" disabled={!stars} loading={busy} onClick={submit}>Submit review</Btn>
      </Panel>
    </Page>
  );
}
