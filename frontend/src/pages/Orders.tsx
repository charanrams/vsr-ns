import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { api } from '../lib/api';
import { money, dateTime, title } from '../lib/format';
import { Card, PageHeader, Table, StatusBadge, Pagination, SearchInput, Chips, IconButton, Avatar, QueryState, Badge } from '../components/ui';

interface OrderRow {
  _id: string;
  orderNumber: string;
  customer: { name: string; phone: string; avatar?: string };
  items: unknown[];
  totals: { grandTotal: number };
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

const FILTERS = [
  ['', 'All Orders'], ['placed', 'New'], ['processing', 'Processing'], ['out_for_delivery', 'Out for Delivery'],
  ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['returns', 'Returns'],
] as const;

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const limit = Number(sp.get('limit') ?? 10);
  const q = sp.get('q') ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n);
  };

  const query = useQuery({
    queryKey: ['orders', status, page, limit, q],
    queryFn: async () => (await api.get<{ items: OrderRow[]; total: number; counts: Record<string, number> }>('/admin/orders', { params: { status, page, limit, q } })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const label = FILTERS.find((f) => f[0] === status)?.[1] ?? 'All Orders';

  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Orders' }, { label }]} title={label === 'All Orders' ? 'Orders' : `${label} Orders`} sub="Review incoming bookings, confirm stock and payment, and move orders through fulfilment." />
      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips value={status} onChange={(v) => set('status', v)} items={FILTERS.map(([v, l]) => ({ value: v, label: l }))} />
          <SearchInput value={q} onChange={(v) => set('q', v)} placeholder="Search order ID, customer, phone…" className="lg:w-80" />
        </div>
        <QueryState q={query}>
          {(d) => (
            <>
              <div className="px-4">
                <Table head={['Order ID', 'Customer', 'Items', 'Amount', 'Payment', 'Status', 'Placed', 'Action']}>
                  {d.items.map((o) => (
                    <tr key={o._id} className="cursor-pointer" onClick={() => nav(`/admin/orders/${o._id}`)}>
                      <td className="tabular font-semibold">#{o.orderNumber}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar src={o.customer?.avatar} name={o.customer?.name ?? '?'} size={30} />
                          <div><p className="font-medium">{o.customer?.name}</p><p className="text-xs text-muted">{o.customer?.phone}</p></div>
                        </div>
                      </td>
                      <td className="tabular">{o.items.length}</td>
                      <td className="tabular font-semibold">{money(o.totals.grandTotal)}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs text-muted">{o.paymentMethod === 'cod' ? 'Cash on Delivery' : title(o.paymentMethod).toUpperCase()}</span>
                          <StatusBadge status={o.paymentStatus} />
                        </div>
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="tabular text-muted">{dateTime(o.createdAt)}</td>
                      <td><IconButton label={`Open order ${o.orderNumber}`} onClick={(e) => { e.stopPropagation(); nav(`/admin/orders/${o._id}`); }}><Eye size={15} /></IconButton></td>
                    </tr>
                  ))}
                </Table>
                {!d.items.length && <div className="py-12 text-center text-sm text-muted">No orders match these filters. {status === 'placed' && <Badge tone="success">You’re all caught up</Badge>}</div>}
              </div>
              <Pagination page={page} total={d.total} limit={limit} noun="orders" onPage={(p) => set('page', String(p))} onLimit={(l) => set('limit', String(l))} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
