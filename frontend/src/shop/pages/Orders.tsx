import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight, Download, CircleX, HelpCircle, KeyRound, MapPin, Package, PackageCheck, Phone, Receipt, RotateCcw, Search, Star, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { dateTime, date as fmtDate, money } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { isActiveOrder, oneLine, useOrder, useOrders, type Order } from '../data';
import { printInvoice } from '../invoice';
import { canRetryPayment, retryPayment } from '../pay';
import { useShopAuth } from '../auth';
import { Bill, Btn, ButtonLink, cx, EmptyState, Page, Panel, ProductImage, Sheet, SkeletonList, StatusPill, statusTone, TextArea, View } from '../ui';

// Tabs group statuses the same way the API's `tab` filter does
const GROUPS: Record<string, string[]> = {
  ongoing: ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivery_failed'],
  delivered: ['delivered', 'return_requested', 'returned'],
  cancelled: ['cancelled', 'rejected'],
};
const TABS: [string, string, LucideIcon][] = [
  ['all', 'All', Package],
  ['ongoing', 'Ongoing', Truck],
  ['delivered', 'Delivered', PackageCheck],
  ['cancelled', 'Cancelled', CircleX],
];
const inTab = (o: Order, tab: string) => tab === 'all' || (GROUPS[tab] ?? []).includes(o.status);

export function OrdersPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'all';
  const [term, setTerm] = useState('');
  // One fetch; tabs, counts and search all work off it
  const q = useOrders('all');
  const all = q.data ?? [];
  const t = term.trim().toLowerCase();
  const shown = all.filter((o) => inTab(o, tab) && (!t || o.orderNumber.toLowerCase().includes(t) || o.items.some((i) => i.name.toLowerCase().includes(t))));
  return (
    <Page narrow>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-3xl font-extrabold tracking-[-0.02em]">My orders</h1>
          <p className="mt-1 text-muted">Track, manage and buy again</p>
        </div>
        <label className="relative w-full md:w-72">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by order no. or item" className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[15px] focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
        </label>
      </div>
      <div role="tablist" aria-label="Order status" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map(([v, l, Icon]) => {
          const n = all.filter((o) => inTab(o, v)).length;
          const on = tab === v;
          return (
            <button key={v} role="tab" aria-selected={on} onClick={() => setSp(v === 'all' ? {} : { tab: v }, { replace: true })} className={cx('inline-flex h-11 shrink-0 items-center gap-2 rounded-full border pl-3.5 pr-2 text-sm font-bold transition-colors', on ? 'border-accent-500 bg-accent-500/10 text-ink' : 'border-line bg-surface text-muted hover:text-ink')}>
              <Icon className={cx('size-4', on && 'text-accent-500')} aria-hidden />
              {l}
              {q.data ? <span className={cx('tabular grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs', on ? 'bg-accent-500 text-white' : 'bg-line-soft text-muted')}>{n}</span> : null}
            </button>
          );
        })}
      </div>
      <View
        q={q}
        empty={() =>
          shown.length ? null : (
            <EmptyState
              icon={<Receipt className="size-8" />}
              title={t ? 'No matching orders' : 'No orders here'}
              message={t ? 'Try an order number or an item name.' : tab === 'all' ? 'Your orders will appear here once you place one.' : undefined}
              action={tab === 'all' && !t ? <ButtonLink to="/" className="w-full">Start shopping</ButtonLink> : undefined}
            />
          )
        }
      >
        {() => (
          <ul className="space-y-4">
            {shown.map((o) => (
              <li key={o._id}>
                <OrderCard o={o} />
              </li>
            ))}
          </ul>
        )}
      </View>
    </Page>
  );
}

// Compact 4-stop tracker for the list; the detail page keeps the full timeline
const MINI: [string, string, string[]][] = [
  ['placed', 'Placed', ['placed']],
  ['packed', 'Packed', ['confirmed', 'picking', 'packed']],
  ['out_for_delivery', 'On the way', ['assigned', 'out_for_delivery', 'delivery_failed']],
  ['delivered', 'Delivered', ['delivered', 'return_requested', 'returned']],
];
const TONE: Record<string, { head: string; dot: string; line: string }> = {
  success: { head: 'bg-success-bg/60', dot: 'bg-success text-white', line: 'bg-success' },
  info: { head: 'bg-info-bg/60', dot: 'bg-info text-white', line: 'bg-info' },
  warning: { head: 'bg-warning-bg/60', dot: 'bg-warning text-white', line: 'bg-warning' },
  danger: { head: 'bg-danger-bg/60', dot: 'bg-danger text-white', line: 'bg-danger' },
};
const fmtShort = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function OrderCard({ o }: { o: Order }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const count = o.items.reduce((s, i) => s + i.quantity, 0);
  const tone = TONE[statusTone(o.status)] ?? TONE.warning;
  const terminal = GROUPS.cancelled.includes(o.status);
  const stage = MINI.findIndex(([, , ss]) => ss.includes(o.status));
  const at = (ss: string[]) => o.history?.filter((h) => ss.includes(h.to)).at(-1)?.at ?? (ss.includes('placed') ? o.createdAt : undefined);
  const href = `/account/orders/${o._id}`;
  const first = o.items[0];
  const reorder = async () => {
    setBusy(true);
    try {
      const { data } = await shopApi.post(`/store/me/orders/${o._id}/reorder`);
      qc.setQueryData(['shop', 'cart'], data);
      nav('/cart');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface">
      <Link to={href} className={cx('flex items-center gap-3 px-4 py-3 hover:brightness-[0.98]', tone.head)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold">#{o.orderNumber}</span>
          <span className="tabular text-[13px] text-muted">
            {fmtDate(o.createdAt)} · {count} item{count === 1 ? '' : 's'}
          </span>
        </span>
        <StatusPill status={o.status} />
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>

      <Link to={href} className="flex gap-4 p-4">
        <span className="relative shrink-0">
          <ProductImage src={first?.image} alt="" className="size-20 rounded-2xl" />
          {o.items.length > 1 ? <span className="absolute bottom-1.5 right-1.5 rounded-full bg-brand-900 px-2 py-0.5 text-[11px] font-bold text-white">+{o.items.length - 1}</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-bold leading-snug">
            {first?.name}
            {o.items.length > 1 ? <span className="font-semibold text-muted"> + {o.items.length - 1} more</span> : null}
          </span>
          <span className="mt-1 block text-[13px] text-muted">{o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase()}</span>
        </span>
        <span className="tabular shrink-0 text-lg font-extrabold">{money(o.totals.grandTotal)}</span>
      </Link>

      <div className="px-4 pb-4">
        {terminal ? (
          <p className="flex gap-2 rounded-2xl bg-danger-bg/50 px-3 py-2.5 text-sm">
            <CircleX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <span>
              {o.status === 'cancelled' ? 'Cancelled' : 'Rejected'}
              {o.rejectionReason ? ` — ${o.rejectionReason}` : ''}
              {o.paymentStatus.startsWith('refund') ? ` · Refund ${o.paymentStatus.replace('refund_', '')}` : ''}
            </span>
          </p>
        ) : (
          <ol className="grid grid-cols-4" aria-label="Order progress">
            {MINI.map(([key, label, ss], i) => {
              const done = i <= stage;
              const when = done ? at(ss) : undefined;
              return (
                <li key={key} className="relative flex min-w-0 flex-col items-center text-center">
                  {i > 0 ? <span aria-hidden className={cx('absolute right-1/2 top-2.5 h-0.5 w-full -translate-y-1/2', done ? tone.line : 'bg-line')} /> : null}
                  <span className={cx('relative grid size-5 place-items-center rounded-full', done ? tone.dot : 'border-2 border-line bg-surface')}>{done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}</span>
                  <span className={cx('mt-1.5 text-xs font-semibold', !done && 'text-muted')}>{label}</span>
                  <span className="tabular text-[11px] text-muted">{when ? fmtShort(when) : '—'}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex gap-2 border-t border-line p-3">
        {isActiveOrder(o.status) ? (
          <ButtonLink to={href} tone="outline" className="flex-1">
            <Truck className="size-4" /> Track
          </ButtonLink>
        ) : (
          <Btn tone="outline" className="flex-1" loading={busy} onClick={reorder}>
            <RotateCcw className="size-4" /> Buy again
          </Btn>
        )}
        {o.status === 'placed' ? (
          <ButtonLink to={`${href}?cancel=1`} tone="ghost" className="flex-1 text-danger">
            <CircleX className="size-4" /> Cancel
          </ButtonLink>
        ) : o.status === 'delivered' && o.rating == null ? (
          <ButtonLink to={`${href}/rate`} tone="ghost" className="flex-1">
            <Star className="size-4" /> Rate
          </ButtonLink>
        ) : null}
        <ButtonLink to={`/account/help?order=${o._id}`} tone="ghost" className="flex-1">
          <HelpCircle className="size-4" /> Help
        </ButtonLink>
      </div>
    </article>
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
// Tracker column labels: one short line each so the row stays aligned on phones
const SHORT: Record<string, string> = { placed: 'Placed', out_for_delivery: 'On the way' };
const FLOW = ['placed', 'confirmed', 'picking', 'packed', 'assigned', 'out_for_delivery', 'delivered'];
const REASONS = ['Ordered by mistake', 'Want to change items', 'Delivery time too long', 'Found a better price', 'Other'];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const q = useOrder(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(sp.get('cancel') === '1');
  const [reason, setReason] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { user } = useShopAuth();

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
  // Unpaid online order: the server re-creates the Razorpay order from the order's own total
  const pay = async (o: Order) => {
    setBusy(true);
    try {
      const r = await retryPayment(o, { email: user?.email, phone: user?.phone });
      if (r === 'paid') toast.success('Payment received. Thank you!');
      else if (r === 'unavailable') toast.error('Couldn’t open the payment window. Please try again.');
      else toast('Payment not completed. You can try again anytime.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      refresh();
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
          const at = (s: string) => o.history?.filter((h) => h.to === s).at(-1)?.at;
          const count = o.items.reduce((s, i) => s + i.quantity, 0);
          const tone = statusTone(o.status);
          const delivered = o.status === 'delivered';
          const lastAt = o.history?.at(-1)?.at;
          const hero = delivered
            ? { title: 'Delivered successfully', sub: `Your order was delivered on ${dateTime(at('delivered') ?? lastAt)}.`, Icon: PackageCheck }
            : terminal
              ? { title: o.status === 'cancelled' ? 'Order cancelled' : 'Order rejected', sub: [o.rejectionReason, o.paymentStatus.startsWith('refund') ? `Refund ${o.paymentStatus.replace('refund_', '')}` : ''].filter(Boolean).join(' · ') || `Updated ${dateTime(lastAt)}.`, Icon: CircleX }
              : o.status === 'out_for_delivery' || o.status === 'assigned'
                ? { title: 'On the way', sub: 'Your order is out for delivery. Keep your delivery code ready.', Icon: Truck }
                : o.status === 'delivery_failed'
                  ? { title: 'Delivery attempt failed', sub: 'We’ll try again soon. Need to change something? Get help below.', Icon: CircleX }
                  : { title: 'Order in progress', sub: 'We’re getting your order ready.', Icon: Package };
          const heroTone = { success: 'bg-success-bg text-success', info: 'bg-info-bg text-info', warning: 'bg-warning-bg text-warning', danger: 'bg-danger-bg text-danger' }[tone] ?? 'bg-warning-bg text-warning';
          const dot = { success: 'bg-success', info: 'bg-info', warning: 'bg-warning', danger: 'bg-danger' }[tone] ?? 'bg-warning';
          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="hidden text-3xl font-extrabold tracking-[-0.02em] md:block">Order details</h1>
                  <p className="truncate text-[15px] font-bold md:mt-1">Order #{o.orderNumber}</p>
                  <p className="tabular mt-0.5 text-sm text-muted">Placed {dateTime(o.createdAt)}</p>
                  <p className="tabular text-sm text-muted">
                    {count} item{count === 1 ? '' : 's'} · <span className="font-bold text-ink">{money(o.totals.grandTotal)}</span>
                  </p>
                </div>
                <StatusPill status={o.status} />
              </div>

              {o.deliveryCode ? (
                <div className="flex gap-4 rounded-3xl bg-brand-900 p-5 text-white" aria-label={`Delivery code ${o.deliveryCode.split('').join(' ')}. Share only with your delivery partner at your door.`}>
                  <KeyRound className="mt-1 size-6 shrink-0 text-accent-500" aria-hidden />
                  <div>
                    <p className="text-sm text-white/80">Delivery code</p>
                    <p className="tabular mt-1 text-3xl font-extrabold tracking-[0.3em]">{o.deliveryCode}</p>
                    <p className="mt-1 text-[13px] text-white/80">Share only with your delivery partner at your door.</p>
                  </div>
                </div>
              ) : null}

              {/* Status banner + tracker */}
              <section className="overflow-hidden rounded-3xl border border-line bg-surface">
                <div className={cx('flex items-center gap-4 p-5', heroTone.split(' ')[0])}>
                  <span className={cx('grid size-14 shrink-0 place-items-center rounded-2xl bg-surface', heroTone.split(' ')[1])}>
                    <hero.Icon className="size-7" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className={cx('text-xl font-extrabold tracking-[-0.01em]', heroTone.split(' ')[1])}>{hero.title}</h2>
                    <p className="mt-0.5 text-sm text-ink/80">{hero.sub}</p>
                  </div>
                </div>
                {!terminal ? (
                  <ol className="grid grid-cols-6 px-2 py-5" aria-label="Order progress">
                    {STEPS.map(([s, label], i) => {
                      const done = idx >= FLOW.indexOf(s);
                      const current = !delivered && (o.status === s || (s === 'out_for_delivery' && o.status === 'assigned'));
                      const when = at(s) ?? (s === 'out_for_delivery' ? at('assigned') : s === 'placed' ? o.createdAt : undefined);
                      return (
                        <li key={s} className="relative flex min-w-0 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
                          {i > 0 ? <span aria-hidden className={cx('absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2', done ? dot : 'bg-line')} /> : null}
                          <span className={cx('relative grid size-6 place-items-center rounded-full', done ? cx(dot, 'text-white') : 'border-2 border-line bg-surface', current && 'ring-4 ring-accent-500/25')}>
                            {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                          </span>
                          <span className={cx('mt-2 whitespace-nowrap text-[11px] font-bold leading-4 sm:text-xs', !done && 'text-muted')}>{SHORT[s] ?? label}</span>
                          {/* Date and time on their own lines so every column lines up */}
                          <span className="tabular mt-0.5 whitespace-nowrap text-[10.5px] leading-4 text-muted sm:text-[11px]">
                            {when ? (
                              <>
                                {new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                <br />
                                {new Date(when).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                              </>
                            ) : current ? 'Now' : '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </section>

              {o.deliveryPartner ? (
                <Panel className="flex items-center gap-3 rounded-3xl p-4">
                  <ProductImage src={o.deliveryPartner.avatar} alt="" className="size-12 rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{delivered ? 'Delivered by' : 'Delivering:'} {o.deliveryPartner.name}</span>
                      {o.deliveryPartner.rating ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">
                          {o.deliveryPartner.rating} <Star className="size-3 fill-current" aria-hidden />
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[13px] text-muted">Your delivery partner</span>
                  </span>
                  {o.deliveryPartner.phone ? (
                    <a href={`tel:${o.deliveryPartner.phone}`} className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-bold hover:border-brand-700" aria-label={`Call ${o.deliveryPartner.name}`}>
                      <Phone className="size-4" aria-hidden /> Call
                    </a>
                  ) : null}
                </Panel>
              ) : null}

              {/* Items */}
              <Panel className="rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold">Items ({o.items.length})</h2>
                  {!isActiveOrder(o.status) ? (
                    <Btn tone="outline" loading={busy && !cancelOpen} onClick={reorder} className="h-10">
                      <RotateCcw className="size-4" /> Buy again
                    </Btn>
                  ) : null}
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex gap-4 py-4">
                      <Link to={`/product/${it.product}`} className="relative shrink-0">
                        <ProductImage src={it.image} alt="" className="size-20 rounded-2xl" />
                        <span className="tabular absolute bottom-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-surface text-xs font-extrabold shadow-sm">{it.quantity}</span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <Link to={`/product/${it.product}`} className="min-w-0 flex-1 hover:text-brand-700">
                            <span className="line-clamp-2 font-bold leading-snug">{it.name}</span>
                            <span className="text-[13px] text-muted">
                              {[it.variantName ?? it.unit, `${it.quantity} × ${money(it.unitPrice)}`].filter(Boolean).join(' · ')}
                            </span>
                          </Link>
                          <span className="tabular shrink-0 font-extrabold">{money(it.lineTotal)}</span>
                        </div>
                        {delivered ? (
                          <Link to={`/product/${it.product}/review`} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold hover:border-brand-700">
                            <Star className="size-4 text-accent-500" aria-hidden /> Write a review
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              {/* Address + payment */}
              <div className="grid gap-4 md:grid-cols-2">
                {o.address ? (
                  <Panel className="flex gap-3 rounded-3xl p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><MapPin className="size-5" aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block font-bold">{delivered ? 'Delivered to' : 'Delivering to'} {o.address.label}</span>
                      <span className="mt-1 block text-sm text-muted">{o.address.recipient}, {oneLine(o.address)}</span>
                      {o.address.phone ? <span className="tabular mt-1 block text-sm text-muted">Mobile: {o.address.phone}</span> : null}
                    </span>
                  </Panel>
                ) : null}
                <Panel className="flex items-center gap-3 rounded-3xl p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Wallet className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">Payment method</span>
                    <span className="text-sm text-muted">{o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase()}</span>
                  </span>
                  <StatusPill status={o.paymentStatus} />
                </Panel>
              </div>

              <Bill totals={o.totals} count={count} />

              {/* Actions */}
              {canRetryPayment(o) ? (
                <div className="rounded-2xl border border-warning/40 bg-warning-bg p-4">
                  <p className="font-extrabold text-ink">Payment pending</p>
                  <p className="mt-0.5 text-sm text-muted">This order is waiting for payment. It's confirmed once the payment goes through.</p>
                  <Btn block size="lg" className="mt-3" loading={busy} onClick={() => pay(o)}>
                    <Wallet className="size-5" aria-hidden /> Complete payment · {money(o.totals.grandTotal)}
                  </Btn>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {delivered ? (
                  <Btn tone="outline" onClick={() => printInvoice(o) || toast.error('Allow pop-ups to download the invoice')}>
                    <Download className="size-4" /> Invoice
                  </Btn>
                ) : null}
                {!isActiveOrder(o.status) ? (
                  <Btn tone="outline" loading={busy && !cancelOpen} onClick={reorder}>
                    <RotateCcw className="size-4" /> Reorder
                  </Btn>
                ) : null}
                {delivered && o.rating == null ? (
                  <ButtonLink to={`/account/orders/${o._id}/rate`} tone="outline">
                    <Star className="size-4" /> Rate order
                  </ButtonLink>
                ) : null}
                {o.status === 'placed' ? (
                  <Btn tone="danger" onClick={() => setCancelOpen(true)}>
                    <CircleX className="size-4" /> Cancel order
                  </Btn>
                ) : null}
                <Link to={`/account/help?order=${o._id}`} className="col-span-2 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand-700 sm:col-span-1">
                  <HelpCircle className="size-6 shrink-0 text-brand-700" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-bold">Get help</span>
                    <span className="text-[13px] text-muted">Need help with this order?</span>
                  </span>
                  <ChevronRight className="ml-auto size-5 shrink-0 text-muted" aria-hidden />
                </Link>
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
