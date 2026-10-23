import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Bike, Wifi, Truck, WifiOff, Pencil, Star } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { num } from '../lib/format';
import { Button, Card, PageHeader, StatCard, Table, StatusBadge, SearchInput, Tabs, Avatar, IconButton, QueryState, Dialog, Field, Input, Select } from '../components/ui';

export interface Partner { _id: string; name: string; phone: string; avatar?: string; vehicle?: string; serviceArea?: string; kycStatus: string; availability: string; rating: number; deliveries: number; distanceKm?: number }
const empty = { name: '', phone: '', vehicle: 'Bike', serviceArea: '', avatar: '', kycStatus: 'pending', availability: 'offline' };

export default function DeliveryPartners() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'' | 'online' | 'on_delivery' | 'offline'>('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partner | 'new' | null>(null);
  const [f, setF] = useState(empty);
  const list = useQuery({ queryKey: ['partners', tab, q], queryFn: async () => (await api.get<{ items: Partner[]; counts: Record<string, number> }>('/admin/delivery-partners', { params: { availability: tab, q } })).data });
  const save = useMutation({
    mutationFn: async () => (editing === 'new' ? api.post('/admin/delivery-partners', f) : api.put(`/admin/delivery-partners/${(editing as Partner)._id}`, f)),
    onSuccess: () => {
      toast.success('Delivery partner saved');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const open = (p: Partner | 'new') => {
    setEditing(p);
    setF(p === 'new' ? empty : { name: p.name, phone: p.phone, vehicle: p.vehicle ?? '', serviceArea: p.serviceArea ?? '', avatar: p.avatar ?? '', kycStatus: p.kycStatus, availability: p.availability });
  };
  const c = list.data?.counts ?? {};
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Delivery' }, { label: 'Delivery Partners' }]} title="Delivery Partners" sub="Onboard partners, review KYC and track availability." actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => open('new')}>Add Partner</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="brand" icon={<Bike size={22} />} label="Total Partners" value={num((c.online ?? 0) + (c.on_delivery ?? 0) + (c.offline ?? 0))} />
        <StatCard tone="accent" icon={<Wifi size={22} />} label="Online" value={num(c.online)} />
        <StatCard tone="info" icon={<Truck size={22} />} label="On Delivery" value={num(c.on_delivery)} />
        <StatCard tone="danger" icon={<WifiOff size={22} />} label="Offline" value={num(c.offline)} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <Tabs value={tab} onChange={setTab} items={[{ value: '', label: 'All' }, { value: 'online', label: 'Online' }, { value: 'on_delivery', label: 'On Delivery' }, { value: 'offline', label: 'Offline' }]} />
          <SearchInput value={q} onChange={setQ} placeholder="Search partners…" className="w-64" />
        </div>
        <QueryState q={list}>
          {(d) => (
            <div className="px-4 pb-4">
              <Table head={['Partner', 'Phone', 'Vehicle', 'Service Area', 'Rating', 'Deliveries', 'KYC', 'Availability', '']}>
                {d.items.map((p) => (
                  <tr key={p._id}>
                    <td><div className="flex items-center gap-2.5"><Avatar src={p.avatar} name={p.name} size={34} /><span className="font-semibold">{p.name}</span></div></td>
                    <td className="tabular">{p.phone}</td>
                    <td>{p.vehicle}</td>
                    <td className="text-muted">{p.serviceArea}</td>
                    <td><span className="flex items-center gap-1 font-semibold"><Star size={13} className="text-accent-500" fill="currentColor" aria-hidden />{p.rating}</span></td>
                    <td className="tabular">{p.deliveries}</td>
                    <td><StatusBadge status={p.kycStatus} /></td>
                    <td><StatusBadge status={p.availability} /></td>
                    <td><IconButton label={`Edit ${p.name}`} onClick={() => open(p)}><Pencil size={14} /></IconButton></td>
                  </tr>
                ))}
              </Table>
              {!d.items.length && <p className="py-12 text-center text-sm text-muted">No delivery partners found.</p>}
            </div>
          )}
        </QueryState>
      </Card>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add delivery partner' : 'Edit delivery partner'} footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone" required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Vehicle"><Input value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} /></Field>
          <Field label="Service area" className="col-span-2"><Input value={f.serviceArea} onChange={(e) => setF({ ...f, serviceArea: e.target.value })} /></Field>
          <Field label="KYC status"><Select value={f.kycStatus} onChange={(e) => setF({ ...f, kycStatus: e.target.value })}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></Select></Field>
          <Field label="Availability"><Select value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}><option value="online">Online</option><option value="on_delivery">On Delivery</option><option value="offline">Offline</option></Select></Field>
        </div>
      </Dialog>
    </div>
  );
}
