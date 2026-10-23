import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Star, Clock, MapPin } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { money } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, Table, StatusBadge, Img, IconButton, QueryState, Dialog, Field, Input, Select } from '../components/ui';
import type { ProductRow } from './Products';

interface Kitchen { _id: string; name: string; chef?: string; image?: string; area?: string; openingHours?: string; rating: number; verification: string; status: string }
const empty = { name: '', chef: '', image: '', area: '', openingHours: '', verification: 'pending', status: 'active' };

export default function Homemade() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Kitchen | 'new' | null>(null);
  const [f, setF] = useState(empty);
  const kitchens = useQuery({ queryKey: ['kitchens'], queryFn: async () => (await api.get<{ items: Kitchen[] }>('/admin/kitchens')).data.items });
  const cats = useQuery({ queryKey: ['cats-root'], queryFn: async () => (await api.get<{ items: { _id: string; name: string }[] }>('/admin/categories')).data.items });
  const food = useQuery({
    queryKey: ['products', 'homemade', cats.data],
    queryFn: async () => (await api.get<{ items: ProductRow[] }>('/admin/products', { params: { category: cats.data?.find((c) => c.name === 'Homemade Food')?._id, limit: 50 } })).data.items,
    enabled: !!cats.data,
  });
  const save = useMutation({
    mutationFn: async () => (editing === 'new' ? api.post('/admin/kitchens', f) : api.put(`/admin/kitchens/${(editing as Kitchen)._id}`, f)),
    onSuccess: () => {
      toast.success('Kitchen saved');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['kitchens'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const open = (k: Kitchen | 'new') => {
    setEditing(k);
    setF(k === 'new' ? empty : { name: k.name, chef: k.chef ?? '', image: k.image ?? '', area: k.area ?? '', openingHours: k.openingHours ?? '', verification: k.verification, status: k.status });
  };
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Homemade Food' }]} title="Homemade Food" sub="Verified home kitchens and their menus." actions={<><Button icon={<Plus size={16} />} onClick={() => open('new')}>Add Kitchen</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/admin/products/new')}>Add Dish</Button></>} />
      <QueryState q={kitchens}>
        {(items) => (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((k) => (
              <Card key={k._id} className="overflow-hidden">
                <Img src={k.image} alt={k.name} className="h-36 w-full" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{k.name}</p><p className="text-xs text-muted">by {k.chef}</p></div><IconButton label={`Edit ${k.name}`} onClick={() => open(k)}><Pencil size={14} /></IconButton></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1"><MapPin size={12} aria-hidden />{k.area}</span>
                    <span className="flex items-center gap-1"><Clock size={12} aria-hidden />{k.openingHours}</span>
                    <span className="flex items-center gap-1"><Star size={12} className="text-accent-500" fill="currentColor" aria-hidden />{k.rating}</span>
                  </div>
                  <div className="mt-3 flex gap-2"><StatusBadge status={k.verification} /><StatusBadge status={k.status} /></div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
      <Card>
        <CardHeader title="Homemade menu" sub="Dishes in the Homemade Food category" />
        <QueryState q={food}>
          {(items) => (
            <div className="px-4 pb-4">
              <Table head={['Dish', 'Kitchen', 'Price', 'Available today', 'Status', '']}>
                {items.map((p) => (
                  <tr key={p._id}>
                    <td><div className="flex items-center gap-3"><Img src={p.images[0]?.url} alt="" className="size-11 rounded-lg" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{p.unit}</p></div></div></td>
                    <td className="text-muted">{p.brand}</td>
                    <td className="tabular font-semibold">{money(p.price)}</td>
                    <td className="tabular">{p.available}</td>
                    <td><StatusBadge status={p.status !== 'active' ? p.status : p.stockStatus === 'in_stock' ? 'active' : p.stockStatus} /></td>
                    <td><IconButton label={`Edit ${p.name}`} onClick={() => nav(`/admin/products/${p._id}/edit`)}><Pencil size={14} /></IconButton></td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </QueryState>
      </Card>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add kitchen' : 'Edit kitchen'} footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kitchen name" required className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Chef"><Input value={f.chef} onChange={(e) => setF({ ...f, chef: e.target.value })} /></Field>
          <Field label="Area"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
          <Field label="Opening hours" className="col-span-2"><Input value={f.openingHours} onChange={(e) => setF({ ...f, openingHours: e.target.value })} placeholder="11:00 AM – 9:00 PM" /></Field>
          <Field label="Image URL" className="col-span-2"><Input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} /></Field>
          <Field label="Verification"><Select value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value })}><option value="pending">Pending</option><option value="verified">Verified</option></Select></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        </div>
      </Dialog>
    </div>
  );
}
