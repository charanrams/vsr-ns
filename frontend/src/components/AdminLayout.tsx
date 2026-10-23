import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu as MenuIcon, Search, Bell, CalendarDays, ChevronDown, LogOut, X, ShoppingBag, LifeBuoy, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NAV, ROLE_LABEL, primaryRole } from '../lib/access';
import { Avatar, cx } from './ui';

function useOrderCounts(enabled: boolean) {
  return useQuery({
    queryKey: ['order-counts'],
    queryFn: async () => (await api.get('/admin/orders', { params: { limit: 1 } })).data.counts as Record<string, number>,
    enabled,
    refetchInterval: 60_000,
  });
}

function Sidebar({ open, collapsed, onClose, onNavigate }: { open: boolean; collapsed: boolean; onClose: () => void; onNavigate: () => void }) {
  const { can } = useAuth();
  const loc = useLocation();
  const counts = useOrderCounts(can('orders')).data ?? {};
  const derived: Record<string, number> = {
    ...counts,
    processing: (counts.confirmed ?? 0) + (counts.picking ?? 0) + (counts.packed ?? 0) + (counts.assigned ?? 0),
    cancelled: (counts.cancelled ?? 0) + (counts.rejected ?? 0),
    returns: (counts.return_requested ?? 0) + (counts.returned ?? 0),
  };
  const items = NAV.filter((n) => can(n.perm));
  const current = loc.pathname + loc.search;
  // Which submenu is expanded. Driven by clicks only, so picking a sub-page collapses its group.
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-brand-900 text-white transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0',
        )}
        aria-label="Primary"
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <img src="/logo-mark.png" alt="" className="size-12 rounded-xl" />
          <div>
            <div className="text-[22px] leading-none font-extrabold tracking-tight">VSR</div>
            <div className="mt-1 text-[10.5px] text-white/70">Shop · Eat · Live Better</div>
          </div>
          <button className="ml-auto rounded-lg p-1.5 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map((n) => {
            const sectionActive = loc.pathname === n.to || loc.pathname.startsWith(n.to + '/');
            const Icon = n.icon;
            return (
              <div key={n.to}>
                <NavLink
                  to={n.to}
                  aria-expanded={n.children ? expanded === n.to : undefined}
                  onClick={(e) => {
                    if (n.children && expanded === n.to) {
                      e.preventDefault(); // second click on an open group just closes it
                      setExpanded(null);
                      return;
                    }
                    setExpanded(n.children ? n.to : null);
                    if (!n.children) onNavigate();
                  }}
                  className={cx(
                    'relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors',
                    sectionActive ? 'bg-white/12 text-white' : 'text-white/85 hover:bg-white/8 hover:text-white',
                  )}
                >
                  {sectionActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-accent-500" aria-hidden />}
                  <Icon size={18} aria-hidden />
                  <span className="flex-1">{n.label}</span>
                  {n.badgeKey && derived.placed > 0 && <span className="tabular rounded-full bg-accent-500/95 px-2 py-0.5 text-[11px] font-bold text-brand-950">{derived.placed}</span>}
                  {n.children && <ChevronDown size={15} className={cx('text-white/60 transition-transform duration-200', expanded === n.to && 'rotate-180')} aria-hidden />}
                </NavLink>
                {n.children && expanded === n.to && (
                  <div className="mt-0.5 mb-1 space-y-0.5 pl-6">
                    {n.children.map((c) => {
                      const active = current === c.to || (c.to === n.to && current === n.to);
                      return (
                        <Link
                          key={c.to}
                          to={c.to}
                          onClick={() => {
                            setExpanded(null);
                            onNavigate();
                          }}
                          aria-current={active ? 'page' : undefined}
                          className={cx('flex h-9 items-center justify-between rounded-lg px-3 text-[13px] transition-colors', active ? 'bg-white/14 font-semibold text-white' : 'text-white/75 hover:bg-white/8 hover:text-white')}
                        >
                          {c.label}
                          {c.countKey && derived[c.countKey] > 0 && <span className="tabular rounded-full bg-white/15 px-1.5 py-0.5 text-[11px]">{derived[c.countKey]}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ['search', q],
    queryFn: async () => (await api.get('/admin/search', { params: { q } })).data as { orders: { _id: string; orderNumber: string; status: string }[]; customers: { _id: string; name: string; email: string }[]; products: { _id: string; name: string; sku: string }[] },
    enabled: q.trim().length >= 2,
  });
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const go = (to: string) => {
    setOpen(false);
    setQ('');
    nav(to);
  };
  const has = data && (data.orders.length || data.customers.length || data.products.length);
  return (
    <div ref={ref} className="relative w-full max-w-[460px]">
      <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search orders, customers, products…"
        aria-label="Global search"
        className="h-11 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm placeholder:text-[#9aa29e] focus:border-brand-600 focus:ring-3 focus:ring-brand-100 focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <div className="animate-rise absolute top-12 z-40 w-full overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
          {!has && <p className="px-4 py-3 text-sm text-muted">No matches for “{q}”.</p>}
          {data?.orders.map((o) => <button key={o._id} onClick={() => go(`/admin/orders/${o._id}`)} className="block w-full px-4 py-2 text-left text-sm hover:bg-brand-50"><span className="text-muted">Order</span> #{o.orderNumber}</button>)}
          {data?.customers.map((c) => <button key={c._id} onClick={() => go(`/admin/customers?id=${c._id}`)} className="block w-full px-4 py-2 text-left text-sm hover:bg-brand-50"><span className="text-muted">Customer</span> {c.name}</button>)}
          {data?.products.map((p) => <button key={p._id} onClick={() => go(`/admin/products/${p._id}/edit`)} className="block w-full px-4 py-2 text-left text-sm hover:bg-brand-50"><span className="text-muted">Product</span> {p.name} · {p.sku}</button>)}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { can } = useAuth();
  const { data } = useQuery({
    queryKey: ['bell'],
    queryFn: async () => (await api.get('/admin/notifications')).data.bell as { newOrders: number; openTickets: number; pendingRefunds: number },
    refetchInterval: 60_000,
  });
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const rows = [
    can('orders') && { icon: ShoppingBag, label: 'New orders awaiting review', n: data?.newOrders ?? 0, to: '/admin/orders?status=placed' },
    can('support') && { icon: LifeBuoy, label: 'Open support tickets', n: data?.openTickets ?? 0, to: '/admin/support' },
    can('payments') && { icon: RotateCcw, label: 'Refunds awaiting action', n: data?.pendingRefunds ?? 0, to: '/admin/payments' },
  ].filter(Boolean) as { icon: typeof Bell; label: string; n: number; to: string }[];
  const total = rows.reduce((s, r) => s + (r.n > 0 ? 1 : 0), 0);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${total ? `, ${total} need attention` : ''}`} aria-expanded={open} className="relative grid size-11 place-items-center rounded-xl hover:bg-white">
        <Bell size={21} aria-hidden />
        {total > 0 && <span className="absolute top-1.5 right-1.5 grid size-[18px] place-items-center rounded-full bg-danger text-[10px] font-bold text-white">{total}</span>}
      </button>
      {open && (
        <div className="animate-rise absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <p className="border-b border-line px-4 py-2.5 text-sm font-bold">Needs attention</p>
          {rows.length === 0 && <p className="px-4 py-3 text-sm text-muted">You’re all caught up.</p>}
          {rows.map((r) => (
            <Link key={r.label} to={r.to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-50">
              <r.icon size={16} className="text-brand-700" aria-hidden />
              <span className="flex-1">{r.label}</span>
              <span className="tabular font-bold">{r.n}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 hover:bg-white">
        <Avatar src={user.avatar} name={user.name} size={40} />
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-bold">{user.name}</span>
          <span className="block text-xs text-muted">{ROLE_LABEL[primaryRole(user.roles)]}</span>
        </span>
        <ChevronDown size={16} className="text-muted" aria-hidden />
      </button>
      {open && (
        <div className="animate-rise absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              await logout();
              nav('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-bg"
          >
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vsr.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const setSidebar = (hidden: boolean) => {
    setCollapsed(hidden);
    try {
      localStorage.setItem('vsr.sidebar', hidden ? 'collapsed' : 'open');
    } catch {
      /* storage unavailable */
    }
  };
  const toggleCollapsed = () => setSidebar(!collapsed);
  // Picking a page hides the sidebar everywhere; the hamburger brings it back.
  const onNavigate = () => {
    setOpen(false);
    setSidebar(true);
  };
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Sidebar open={open} collapsed={collapsed} onClose={() => setOpen(false)} onNavigate={onNavigate} />
      <div className={cx('transition-[padding] duration-300', collapsed ? 'lg:pl-0' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-line/70 bg-cream/92 px-4 backdrop-blur-sm sm:px-6">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-white lg:hidden" aria-label="Open menu"><MenuIcon size={22} /></button>
          <button onClick={toggleCollapsed} className="hidden size-10 place-items-center rounded-lg hover:bg-white lg:grid" aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'} aria-expanded={!collapsed}><MenuIcon size={22} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[13px] font-medium md:flex">
              <CalendarDays size={16} className="text-brand-700" aria-hidden /> Today {today}
            </span>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="w-full px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
