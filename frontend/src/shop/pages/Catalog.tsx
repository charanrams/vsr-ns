import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { History, Search, Sparkles, Tag } from 'lucide-react';
import { useShopAuth } from '../auth';
import { couponLabel, useCategories, useCoupons, useDeals, useHome, useProducts, useRecentlyViewed, useRecentlyViewedIds, useRecommendations } from '../data';
import { Btn, ButtonLink, cx, EmptyState, ErrorState, Page, PageTitle, ProductGrid, ProductImage, SectionHead, SelectBox, SkeletonGrid, View } from '../ui';

const SORTS: [string, string][] = [
  ['popular', 'Popularity'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['discount', 'Biggest discount'],
  ['latest', 'Newest'],
];

// ------------------------------------------------------------------ Categories
export function CategoriesPage() {
  const cats = useCategories();
  const [q, setQ] = useState('');
  return (
    <Page>
      <PageTitle>Categories</PageTitle>
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value.toLowerCase())} placeholder="Search categories…" aria-label="Search categories" className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-[15px] focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
      </div>
      <View
        q={cats}
        skeleton={<SkeletonGrid n={8} />}
        empty={(list) => {
          const n = list.filter((c) => c.name.toLowerCase().includes(q) || c.children?.some((s) => s.name.toLowerCase().includes(q))).length;
          return n === 0 ? <EmptyState title="No categories found" message="Try a different word." /> : null;
        }}
      >
        {(list) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {list
              .filter((c) => c.name.toLowerCase().includes(q) || c.children?.some((s) => s.name.toLowerCase().includes(q)))
              .map((c) => (
                <Link key={c._id} to={`/category/${c._id}?name=${encodeURIComponent(c.name)}`} className="group rounded-2xl border border-line bg-surface p-2.5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgb(11_61_46/0.25)]">
                  <ProductImage src={c.image} alt="" className="aspect-[4/3] w-full rounded-xl transition-transform group-hover:scale-[1.02]" />
                  <h2 className="mt-2.5 truncate px-0.5 text-[15px] font-bold">{c.name}</h2>
                  {c.children?.length ? <p className="px-0.5 text-[13px] text-muted">{c.children.length} subcategories</p> : null}
                </Link>
              ))}
          </div>
        )}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Category / filtered product list
export function ProductListPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const title = params.get('name') ?? params.get('title') ?? 'Products';
  const [sub, setSub] = useState<string | undefined>();
  const [sort, setSort] = useState(params.get('sort') ?? 'popular');
  const parent = useCategories().data?.find((c) => c._id === id);
  const q = useProducts({ category: sub ?? id ?? undefined, sort, type: params.get('type') ?? undefined });
  return (
    <Page>
      <PageTitle
        sub={q.data ? `${q.data.length} product${q.data.length === 1 ? '' : 's'}` : undefined}
        action={
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted">Sort</span>
            <SelectBox value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 w-auto pr-10" aria-label="Sort products">
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectBox>
          </label>
        }
      >
        {title}
      </PageTitle>
      {parent?.children?.length ? (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Subcategories">
          {[{ _id: undefined as string | undefined, name: 'All' }, ...parent.children].map((s) => (
            <button
              key={s._id ?? 'all'}
              role="tab"
              aria-selected={sub === s._id}
              onClick={() => setSub(s._id)}
              className={cx('h-10 shrink-0 rounded-full border px-4 text-sm font-semibold', sub === s._id ? 'border-brand-700 bg-brand-100 text-ink' : 'border-line bg-surface text-muted hover:text-ink')}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      <View q={q} skeleton={<SkeletonGrid />} empty={(l) => (l.length ? null : <EmptyState title="No products here yet" message="Check back soon or explore other categories." action={<ButtonLink to="/categories" className="w-full">Browse categories</ButtonLink>} />)}>
        {(items) => <ProductGrid items={items} />}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Offers & deals
export function DealsPage() {
  const home = useHome().data;
  const deals = useDeals();
  const { user } = useShopAuth();
  const coupons = useCoupons();
  return (
    <Page>
      <PageTitle>Offers & Deals</PageTitle>
      {home?.banners.length ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
          {home.banners.map((b, i) => (
            <Link key={i} to={`/campaign/${i}`} className="relative h-36 w-[80%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-auto">
              <img src={b.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b3d2e]/85 to-transparent" />
              <span className="absolute inset-x-4 bottom-4 text-base font-extrabold text-white">{b.title}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {user ? (
        <>
          <SectionHead title="Coupons" to="/account/coupons" action="View all" />
          <View q={coupons} skeleton={<div className="h-24" />} empty={(l) => (l.length ? null : <p className="text-sm text-muted">No coupons available right now.</p>)}>
            {(list) => (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                {list.map((c) => (
                  <div key={c._id} className="w-52 shrink-0 rounded-2xl border border-accent-500/40 bg-accent-50 p-4">
                    <p className="font-extrabold text-accent-600 dark:text-accent-500">{couponLabel(c)}</p>
                    <p className="mt-0.5 text-sm font-semibold tracking-wide">Code {c.code}</p>
                    <p className="text-[13px] text-muted">Min order ₹{c.minOrder}</p>
                  </div>
                ))}
              </div>
            )}
          </View>
        </>
      ) : null}
      <SectionHead title="Top Deals" />
      <View q={deals} skeleton={<SkeletonGrid />} empty={(l) => (l.length ? null : <EmptyState icon={<Tag className="size-8" />} title="No deals right now" message="Check back soon for fresh discounts." />)}>
        {(items) => <ProductGrid items={items} />}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Campaign (banner landing)
export function CampaignPage() {
  const { index } = useParams();
  const home = useHome();
  const b = home.data?.banners[Number(index)];
  const cat = useCategories().data?.find((c) => c.name === b?.linkValue);
  const products = useProducts(cat ? { category: cat._id } : { sort: 'popular' }, Boolean(home.data));
  if (home.isError) return <Page><ErrorState error={home.error} onRetry={() => home.refetch()} /></Page>;
  if (home.data && !b) return <Page><EmptyState title="This offer has ended" message="Explore today’s deals instead." action={<ButtonLink to="/deals" className="w-full">See offers</ButtonLink>} /></Page>;
  return (
    <Page>
      {b ? (
        <div className="relative h-52 overflow-hidden rounded-3xl sm:h-72">
          <img src={b.image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b3d2e]/90 via-[#0b3d2e]/30 to-transparent" />
          <div className="absolute inset-x-5 bottom-6 sm:inset-x-10">
            <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-4xl">{b.title}</h1>
            {b.subtitle ? <p className="mt-1 text-white sm:text-lg">{b.subtitle}</p> : null}
          </div>
        </div>
      ) : (
        <div className="h-52 animate-pulse rounded-3xl bg-line sm:h-72" />
      )}
      <SectionHead title={cat ? `Shop ${cat.name}` : 'Featured products'} />
      <View q={products} skeleton={<SkeletonGrid />} empty={(l) => (l.length ? null : <EmptyState title="Products coming soon" />)}>
        {(items) => <ProductGrid items={items} />}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Recommended / recently viewed
export function CollectionPage({ kind }: { kind: 'recommended' | 'recent' }) {
  const recent = kind === 'recent';
  const { user } = useShopAuth();
  const rec = useRecommendations();
  const rv = useRecentlyViewed();
  const ids = useRecentlyViewedIds();
  const q = recent ? rv : rec;
  return (
    <Page>
      <PageTitle action={recent && ids.list.length ? <Btn tone="ghost" onClick={ids.clear}>Clear</Btn> : undefined}>{recent ? 'Recently Viewed' : 'Recommended for You'}</PageTitle>
      {!recent && !user ? (
        <EmptyState icon={<Sparkles className="size-8" />} title="Log in for picks made for you" message="We suggest products based on what you buy." action={<ButtonLink to="/login" className="w-full">Log in</ButtonLink>} />
      ) : (
        <View
          q={q}
          skeleton={<SkeletonGrid />}
          empty={(l) =>
            l.length ? null : (
              <EmptyState
                icon={recent ? <History className="size-8" /> : <Sparkles className="size-8" />}
                title={recent ? 'Nothing viewed yet' : 'No recommendations yet'}
                message={recent ? 'Products you open will appear here.' : 'Shop a little and we’ll suggest products you’ll love.'}
              />
            )
          }
        >
          {(items) => <ProductGrid items={items} />}
        </View>
      )}
    </Page>
  );
}
