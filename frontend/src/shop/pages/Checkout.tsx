import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Briefcase, CheckCircle2, Circle, CircleCheck, Home, Lock, MapPin, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { money } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { useShopAuth } from '../auth';
import { cartCount, couponLabel, oneLine, useAddresses, useCart, useCartActions, useConfig, useCoupons, useOrder, type Address, type Order } from '../data';
import { Bill, Btn, ButtonLink, cx, EmptyState, FormField, Page, PageTitle, Panel, ProductImage, SelectBox, Sheet, SkeletonList, Stepper, TextInput, View } from '../ui';

// ------------------------------------------------------------------ Cart
export function CartPage() {
  const cart = useCart();
  const { setQty, coupon, clear } = useCartActions();
  const nav = useNavigate();
  const [couponOpen, setCouponOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const busyKey = setQty.isPending ? `${setQty.variables?.productId}:${setQty.variables?.variantId ?? ''}` : '';
  const count = cartCount(cart.data);

  return (
    <Page>
      <PageTitle action={count ? <Btn tone="ghost" className="text-danger" onClick={() => setConfirmClear(true)}><Trash2 className="size-4" /> Clear all</Btn> : undefined}>
        My cart{count ? <span className="ml-2 text-base font-semibold text-muted">({count} item{count === 1 ? '' : 's'})</span> : null}
      </PageTitle>
      <View
        q={cart}
        empty={(c) => (c.items.length ? null : <EmptyState icon={<ShoppingBag className="size-8" />} title="Your cart is empty" message="Add fresh groceries, essentials or homemade food to get started." action={<ButtonLink to="/" className="w-full">Start shopping</ButtonLink>} />)}
      >
        {(c) => (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <div className="space-y-4">
              {c.warnings?.map((w) => (
                <div key={w} className="flex gap-3 rounded-xl bg-warning-bg p-4 text-sm text-ink" role="status">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w}
                </div>
              ))}
              <Panel>
                <ul className="divide-y divide-line">
                  {c.items.map((it) => {
                    const key = `${it.product}:${it.variant ?? ''}`;
                    return (
                      <li key={key} className="flex gap-4 p-4 sm:p-5">
                        <Link to={`/product/${it.product}`} className="shrink-0">
                          <ProductImage src={it.image} alt="" className="size-20 rounded-xl" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/product/${it.product}`} className="line-clamp-2 font-bold leading-snug hover:text-brand-700">{it.name}</Link>
                          <p className="mt-0.5 text-[13px] text-muted">{it.variantName ? `Size: ${it.variantName}` : it.unit}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p>
                              <span className="tabular font-extrabold">{money(it.lineTotal)}</span>
                              {it.quantity > 1 ? <span className="ml-2 text-[13px] text-muted">{money(it.unitPrice)} each</span> : null}
                            </p>
                            <Stepper
                              size="sm"
                              qty={it.quantity}
                              busy={busyKey === key}
                              max={Math.max(1, Math.min(50, it.available ?? 50))}
                              label={it.name}
                              onChange={(q) => setQty.mutate({ productId: it.product, quantity: q, variantId: it.variant }, { onError: (e) => toast.error(errMsg(e)) })}
                            />
                          </div>
                          {it.outOfStock ? <p className="mt-2 text-[13px] font-semibold text-danger">Only {it.available ?? 0} available. Reduce the quantity to continue.</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </div>
            <div className="space-y-4 lg:sticky lg:top-24">
              <button type="button" onClick={() => setCouponOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:border-brand-700/50">
                <Tag className="size-5 text-accent-500" aria-hidden />
                <span className="flex-1">
                  <span className="block font-semibold">{c.couponCode ?? c.totals.couponCode ? `Coupon ${c.couponCode ?? c.totals.couponCode} applied` : 'Apply coupon'}</span>
                  {c.totals.discount > 0 ? <span className="text-sm font-semibold text-success">You save {money(c.totals.discount)}</span> : null}
                </span>
              </button>
              <Bill totals={c.totals} count={count} />
              <Btn block size="lg" disabled={c.items.some((i) => i.outOfStock)} onClick={() => nav('/checkout')}>
                Proceed to checkout · {money(c.totals.grandTotal)}
              </Btn>
              <p className="text-center text-[13px] text-muted">Prices and availability are confirmed again when you place the order.</p>
            </div>
            <CouponSheet
              open={couponOpen}
              current={c.couponCode ?? c.totals.couponCode}
              onClose={() => setCouponOpen(false)}
              onApply={(code) =>
                coupon.mutate(code, {
                  onSuccess: () => {
                    setCouponOpen(false);
                    toast.success(code ? `Coupon ${code} applied` : 'Coupon removed');
                  },
                  onError: (e) => toast.error(errMsg(e)),
                })
              }
              busy={coupon.isPending}
            />
          </div>
        )}
      </View>
      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear cart?"
        footer={
          <div className="flex gap-3">
            <Btn tone="outline" className="flex-1" onClick={() => setConfirmClear(false)}>Keep items</Btn>
            <Btn tone="danger" className="flex-1" loading={clear.isPending} onClick={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false), onError: (e) => toast.error(errMsg(e)) })}>Clear cart</Btn>
          </div>
        }
      >
        <p className="text-muted">All items will be removed from your cart.</p>
      </Sheet>
    </Page>
  );
}

function CouponSheet({ open, onClose, onApply, current, busy }: { open: boolean; onClose: () => void; onApply: (code: string | null) => void; current?: string; busy: boolean }) {
  const list = useCoupons();
  const [code, setCode] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Apply coupon">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onApply(code.trim().toUpperCase());
        }}
        className="flex gap-2"
      >
        <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" />
        <Btn type="submit" size="lg" loading={busy} disabled={!code.trim()}>Apply</Btn>
      </form>
      <View q={list} skeleton={<SkeletonList n={2} />} empty={(l) => (l.length ? null : <p className="mt-4 text-sm text-muted">No coupons available right now.</p>)}>
        {(l) => (
          <ul className="mt-4 divide-y divide-line">
            {l.map((c) => (
              <li key={c._id} className="flex items-center gap-3 py-3">
                <Tag className="size-5 shrink-0 text-accent-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold tracking-wide">{c.code}</span>
                  <span className="text-[13px] text-muted">{couponLabel(c)} · Min order ₹{c.minOrder}</span>
                </span>
                <Btn tone="ghost" size="sm" disabled={busy} onClick={() => onApply(c.code)}>Apply</Btn>
              </li>
            ))}
          </ul>
        )}
      </View>
      {current ? <Btn tone="danger" block className="mt-4" disabled={busy} onClick={() => onApply(null)}>Remove applied coupon</Btn> : null}
    </Sheet>
  );
}

// ------------------------------------------------------------------ Address picker (checkout step 1)
const labelIcon = (l: string) => (l === 'Work' ? Briefcase : l === 'Home' ? Home : MapPin);

export function CheckoutPage() {
  const addrs = useAddresses();
  const cart = useCart().data;
  const nav = useNavigate();
  const [picked, setPicked] = useState<string>();
  const list = addrs.data ?? [];
  const sel = picked ?? list.find((a) => a.isDefault)?._id ?? list[0]?._id;
  if (cart && cart.items.length === 0) return <Page narrow><EmptyState icon={<ShoppingBag className="size-8" />} title="Your cart is empty" action={<ButtonLink to="/" className="w-full">Start shopping</ButtonLink>} /></Page>;
  return (
    <Page narrow>
      <Steps at={1} />
      <PageTitle>Select delivery address</PageTitle>
      <ButtonLink to="/account/addresses/new?next=checkout" tone="outline" className="mb-4 w-full"><Plus className="size-4" /> Add new address</ButtonLink>
      <View q={addrs} empty={(l) => (l.length ? null : <EmptyState icon={<MapPin className="size-8" />} title="No saved addresses" message="Add an address to see delivery options." />)}>
        {(l) => (
          <div role="radiogroup" aria-label="Delivery address" className="space-y-3">
            {l.map((a) => (
              <AddressCard key={a._id} a={a} selected={sel === a._id} onSelect={() => setPicked(a._id)} />
            ))}
          </div>
        )}
      </View>
      {list.length ? (
        <Btn block size="lg" className="mt-6" onClick={() => nav(`/checkout/payment?address=${sel}`)}>
          Deliver to this address
        </Btn>
      ) : null}
    </Page>
  );
}

export function AddressCard({ a, selected, onSelect, onEdit }: { a: Address; selected?: boolean; onSelect?: () => void; onEdit?: () => void }) {
  const Icon = labelIcon(a.label);
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 font-bold">
          {a.label}
          {a.isDefault ? <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-bold text-success">Default</span> : null}
        </span>
        <span className="mt-1 block text-[13px] text-muted">{a.recipient} · {a.phone}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{oneLine(a)}</span>
      </span>
    </>
  );
  if (onSelect)
    return (
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={cx('flex w-full gap-3 rounded-2xl border bg-surface p-4', selected ? 'border-brand-700 ring-1 ring-brand-700' : 'border-line hover:border-brand-700/50')}>
        {body}
        {selected ? <CircleCheck className="size-6 shrink-0 text-brand-700" aria-hidden /> : <Circle className="size-6 shrink-0 text-muted" aria-hidden />}
      </button>
    );
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
      {body}
      {onEdit ? <Btn tone="ghost" size="sm" onClick={onEdit}>Edit</Btn> : null}
    </div>
  );
}

function Steps({ at }: { at: 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-[13px] font-semibold" aria-label="Checkout steps">
      {['Cart', 'Address', 'Payment'].map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx('grid size-6 place-items-center rounded-full text-xs', i <= at ? 'bg-brand-900 text-white' : 'bg-line text-muted')} aria-current={i === at ? 'step' : undefined}>{i + 1}</span>
          <span className={i <= at ? 'text-ink' : 'text-muted'}>{s}</span>
          {i < 2 ? <span className="h-px w-6 bg-line" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ Address form (shared with the account area)
export function AddressFormPage() {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useShopAuth();
  const addrs = useAddresses();
  const existing = id ? addrs.data?.find((a) => a._id === id) : undefined;
  const next = new URLSearchParams(loc.search).get('next');
  if (id && addrs.isLoading) return <Page narrow><SkeletonList n={3} /></Page>;
  return <AddressForm key={existing?._id ?? 'new'} existing={existing} defaults={{ recipient: user?.name ?? '', phone: user?.phone ?? '' }} onDone={() => {
    qc.invalidateQueries({ queryKey: ['shop', 'addresses'] });
    // Saved → Home (where the new delivery location shows); mid-checkout → back to the address picker
    nav(next === 'checkout' ? '/checkout' : '/', { replace: true });
  }} onDeleted={() => {
    qc.invalidateQueries({ queryKey: ['shop', 'addresses'] });
    nav('/account/addresses');
  }} />;
}

function AddressForm({ existing, defaults, onDone, onDeleted }: { existing?: Address; defaults: { recipient: string; phone: string }; onDone: () => void; onDeleted: () => void }) {
  const [f, setF] = useState({
    label: existing?.label ?? 'Home',
    recipient: existing?.recipient ?? defaults.recipient,
    phone: existing?.phone ?? defaults.phone,
    line1: existing?.line1 ?? '',
    line2: existing?.line2 ?? '',
    landmark: existing?.landmark ?? '',
    city: existing?.city ?? 'Hyderabad',
    state: existing?.state ?? 'Telangana',
    postalCode: existing?.postalCode ?? '',
    isDefault: existing?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.recipient.trim()) e.recipient = 'Required';
    if (!/^(\+91)?[6-9]\d{9}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid mobile number';
    if (!f.line1.trim()) e.line1 = 'Required';
    if (!f.line2.trim()) e.line2 = 'Required';
    if (!f.city.trim()) e.city = 'Required';
    if (!f.state.trim()) e.state = 'Required';
    if (!/^\d{6}$/.test(f.postalCode)) e.postalCode = '6 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const save = async (skipCheck = false) => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (!skipCheck) {
        // Advisory: warn when outside the delivery area (checkout enforces it)
        const { data } = await shopApi.get('/store/serviceability', { params: { pincode: f.postalCode } }).catch(() => ({ data: { serviceable: true } }));
        if (data.serviceable !== true) {
          setWarn(true);
          setBusy(false);
          return;
        }
      }
      const body = { ...f, recipient: f.recipient.trim(), phone: f.phone.trim(), line1: f.line1.trim(), line2: f.line2.trim(), landmark: f.landmark.trim() };
      if (existing) await shopApi.put(`/store/me/addresses/${existing._id}`, body);
      else await shopApi.post('/store/me/addresses', body);
      toast.success('Address saved');
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await shopApi.delete(`/store/me/addresses/${existing!._id}`);
      onDeleted();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  return (
    <Page narrow>
      <PageTitle action={existing ? <Btn tone="danger" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Btn> : undefined}>{existing ? 'Edit address' : 'Add delivery address'}</PageTitle>
      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Save address as</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {['Home', 'Work', 'Other'].map((l) => (
              <button key={l} type="button" role="radio" aria-checked={f.label === l} onClick={() => setF({ ...f, label: l })} className={cx('h-11 rounded-xl border text-sm font-bold', f.label === l ? 'border-brand-700 bg-brand-100' : 'border-line bg-surface text-muted')}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Recipient name" htmlFor="a-name" error={errors.recipient}><TextInput id="a-name" autoComplete="name" value={f.recipient} onChange={set('recipient')} aria-invalid={Boolean(errors.recipient)} /></FormField>
          <FormField label="Phone number" htmlFor="a-phone" error={errors.phone}><TextInput id="a-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} /></FormField>
        </div>
        <FormField label="Flat / House no., Building" htmlFor="a-l1" error={errors.line1}><TextInput id="a-l1" autoComplete="address-line1" value={f.line1} onChange={set('line1')} aria-invalid={Boolean(errors.line1)} /></FormField>
        <FormField label="Area / Locality" htmlFor="a-l2" error={errors.line2}><TextInput id="a-l2" autoComplete="address-line2" value={f.line2} onChange={set('line2')} aria-invalid={Boolean(errors.line2)} /></FormField>
        <FormField label="Landmark (optional)" htmlFor="a-lm"><TextInput id="a-lm" value={f.landmark} onChange={set('landmark')} /></FormField>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <FormField label="City" htmlFor="a-city" error={errors.city}><TextInput id="a-city" autoComplete="address-level2" value={f.city} onChange={set('city')} aria-invalid={Boolean(errors.city)} /></FormField>
          <FormField label="PIN code" htmlFor="a-pin" error={errors.postalCode}><TextInput id="a-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value.replace(/\D/g, '') })} aria-invalid={Boolean(errors.postalCode)} /></FormField>
          <div className="col-span-2 sm:col-span-1">
            <FormField label="State" htmlFor="a-state" error={errors.state}>
              <SelectBox id="a-state" value={f.state} onChange={set('state')}>
                {['Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Other'].map((s) => <option key={s}>{s}</option>)}
              </SelectBox>
            </FormField>
          </div>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4">
          <span className="font-medium">Set as default address</span>
          <input type="checkbox" checked={f.isDefault} onChange={set('isDefault')} className="size-5 accent-[var(--color-brand-800)]" />
        </label>
        <Btn type="submit" block size="lg" loading={busy}>Save address</Btn>
      </form>
      <Sheet open={warn} onClose={() => setWarn(false)} title="We don’t deliver here yet" footer={<div className="flex gap-3"><Btn tone="outline" className="flex-1" onClick={() => setWarn(false)}>Change PIN</Btn><Btn className="flex-1" onClick={() => { setWarn(false); save(true); }}>Save anyway</Btn></div>}>
        <p className="text-muted">PIN {f.postalCode} is outside our delivery area. You can save it, but orders can’t be delivered there right now.</p>
      </Sheet>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete address?" footer={<div className="flex gap-3"><Btn tone="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Btn><Btn tone="danger" className="flex-1" onClick={del}>Delete</Btn></div>}>
        <p className="text-muted">This address will be removed from your account.</p>
      </Sheet>
    </Page>
  );
}

// ------------------------------------------------------------------ Payment (checkout step 2)
const METHODS: [string, string, string][] = [
  ['upi', 'UPI', 'PhonePe, GPay, Paytm'],
  ['card', 'Credit / Debit card', 'Visa, Mastercard, RuPay'],
  ['netbanking', 'Net banking', 'All major banks'],
  ['wallet', 'Wallets', 'Paytm, Amazon Pay'],
  ['cod', 'Cash on delivery', 'Pay when you receive'],
];

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}
function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PaymentPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useShopAuth();
  const addressId = new URLSearchParams(loc.search).get('address');
  const address = useAddresses().data?.find((a) => a._id === addressId);
  const cart = useCart();
  const cfg = useConfig().data;
  const allowed = cfg?.paymentMethods ?? ['cod'];
  const [method, setMethod] = useState('cod');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per checkout visit → double clicks and retries never create duplicate orders
  const idem = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  if (!addressId) return <Page narrow><EmptyState icon={<MapPin className="size-8" />} title="Choose an address first" action={<ButtonLink to="/checkout" className="w-full">Select address</ButtonLink>} /></Page>;

  const place = async () => {
    setBusy(true);
    try {
      const { data } = await shopApi.post('/store/me/orders', { addressId, paymentMethod: method, ...(note.trim() ? { instructions: note.trim() } : {}) }, { headers: { 'Idempotency-Key': idem } });
      const order = data.order as Order;
      qc.invalidateQueries({ queryKey: ['shop', 'cart'] });
      qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
      const rzp = data.razorpay as { keyId: string; orderId: string; amount: number } | null;
      if (!rzp) return nav(`/order-placed/${order._id}`, { replace: true });
      if (!(await loadRazorpay()) || !window.Razorpay) {
        toast.error('Couldn’t open the payment window. Your order is saved; retry payment from My orders.');
        return nav(`/account/orders/${order._id}`, { replace: true });
      }
      const r = new window.Razorpay({
        key: rzp.keyId,
        order_id: rzp.orderId,
        amount: rzp.amount,
        currency: 'INR',
        name: 'VSR',
        description: `Order #${order.orderNumber}`,
        prefill: { email: user?.email ?? '', contact: user?.phone ?? '' },
        theme: { color: '#0B3D2E' },
        handler: async (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Webhook reconciles if this verification is late or fails; the order page shows the live state
          await shopApi.post('/store/me/payments/verify', { razorpayOrderId: res.razorpay_order_id, razorpayPaymentId: res.razorpay_payment_id, razorpaySignature: res.razorpay_signature }).catch(() => undefined);
          nav(`/order-placed/${order._id}`, { replace: true });
        },
        modal: {
          ondismiss: () => {
            toast('Payment not completed. Your order is saved; you can retry from My orders.');
            nav(`/account/orders/${order._id}`, { replace: true });
          },
        },
      });
      r.on('payment.failed', () => toast.error('Payment failed. You can retry from My orders.'));
      r.open();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <Steps at={2} />
      <PageTitle>Payment</PageTitle>
      {address ? (
        <Panel className="flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Deliver to {address.label}</span>
            <span className="line-clamp-2 text-[13px] text-muted">{oneLine(address)}</span>
          </span>
          <Link to="/checkout" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50">Change</Link>
        </Panel>
      ) : null}
      <h2 className="mb-3 mt-8 text-lg font-extrabold">Choose how to pay</h2>
      <Panel>
        <div role="radiogroup" aria-label="Payment method" className="divide-y divide-line">
          {METHODS.map(([v, label, sub]) => {
            const ok = allowed.includes(v);
            return (
              <button key={v} type="button" role="radio" aria-checked={method === v} disabled={!ok} onClick={() => setMethod(v)} className="flex w-full items-center gap-3 px-4 py-4 text-left disabled:opacity-50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="text-[13px] text-muted">{ok ? sub : 'Not available right now'}</span>
                </span>
                {method === v ? <CircleCheck className="size-6 text-brand-700" aria-hidden /> : <Circle className="size-6 text-muted" aria-hidden />}
              </button>
            );
          })}
        </div>
      </Panel>
      <div className="mt-6">
        <FormField label="Delivery instructions (optional)" htmlFor="note">
          <TextInput id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Call before delivery" />
        </FormField>
      </div>
      <div className="mt-6">{cart.data?.items.length ? <Bill totals={cart.data.totals} count={cartCount(cart.data)} /> : null}</div>
      <Btn block size="lg" className="mt-6" loading={busy} disabled={!cart.data?.items.length} onClick={place}>
        {method === 'cod' ? `Place order · ${money(cart.data?.totals.grandTotal)}` : `Pay ${money(cart.data?.totals.grandTotal)}`}
      </Btn>
      <p className="mt-3 flex items-start justify-center gap-2 text-center text-[13px] text-muted">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Payments are processed securely by Razorpay. VSR never stores your card details.
      </p>
    </Page>
  );
}

// ------------------------------------------------------------------ Order placed
export function OrderPlacedPage() {
  const { id = '' } = useParams();
  const o = useOrder(id).data;
  return (
    <Page narrow>
      <div className="flex flex-col items-center py-10 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-success text-white animate-rise">
          <CheckCircle2 className="size-14" aria-hidden />
        </span>
        <h1 className="mt-8 text-2xl font-extrabold sm:text-3xl">Order placed successfully!</h1>
        {o ? (
          <>
            <span className="mt-4 rounded-full border border-line bg-surface px-4 py-2 font-extrabold">Order #{o.orderNumber}</span>
            <p className="mt-4 max-w-sm text-muted">
              {o.paymentStatus === 'paid' || o.paymentMethod === 'cod' ? 'VSR will confirm your order shortly. We’ll notify you at every step.' : 'We’re confirming your payment. Your order will be reviewed once payment is verified.'}
            </p>
          </>
        ) : null}
        <div className="mt-10 grid w-full max-w-sm gap-3">
          <ButtonLink to={`/account/orders/${id}`}>Track order</ButtonLink>
          <ButtonLink to="/" tone="ghost">Continue shopping</ButtonLink>
        </div>
      </div>
    </Page>
  );
}
