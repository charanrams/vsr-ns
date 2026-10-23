import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronDown, Grid2x2, Home, MapPin, Receipt, Search, ShoppingBag, User } from 'lucide-react';
import { money } from '../lib/format';
import { useShopAuth } from './auth';
import { cartCount, img, useAddresses, useCart, useNotifications, shortLine } from './data';
import { cx, ProductImage } from './ui';

// ------------------------------------------------------------------ Theme (System / Light / Dark), per browser
export type ThemeMode = 'system' | 'light' | 'dark';
const ThemeCtx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: 'system', setMode: () => undefined });
export const useShopTheme = () => useContext(ThemeCtx);
function useThemeState() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem('vsr.shop.theme') as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  });
  const [osDark, setOsDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem('vsr.shop.theme', m);
    } catch {
      /* storage blocked */
    }
  };
  const dark = mode === 'dark' || (mode === 'system' && osDark);
  return { mode, setMode, dark };
}

/** Theme wrapper shared by the storefront and the public marketing pages. */
export function ShopShell({ children }: { children: ReactNode }) {
  const t = useThemeState();
  useEffect(() => {
    // Page background behind overscroll matches the theme
    document.documentElement.style.background = t.dark ? '#0b0b0c' : '';
    document.body.style.background = t.dark ? '#0b0b0c' : '';
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, [t.dark]);
  return (
    <ThemeCtx.Provider value={{ mode: t.mode, setMode: t.setMode }}>
      <div className={cx('shop', t.dark && 'dark')}>{children}</div>
    </ThemeCtx.Provider>
  );
}

// ------------------------------------------------------------------ Header pieces
function Logo() {
  return (
    // Phones show the app-style header (location + bell) without the logo; Home is in the bottom tabs
    <Link to="/" className="hidden shrink-0 items-center gap-2 rounded-lg md:flex" aria-label="VSR home">
      <img src="/logo-mark.png" alt="" className="size-9 rounded-lg object-contain" />
      <span className="hidden text-lg font-extrabold tracking-[-0.02em] text-ink sm:inline">VSR</span>
    </Link>
  );
}

function DeliverTo({ className }: { className?: string }) {
  const { user } = useShopAuth();
  const addr = useAddresses().data;
  const def = addr?.find((a) => a.isDefault) ?? addr?.[0];
  return (
    <Link to={user ? '/account/addresses' : '/login'} className={cx("flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 hover:bg-line-soft transition-colors", className)}>
      <MapPin className="size-5 shrink-0 text-accent-500" aria-hidden />
      <span className="min-w-0">
        <span className="flex items-center gap-0.5 text-base font-extrabold leading-tight text-ink">
          {def?.label ?? 'Home'} <ChevronDown className="size-4 text-ink" aria-hidden />
        </span>
        <span className="block max-w-[12rem] truncate text-xs text-muted sm:max-w-[15rem]">
          {def ? shortLine(def) : 'Add delivery address'}
        </span>
      </span>
    </Link>
  );
}

export function SearchBox({ className, pill }: { className?: string; pill?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(q.trim().length >= 2 ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  };
  return (
    <form role="search" onSubmit={submit} className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => loc.pathname !== '/search' && nav('/search' + (q ? `?q=${encodeURIComponent(q)}` : ''))}
        type="search"
        placeholder='Search for "biryani", "milk"…'
        aria-label="Search products"
        className={cx(
          'h-11 w-full text-[15px] text-ink placeholder:text-muted focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 transition-all',
          pill
            ? 'rounded-full border border-line/40 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] pl-12 pr-4 text-[#202923] placeholder:text-[#7A837E]'
            : 'rounded-xl border border-line bg-surface pl-11 pr-4'
        )}
      />
    </form>
  );
}

function IconLink({ to, label, badge, children }: { to: string; label: string; badge?: number; children: ReactNode }) {
  return (
    <Link to={to} aria-label={badge ? `${label}, ${badge}` : label} className="relative grid size-11 place-items-center rounded-xl text-ink hover:bg-line-soft">
      {children}
      {badge ? <span className="tabular absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-[18px] text-white">{badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );
}

// ------------------------------------------------------------------ Layout
const TABS = [
  { to: '/categories', label: 'Categories', icon: Grid2x2 },
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/account/orders', label: 'Orders', icon: Receipt },
  { to: '/account', label: 'Profile', icon: User, end: true },
];

/** Phone top-bar heading for each storefront route (Home has its own header). */
function pageTitle(path: string, search: string) {
  const q = new URLSearchParams(search);
  const rules: [RegExp, string | (() => string)][] = [
    [/^\/categories$/, 'Categories'],
    [/^\/category\//, () => q.get('name') ?? 'Products'],
    [/^\/products$/, () => q.get('title') ?? 'Products'],
    [/^\/product\/[^/]+\/reviews$/, 'Ratings & reviews'],
    [/^\/product\/[^/]+\/review$/, 'Write a review'],
    [/^\/product\//, 'Product details'],
    [/^\/search$/, 'Search'],
    [/^\/deals$/, 'Offers & deals'],
    [/^\/campaign\//, 'Offer'],
    [/^\/recommended$/, 'Recommended for you'],
    [/^\/recently-viewed$/, 'Recently viewed'],
    [/^\/cart$/, 'My cart'],
    [/^\/checkout$/, 'Delivery address'],
    [/^\/checkout\/payment$/, 'Payment'],
    [/^\/order-placed\//, 'Order placed'],
    [/^\/account$/, 'Profile'],
    [/^\/account\/edit$/, 'Edit profile'],
    [/^\/account\/orders$/, 'My orders'],
    [/^\/account\/orders\/[^/]+\/rate$/, 'Rate order'],
    [/^\/account\/orders\//, 'Order details'],
    [/^\/account\/addresses$/, 'My addresses'],
    [/^\/account\/addresses\/new$/, 'Add address'],
    [/^\/account\/addresses\//, 'Edit address'],
    [/^\/account\/wishlist$/, 'My wishlist'],
    [/^\/account\/coupons$/, 'Offers & coupons'],
    [/^\/account\/notifications$/, 'Notifications'],
    [/^\/account\/notifications\//, 'Notification'],
    [/^\/account\/help$/, 'Help & support'],
    [/^\/account\/settings$/, 'Settings & legal'],
    [/^\/about$/, 'About VSR'],
    [/^\/contact$/, 'Contact us'],
    [/^\/faq$/, 'FAQs'],
    [/^\/terms$/, 'Terms & Conditions'],
    [/^\/privacy$/, 'Privacy Policy'],
    [/^\/refund-policy$/, 'Refunds & cancellations'],
    [/^\/delivery-policy$/, 'Delivery policy'],
  ];
  const hit = rules.find(([re]) => re.test(path));
  return hit ? (typeof hit[1] === 'function' ? hit[1]() : hit[1]) : 'VSR';
}

/** Phones: "first item · total · View Cart" bar, shown while the cart has items (tabs pages + product page). */
export function FloatingCartBar({ className }: { className?: string }) {
  const cart = useCart().data;
  const count = cartCount(cart);
  if (!cart || count === 0) return null;
  return (
    <Link to="/cart" className={cx('flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-2 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]', className)}>
      <ProductImage src={cart.items[0]?.image} alt="" className="size-10 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{cart.items[0]?.name}{cart.items.length > 1 ? ` + ${cart.items.length - 1} more` : ''}</span>
        <span className="tabular text-[13px] text-muted">{money(cart.totals.grandTotal)}</span>
      </span>
      <span className="rounded-xl bg-accent-500 px-3 py-2 text-sm font-extrabold text-white">View Cart · {count}</span>
    </Link>
  );
}

export default function ShopLayout() {
  const { user } = useShopAuth();
  const cart = useCart().data;
  const count = cartCount(cart);
  const unread = (useNotifications().data ?? []).filter((n) => !n.read).length;
  const loc = useLocation();
  const isHome = loc.pathname === '/';
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  // Phones: bottom tabs tuck away while scrolling down; the cart bar drops into their place
  const [tabsHidden, setTabsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (Math.abs(y - lastY) < 8) return;
      setTabsHidden(y > lastY && y > 80);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Braces matter: scrollTo returns a Promise in new Chrome, and an effect must not return it
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setScrolled(false);
    setTabsHidden(false);
  }, [loc.pathname]);
  const hideCartBar = ['/cart', '/checkout'].some((p) => loc.pathname.startsWith(p));
  // Bottom-tab destinations: no back button on phones
  // The order-placed screen moves on by itself, so it gets no back button either
  const isTabRoot = ['/categories', '/account', '/account/orders'].includes(loc.pathname) || loc.pathname.startsWith('/order-placed');
  // Product page draws its own floating back button over a full-bleed image
  const isProductPage = /^\/product\/[^/]+$/.test(loc.pathname);
  // Cart and checkout pin their own bottom bar (Checkout / Place order), so the tabs step aside
  const isCheckout = loc.pathname.startsWith('/checkout') || loc.pathname === '/cart' || loc.pathname.startsWith('/order-placed') || /^\/account\/addresses\/[^/]+$/.test(loc.pathname);
  // Same rule as the app: tabs only hide when the cart bar is there to take their place
  const hideTabs = tabsHidden && count > 0 && !hideCartBar;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30">
        {/* Desktop Header: Clean, fast, full-width sticky navigation */}
        <div className="hidden border-b border-line bg-cream/95 dark:bg-[#0B0B0C]/95 backdrop-blur-sm md:block">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
            <Logo />
            <div className="min-w-0">
              <DeliverTo />
            </div>
            <SearchBox pill className="flex-1 max-w-xl mx-auto" />
            <nav aria-label="Shop" className="hidden items-center gap-1 lg:flex">
              {[
                ['/categories', 'Categories'],
                ['/deals', 'Offers'],
              ].map(([to, label]) => (
                <NavLink key={to} to={to} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-bold', isActive ? 'text-brand-700' : 'text-ink hover:bg-line-soft')}>
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <IconLink to={user ? "/account/notifications" : "/login"} label="Notifications" badge={unread}>
                <Bell className="size-5" />
              </IconLink>
              <IconLink to="/cart" label="Cart" badge={count}>
                <ShoppingBag className="size-5" />
              </IconLink>
              {user ? (
                <IconLink to="/account" label="Your account">
                  <User className="size-5" />
                </IconLink>
              ) : (
                <Link to="/login" state={{ from: loc.pathname }} className="ml-1 hidden h-10 items-center rounded-xl bg-brand-900 px-4 text-sm font-bold text-white hover:bg-brand-800 md:inline-flex">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Header: Complete App Bar up to Search, Sticky Nav Bar */}
        <div className="md:hidden">
          {isHome ? (
            <div
              className={cx(
                'relative overflow-hidden transition-all duration-300',
                scrolled
                  ? 'border-b border-line bg-cream/95 dark:bg-[#0B0B0C]/95 backdrop-blur-md shadow-sm'
                  : 'bg-gradient-to-b from-[#FFF2E6] via-[#FFF6EE] to-[#FFF9F5] dark:from-[#261A12] dark:via-[#1A1412] dark:to-[#0B0B0C]'
              )}
            >
              {/* Peach 3D shopping cart illustration (Right-aligned, fades when scrolled) */}
              <div
                className={cx(
                  'pointer-events-none absolute inset-0 bg-contain bg-right-bottom bg-no-repeat transition-opacity duration-300',
                  scrolled ? 'opacity-0' : 'opacity-100'
                )}
                style={{ backgroundImage: "url('/home-hero.jpg')" }}
              >
                {/* Soft left gradient wash keeps text readable over illustration */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#FFF6EE] via-[#FFF6EE]/90 to-transparent dark:from-[#0B0B0C] dark:via-[#0B0B0C]/85" />
              </div>

              <div className="relative z-10 px-4 pt-2.5 pb-3">
                {/* Row 1: Location & Bell */}
                <div className="flex items-center justify-between gap-2">
                  <DeliverTo />
                  <div className="flex items-center gap-1">
                    <IconLink to={user ? "/account/notifications" : "/login"} label="Notifications" badge={unread}>
                      <Bell className="size-6 text-ink" />
                    </IconLink>
                  </div>
                </div>

                {/* Greeting: Hi [Name] 👋 / What would you like to shop today? Always visible in sticky app bar */}
                <div className="mt-1.5 mb-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-ink leading-tight">
                    Hi {user?.name ? user.name.trim().split(' ')[0] : 'there'} 👋
                  </h1>
                  <p className="mt-0.5 text-xs font-medium text-[#4A524E] dark:text-[#A6B2AC]">
                    What would you like to shop today?
                  </p>
                </div>

                {/* Search Box: always visible in sticky header, styled as pill */}
                <div className="mt-1">
                  <SearchBox pill className="w-full" />
                </div>
              </div>
            </div>
          ) : (
            isProductPage ? null : (
            // Other pages: heading bar (auto back button; bottom-tab pages have no back). Home keeps location/bell/search.
            <div className="flex h-14 items-center gap-1 border-b border-line bg-cream/95 px-2 backdrop-blur-md dark:bg-[#0B0B0C]/95">
              {isTabRoot ? (
                <span className="w-2" />
              ) : (
                <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-line-soft">
                  <ArrowLeft className="size-6" />
                </button>
              )}
              <p className="min-w-0 truncate text-lg font-extrabold tracking-[-0.01em] text-ink">{pageTitle(loc.pathname, loc.search)}</p>
            </div>
            )
          )}
        </div>
      </header>

      <main id="main" className="flex-1 pb-28 md:pb-0">
        <Outlet />
      </main>

      <SiteFooter />

      {/* Phones: floating cart bar + bottom tabs (mirrors the app) */}
      {/* Product page has its own bottom buy bar instead of tabs */}
      <div className={cx('fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden', (isProductPage || isCheckout) && 'hidden')}>
        {!hideCartBar ? <FloatingCartBar className={cx('transition-[margin] duration-300 ease-out motion-reduce:transition-none', !hideTabs && 'mb-2')} /> : null}
        {/* Collapses to zero height (grid-rows trick) so the cart bar slides down into the tabs' spot */}
        <div className={cx('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', hideTabs ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100')} {...(hideTabs ? { inert: '' } : {})}>
        <div className="min-h-0 overflow-hidden">
        <nav aria-label="Main" className="flex rounded-[28px] border border-line bg-surface p-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.3)]">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx('flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-3xl text-[11.5px]', isActive ? 'bg-brand-100 font-extrabold text-ink' : 'font-semibold text-muted')}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-5', isActive && 'text-brand-700')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        </div>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    ['Shop', [['/categories', 'All categories'], ['/deals', 'Offers & deals'], ['/products?title=Homemade%20Food&type=homemade', 'Homemade food'], ['/cart', 'Cart']]],
    ['Company', [['/about', 'About VSR'], ['/contact', 'Contact us'], ['/faq', 'FAQs']]],
    ['Policies', [['/terms', 'Terms & Conditions'], ['/privacy', 'Privacy Policy'], ['/refund-policy', 'Refunds & cancellations'], ['/delivery-policy', 'Delivery policy']]],
  ];
  return (
    // Phones: no footer (app-style). Its links live in Profile → Settings & legal and the bottom tabs.
    <footer className="hidden border-t border-line bg-surface md:block">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="size-10 rounded-lg object-contain" />
            <span className="text-xl font-extrabold">VSR</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Shop · Eat · Live Better. Fresh groceries, daily essentials and homemade food, delivered to your door.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h2 className="text-sm font-extrabold">{title}</h2>
            <ul className="mt-3 space-y-1">
              {links.map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="inline-block py-1.5 text-sm text-muted hover:text-brand-700">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-muted sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} VSR. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export { img };
