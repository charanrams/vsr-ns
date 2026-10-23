import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertTriangle, Inbox, X, ImageOff, ArrowUp, ArrowDown, Search, RotateCw } from 'lucide-react';
import { title as titleCase } from '../lib/format';

export const cx = clsx;

// ---------------- Layout ----------------
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cx('rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action, className, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ crumbs, title, sub, actions }: { crumbs: { label: string; to?: string }[]; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-[13px] text-muted">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={13} aria-hidden />}
              {c.to ? <Link to={c.to} className="hover:text-brand-700">{c.label}</Link> : <span className={i === 0 ? 'text-ink' : ''}>{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

// ---------------- Controls ----------------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'outline-brand';
export function Button({
  variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-brand-900 text-white hover:bg-brand-800',
        variant === 'secondary' && 'border border-line bg-white text-ink hover:border-brand-600/40 hover:bg-brand-50',
        variant === 'outline-brand' && 'border border-brand-700 bg-white text-brand-800 hover:bg-brand-50',
        variant === 'ghost' && 'text-ink hover:bg-line-soft',
        variant === 'danger' && 'bg-danger text-white hover:bg-[#b02f25]',
        variant === 'danger-soft' && 'border border-danger/30 bg-danger-bg text-danger hover:bg-[#fbd9d5]',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, tone = 'default', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid size-9 shrink-0 place-items-center rounded-[9px] border border-line bg-white transition-colors hover:bg-brand-50 disabled:opacity-50',
        tone === 'danger' ? 'text-danger hover:bg-danger-bg' : 'text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const control = 'w-full rounded-[10px] border border-line bg-white px-3 text-sm text-ink placeholder:text-[#9aa29e] transition-colors hover:border-[#d9d1c3] focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-line-soft disabled:text-muted aria-[invalid=true]:border-danger';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(control, 'h-10', className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(control, 'min-h-20 py-2.5', className)} {...p} />;
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(control, 'h-10 appearance-none pr-8')} {...p}>{children}</select>
      <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => v !== value && onChange(v), 300);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={cx(control, 'h-10 pl-9')} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5">
      <span className={cx('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand-700' : 'bg-[#d6d0c4]')}>
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </span>
      <span className="text-sm font-medium">{checked ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('inline-flex flex-wrap gap-1 rounded-[11px] border border-line bg-white p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('h-8 rounded-[8px] px-3.5 text-[13px] font-semibold transition-colors', value === it.value ? 'bg-brand-900 text-white' : 'text-ink hover:bg-brand-50')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((it) => (
        <button
          key={it.value}
          aria-pressed={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors', value === it.value ? 'border-brand-900 bg-brand-900 text-white' : 'border-line bg-white hover:border-brand-600/40')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Display ----------------
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral' | 'accent' | 'brand';
const toneCls: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  violet: 'bg-violet-bg text-violet',
  neutral: 'bg-line-soft text-muted',
  accent: 'bg-accent-100 text-accent-600',
  brand: 'bg-brand-50 text-brand-700',
};
export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  placed: 'accent', new: 'accent', confirmed: 'success', picking: 'warning', preparing: 'warning', packed: 'violet', assigned: 'info',
  out_for_delivery: 'info', delivered: 'success', rejected: 'danger', cancelled: 'danger', return_requested: 'warning', returned: 'neutral', delivery_failed: 'danger',
  active: 'success', inactive: 'danger', draft: 'neutral', archived: 'neutral', blocked: 'danger', scheduled: 'warning', expired: 'neutral',
  paid: 'success', successful: 'success', pending: 'warning', failed: 'danger', refunded: 'accent', refund_pending: 'warning', partially_refunded: 'accent', processed: 'success',
  in_stock: 'success', low_stock: 'warning', out_of_stock: 'danger',
  open: 'danger', in_progress: 'warning', resolved: 'success', closed: 'neutral',
  high: 'danger', medium: 'warning', low: 'success',
  online: 'success', on_delivery: 'info', offline: 'neutral', verified: 'success',
};
const STATUS_LABEL: Record<string, string> = { placed: 'New', paid: 'Paid', refund_pending: 'Refund Pending', out_for_delivery: 'Out for Delivery', picking: 'Preparing' };
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>{label ?? STATUS_LABEL[status] ?? titleCase(status)}</Badge>;
}

export function StatCard({ icon, tone, label, value, delta, deltaLabel, invertDelta }: { icon: ReactNode; tone: 'brand' | 'accent' | 'info' | 'danger' | 'violet' | 'warning'; label: string; value: ReactNode; delta?: number; deltaLabel?: string; invertDelta?: boolean }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', accent: 'bg-accent-50 text-accent-600', info: 'bg-info-bg text-info', danger: 'bg-danger-bg text-danger', violet: 'bg-violet-bg text-violet', warning: 'bg-warning-bg text-warning' };
  const good = delta === undefined ? true : invertDelta ? delta <= 0 : delta >= 0;
  return (
    <Card className="flex items-start gap-3.5 p-4">
      <span className={cx('grid size-12 shrink-0 place-items-center rounded-xl', tones[tone])} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[13px] text-muted">{label}</p>
        <p className="tabular mt-0.5 text-[22px] leading-tight font-extrabold text-ink">{value}</p>
        {(delta !== undefined || deltaLabel) && (
          <p className={cx('mt-1 flex flex-wrap items-center gap-x-1 text-xs font-medium whitespace-nowrap', delta === undefined ? 'text-muted' : good ? 'text-success' : 'text-danger')}>
            {delta !== undefined && (delta >= 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
            {delta !== undefined && <span className="tabular">{Math.abs(delta)}%</span>}
            <span className={delta !== undefined ? 'text-muted' : ''}>{deltaLabel}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

export function Img({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span className={cx('grid place-items-center bg-line-soft text-muted', className)} role="img" aria-label={alt}>
        <ImageOff size={16} aria-hidden />
      </span>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} className={cx('object-cover', className)} />;
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return src && !err ? (
    <img src={src} alt="" onError={() => setErr(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800" aria-hidden>{initials}</span>
  );
}

// ---------------- Tables ----------------
export function Table({ head, children, minWidth = 860 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left text-[13px]" style={{ minWidth }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="border-y border-line bg-[#faf8f3] px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr>td]:whitespace-nowrap [&>tr>td]:border-b [&>tr>td]:border-line-soft [&>tr>td]:px-3 [&>tr>td]:py-2.5 [&>tr:hover>td]:bg-[#fcfbf7]">{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, limit, onPage, onLimit, noun }: { page: number; total: number; limit: number; onPage: (p: number) => void; onLimit?: (l: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i <= 5 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-muted">
      <span className="tabular">Showing {from}–{to} of {total.toLocaleString('en-IN')} {noun}</span>
      <div className="flex items-center gap-1.5">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /></IconButton>
        {nums.map((n, i) =>
          n === '…' ? <span key={`e${i}`} className="px-1">…</span> : (
            <button key={n} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={cx('tabular h-9 min-w-9 rounded-[9px] border px-2 text-[13px] font-semibold', n === page ? 'border-brand-900 bg-brand-900 text-white' : 'border-line bg-white text-ink hover:bg-brand-50')}>{n}</button>
          ),
        )}
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={15} /></IconButton>
        {onLimit && (
          <Select aria-label="Rows per page" value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="ml-1 w-[118px]">
            {[5, 8, 10, 20, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </Select>
        )}
      </div>
    </div>
  );
}

// ---------------- States ----------------
export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('grid place-items-center gap-2 py-14 text-sm text-muted', className)}>
      <Loader2 className="animate-spin text-brand-700" aria-hidden />
      {label}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-line-soft', className)} aria-hidden />;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="grid place-items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-danger-bg text-danger"><AlertTriangle size={20} aria-hidden /></span>
      <p className="max-w-sm text-sm text-ink">{message}</p>
      {onRetry && <Button size="sm" icon={<RotateCw size={14} />} onClick={onRetry}>Retry</Button>}
    </div>
  );
}
export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700"><Inbox size={20} aria-hidden /></span>
      <p className="text-sm font-semibold">{title}</p>
      {sub && <p className="max-w-sm text-[13px] text-muted">{sub}</p>}
      {action}
    </div>
  );
}

/** Render query state uniformly: loading → error → empty → content. */
export function QueryState<T>({ q, empty, children, loading }: { q: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; empty?: (d: T) => boolean; children: (d: T) => ReactNode; loading?: ReactNode }) {
  if (q.isLoading) return <>{loading ?? <Loading />}</>;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  if (empty?.(q.data)) return <Empty title="Nothing here yet" sub="Try changing your filters." />;
  return <>{children(q.data)}</>;
}
function errorText(e: unknown) {
  const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; code?: string };
  if (err?.response?.status === 403) return 'You don’t have permission to view this.';
  if (err?.code === 'ERR_NETWORK') return 'Can’t reach the server. Check your connection.';
  return err?.response?.data?.error?.message ?? 'Couldn’t load this data.';
}

// ---------------- Overlays ----------------
export function Dialog({ open, onClose, title, children, footer, width = 480 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
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
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      className="m-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-[#0b3d2e]/35"
    >
      {open && (
        <div className="animate-rise">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-bold">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="border-transparent"><X size={16} /></IconButton>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Panel({ title, onClose, children, actions }: { title: ReactNode; onClose?: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card className="animate-slide-in self-start xl:sticky xl:top-[84px]">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="text-base font-bold">{title}</h2>
        <div className="flex items-center gap-1">
          {actions}
          {onClose && <IconButton label="Close panel" onClick={onClose} className="border-transparent"><X size={16} /></IconButton>}
        </div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}

export function Menu({ items, label = 'More actions' }: { items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="text-base leading-none tracking-wider">···</span>
      </IconButton>
      {open && (
        <div role="menu" className="animate-rise absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cx('block w-full px-3.5 py-2 text-left text-[13px] hover:bg-brand-50 disabled:opacity-50', it.danger && 'text-danger hover:bg-danger-bg')}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ color, label, value }: { color: string; label: string; value?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-2 text-ink"><span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />{label}</span>
      {value !== undefined && <span className="tabular text-muted">{value}</span>}
    </li>
  );
}

export function KV({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 py-1.5 text-[13px]', className)}>
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium text-ink">{v}</span>
    </div>
  );
}

/** Compact range picker used in chart card headers; the value is sent to the API. */
export function RangeSelect<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-line bg-white pr-7 pl-2.5 text-xs font-medium text-ink hover:border-brand-600/40 focus:border-brand-600 focus:outline-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}
