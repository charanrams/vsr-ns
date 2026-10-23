import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShopAuth } from '../auth';
import { DEFAULT_HOME_SECTIONS, useHome, useRecentlyViewed, useRecommendations, type Banner, type Category, type Product } from '../data';
import { cx, ErrorState, Page, ProductImage, ProductRail, SectionHead, Skeleton, SkeletonGrid } from '../ui';

export default function ShopHome() {
  const { user } = useShopAuth();
  const home = useHome();
  const rec = useRecommendations().data ?? [];
  const recent = useRecentlyViewed().data ?? [];

  if (home.isLoading)
    return (
      <Page>
        <Skeleton className="h-44 w-full sm:h-64" />
        <div className="mt-8 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-full" />
          ))}
        </div>
        <div className="mt-10">
          <SkeletonGrid n={5} />
        </div>
      </Page>
    );
  if (home.isError || !home.data)
    return (
      <Page>
        <ErrorState error={home.error} onRetry={() => home.refetch()} />
      </Page>
    );
  const d = home.data;

  return (
    <Page>
      {/* Desktop Hero Section matching mobile theme */}
      <div className="relative mb-6 hidden overflow-hidden rounded-3xl border border-line/60 bg-gradient-to-r from-[#FFF0E2] via-[#FFF6EE] to-[#FFEAD7] p-8 shadow-sm dark:border-[#2A2A2E] dark:from-[#261A12] dark:via-[#1A1412] dark:to-[#120F0D] md:block">
        <div
          className="pointer-events-none absolute inset-0 bg-contain bg-right bg-no-repeat opacity-90"
          style={{ backgroundImage: "url('/home-hero.jpg')" }}
        />
        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-xs font-extrabold text-accent-600 dark:text-accent-400">
            ✨ Welcome to VSR Market
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink lg:text-4xl">
            Hi {user?.name ? user.name.trim().split(' ')[0] : 'Charan'} 👋
          </h1>
          <p className="mt-1.5 text-base font-medium text-[#4A524E] dark:text-[#A6B2AC]">
            What would you like to shop today?
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted">Popular:</span>
            {['Biryani', 'Organic Milk', 'Fresh Veggies', 'Bakery', 'Sweets'].map((tag) => (
              <Link
                key={tag}
                to={`/search?q=${encodeURIComponent(tag.toLowerCase())}`}
                className="rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-ink backdrop-blur-sm transition-colors hover:border-brand-700 hover:text-brand-700"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {d.banners.length ? <Banners items={d.banners} /> : null}
      {(d.sections ?? DEFAULT_HOME_SECTIONS).map(({ key, title, categoryId, items: rowItems }, n) => {
        // Admin-added row for one category / subcategory (products come with the home response)
        if (key === 'category')
          return rowItems?.length ? (
            <div key={`category-${categoryId}-${n}`}>
              <SectionHead title={title} to={`/category/${categoryId}?name=${encodeURIComponent(title)}`} />
              <ProductRail items={rowItems} />
            </div>
          ) : null;
        if (key === 'categories')
          return d.categories.length ? (
            <div key={key}>
              <SectionHead title={title} to="/categories" />
              <CategoryStrip items={d.categories} />
            </div>
          ) : null;
        const SUBS: Record<string, string> = {
          deals: 'Limited time offers just for you',
          bestSellers: 'Most loved products by our customers',
          recommended: 'Curated picks tailored for you',
          recent: 'Pick up where you left off',
        };
        const rows: Record<string, [Product[], string]> = {
          // Signed in: admin picks + past-order matches; guests: admin picks + best sellers
          recommended: [user && rec.length ? rec : (d.recommended ?? []), user ? '/recommended' : `/products?title=${encodeURIComponent(title)}&sort=popular`],
          deals: [d.deals, '/deals'],
          bestSellers: [d.bestSellers, '/products?title=Best%20Sellers&sort=popular'],
          homemade: [d.homemade, '/products?title=Homemade%20Food&type=homemade'],
          recent: [recent, '/recently-viewed'],
        };
        const [items, to] = rows[key] ?? [[], ''];
        return items.length ? (
          <div key={key}>
            <SectionHead title={title} sub={SUBS[key]} to={to || undefined} />
            <ProductRail items={items} />
          </div>
        ) : null;
      })}
    </Page>
  );
}

export function CategoryStrip({ items }: { items: Category[] }) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
      {items.map((c) => (
        <Link key={c._id} to={`/category/${c._id}?name=${encodeURIComponent(c.name)}`} className="group flex flex-col items-center gap-2 rounded-2xl p-1">
          <ProductImage src={c.image} alt="" className="aspect-square w-full max-w-24 rounded-full ring-1 ring-line transition-transform group-hover:scale-[1.04]" />
          <span className="line-clamp-2 text-center text-xs font-semibold leading-tight sm:text-[13px]">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}

function Banners({ items }: { items: Banner[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);
  const b = items[i];
  return (
    <section aria-roledescription="carousel" aria-label="Offers" className="relative">
      <Link to={`/campaign/${i}`} className="relative block h-44 overflow-hidden rounded-3xl bg-line-soft sm:h-64 lg:h-80">
        <img key={b.image} src={b.image} alt="" className="absolute inset-0 size-full animate-[rise_400ms_ease-out] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#fbf7ee] via-[#fbf7ee]/85 to-transparent sm:via-[#fbf7ee]/70" />
        <div className="relative flex h-full max-w-[62%] flex-col justify-center p-5 sm:max-w-md sm:p-10">
          <h2 className="text-xl font-extrabold leading-tight text-brand-800 sm:text-4xl">{b.title}</h2>
          {b.subtitle ? <p className="mt-2 line-clamp-2 text-xs font-medium text-[#202923] sm:text-base">{b.subtitle}</p> : null}
          {b.buttonText ? <span className="mt-4 inline-flex w-fit rounded-full bg-brand-900 px-4 py-2 text-xs font-bold text-white sm:text-sm">{b.buttonText} →</span> : null}
        </div>
      </Link>
      {items.length > 1 ? (
        <>
          <div className="mt-3 flex justify-center gap-1.5">
            {items.map((_, n) => (
              <button key={n} type="button" onClick={() => setI(n)} aria-label={`Show offer ${n + 1}`} aria-current={n === i} className="grid h-6 place-items-center px-0.5">
                <span className={cx('block h-1.5 rounded-full transition-all', n === i ? 'w-5 bg-brand-700' : 'w-1.5 bg-line')} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous offer" className="absolute left-3 top-[calc(50%-14px)] hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#202923] shadow sm:grid">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => setI((i + 1) % items.length)} aria-label="Next offer" className="absolute right-3 top-[calc(50%-14px)] hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#202923] shadow sm:grid">
            <ChevronRight className="size-5" />
          </button>
        </>
      ) : null}
    </section>
  );
}
