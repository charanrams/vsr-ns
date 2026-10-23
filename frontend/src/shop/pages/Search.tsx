import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { History, SearchX, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import { useCategories, useRecentSearches, useSearch } from '../data';
import { Btn, cx, EmptyState, FormField, Page, ProductGrid, SelectBox, Sheet, SkeletonGrid, TextInput, View } from '../ui';

const SORTS: [string, string][] = [
  ['popular', 'Popularity'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['discount', 'Biggest discount'],
  ['latest', 'Newest'],
];
const POPULAR = ['Tomatoes', 'Milk', 'Rice', 'Biryani', 'Oil', 'Eggs', 'Honey', 'Shampoo'];

export default function SearchPage() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const recent = useRecentSearches();
  const q = sp.get('q') ?? '';
  const query = {
    q,
    sort: sp.get('sort') ?? 'popular',
    minPrice: sp.get('min') ? Number(sp.get('min')) : undefined,
    maxPrice: sp.get('max') ? Number(sp.get('max')) : undefined,
    inStock: sp.get('stock') === '1',
    type: sp.get('type') ?? undefined,
    category: sp.get('cat') ?? undefined,
  };
  const active = [query.minPrice, query.maxPrice, query.inStock || undefined, query.type, query.category].filter((v) => v !== undefined).length;
  const res = useSearch(query);
  const [filters, setFilters] = useState(false);

  useEffect(() => {
    if (q.trim().length >= 2) recent.add(q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const set = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === '' ? n.delete(k) : n.set(k, v)));
    setSp(n, { replace: true });
  };

  if (q.trim().length < 2)
    return (
      <Page narrow>
        <h1 className="sr-only">Search</h1>
        {recent.list.length ? (
          <section className="mt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Recent searches</h2>
              <Btn tone="ghost" size="sm" onClick={recent.clear}>Clear all</Btn>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {recent.list.map((r) => (
                <li key={r} className="flex items-center">
                  <button type="button" onClick={() => nav(`/search?q=${encodeURIComponent(r)}`)} className="flex min-h-12 flex-1 items-center gap-3 text-left text-[15px]">
                    <History className="size-5 text-muted" aria-hidden /> {r}
                  </button>
                  <button type="button" onClick={() => recent.remove(r)} aria-label={`Remove ${r}`} className="grid size-11 place-items-center rounded-full text-muted hover:bg-line-soft">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">Popular searches</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR.map((s) => (
              <button key={s} type="button" onClick={() => nav(`/search?q=${encodeURIComponent(s)}`)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand-700">
                <TrendingUp className="size-4 text-brand-700" aria-hidden /> {s}
              </button>
            ))}
          </div>
        </section>
      </Page>
    );

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-extrabold sm:text-2xl">
          Results for “{q}”
          {res.data ? <span className="ml-2 text-sm font-semibold text-muted">{res.data.length} result{res.data.length === 1 ? '' : 's'}</span> : null}
        </h1>
        <SelectBox value={query.sort} onChange={(e) => set({ sort: e.target.value })} className="h-11 w-auto pr-10" aria-label="Sort results">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectBox>
        <Btn tone="outline" onClick={() => setFilters(true)}>
          <SlidersHorizontal className="size-4" /> Filters{active ? <span className="grid size-5 place-items-center rounded-full bg-accent-500 text-[11px] text-white">{active}</span> : null}
        </Btn>
      </div>
      <View
        q={res}
        skeleton={<SkeletonGrid />}
        empty={(l) =>
          l.length ? null : (
            <EmptyState
              icon={<SearchX className="size-8" />}
              title={`No results for “${q}”`}
              message={active ? 'Try removing some filters.' : 'Check the spelling or try a broader term.'}
              action={active ? <Btn block onClick={() => set({ min: undefined, max: undefined, stock: undefined, type: undefined, cat: undefined })}>Clear filters</Btn> : <Btn block onClick={() => nav('/categories')}>Browse categories</Btn>}
            />
          )
        }
      >
        {(items) => <ProductGrid items={items} />}
      </View>
      <FilterSheet open={filters} onClose={() => setFilters(false)} value={query} onApply={(f) => { set(f); setFilters(false); }} />
    </Page>
  );
}

function FilterSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: { minPrice?: number; maxPrice?: number; inStock: boolean; type?: string; category?: string }; onApply: (p: Record<string, string | undefined>) => void }) {
  const cats = useCategories().data ?? [];
  const [min, setMin] = useState(''), [max, setMax] = useState('');
  const [stock, setStock] = useState(false), [home, setHome] = useState(false);
  const [cat, setCat] = useState<string | undefined>();
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setMin(value.minPrice?.toString() ?? '');
    setMax(value.maxPrice?.toString() ?? '');
    setStock(value.inStock);
    setHome(value.type === 'homemade');
    setCat(value.category);
    setErr('');
  }, [open, value]);
  const apply = () => {
    if (min && max && Number(min) > Number(max)) return setErr('Min price can’t be more than max price');
    onApply({ min: min || undefined, max: max || undefined, stock: stock ? '1' : undefined, type: home ? 'homemade' : undefined, cat });
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-3">
          <Btn tone="outline" className="flex-1" onClick={() => onApply({ min: undefined, max: undefined, stock: undefined, type: undefined, cat: undefined })}>Clear all</Btn>
          <Btn className="flex-1" onClick={apply}>Apply filters</Btn>
        </div>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Price range (₹)</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Min" htmlFor="fmin"><TextInput id="fmin" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></FormField>
          <FormField label="Max" htmlFor="fmax" error={err}><TextInput id="fmax" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(err)} /></FormField>
        </div>
      </fieldset>
      <div className="mt-5 space-y-1">
        {[
          ['In stock only', stock, setStock],
          ['Homemade food only', home, setHome],
        ].map(([label, on, fn]) => (
          <label key={label as string} className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
            <span className="text-[15px] font-medium">{label as string}</span>
            <input type="checkbox" checked={on as boolean} onChange={(e) => (fn as (v: boolean) => void)(e.target.checked)} className="size-5 accent-[var(--color-brand-800)]" />
          </label>
        ))}
      </div>
      {cats.length ? (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-bold">Category</legend>
          <div className="flex flex-wrap gap-2">
            {[{ _id: undefined as string | undefined, name: 'All' }, ...cats].map((c) => (
              <button key={c._id ?? 'all'} type="button" aria-pressed={cat === c._id} onClick={() => setCat(c._id)} className={cx('h-10 rounded-full border px-4 text-sm font-semibold', cat === c._id ? 'border-brand-700 bg-brand-100' : 'border-line bg-surface text-muted')}>
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </Sheet>
  );
}
