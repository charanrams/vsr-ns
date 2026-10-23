import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Banknote, Briefcase, Check, CheckCircle2, ChevronRight, Circle, CircleCheck, CreditCard, Heart, Home, Landmark, Lock, MapPin, MessageSquare, Pencil, Percent, Phone, PiggyBank, Plus, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Tag, Trash2, Truck, User as UserIcon, Wallet as WalletIcon, type LucideIcon } from 'lucide-react';
import { money } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { useShopAuth } from '../auth';
import { openRazorpay, type RazorpayStart } from '../pay';
import { cartCount, couponLabel, oneLine, useAddresses, useCart, useCartActions, useConfig, useCoupons, useOrder, useRecommendations, useWishlist, type Address, type Cart, type LineItem, type Order } from '../data';
import { Bill, Btn, ButtonLink, cx, EmptyState, FormField, Page, PageTitle, Panel, ProductImage, ProductRail, SectionHead, SelectBox, Sheet, SkeletonList, Stepper, TextInput, View } from '../ui';

// ------------------------------------------------------------------ Cart
export function CartPage() {
  const cart = useCart();
  const { setQty, coupon } = useCartActions();
  const nav = useNavigate();
  const qc = useQueryClient();
  const wishlist = useWishlist();
  const recs = useRecommendations();
  const [couponOpen, setCouponOpen] = useState(false);
  const [removing, setRemoving] = useState<LineItem | null>(null);
  const [saving, setSaving] = useState('');
  const busyKey = setQty.isPending ? `${setQty.variables?.productId}:${setQty.variables?.variantId ?? ''}` : '';
  const count = cartCount(cart.data);

  const setLine = (it: LineItem, q: number) => {
    if (q === 0) return setRemoving(it);
    setQty.mutate({ productId: it.product, quantity: q, variantId: it.variant }, { onError: (e) => toast.error(errMsg(e)) });
  };
  // "Save for later" = move to the wishlist (added if not there yet), then out of the cart
  const saveForLater = async (it: LineItem) => {
    const key = `${it.product}:${it.variant ?? ''}`;
    setSaving(key);
    try {
      const list = wishlist.data ?? (await qc.fetchQuery({ queryKey: ['shop', 'wishlist'], queryFn: async () => (await shopApi.get<{ items: { _id: string }[] }>('/store/me/wishlist')).data.items })) ?? [];
      if (!list.some((p) => p._id === it.product)) await shopApi.post(`/store/me/wishlist/${it.product}`);
      await setQty.mutateAsync({ productId: it.product, quantity: 0, variantId: it.variant });
      await qc.invalidateQueries({ queryKey: ['shop', 'wishlist'] });
      toast.success(`${it.name} moved to your wishlist`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving('');
    }
  };

  return (
    <Page>
      <PageTitle sub={count ? `${count} item${count === 1 ? '' : 's'} in your cart` : undefined}>My cart</PageTitle>
      <View
        q={cart}
        empty={(c) => (c.items.length ? null : <EmptyState icon={<ShoppingBag className="size-8" />} title="Your cart is empty" message="Add fresh groceries, essentials or homemade food to get started." action={<ButtonLink to="/" className="w-full">Start shopping</ButtonLink>} />)}
      >
        {(c) => {
          const inCart = new Set(c.items.map((i) => i.product));
          const more = (recs.data ?? []).filter((p) => !inCart.has(p._id)).slice(0, 10);
          // Everything saved on this order: MRP vs price, coupon, and delivery when it's free
          const mrpSaved = c.items.reduce((s, i) => s + Math.max(0, i.mrp - i.unitPrice) * i.quantity, 0);
          const deliverySaved = c.totals.deliveryFee === 0 ? (c.delivery?.fee ?? 0) : 0;
          const saved = mrpSaved + c.totals.discount + deliverySaved;
          const code = c.couponCode ?? c.totals.couponCode;
          return (
            <>
              <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
                <div className="space-y-3">
                  {c.warnings?.map((w) => (
                    <div key={w} className="flex gap-3 rounded-xl bg-warning-bg p-4 text-sm text-ink" role="status">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w}
                    </div>
                  ))}
                  <FreeDeliveryBar cart={c} />
                  <ul className="space-y-3">
                    {c.items.map((it) => {
                      const key = `${it.product}:${it.variant ?? ''}`;
                      return <CartItem key={key} it={it} busy={busyKey === key || saving === key} onQty={(q) => setLine(it, q)} onRemove={() => setRemoving(it)} onSave={() => saveForLater(it)} />;
                    })}
                  </ul>
                </div>
                <div className="space-y-3 lg:sticky lg:top-24">
                  <button
                    type="button"
                    onClick={() => setCouponOpen(true)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-700',
                      code ? 'border-success/40 bg-success-bg' : 'border-accent-500/40 bg-accent-500/[0.07] hover:border-accent-500',
                    )}
                  >
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl text-white', code ? 'bg-success' : 'bg-accent-500')}>
                      {code ? <Check className="size-5" aria-hidden /> : <Percent className="size-5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold">{code ? `${code} applied` : 'Apply coupon'}</span>
                      <span className={cx('block text-[13px]', code ? 'font-semibold text-success' : 'text-muted')}>
                        {code ? (c.totals.discount > 0 ? `You save ${money(c.totals.discount)}` : 'Free delivery unlocked') : 'Get discounts on your order'}
                      </span>
                    </span>
                    <span className={cx('flex shrink-0 items-center text-sm font-bold', code ? 'text-success' : 'text-accent-600')}>
                      {code ? 'Change' : 'View offers'} <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </button>
                  <Bill totals={c.totals} count={count} standardDeliveryFee={c.delivery?.fee} />
                  {saved > 0 ? (
                    <p className="flex items-center gap-3 rounded-2xl bg-success-bg px-4 py-3 text-sm font-semibold text-ink">
                      <PiggyBank className="size-5 shrink-0 text-success" aria-hidden />
                      <span>
                        You are saving <span className="tabular font-extrabold text-success">{money(saved)}</span> on this order
                      </span>
                    </p>
                  ) : null}
                  <Btn block size="lg" className="max-md:hidden" disabled={c.items.some((i) => i.outOfStock)} onClick={() => nav('/checkout')}>
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="tabular">{money(c.totals.grandTotal)}</span>
                      <span className="flex items-center gap-1.5">
                        Proceed to checkout <ArrowRight className="size-4" aria-hidden />
                      </span>
                    </span>
                  </Btn>
                  {c.items.some((i) => i.outOfStock) ? <p className="text-center text-[13px] font-semibold text-danger">Reduce the highlighted quantities to continue.</p> : null}
                  <p className="text-center text-[13px] text-muted">Prices and availability are confirmed again when you place the order.</p>
                </div>
              </div>
              {/* Phones: total + Checkout pinned to the bottom (the tabs step aside on /cart) */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:hidden">
                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="tabular truncate text-xl font-extrabold leading-tight">{money(c.totals.grandTotal)}</p>
                    <p className="text-[12.5px] text-muted">{count} item{count === 1 ? '' : 's'}{saved > 0 ? ` · saved ${money(saved)}` : ''}</p>
                  </div>
                  <Btn size="lg" className="flex-1" disabled={c.items.some((i) => i.outOfStock)} onClick={() => nav('/checkout')}>
                    Checkout <ArrowRight className="size-4" aria-hidden />
                  </Btn>
                </div>
              </div>
              {more.length ? (
                <section className="mt-10">
                  <SectionHead title="You might also like" />
                  <ProductRail items={more} />
                </section>
              ) : null}
              <CouponSheet
                open={couponOpen}
                current={code}
                onClose={() => setCouponOpen(false)}
                onApply={(next) =>
                  coupon.mutate(next, {
                    onSuccess: () => {
                      setCouponOpen(false);
                      toast.success(next ? `Coupon ${next} applied` : 'Coupon removed');
                    },
                    onError: (e) => toast.error(errMsg(e)),
                  })
                }
                busy={coupon.isPending}
              />
            </>
          );
        }}
      </View>
      <Sheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove item?"
        footer={
          <div className="flex gap-3">
            <Btn tone="outline" className="flex-1" onClick={() => setRemoving(null)}>Keep</Btn>
            <Btn
              tone="danger"
              className="flex-1"
              onClick={() => {
                const it = removing!;
                setRemoving(null);
                setQty.mutate({ productId: it.product, quantity: 0, variantId: it.variant }, { onError: (e) => toast.error(errMsg(e)) });
              }}
            >
              Remove
            </Btn>
          </div>
        }
      >
        <p className="text-muted">Remove {removing?.name} from your cart?</p>
      </Sheet>
    </Page>
  );
}

/** "Add ₹X more for FREE delivery" with progress, or a tick once the order qualifies. */
function FreeDeliveryBar({ cart }: { cart: Cart }) {
  const free = cart.totals.deliveryFee === 0;
  const above = cart.delivery?.freeAbove ?? 0;
  const left = Math.max(0, above - cart.totals.itemTotal);
  const pct = above > 0 ? Math.min(100, Math.round((cart.totals.itemTotal / above) * 100)) : 100;
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border p-4', free ? 'border-success/35 bg-success-bg' : 'border-line bg-surface')}>
      <Truck className={cx('size-7 shrink-0', free ? 'text-success' : 'text-brand-700')} aria-hidden />
      <div className="min-w-0 flex-1">
        {free ? (
          <>
            <p className="font-extrabold">Free delivery</p>
            <p className="text-[13px] text-muted">{cart.totals.couponCode && cart.totals.itemTotal < above ? `Unlocked with ${cart.totals.couponCode}` : 'Your order qualifies for free delivery'}</p>
          </>
        ) : (
          <>
            <p className="font-semibold">
              Add <span className="tabular font-extrabold text-brand-700">{money(left)}</span> more for FREE delivery
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-label="Progress to free delivery" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand-700 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
      {free ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden /> : null}
    </div>
  );
}

function CartItem({ it, busy, onQty, onRemove, onSave }: { it: LineItem; busy: boolean; onQty: (q: number) => void; onRemove: () => void; onSave: () => void }) {
  const avail = it.available;
  const [stock, stockCls] = it.outOfStock
    ? [`Only ${avail ?? 0} available`, 'text-danger']
    : avail != null && avail <= 5
      ? [`Only ${avail} left`, 'text-warning']
      : ['In stock', 'text-success'];
  return (
    <li className="relative flex gap-3 rounded-2xl border border-line bg-surface p-3 sm:gap-4 sm:p-4">
      <Link to={`/product/${it.product}`} className="shrink-0 self-start rounded-xl focus-visible:outline-2 focus-visible:outline-brand-700" aria-label={`Open ${it.name}`}>
        <ProductImage src={it.image} alt="" className="size-22 rounded-xl sm:size-24" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/product/${it.product}`} className="line-clamp-2 pr-10 font-extrabold leading-snug hover:text-brand-700">{it.name}</Link>
        <p className="mt-0.5 text-[13px] text-muted">
          {it.variantName ?? it.unit}
          <span aria-hidden> · </span>
          <span className={cx('font-semibold', stockCls)}>{stock}</span>
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 leading-tight">
            <span className="tabular text-[17px] font-extrabold">{money(it.lineTotal)}</span>
            {it.mrp > it.unitPrice ? <span className="tabular ml-1.5 text-[13px] text-muted line-through">{money(it.mrp * it.quantity)}</span> : null}
            {it.quantity > 1 ? <span className="block text-[12.5px] text-muted">{money(it.unitPrice)} each</span> : null}
          </p>
          <Stepper size="sm" qty={it.quantity} busy={busy} max={Math.max(1, Math.min(50, avail ?? 50))} label={it.name} onChange={onQty} />
        </div>
        <button type="button" disabled={busy} onClick={onSave} className="-ml-2 mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-brand-700 hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50">
          <Heart className="size-4" aria-hidden /> Save for later
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        aria-label={`Remove ${it.name}`}
        className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-danger-bg hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50"
      >
        <Trash2 className="size-[18px]" aria-hidden />
      </button>
    </li>
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
    <Page narrow className="pb-32 md:pb-16">
      <Steps at={1} />
      <div className="mb-5 hidden md:block">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em]">Delivery address</h1>
        <p className="mt-1 text-muted">Choose where you want your order delivered</p>
      </div>
      <Link to="/account/addresses/new?next=checkout" className="mb-6 flex items-center gap-4 rounded-3xl border-2 border-dashed border-accent-500/40 bg-accent-50 p-4 hover:border-accent-500">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-100 text-accent-600"><Plus className="size-6" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Add new address</span>
          <span className="text-sm text-muted">Save a new delivery address</span>
        </span>
        <ChevronRight className="size-5 text-accent-600" aria-hidden />
      </Link>
      <View q={addrs} empty={(l) => (l.length ? null : <EmptyState icon={<MapPin className="size-8" />} title="No saved addresses" message="Add an address to see delivery options." />)}>
        {(l) => (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">Saved addresses</h2>
              <span className="text-sm text-muted">{l.length} address{l.length === 1 ? '' : 'es'}</span>
            </div>
            <div role="radiogroup" aria-label="Delivery address" className="space-y-3">
              {l.map((a) => (
                <AddressCard key={a._id} a={a} selected={sel === a._id} onSelect={() => setPicked(a._id)} editTo={`/account/addresses/${a._id}?next=checkout`} />
              ))}
            </div>
          </>
        )}
      </View>
      {list.length ? (
        // Phones: pinned above the tabs; desktop: inline
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
          <Btn block size="lg" className="bg-accent-500 hover:bg-accent-600" onClick={() => nav(`/checkout/payment?address=${sel}`)}>
            <Truck className="size-5" /> Deliver to this address
          </Btn>
        </div>
      ) : null}
    </Page>
  );
}

export function AddressCard({ a, selected, onSelect, onEdit, editTo }: { a: Address; selected?: boolean; onSelect?: () => void; onEdit?: () => void; editTo?: string }) {
  const Icon = labelIcon(a.label);
  const info = (
    <>
      <span className={cx('grid size-14 shrink-0 place-items-center rounded-2xl', selected ? 'bg-surface text-brand-700' : 'bg-brand-50 text-brand-700')}>
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
          {a.label}
          {a.isDefault ? <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-bold text-success">Default</span> : null}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><UserIcon className="size-4" aria-hidden />{a.recipient}</span>
          <span className="tabular inline-flex items-center gap-1.5"><Phone className="size-4" aria-hidden />{a.phone}</span>
        </span>
        <span className="mt-1 flex gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{oneLine(a)}</span>
        </span>
      </span>
    </>
  );
  if (onSelect)
    return (
      <div className={cx('rounded-3xl border bg-surface transition-colors', selected ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-line hover:border-brand-700/50')}>
        <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="flex w-full gap-4 p-4 text-left">
          {info}
          {selected ? <CircleCheck className="size-6 shrink-0 text-brand-700" aria-hidden /> : <Circle className="size-6 shrink-0 text-muted" aria-hidden />}
        </button>
        {editTo ? (
          <div className="flex justify-end px-4 pb-3 pl-22">
            <Link to={editTo} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-bold hover:border-brand-700">
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </div>
        ) : null}
      </div>
    );
  return (
    <div className="flex gap-4 rounded-3xl border border-line bg-surface p-4">
      {info}
      {onEdit ? <Btn tone="ghost" size="sm" onClick={onEdit}><Pencil className="size-4" /> Edit</Btn> : null}
    </div>
  );
}

/** Checkout progress: Cart → Address → Payment. Done steps get a tick, the current one is orange. */
function Steps({ at }: { at: 1 | 2 }) {
  const steps: [string, LucideIcon][] = [
    ['Cart', ShoppingCart],
    ['Address', MapPin],
    ['Payment', CreditCard],
  ];
  return (
    <ol className="mb-6 grid grid-cols-3" aria-label="Checkout steps">
      {steps.map(([s, Icon], i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s} className="relative flex flex-col items-center" aria-current={current ? 'step' : undefined}>
            {i > 0 ? <span aria-hidden className={cx('absolute right-1/2 top-6 h-0.5 w-full -translate-y-1/2', i <= at ? 'bg-success' : 'bg-line')} /> : null}
            <span className={cx('relative grid size-12 place-items-center rounded-full', current ? 'bg-accent-500 text-white shadow-[0_6px_16px_-6px_var(--color-accent-500)]' : done ? 'bg-success-bg text-success' : 'bg-line-soft text-muted')}>
              <Icon className="size-5" aria-hidden />
              {done ? <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-success text-white ring-2 ring-cream"><Check className="size-3" strokeWidth={3} aria-hidden /></span> : null}
            </span>
            <span className={cx('mt-1.5 text-sm font-bold', current ? 'text-accent-600' : done ? 'text-ink' : 'text-muted')}>{s}</span>
          </li>
        );
      })}
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

  const section = 'space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-5';
  return (
    <Page narrow className="pb-32 md:pb-16">
      <h1 className="mb-5 hidden text-3xl font-extrabold tracking-[-0.02em] md:block">{existing ? 'Edit address' : 'Add delivery address'}</h1>
      <form id="address-form" onSubmit={submit} noValidate className="space-y-4">
        <div className={section}>
          <p id="a-type" className="text-sm font-bold">Save address as</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="a-type">
            {(['Home', 'Work', 'Other'] as const).map((l) => {
              const Icon = labelIcon(l);
              const on = f.label === l;
              return (
                <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setF({ ...f, label: l })} className={cx('flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-colors', on ? 'border-brand-700 bg-brand-50 text-ink ring-1 ring-brand-700' : 'border-line bg-surface text-muted hover:text-ink')}>
                  <Icon className={cx('size-4', on && 'text-brand-700')} aria-hidden /> {l}
                </button>
              );
            })}
          </div>
        </div>

        <section className={section} aria-labelledby="a-contact">
          <h2 id="a-contact" className="flex items-center gap-2 font-extrabold">
            <UserIcon className="size-5 text-brand-700" aria-hidden /> Contact details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Recipient name" htmlFor="a-name" error={errors.recipient}><TextInput id="a-name" autoComplete="name" value={f.recipient} onChange={set('recipient')} aria-invalid={Boolean(errors.recipient)} /></FormField>
            <FormField label="Phone number" htmlFor="a-phone" error={errors.phone}><TextInput id="a-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} /></FormField>
          </div>
        </section>

        <section className={section} aria-labelledby="a-addr">
          <h2 id="a-addr" className="flex items-center gap-2 font-extrabold">
            <MapPin className="size-5 text-brand-700" aria-hidden /> Address
          </h2>
          <FormField label="Flat / House no., Building" htmlFor="a-l1" error={errors.line1}><TextInput id="a-l1" autoComplete="address-line1" value={f.line1} onChange={set('line1')} aria-invalid={Boolean(errors.line1)} /></FormField>
          <FormField label="Area / Locality" htmlFor="a-l2" error={errors.line2}><TextInput id="a-l2" autoComplete="address-line2" value={f.line2} onChange={set('line2')} aria-invalid={Boolean(errors.line2)} /></FormField>
          <FormField label="Landmark (optional)" htmlFor="a-lm"><TextInput id="a-lm" value={f.landmark} onChange={set('landmark')} placeholder="e.g. Near metro station" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City" htmlFor="a-city" error={errors.city}><TextInput id="a-city" autoComplete="address-level2" value={f.city} onChange={set('city')} aria-invalid={Boolean(errors.city)} /></FormField>
            <FormField label="PIN code" htmlFor="a-pin" error={errors.postalCode}><TextInput id="a-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value.replace(/\D/g, '') })} aria-invalid={Boolean(errors.postalCode)} /></FormField>
          </div>
          <FormField label="State" htmlFor="a-state" error={errors.state}>
            <SelectBox id="a-state" value={f.state} onChange={set('state')}>
              {['Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Other'].map((s) => <option key={s}>{s}</option>)}
            </SelectBox>
          </FormField>
        </section>

        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-3xl border border-line bg-surface px-4 sm:px-5">
          <span>
            <span className="block font-bold">Set as default address</span>
            <span className="text-[13px] text-muted">Used first at checkout</span>
          </span>
          <input type="checkbox" checked={f.isDefault} onChange={set('isDefault')} className="size-5 accent-[var(--color-brand-800)]" />
        </label>

        {existing ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mx-auto flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-danger hover:bg-danger-bg">
            <Trash2 className="size-4" aria-hidden /> Delete this address
          </button>
        ) : null}
      </form>

      {/* Phones: pinned save bar; desktop: inline */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Btn type="submit" form="address-form" block size="lg" loading={busy}>Save address</Btn>
      </div>
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
const METHODS: [string, string, string, LucideIcon, string][] = [
  ['upi', 'UPI', 'Pay using PhonePe, Google Pay, Paytm and more', Smartphone, 'bg-accent-50 text-accent-600'],
  ['card', 'Credit / Debit card', 'Visa, Mastercard, RuPay & more', CreditCard, 'bg-warning-bg text-warning'],
  ['netbanking', 'Net banking', 'All major banks', Landmark, 'bg-info-bg text-info'],
  ['wallet', 'Wallets', 'Paytm, Amazon Pay & more', WalletIcon, 'bg-danger-bg text-danger'],
  ['cod', 'Cash on delivery', 'Pay with cash at the time of delivery', Banknote, 'bg-success-bg text-success'],
];

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
  const [picked, setMethod] = useState<string>();
  const method = picked && allowed.includes(picked) ? picked : allowed.includes('cod') ? 'cod' : allowed[0] ?? 'cod';
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Amount of the order being paid: the server empties the cart when the order is created, so the
  // button must not fall back to the (now empty) cart total while Razorpay is open
  const [paying, setPaying] = useState<number | null>(null);
  // One key per checkout visit → double clicks and retries never create duplicate orders
  const idem = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  if (!addressId) return <Page narrow><EmptyState icon={<MapPin className="size-8" />} title="Choose an address first" action={<ButtonLink to="/checkout" className="w-full">Select address</ButtonLink>} /></Page>;

  const place = async () => {
    setBusy(true);
    try {
      const { data } = await shopApi.post('/store/me/orders', { addressId, paymentMethod: method, ...(note.trim() ? { instructions: note.trim() } : {}) }, { headers: { 'Idempotency-Key': idem } });
      const order = data.order as Order;
      setPaying(order.totals.grandTotal);
      // The order exists now: refresh cart + orders when we leave this page, not while paying
      const done = (to: string) => {
        qc.invalidateQueries({ queryKey: ['shop', 'cart'] });
        qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
        nav(to, { replace: true });
      };
      const rzp = data.razorpay as RazorpayStart | null;
      if (!rzp) return done(`/order-placed/${order._id}`);
      const result = await openRazorpay(rzp, order, { email: user?.email, phone: user?.phone });
      if (result === 'paid') return done(`/order-placed/${order._id}`);
      toast(result === 'unavailable' ? 'Couldn’t open the payment window. Your order is saved; complete payment from the order page.' : 'Payment not completed. Your order is saved; tap “Complete payment” on the order page to try again.');
      done(`/account/orders/${order._id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const total = money(paying ?? cart.data?.totals.grandTotal);
  if (paying == null && cart.data && !cart.data.items.length) {
    return (
      <Page narrow>
        <EmptyState
          icon={<ShoppingBag className="size-8" />}
          title="Nothing to pay for here"
          message="Your cart is empty. If you already placed an order, you can complete its payment from the order page."
          action={<ButtonLink to="/account/orders" className="w-full">Go to my orders</ButtonLink>}
        />
      </Page>
    );
  }
  return (
    <Page narrow className="pb-36 md:pb-16">
      <Steps at={2} />
      <h1 className="mb-5 hidden text-3xl font-extrabold tracking-[-0.02em] md:block">Payment</h1>
      {address ? (
        <Panel className="flex items-start gap-4 rounded-3xl p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-50 text-accent-600"><MapPin className="size-6" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">Deliver to {address.label}</span>
            <span className="mt-0.5 block text-sm text-muted">{address.recipient}, {oneLine(address)}</span>
            {address.phone ? <span className="tabular block text-sm text-muted">Mobile: {address.phone}</span> : null}
          </span>
          <Link to="/checkout" className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">Change</Link>
        </Panel>
      ) : null}

      <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">Choose payment method</h2>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success"><ShieldCheck className="size-4" aria-hidden /> 100% secure payments</span>
      </div>
      <div role="radiogroup" aria-label="Payment method" className="space-y-3">
        {METHODS.map(([v, label, sub, Icon, tint]) => {
          const ok = allowed.includes(v);
          const on = method === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!ok}
              onClick={() => setMethod(v)}
              className={cx('flex w-full items-center gap-4 rounded-3xl border bg-surface p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55', on ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-line enabled:hover:border-brand-700/50')}
            >
              <span className={cx('grid size-12 shrink-0 place-items-center rounded-2xl', tint)}><Icon className="size-6" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{label}</span>
                <span className="text-sm text-muted">{ok ? sub : 'Not available right now'}</span>
              </span>
              <span aria-hidden className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-brand-700' : 'border-line')}>
                {on ? <span className="size-3 rounded-full bg-brand-700" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <FormField label="Delivery instructions (optional)" htmlFor="note">
          <div className="relative">
            <MessageSquare className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <TextInput id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Call before delivery" className="pl-11" />
          </div>
        </FormField>
      </div>
      <div className="mt-6">{cart.data?.items.length ? <Bill totals={cart.data.totals} count={cartCount(cart.data)} /> : null}</div>

      {/* Phones: pinned to the bottom; desktop: inline */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Btn block size="lg" className="bg-accent-500 hover:bg-accent-600" loading={busy || paying != null} disabled={paying == null && !cart.data?.items.length} onClick={place}>
          {method === 'cod' ? `Place order · ${total}` : `Pay ${total}`} <ArrowRight className="size-5" />
        </Btn>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Lock className="size-3.5 shrink-0" aria-hidden /> Secure payments by Razorpay. VSR never stores your card details.
        </p>
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ Order placed
export function OrderPlacedPage() {
  const { id = '' } = useParams();
  const o = useOrder(id).data;
  const nav = useNavigate();
  // Celebrate briefly, then open the order (replace: Back must not return here)
  const [left, setLeft] = useState(3);
  useEffect(() => {
    if (left <= 0) {
      nav(`/account/orders/${id}`, { replace: true });
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, id, nav]);
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
          <ButtonLink to={`/account/orders/${id}`} replace>Track order</ButtonLink>
          <ButtonLink to="/" replace tone="ghost">Continue shopping</ButtonLink>
        </div>
        <p className="mt-4 text-sm text-muted" aria-live="polite">Opening your order in {left}s…</p>
      </div>
    </Page>
  );
}
