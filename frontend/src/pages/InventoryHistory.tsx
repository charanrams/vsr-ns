import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime, title } from '../lib/format';
import { Card, PageHeader, Table, Pagination, Img, QueryState, Badge, Button } from '../components/ui';

interface Movement { _id: string; product: { name: string; sku: string; unit: string; images: { url: string }[] }; delta: number; field: string; reason: string; note?: string; reference?: string; actor?: { name: string }; createdAt: string }

export default function InventoryHistory() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get('page') ?? 1);
  const product = sp.get('product') ?? '';
  const q = useQuery({
    queryKey: ['movements', page, product],
    queryFn: async () => (await api.get<{ items: Movement[]; total: number }>('/admin/inventory/movements', { params: { page, limit: 15, product } })).data,
    placeholderData: keepPreviousData,
  });
  return (
    <div className="animate-rise">
      <PageHeader
        crumbs={[{ label: 'Inventory', to: '/admin/inventory' }, { label: 'Inventory History' }]}
        title={product ? `Stock history · ${sp.get('name') ?? ''}` : 'Inventory History'}
        sub="Every stock change with its reason, actor, time and reference."
        actions={product ? <Button onClick={() => setSp(new URLSearchParams())}>Show all products</Button> : undefined}
      />
      <Card>
        <QueryState q={q}>
          {(d) => (
            <>
              <div className="p-4">
                <Table head={['Product', 'Change', 'Type', 'Reason', 'Reference / Note', 'By', 'When']}>
                  {d.items.map((m) => (
                    <tr key={m._id}>
                      <td><div className="flex items-center gap-2.5"><Img src={m.product?.images?.[0]?.url} alt="" className="size-10 rounded-lg" /><div><p className="font-medium">{m.product?.name}</p><p className="tabular text-xs text-muted">{m.product?.sku}</p></div></div></td>
                      <td className={`tabular font-bold ${m.delta > 0 ? 'text-success' : 'text-danger'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</td>
                      <td><Badge tone={m.field === 'reserved' ? 'info' : 'neutral'}>{m.field === 'reserved' ? 'Reserved' : 'On hand'}</Badge></td>
                      <td>{title(m.reason)}</td>
                      <td className="tabular text-muted">{m.reference ?? m.note ?? '—'}</td>
                      <td>{m.actor?.name ?? 'System'}</td>
                      <td className="tabular text-muted">{dateTime(m.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
                {!d.items.length && <p className="py-12 text-center text-sm text-muted">No stock movements recorded.</p>}
              </div>
              <Pagination page={page} total={d.total} limit={15} noun="movements" onPage={(n) => { const s = new URLSearchParams(sp); s.set('page', String(n)); setSp(s); }} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
