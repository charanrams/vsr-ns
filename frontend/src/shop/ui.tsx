import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Bell, BellRing, ChevronRight, Heart, ImageOff, Loader2, Minus, PackageSearch, Plus, ShoppingCart, Star, WifiOff, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { money, title as titleCase } from '../lib/format';
import { errMsg, isOffline } from './api';
import { useShopAuth } from './auth';
import { useQueryClient } from '@tanstack/react-query';
import { shopApi } from './api';
import { cartCount, catName, hasSizes, img, outOfStock, pct, qtyOf, useCart, useCartActions, useStockAlerts, useWishlist, type Product, type Totals } from './data';

export const cx = clsx;

// ------------------------------------------------------------------ Controls
type BtnTone = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export function Btn({
  tone = 'primary',
  size = 'md',
  loading,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone; size?: 'sm' | 'md' | 'lg'; loading?: boolean; block?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'lg' && 'h-13 px-6 text-base',
        block && 'w-full',
        tone === 'primary' && 'bg-brand-900 text-white hover:bg-brand-800',
        tone === 'accent' && 'bg-accent-500 text-white hover:bg-accent-600',
        tone === 'outline' && 'border border-line bg-surface text-ink hover:border-brand-700 hover:text-brand-700',
        tone === 'ghost' && 'text-brand-700 hover:bg-brand-50',
        tone === 'danger' && 'border border-danger/40 bg-surface text-danger hover:bg-danger-bg',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ to, tone = 'primary', className, children }: { to: string; tone?: BtnTone; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors',
        tone === 'primary' && 'bg-brand-900 text-white hover:bg-brand-800',
        tone === 'accent' && 'bg-accent-500 text-white hover:bg-accent-600',
        tone === 'outline' && 'border border-line bg-surface text-ink hover:border-brand-700 hover:text-brand-700',
        tone === 'ghost' && 'text-brand-700 hover:bg-brand-50',
        className,
      )}
    >
      {children}
    </Link>
  );
}

const control =
  'w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 disabled:opacity-60 aria-[invalid=true]:border-danger';
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cx(control, 'h-12', className)} {...p} />);
TextInput.displayName = 'TextInput';
export const TextArea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(control, 'min-h-28 py-3', className)} {...p} />;
export const SelectBox = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx(control, 'h-12 appearance-none', className)} {...p}>
    {children}
  </select>
);
export function FormField({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ Layout pieces
export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx('mx-auto w-full px-4 pb-16 pt-4 sm:px-6 lg:px-8', narrow ? 'max-w-3xl' : 'max-w-7xl', className)}>{children}</div>;
}
export function PageTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div>
        {/* Phones show this heading in the top bar; keep it here for desktop and screen readers */}
        <h1 className="sr-only text-2xl font-extrabold tracking-[-0.02em] text-ink md:not-sr-only md:text-[28px]">{children}</h1>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function SectionHead({ title, sub, to, action = 'See all' }: { title: string; sub?: string; to?: string; action?: string }) {
  return (
    // Tighter rhythm on phones; roomier on larger screens
    <div className="mb-2.5 mt-5 flex items-center justify-between gap-3 sm:mb-4 sm:mt-10">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-[-0.01em] sm:text-xl">{title}</h2>
        {sub ? <p className="mt-0.5 truncate text-[13px] text-muted sm:text-sm">{sub}</p> : null}
      </div>
      {to ? (
        // 44px tap target that overlaps the gap above/below instead of making the title row taller
        <Link to={to} className="-my-3 -mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50">
          {action} <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>;
}

// ------------------------------------------------------------------ States
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-line motion-reduce:animate-none', className)} />;
}
export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-label="Loading" role="status">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-3 h-4 w-4/5" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-4 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
export function SkeletonList({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading" role="status">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-14 text-center">
      <div className="grid size-18 place-items-center rounded-full bg-brand-50 text-brand-700">{icon ?? <PackageSearch className="size-8" aria-hidden />}</div>
      <h2 className="mt-6 text-xl font-extrabold">{title}</h2>
      {message ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{message}</p> : null}
      {action ? <div className="mt-6 w-full">{action}</div> : null}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const off = isOffline(error);
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-14 text-center" role="alert">
      <div className={cx('grid size-18 place-items-center rounded-full', off ? 'bg-warning-bg text-warning' : 'bg-danger-bg text-danger')}>
        {off ? <WifiOff className="size-8" aria-hidden /> : <AlertTriangle className="size-8" aria-hidden />}
      </div>
      <h2 className="mt-6 text-xl font-extrabold">{off ? 'You’re offline' : 'Something went wrong'}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{errMsg(error)}</p>
      {onRetry ? (
        <Btn className="mt-6" block onClick={onRetry}>
          Retry
        </Btn>
      ) : null}
    </div>
  );
}
/** Loading → skeleton, error → retry, empty → empty state, otherwise children. */
export function View<T>({ q, empty, skeleton, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; empty?: (d: T) => ReactNode | null; skeleton?: ReactNode; children: (d: T) => ReactNode }) {
  if (q.isLoading) return <>{skeleton ?? <SkeletonList />}</>;
  if (q.isError && q.data === undefined) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined) return null;
  const e = empty?.(q.data);
  return <>{e ?? children(q.data)}</>;
}

// ------------------------------------------------------------------ Commerce pieces
export function Price({ price, mrp, big }: { price: number; mrp: number; big?: boolean }) {
  const off = pct(price, mrp);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cx('tabular font-extrabold text-ink', big ? 'text-2xl sm:text-[28px]' : 'text-[15px]')}>{money(price)}</span>
      {off > 0 ? <span className={cx('tabular text-muted line-through', big ? 'text-base' : 'text-[13px]')}>{money(mrp)}</span> : null}
      {off > 0 && big ? <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-bold text-success">{off}% OFF</span> : null}
    </div>
  );
}

export function Stepper({ qty, onChange, max = 50, busy, size = 'md', label }: { qty: number; onChange: (q: number) => void; max?: number; busy?: boolean; size?: 'sm' | 'md'; label: string }) {
  const s = size === 'sm' ? 'size-9' : 'size-11';
  return (
    <div className="inline-flex items-center rounded-xl border border-brand-700/40 bg-surface" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" className={cx(s, 'grid place-items-center rounded-l-xl text-brand-700 hover:bg-brand-50 disabled:opacity-40')} disabled={busy || qty <= 0} onClick={() => onChange(qty - 1)} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <span className="tabular grid min-w-8 place-items-center text-sm font-bold" aria-live="polite">
        {busy ? <Loader2 className="size-4 animate-spin" aria-label="Updating" /> : qty}
      </span>
      <button type="button" className={cx(s, 'grid place-items-center rounded-r-xl text-brand-700 hover:bg-brand-50 disabled:opacity-40')} disabled={busy || qty >= max} onClick={() => onChange(qty + 1)} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Guests → login (and back). Sized products → product page to pick a size. Otherwise add / stepper. */
export function useRequireLogin() {
  const { user } = useShopAuth();
  const nav = useNavigate();
  const loc = useLocation();
  return (reason: string) => {
    if (user) return true;
    toast(reason);
    nav('/login', { state: { from: loc.pathname + loc.search } });
    return false;
  };
}

export function AddToCart({ product, size = 'sm' }: { product: Product; size?: 'sm' | 'md' }) {
  const cart = useCart().data;
  const { setQty } = useCartActions();
  const need = useRequireLogin();
  const nav = useNavigate();
  const qty = qtyOf(cart, product._id);
  const busy = setQty.isPending && setQty.variables?.productId === product._id;
  const set = (q: number) => {
    if (!need('Log in to add items to your cart')) return;
    setQty.mutate({ productId: product._id, quantity: q }, { onError: (e) => toast.error(errMsg(e)) });
  };
  const h = size === 'sm' ? 'h-9 text-sm' : 'h-11 text-sm';
  if (outOfStock(product)) return <span className="text-[13px] font-semibold text-danger">Out of stock</span>;
  if (hasSizes(product))
    return (
      <button type="button" onClick={() => nav(`/product/${product._id}`)} className={cx(h, 'rounded-xl border border-brand-700/50 px-3 font-bold text-brand-700 hover:bg-brand-50')} aria-label={`Choose a size of ${product.name}`}>
        {qty > 0 ? `${qty} in cart` : `${product.variants!.length} sizes`}
      </button>
    );
  if (qty === 0)
    return (
      <button type="button" disabled={busy} onClick={() => set(1)} className={cx(h, 'min-w-16 rounded-xl border border-brand-700/50 px-4 font-bold text-brand-700 hover:bg-brand-900 hover:text-white disabled:opacity-60')} aria-label={`Add ${product.name} to cart`}>
        {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Add'}
      </button>
    );
  return <Stepper qty={qty} busy={busy} size={size} onChange={set} max={Math.max(1, Math.min(50, product.available))} label={product.name} />;
}

export function ProductImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className={cx('object-cover', className)} onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
  ) : (
    <div className={cx('grid place-items-center bg-line-soft text-muted', className)}>
      <ImageOff className="size-6" aria-hidden />
    </div>
  );
}

/** Wishlist heart on cards: one tap for customers, login prompt for guests. */
function WishHeart({ p }: { p: Product }) {
  const wished = useWishlist().data?.some((w) => w._id === p._id) ?? false;
  const need = useRequireLogin();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!need('Log in to save items to your wishlist')) return;
    setBusy(true);
    try {
      const { data } = await shopApi.post(`/store/me/wishlist/${p._id}`);
      await qc.invalidateQueries({ queryKey: ['shop', 'wishlist'] });
      toast.success(data.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={wished}
      aria-label={wished ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}
      className="grid size-10 place-items-center rounded-full bg-white/95 shadow-[0_2px_8px_rgb(0_0_0/0.12)] transition-transform hover:scale-105 disabled:opacity-60"
    >
      <Heart className={cx('size-[18px]', wished ? 'fill-danger text-danger' : 'text-[#202923]')} />
    </button>
  );
}

/** "Notify Me" for out-of-stock products: one tap to ask, tap again to cancel. Guests are asked to log in. */
export function NotifyMe({ p, className }: { p: Product; className?: string }) {
  const alerts = useStockAlerts().data ?? [];
  const on = alerts.includes(p._id);
  const need = useRequireLogin();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!need('Log in to get back-in-stock alerts')) return;
    setBusy(true);
    try {
      if (on) await shopApi.delete(`/store/me/stock-alerts/${p._id}`);
      else await shopApi.post(`/store/me/stock-alerts/${p._id}`);
      await qc.invalidateQueries({ queryKey: ['shop', 'stock-alerts'] });
      toast.success(on ? 'Alert cancelled' : 'We’ll notify you when it’s back in stock');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      className={cx(
        'flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors disabled:opacity-60',
        on ? 'border-brand-700/40 bg-brand-50 text-brand-700' : 'border-accent-500 bg-surface text-accent-600 hover:bg-accent-50 dark:text-accent-500',
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : on ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
      {on ? 'We’ll notify you' : 'Notify Me'}
    </button>
  );
}

/** Full-width card action: Add to Cart → quantity stepper; sized products open the product; out of stock is disabled. */
function CardAction({ p }: { p: Product }) {
  const cart = useCart().data;
  const { setQty } = useCartActions();
  const need = useRequireLogin();
  const nav = useNavigate();
  const qty = qtyOf(cart, p._id);
  const busy = setQty.isPending && setQty.variables?.productId === p._id;
  const set = (q: number) => {
    if (!need('Log in to add items to your cart')) return;
    setQty.mutate({ productId: p._id, quantity: q }, { onError: (e) => toast.error(errMsg(e)) });
  };
  const base = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold';
  if (outOfStock(p)) return <NotifyMe p={p} />;
  if (hasSizes(p))
    return (
      <button type="button" onClick={() => nav(`/product/${p._id}`)} className={cx(base, 'bg-accent-500 text-white hover:bg-accent-600')} aria-label={`Choose a size of ${p.name}`}>
        <ShoppingCart className="size-4" aria-hidden /> {qty > 0 ? `${qty} in cart` : 'Choose size'}
      </button>
    );
  if (qty > 0)
    return (
      <div className="flex h-11 items-center justify-between rounded-xl bg-accent-500 text-white" role="group" aria-label={`Quantity of ${p.name}`}>
        <button type="button" onClick={() => set(qty - 1)} disabled={busy} className="grid h-full w-12 place-items-center rounded-l-xl hover:bg-accent-600" aria-label="Decrease quantity"><Minus className="size-4" /></button>
        <span className="tabular text-sm font-extrabold" aria-live="polite">{busy ? <Loader2 className="size-4 animate-spin" aria-label="Updating" /> : qty}</span>
        <button type="button" onClick={() => set(qty + 1)} disabled={busy || qty >= Math.min(50, p.available)} className="grid h-full w-12 place-items-center rounded-r-xl hover:bg-accent-600 disabled:opacity-50" aria-label="Increase quantity"><Plus className="size-4" /></button>
      </div>
    );
  return (
    <button type="button" onClick={() => set(1)} disabled={busy} className={cx(base, 'bg-accent-500 text-white shadow-[0_6px_14px_-6px_rgb(245_130_32/0.7)] hover:bg-accent-600 disabled:opacity-70')} aria-label={`Add ${p.name} to cart`}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />} Add to Cart
    </button>
  );
}

const reviewsText = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K reviews` : `${n} review${n === 1 ? '' : 's'}`);

export function ProductCard({ p }: { p: Product }) {
  const off = pct(p.price, p.mrp);
  const detail = p.shortDescription?.trim() || [p.unit, p.brand].filter(Boolean).join(' · ') || catName(p);
  return (
    <article className="group relative flex h-full flex-col rounded-[20px] border border-line bg-surface p-3 shadow-[0_4px_14px_-8px_rgb(0_0_0/0.12)] transition-shadow hover:shadow-[0_12px_28px_-14px_rgb(11_61_46/0.3)]">
      <Link to={`/product/${p._id}`} className="absolute inset-0 z-0 rounded-[20px]" aria-label={p.name} />
      <div className="relative overflow-hidden rounded-2xl bg-line-soft">
        <ProductImage src={img(p)} alt="" className="aspect-[1.05] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {off > 0 ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-[#ff4d1f] px-2 py-1 text-xs font-extrabold text-white shadow-[0_2px_6px_rgb(255_77_31/0.4)]">
            <Zap className="size-3.5 fill-white" aria-hidden /> {off}% OFF
          </span>
        ) : null}
        <div className="absolute right-2.5 top-2.5 z-10">
          <WishHeart p={p} />
        </div>
      </div>
      <h3 className="mt-3 truncate text-[15px] font-bold leading-snug text-ink">{p.name}</h3>
      {detail ? <p className="mt-0.5 truncate text-[13px] text-muted">{detail}</p> : null}
      {/* Real ratings only; products without reviews say "New" */}
      {(p.reviewCount ?? 0) > 0 ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" aria-label={`Rated ${p.rating} out of 5 from ${p.reviewCount} reviews`}>
          <Star className="size-4 fill-[#f59e0b] text-[#f59e0b]" aria-hidden />
          <span className="font-bold text-ink">{(p.rating ?? 0).toFixed(1)}</span>
          <span className="h-3 w-px bg-line" aria-hidden />
          <span className="truncate text-muted">{reviewsText(p.reviewCount ?? 0)}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] font-bold text-brand-700">New</p>
      )}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tabular text-lg font-extrabold text-ink">{money(p.price)}</span>
        {off > 0 ? <span className="tabular text-[13px] text-muted line-through">{money(p.mrp)}</span> : null}
        {outOfStock(p) ? <span className="ml-auto rounded-md bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">Out of stock</span> : null}
      </div>
      <div className="relative z-10 mt-auto pt-3">
        <CardAction p={p} />
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((p) => (
        <ProductCard key={p._id} p={p} />
      ))}
    </div>
  );
}

/** Horizontal swipe rail on phones and tablets; a single row on desktop. */
export function ProductRail({ items }: { items: Product[] }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 xl:grid-cols-5">
      {items.slice(0, 10).map((p, i) => (
        // Desktop: exactly one line (4 on laptops, 5 on wide screens); "See all" opens the rest
        <div key={p._id} className={cx('w-[62%] shrink-0 snap-start sm:w-[38%] md:w-[31%] lg:w-auto', i >= 4 && 'lg:hidden', i === 4 && 'xl:block')}>
          <ProductCard p={p} />
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  placed: ['Placed', 'warning'],
  confirmed: ['Confirmed', 'success'],
  picking: ['Preparing', 'warning'],
  packed: ['Packed', 'warning'],
  assigned: ['Out for Delivery', 'info'],
  out_for_delivery: ['Out for Delivery', 'info'],
  delivered: ['Delivered', 'success'],
  cancelled: ['Cancelled', 'danger'],
  rejected: ['Rejected', 'danger'],
  delivery_failed: ['Delivery failed', 'danger'],
  paid: ['Paid', 'success'],
  pending: ['Pending', 'warning'],
  failed: ['Failed', 'danger'],
  refund_pending: ['Refund Pending', 'warning'],
  refunded: ['Refunded', 'success'],
  open: ['Open', 'danger'],
  resolved: ['Resolved', 'success'],
  default: ['Default', 'success'],
};
export function StatusPill({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [titleCase(status), 'warning'];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        tone === 'success' && 'bg-success-bg text-success',
        tone === 'warning' && 'bg-warning-bg text-warning',
        tone === 'danger' && 'bg-danger-bg text-danger',
        tone === 'info' && 'bg-info-bg text-info',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function Bill({ totals, count }: { totals: Totals; count?: number }) {
  const row = (label: string, value: string, cls?: string) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cx('tabular font-medium', cls)}>{value}</span>
    </div>
  );
  return (
    <Panel className="p-5">
      <h2 className="mb-2 text-base font-extrabold">Bill details</h2>
      {row(`Item total${count ? ` (${count} item${count === 1 ? '' : 's'})` : ''}`, money(totals.itemTotal))}
      {totals.discount > 0 ? row(`Discount${totals.couponCode ? ` (${totals.couponCode})` : ''}`, `−${money(totals.discount)}`, 'text-success') : null}
      {row('Delivery fee', totals.deliveryFee === 0 ? 'FREE' : money(totals.deliveryFee), totals.deliveryFee === 0 ? 'text-success' : undefined)}
      {row('Packaging fee', money(totals.packagingFee))}
      {row('GST (included)', money(totals.tax))}
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-extrabold">Total</span>
        <span className="tabular text-lg font-extrabold">{money(totals.grandTotal)}</span>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ Sheet (bottom sheet on phones, dialog on desktop)
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/45 sm:m-auto sm:max-w-lg sm:rounded-3xl"
      aria-label={title}
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-muted hover:bg-line-soft" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}

export { cartCount };
