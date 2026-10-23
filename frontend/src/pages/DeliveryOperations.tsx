import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardHeader, PageHeader, StatusBadge, Avatar, QueryState, Button, Badge } from '../components/ui';
import type { Partner } from './DeliveryPartners';

interface Active { _id: string; orderNumber: string; status: string; deliveryPartner?: string; address: { line1: string; line2?: string; city: string }; customer: { name: string } }

export default function DeliveryOperations() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['partners', 'ops'], queryFn: async () => (await api.get<{ items: Partner[]; active: Active[] }>('/admin/delivery-partners')).data, refetchInterval: 30_000 });
  const ready = useQuery({ queryKey: ['orders', 'packed-ready'], queryFn: async () => (await api.get<{ items: Active[]; total: number }>('/admin/orders', { params: { status: 'packed', limit: 20 } })).data });
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Delivery' }, { label: 'Operations' }]} title="Delivery Operations" sub="Orders waiting for a partner and deliveries in progress. Live map tracking needs partner consent and the delivery app." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2">Ready to assign <Badge tone="violet">{ready.data?.total ?? 0}</Badge></span>} sub="Packed orders without a partner" />
          <QueryState q={ready}>
            {(d) => (
              <ul className="divide-y divide-line-soft px-5 pb-4">
                {d.items.map((o) => (
                  <li key={o._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><p className="tabular text-[13px] font-bold">#{o.orderNumber}</p><p className="truncate text-xs text-muted">{o.customer?.name} · {o.address.line2 ?? o.address.city}</p></div>
                    <Button size="sm" onClick={() => nav(`/admin/orders/${o._id}`)}>Assign <ArrowRight size={14} /></Button>
                  </li>
                ))}
                {!d.items.length && <p className="py-8 text-center text-sm text-muted">Nothing waiting for assignment.</p>}
              </ul>
            )}
          </QueryState>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Deliveries in progress" />
          <QueryState q={q}>
            {(d) => (
              <ul className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2">
                {d.active.map((o) => {
                  const p = d.items.find((x) => x._id === o.deliveryPartner);
                  return (
                    <li key={o._id} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between"><p className="tabular text-[13px] font-bold">#{o.orderNumber}</p><StatusBadge status={o.status} /></div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} aria-hidden />{o.customer?.name} · {o.address.line1}, {o.address.line2 ?? o.address.city}</p>
                      {p && <div className="mt-2.5 flex items-center gap-2"><Avatar src={p.avatar} name={p.name} size={28} /><span className="text-[13px] font-medium">{p.name}</span><span className="text-xs text-muted">{p.phone}</span></div>}
                      <Button size="sm" className="mt-3 w-full" onClick={() => nav(`/admin/orders/${o._id}`)}>Open order</Button>
                    </li>
                  );
                })}
                {!d.active.length && <p className="col-span-2 py-8 text-center text-sm text-muted">No deliveries in progress.</p>}
              </ul>
            )}
          </QueryState>
        </Card>
      </div>
    </div>
  );
}
