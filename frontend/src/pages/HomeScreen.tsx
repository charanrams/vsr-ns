import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, LayoutList, Plus, Search, Trash2, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { money } from '../lib/format';
import { Button, Card, cx, IconButton, Img, Input, PageHeader, QueryState, Select } from '../components/ui';

type Key = 'categories' | 'recommended' | 'deals' | 'bestSellers' | 'recent' | 'category';
/** key 'category' = an admin-added product row for one category / subcategory (categoryId). */
interface Section { key: Key; categoryId?: string; title: string; enabled: boolean; autoFill: boolean; productIds: string[]; excludedIds: string[] }
interface Mini { _id: string; name: string; images?: { url: string }[]; price?: number; mrp?: number; status?: string; unit?: string }
interface Cat { _id: string; name: string; image?: string; children?: Cat[] }
interface Layout { sections: Section[]; categoryIds: string[]; products: Mini[]; categories: (Cat & { parent?: { name: string } | null })[] }

/** What "automatic" means for each row, shown to the admin. */
const AUTO: Record<Key, string> = {
  categories: '',
  recommended: 'For signed-in customers: popular items from categories they bought before. For guests: best sellers.',
  deals: 'Newest discounted products, biggest saving first.',
  bestSellers: 'Most-sold products.',
  recent: 'Products the customer opened recently on their own device.',
  category: 'Most-sold products in this category.',
};
const swap = <T,>(a: T[], i: number, j: number) => {
  const n = [...a];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};

export default function HomeScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['home-layout'], queryFn: async () => (await api.get<Layout>('/admin/home-layout')).data });
  const cats = useQuery({ queryKey: ['home-layout-cats'], queryFn: async () => (await api.get<{ categories: Cat[] }>('/store/categories')).data.categories });
  const [sections, setSections] = useState<Section[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [known, setKnown] = useState<Record<string, Mini>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!q.data || dirty) return;
    setSections(q.data.sections.map((s) => ({ ...s, categoryId: s.categoryId ? String(s.categoryId) : undefined, productIds: s.productIds.map(String), excludedIds: (s.excludedIds ?? []).map(String) })));
    setCategoryIds(q.data.categoryIds.map(String).filter((id) => !q.data!.categories.find((c) => String(c._id) === id)?.parent));
    setKnown(Object.fromEntries(q.data.products.map((p) => [p._id, p])));
  }, [q.data, dirty]);

  const catIndex = useMemo(() => {
    const m: Record<string, { name: string; parent?: string; image?: string }> = {};
    for (const c of cats.data ?? []) {
      m[c._id] = { name: c.name, image: c.image };
      for (const s of c.children ?? []) m[s._id] = { name: s.name, parent: c.name, image: s.image };
    }
    return m;
  }, [cats.data]);

  // What customers see right now (guest view of the saved layout); refreshes on save and via realtime
  const live = useQuery({
    queryKey: ['home-layout-preview'],
    queryFn: async () =>
      (await api.get<{ deals: Mini[]; bestSellers: Mini[]; recommended?: Mini[]; sections?: { key: string; categoryId?: string; items?: Mini[] }[] }>('/store/home')).data,
  });
  const previewFor = (s: Section): Mini[] | null => {
    const d = live.data;
    if (!d) return null;
    if (s.key === 'recommended') return d.recommended ?? [];
    if (s.key === 'deals') return d.deals;
    if (s.key === 'bestSellers') return d.bestSellers;
    if (s.key === 'category') return d.sections?.find((x) => x.key === 'category' && x.categoryId === s.categoryId)?.items ?? [];
    return null;
  };

  const save = useMutation({
    mutationFn: async () => (await api.put('/admin/home-layout', { sections, categoryIds })).data,
    onSuccess: () => {
      toast.success('Home screen updated. Customers see it right away.');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['home-layout'] });
      qc.invalidateQueries({ queryKey: ['home-layout-preview'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const edit = (i: number, patch: Partial<Section>) => {
    setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setSections((s) => swap(s, i, i + d));
    setDirty(true);
  };
  // New category rows go right after Best Sellers (the usual spot); admin can move them anywhere
  const addCategoryRow = (id: string) => {
    const name = catIndex[id]?.name ?? 'Category';
    setSections((s) => {
      const at = s.findIndex((x) => x.key === 'bestSellers') + 1 || s.length;
      return [...s.slice(0, at), { key: 'category', categoryId: id, title: name, enabled: true, autoFill: true, productIds: [], excludedIds: [] }, ...s.slice(at)];
    });
    setDirty(true);
  };
  const removeRow = (i: number) => {
    setSections((s) => s.filter((_, j) => j !== i));
    setDirty(true);
  };

  // ---------------- Tabs: "Layout" (order & visibility of every row) + one tab per row
  const rowId = (s: Section) => (s.key === 'category' ? `category:${s.categoryId}` : s.key);
  const [tab, setTab] = useState('layout');
  const active = sections.findIndex((s) => rowId(s) === tab);
  const current = active >= 0 ? sections[active] : null;
  const catLabel = (s: Section) =>
    s.categoryId && catIndex[s.categoryId] ? (catIndex[s.categoryId].parent ? `${catIndex[s.categoryId].parent} › ${catIndex[s.categoryId].name}` : catIndex[s.categoryId].name) : 'Category inactive or removed';
  useEffect(() => {
    if (tab !== 'layout' && sections.length && active < 0) setTab('layout'); // row removed → back to Layout
  }, [tab, active, sections.length]);

  return (
    <div className="pb-24">
      <PageHeader
        crumbs={[{ label: 'Marketing' }, { label: 'Home Screen' }]}
        title="Home Screen"
        sub="Choose what customers see on Home in the app and on the website, and in what order."
        actions={
          <>
            {dirty ? <span className="text-[13px] font-semibold text-warning">Unsaved changes</span> : null}
            {dirty ? <Button onClick={() => { setDirty(false); q.refetch(); }}>Discard</Button> : null}
            <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save changes</Button>
          </>
        }
      />
      <QueryState q={q}>
        {() => (
          <>
            {/* Tab bar: scrolls sideways on small screens */}
            <div role="tablist" aria-label="Home screen rows" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
              {[{ id: 'layout', label: 'Layout', hidden: false, icon: <LayoutList size={15} aria-hidden /> }, ...sections.map((s) => ({ id: rowId(s), label: s.title || 'Untitled', hidden: !s.enabled, icon: null }))].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cx(
                    '-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors',
                    tab === t.id ? 'border-brand-800 text-brand-900' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {t.icon}
                  <span className={cx(t.hidden && 'line-through decoration-muted/60')}>{t.label}</span>
                  {t.hidden ? <span className="rounded-full bg-line-soft px-1.5 py-0.5 text-[10px] font-bold text-muted no-underline">Hidden</span> : null}
                </button>
              ))}
            </div>

            {tab === 'layout' ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <Card className="p-0">
                  <div className="border-b border-line px-5 py-4">
                    <h2 className="font-bold">Rows on Home, top to bottom</h2>
                    <p className="text-sm text-muted">Reorder, rename, show or hide. Open a row’s tab to choose its products.</p>
                  </div>
                  <ol className="divide-y divide-line">
                    {sections.map((s, i) => (
                      <li key={rowId(s) + i} className={cx('flex flex-wrap items-center gap-3 px-5 py-3', !s.enabled && 'bg-line-soft/40')}>
                        <div className="flex gap-1">
                          <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></IconButton>
                          <IconButton label="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></IconButton>
                        </div>
                        <span className="tabular grid size-7 place-items-center rounded-full bg-line-soft text-xs font-bold text-muted" aria-label={`Position ${i + 1}`}>{i + 1}</span>
                        <div className="min-w-[200px] flex-1">
                          <label>
                            <span className="sr-only">Row title</span>
                            <Input value={s.title} maxLength={40} onChange={(e) => edit(i, { title: e.target.value })} className="font-semibold" />
                          </label>
                          {s.key === 'category' ? <p className="mt-1 text-xs text-muted">Category row · {catLabel(s)}</p> : null}
                        </div>
                        <Switch checked={s.enabled} onChange={(v) => edit(i, { enabled: v })} on="Shown" off="Hidden" label={`Show ${s.title}`} />
                        {s.key !== 'recent' ? <Button size="sm" variant="ghost" onClick={() => setTab(rowId(s))}>Edit products</Button> : <span className="w-[104px]" />}
                        {s.key === 'category' ? <IconButton label={`Remove ${s.title} row`} tone="danger" onClick={() => removeRow(i)}><Trash2 size={16} /></IconButton> : null}
                      </li>
                    ))}
                  </ol>
                </Card>
                <Card className="self-start p-5">
                  <h2 className="font-bold">Add a category row</h2>
                  <p className="mt-1 text-sm text-muted">A row of products from one category or subcategory, placed after Best Sellers. Up to 10.</p>
                  <ul className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-line">
                    {(cats.data ?? []).map((c) => (
                      <li key={c._id} className="border-b border-line last:border-0">
                        <PickRow name={c.name} on={sections.some((x) => x.categoryId === c._id)} onAdd={() => sections.filter((x) => x.key === 'category').length < 10 && addCategoryRow(c._id)} bold />
                        {c.children?.map((sc) => (
                          <PickRow key={sc._id} name={sc.name} on={sections.some((x) => x.categoryId === sc._id)} onAdd={() => sections.filter((x) => x.key === 'category').length < 10 && addCategoryRow(sc._id)} indent />
                        ))}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ) : current ? (
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold">{current.title}</h2>
                    <p className="text-sm text-muted">
                      {current.key === 'category' ? `Category row · ${catLabel(current)}` : current.key === 'categories' ? 'Round category icons near the top of Home.' : `Position ${active + 1} of ${sections.length} on Home.`}
                    </p>
                  </div>
                  <Switch checked={current.enabled} onChange={(v) => edit(active, { enabled: v })} on="Shown" off="Hidden" label={`Show ${current.title}`} />
                  {current.key === 'category' ? <IconButton label={`Remove ${current.title} row`} tone="danger" onClick={() => removeRow(active)}><Trash2 size={16} /></IconButton> : null}
                </div>
                <div className={cx('mt-5', !current.enabled && 'opacity-50')}>
                  {current.key === 'categories' ? (
                    <CategoryPicker ids={categoryIds} index={catIndex} tree={cats.data ?? []} onChange={(ids) => { setCategoryIds(ids); setDirty(true); }} />
                  ) : current.key === 'recent' ? (
                    <p className="text-sm text-muted">{AUTO.recent} Nothing to pick here; use the Layout tab to show, hide or move it.</p>
                  ) : (
                    <>
                      <ProductPins section={current} known={known} tree={cats.data ?? []} onKnown={(p) => setKnown((k) => ({ ...k, [p._id]: p }))} onChange={(patch) => edit(active, patch)} />
                      <Preview
                        items={previewFor(current)}
                        loading={live.isLoading}
                        dirty={dirty}
                        recommended={current.key === 'recommended'}
                        enabled={current.enabled}
                        section={current}
                        known={known}
                        onHide={(p) => {
                          setKnown((k) => ({ ...k, [p._id]: p }));
                          // A pinned product is simply unpinned; an automatic pick goes on the row's hidden list
                          if (current.productIds.includes(p._id)) edit(active, { productIds: current.productIds.filter((x) => x !== p._id) });
                          else edit(active, { excludedIds: [...current.excludedIds, p._id] });
                        }}
                        onRestore={(id) => edit(active, { excludedIds: current.excludedIds.filter((x) => x !== id) })}
                      />
                    </>
                  )}
                </div>
              </Card>
            ) : null}
          </>
        )}
      </QueryState>
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Button variant="primary" className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        </div>
      ) : null}
    </div>
  );
}

function Switch({ checked, onChange, on, off, label }: { checked: boolean; onChange: (v: boolean) => void; on: string; off: string; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="inline-flex min-h-10 items-center gap-2.5">
      <span className={cx('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand-700' : 'bg-[#d6d0c4]')}>
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </span>
      <span className="w-14 text-sm font-medium">{checked ? on : off}</span>
    </button>
  );
}

// ------------------------------------------------------------------ Pinned products + auto-fill
function ProductPins({ section, known, tree, onKnown, onChange }: { section: Section; known: Record<string, Mini>; tree: Cat[]; onKnown: (p: Mini) => void; onChange: (p: Partial<Section>) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  // Browse by category / subcategory, by name or SKU, or both
  const searching = debounced.length >= 2 || Boolean(cat);
  const results = useQuery({
    queryKey: ['home-layout-search', debounced, cat],
    enabled: searching,
    queryFn: async () =>
      (await api.get<{ items: Mini[] }>('/admin/products', { params: { q: debounced.length >= 2 ? debounced : undefined, category: cat || undefined, limit: 20, status: 'active' } })).data.items,
  });
  const ids = section.productIds;
  const add = (p: Mini) => {
    if (ids.includes(p._id) || ids.length >= 20) return;
    onKnown(p);
    onChange({ productIds: [...ids, p._id] });
    if (!cat) setQ('');
  };
  const addAll = (list: Mini[]) => {
    const fresh = list.filter((p) => !ids.includes(p._id)).slice(0, 20 - ids.length);
    fresh.forEach(onKnown);
    if (fresh.length) onChange({ productIds: [...ids, ...fresh.map((p) => p._id)] });
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-sm font-bold">Pinned products <span className="font-medium text-muted">({ids.length}/20, shown first in this order)</span></p>
        {ids.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line p-4 text-sm text-muted">No pinned products. {section.autoFill ? 'This row fills automatically.' : 'Turn on automatic fill or pin products, or the row stays empty.'}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {ids.map((id, i) => {
              const p = known[id];
              return (
                <li key={id} className="flex items-center gap-3 px-3 py-2">
                  <Img src={p?.images?.[0]?.url} alt="" className="size-10 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p?.name ?? 'Product'}</span>
                    <span className="text-xs text-muted">{p?.price != null ? money(p.price) : ''}{p?.status && p.status !== 'active' ? ' · not active (hidden from customers)' : ''}</span>
                  </span>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => onChange({ productIds: swap(ids, i, i - 1) })}><ArrowUp size={14} /></IconButton>
                  <IconButton label="Move down" disabled={i === ids.length - 1} onClick={() => onChange({ productIds: swap(ids, i, i + 1) })}><ArrowDown size={14} /></IconButton>
                  <IconButton label={`Remove ${p?.name ?? 'product'}`} tone="danger" onClick={() => onChange({ productIds: ids.filter((x) => x !== id) })}><X size={14} /></IconButton>
                </li>
              );
            })}
          </ul>
        )}
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-line-soft/60 p-3">
          <input type="checkbox" checked={section.autoFill} onChange={(e) => onChange({ autoFill: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-brand-800)]" />
          <span className="text-sm">
            <span className="block font-semibold">Fill remaining spots automatically</span>
            <span className="text-muted">{AUTO[section.key]}</span>
          </span>
        </label>
      </div>
      <div>
        <label className="text-sm font-bold" htmlFor={`s-${section.key}`}>Add products</label>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-2" aria-label="Filter by category">
          <option value="">All categories</option>
          {tree.map((c) => (
            <optgroup key={c._id} label={c.name}>
              <option value={c._id}>All of {c.name}</option>
              {c.children?.map((sc) => <option key={sc._id} value={sc._id}>{sc.name}</option>)}
            </optgroup>
          ))}
        </Select>
        <div className="relative mt-2">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input id={`s-${section.key}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="pl-9" />
        </div>
        {searching ? (
          <>
          {results.data?.length ? (
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">{results.data.length} product{results.data.length === 1 ? '' : 's'}</span>
              <Button size="sm" variant="ghost" disabled={ids.length >= 20 || results.data.every((p) => ids.includes(p._id))} onClick={() => addAll(results.data!)}>
                Add all shown
              </Button>
            </div>
          ) : null}
          <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {results.isLoading ? <li className="p-3 text-sm text-muted">Searching…</li> : null}
            {results.data?.length === 0 ? <li className="p-3 text-sm text-muted">No active products {debounced.length >= 2 ? `match “${debounced}”` : 'in this category'}.</li> : null}
            {results.data?.map((p) => {
              const on = ids.includes(p._id);
              return (
                <li key={p._id}>
                  <button type="button" disabled={on} onClick={() => add(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50 disabled:opacity-50">
                    <Img src={p.images?.[0]?.url} alt="" className="size-9 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    {on ? <span className="text-xs text-muted">Pinned</span> : <Plus size={16} className="text-brand-700" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted">Pick a category, or type at least 2 letters.</p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Shop by Category picker (categories + subcategories)
function CategoryPicker({ ids, index, tree, onChange }: { ids: string[]; index: Record<string, { name: string; parent?: string; image?: string }>; tree: Cat[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-sm font-bold">Shown on Home <span className="font-medium text-muted">({ids.length}/24, in this order)</span></p>
        {ids.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line p-4 text-sm text-muted">Automatic: all active top-level categories, in their category order. Pick categories to choose exactly which show. Subcategories appear as product rows instead (switch on in Categories).</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {ids.map((id, i) => {
              const c = index[id];
              return (
                <li key={id} className="flex items-center gap-3 px-3 py-2">
                  <Img src={c?.image} alt="" className="size-10 rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c?.name ?? 'Category (inactive or removed)'}</span>
                    {c?.parent ? <span className="text-xs text-muted">Subcategory of {c.parent}</span> : null}
                  </span>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => onChange(swap(ids, i, i - 1))}><ArrowUp size={14} /></IconButton>
                  <IconButton label="Move down" disabled={i === ids.length - 1} onClick={() => onChange(swap(ids, i, i + 1))}><ArrowDown size={14} /></IconButton>
                  <IconButton label={`Remove ${c?.name ?? 'category'}`} tone="danger" onClick={() => onChange(ids.filter((x) => x !== id))}><X size={14} /></IconButton>
                </li>
              );
            })}
          </ul>
        )}
        {ids.length ? <Button size="sm" variant="ghost" className="mt-2" onClick={() => onChange([])}>Reset to automatic</Button> : null}
      </div>
      <div>
        <p className="text-sm font-bold">Add top-level categories</p>
        <ul className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-line">
          {tree.map((c) => (
            <li key={c._id} className="border-b border-line last:border-0">
              <PickRow name={c.name} on={ids.includes(c._id)} onAdd={() => ids.length < 24 && onChange([...ids, c._id])} bold />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function PickRow({ name, on, onAdd, bold, indent }: { name: string; on: boolean; onAdd: () => void; bold?: boolean; indent?: boolean }) {
  return (
    <button type="button" disabled={on} onClick={onAdd} className={cx('flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-brand-50 disabled:opacity-50', indent && 'pl-8', bold && 'font-semibold')}>
      <span className="flex-1 truncate">{name}</span>
      {on ? <span className="text-xs text-muted">Added</span> : <Plus size={15} className="text-brand-700" aria-hidden />}
    </button>
  );
}

// ------------------------------------------------------------------ Live preview of a row
function Preview({ items: saved, loading, dirty, recommended, enabled, section, known, onHide, onRestore }: { items: Mini[] | null; loading: boolean; dirty: boolean; recommended: boolean; enabled: boolean; section: Section; known: Record<string, Mini>; onHide: (p: Mini) => void; onRestore: (id: string) => void }) {
  // Apply unsaved hides/unpins right away so the admin sees the effect before saving
  const hiddenNow = new Set(section.excludedIds);
  const items = saved?.filter((p) => !hiddenNow.has(p._id)) ?? null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">
          Preview <span className="font-medium text-muted">· what customers see now{recommended ? ' (guest view; signed-in customers also get their own past-order picks)' : ''}</span>
        </p>
        {dirty ? <span className="text-xs font-semibold text-warning">Showing the saved version. Save to update.</span> : null}
      </div>
      {!enabled ? (
        <p className="mt-2 text-sm text-muted">This row is hidden from customers.</p>
      ) : loading ? (
        <div className="mt-3 flex gap-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-36 w-28 shrink-0 animate-pulse rounded-xl bg-line-soft" />)}</div>
      ) : !items?.length ? (
        <p className="mt-2 text-sm text-muted">No products yet, so customers won’t see this row. Pin products or turn on automatic fill.</p>
      ) : (
        <ol className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {items.map((p, n) => (
            <li key={p._id} className="w-28 shrink-0">
              <div className="relative">
                <Img src={p.images?.[0]?.url} alt="" className="aspect-square w-full rounded-xl" />
                <span className="tabular absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-white/90 text-[11px] font-bold text-ink">{n + 1}</span>
                <button
                  type="button"
                  onClick={() => onHide(p)}
                  title={section.productIds.includes(p._id) ? 'Unpin from this row' : 'Hide from this row'}
                  aria-label={`${section.productIds.includes(p._id) ? 'Unpin' : 'Hide'} ${p.name}`}
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/95 text-danger shadow hover:bg-danger-bg"
                >
                  <X size={14} />
                </button>
                {section.productIds.includes(p._id) ? <span className="absolute bottom-1.5 left-1.5 rounded-md bg-brand-900 px-1.5 text-[10px] font-bold text-white">Pinned</span> : null}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{p.name}</p>
              {p.price != null ? <p className="tabular text-xs text-muted">{money(p.price)}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {section.excludedIds.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-muted">Hidden from this row ({section.excludedIds.length})</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {section.excludedIds.map((id) => (
              <li key={id} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-1">
                <Img src={known[id]?.images?.[0]?.url} alt="" className="size-6 rounded-full" />
                <span className="max-w-40 truncate text-xs font-semibold">{known[id]?.name ?? 'Product'}</span>
                <button type="button" onClick={() => onRestore(id)} className="rounded-full px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">Restore</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
