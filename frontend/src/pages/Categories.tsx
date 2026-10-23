import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ChevronDown, Pencil, Eye, ArrowLeft } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, PageHeader, Table, StatusBadge, SearchInput, Select, Img, Menu, QueryState, Field, Input, Textarea, Toggle, Pagination, cx } from '../components/ui';
import { ImagePicker } from '../components/ImagePicker';

interface Cat { _id: string; name: string; description?: string; image?: string; parent?: string | null; sortOrder: number; status: string; subcategoryCount: number; productCount: number; showOnHome?: boolean }

function Accordion({ n, title, sub, open, onToggle, children, action, tone = 'brand' }: { n: number; title: string; sub: string; open: boolean; onToggle: () => void; children: ReactNode; action?: ReactNode; tone?: 'brand' | 'accent' }) {
  const id = `acc-${n}`;
  return (
    <Card className="mb-4 scroll-mt-[88px]" id={`section-${n}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white', tone === 'brand' ? 'bg-brand-800' : 'bg-accent-600')} aria-hidden>{n}</span>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="min-w-0 flex-1 cursor-pointer text-left">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <p className="text-[13px] text-muted">{sub}</p>
        </button>
        {open && action}
        <button type="button" onClick={onToggle} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} aria-expanded={open} aria-controls={id} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line hover:bg-brand-50">
          <ChevronDown size={18} className={cx('transition-transform duration-300', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {/* grid-rows 0fr→1fr animates height without measuring; closed content is inert so it can't be focused */}
      <div id={id} role="region" aria-label={title} {...(open ? {} : { inert: "" })} className={cx('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

const empty = { name: '', description: '', image: [] as { url: string }[], parent: '', sortOrder: '1', status: 'active', showOnHome: false };

function CategoryForm({ initial, parents, onDone, fixedParent }: { initial?: Cat | null; parents: Cat[]; onDone: () => void; fixedParent?: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => {
    setF(initial ? { name: initial.name, description: initial.description ?? '', image: initial.image ? [{ url: initial.image }] : [], parent: initial.parent ?? '', sortOrder: String(initial.sortOrder), status: initial.status, showOnHome: Boolean(initial.showOnHome) } : { ...empty, parent: fixedParent ?? '', showOnHome: !fixedParent });
    setErr({});
  }, [initial, fixedParent]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: f.name.trim(), description: f.description, image: f.image[0]?.url ?? '', parent: f.parent || null, sortOrder: Number(f.sortOrder) || 0, status: f.status, showOnHome: f.showOnHome };
      return initial ? api.put(`/admin/categories/${initial._id}`, body) : api.post('/admin/categories', body);
    },
    onSuccess: () => {
      toast.success(initial ? 'Category updated' : 'Category created');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setF(empty);
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim().length < 2) return setErr({ name: 'Enter a category name' });
        save.mutate();
      }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto]"
    >
      <div className="space-y-4">
        <Field label="Category name" required error={err.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!err.name} /></Field>
        <Field label="Description"><Textarea value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <div className="space-y-4">
        <Field label="Parent category" hint="Leave empty for a top-level category">
          <Select value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })} disabled={!!fixedParent}>
            <option value="">None (top level)</option>{parents.filter((p) => p._id !== initial?._id).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order"><Input inputMode="numeric" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value.replace(/\D/g, '') })} /></Field>
          <div><span className="mb-1.5 block text-[13px] font-medium">Visibility</span><div className="h-10 content-center"><Toggle checked={f.status === 'active'} onChange={(v) => setF({ ...f, status: v ? 'active' : 'inactive' })} label="Category visible" /></div></div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">Home screen</span>
            <label className="flex min-h-10 cursor-pointer items-center gap-2.5">
              <button type="button" role="switch" aria-checked={f.showOnHome} aria-label="Show on Home screen" onClick={() => setF({ ...f, showOnHome: !f.showOnHome })} className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', f.showOnHome ? 'bg-brand-700' : 'bg-[#d6d0c4]')}>
                <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', f.showOnHome && 'translate-x-5')} />
              </button>
              <span className="text-sm font-medium">{f.showOnHome ? 'Shown on Home' : 'Not on Home'}</span>
            </label>
            <p className="mt-1 text-[12px] text-muted">
              {f.parent ? 'Adds a row of this subcategory’s products to the app and website Home, after Best Sellers.' : 'Shows this category in “Shop by Category” on the app and website Home.'}
            </p>
          </div>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Image</span>
        <ImagePicker single value={f.image} onChange={(v) => setF({ ...f, image: v })} folder="categories" />
      </div>
      <div className="flex gap-2 lg:col-span-3 lg:justify-end">
        <Button type="button" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" loading={save.isPending}>{initial ? 'Save Changes' : 'Create Category'}</Button>
      </div>
    </form>
  );
}

export default function Categories() {
  const qc = useQueryClient();
  const [active, setActive] = useState<number | null>(1);
  const open: Record<number, boolean> = active ? { [active]: true } : {};
  /** Open exactly one section and bring it into view. */
  const focusSection = (n: number) => {
    setActive(n);
    requestAnimationFrame(() => document.getElementById(`section-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [selected, setSelected] = useState<Cat | null>(null);
  const [subEditing, setSubEditing] = useState<Cat | null | 'new'>(null);

  const q = useQuery({ queryKey: ['categories', 'root', search, status], queryFn: async () => (await api.get<{ items: Cat[] }>('/admin/categories', { params: { q: search, status } })).data.items });
  const parents = q.data ?? [];
  const subs = useQuery({ queryKey: ['categories', 'sub', selected?._id], queryFn: async () => (await api.get<{ items: Cat[] }>('/admin/categories', { params: { parent: selected!._id } })).data.items, enabled: !!selected });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (n: number) => (active === n ? setActive(null) : focusSection(n));
  const viewSubs = (c: Cat) => {
    setSelected(c);
    focusSection(4);
  };
  const paged = parents.slice((page - 1) * limit, page * limit);

  const actions = (c: Cat, isSub = false) => (
    <div className="flex items-center gap-1.5">
      <Button size="sm" icon={<Pencil size={13} />} onClick={() => (isSub ? setSubEditing(c) : (setEditing(c), focusSection(3)))}>Edit</Button>
      {!isSub && <Button size="sm" icon={<Eye size={13} />} onClick={() => viewSubs(c)}>View</Button>}
      <Menu items={[{ label: 'Delete', danger: true, onClick: () => confirm(`Delete “${c.name}”? This only works if it has no products or subcategories.`) && del.mutate(c._id) }]} />
    </div>
  );

  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Categories' }, { label: 'Manage Categories' }]} title="Category Management" sub="Organize your product categories and subcategories." />

      <Accordion
        n={1}
        title={`All Categories (${parents.length})`}
        sub="View and manage all product categories."
        open={!!open[1]}
        onToggle={() => toggle(1)}
        action={<div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" className="w-60" />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-32"><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => focusSection(2)}>Add Category</Button>
        </div>}
      >
        <QueryState q={q}>
          {() => (
            <>
              <Table head={['#', 'Image', 'Category Name', 'Description', 'Subcategories', 'Products', 'Status', 'Sort Order', 'Actions']}>
                {paged.map((c, i) => (
                  <tr key={c._id}>
                    <td className="tabular text-muted">{(page - 1) * limit + i + 1}</td>
                    <td><Img src={c.image} alt={c.name} className="h-10 w-14 rounded-lg" /></td>
                    <td className="font-semibold">{c.name}</td>
                    <td className="whitespace-normal! max-w-[260px] text-xs text-muted">{c.description}</td>
                    <td className="tabular text-center">{c.subcategoryCount}</td>
                    <td className="tabular text-center">{c.productCount}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="tabular text-center">{c.sortOrder}</td>
                    <td>{actions(c)}</td>
                  </tr>
                ))}
              </Table>
              {!parents.length && <p className="py-10 text-center text-sm text-muted">No categories found.</p>}
              <Pagination page={page} total={parents.length} limit={limit} noun="categories" onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
            </>
          )}
        </QueryState>
      </Accordion>

      <Accordion n={2} title="Add New Category" sub="Create a new category with image, description and settings." open={!!open[2]} onToggle={() => toggle(2)}>
        <CategoryForm parents={parents} onDone={() => focusSection(1)} />
      </Accordion>

      <Accordion n={3} title="Edit Category" sub="Update category details, image, visibility and sort order." open={!!open[3]} onToggle={() => toggle(3)}>
        {editing ? <CategoryForm initial={editing} parents={parents} onDone={() => { setEditing(null); focusSection(1); }} /> : <p className="text-sm text-muted">Choose <b>Edit</b> on a category above to change it here.</p>}
      </Accordion>

      <Accordion n={4} tone="accent" title="Subcategories" sub="Manage subcategories under a category." open={!!open[4]} onToggle={() => toggle(4)}>
        {!selected ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">Pick a category:</p>
            {parents.map((p) => <Button key={p._id} size="sm" onClick={() => setSelected(p)}>{p.name}</Button>)}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-line p-3">
              <Button size="sm" icon={<ArrowLeft size={14} />} onClick={() => setSelected(null)}>Back to Categories</Button>
              <Img src={selected.image} alt={selected.name} className="h-12 w-16 rounded-lg" />
              <div className="min-w-[180px] flex-1"><p className="font-bold">{selected.name}</p><p className="text-xs text-muted">{selected.description}</p></div>
              <StatusBadge status={selected.status} />
              {[['Subcategories', subs.data?.length ?? selected.subcategoryCount], ['Products', selected.productCount], ['Sort Order', selected.sortOrder]].map(([l, v]) => (
                <div key={l as string} className="border-l border-line pl-4 text-center"><p className="tabular font-extrabold">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
              ))}
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setSubEditing('new')}>Add Subcategory</Button>
            </div>
            {subEditing && (
              <div className="mb-4 rounded-xl border border-line bg-[#fcfaf6] p-4">
                <CategoryForm initial={subEditing === 'new' ? null : subEditing} parents={parents} fixedParent={selected._id} onDone={() => setSubEditing(null)} />
              </div>
            )}
            <QueryState q={subs}>
              {(items) => (
                <>
                  <Table head={['#', 'Image', 'Subcategory Name', 'Description', 'Products', 'Status', 'Sort Order', 'Actions']}>
                    {items.map((c, i) => (
                      <tr key={c._id}>
                        <td className="tabular text-muted">{i + 1}</td>
                        <td><Img src={c.image} alt={c.name} className="h-9 w-12 rounded-lg" /></td>
                        <td className="font-semibold">{c.name}</td>
                        <td className="whitespace-normal! text-xs text-muted">{c.description}</td>
                        <td className="tabular">{c.productCount}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td className="tabular">{c.sortOrder}</td>
                        <td>{actions(c, true)}</td>
                      </tr>
                    ))}
                  </Table>
                  {!items.length && <p className="py-8 text-center text-sm text-muted">No subcategories yet.</p>}
                </>
              )}
            </QueryState>
          </>
        )}
      </Accordion>
    </div>
  );
}
