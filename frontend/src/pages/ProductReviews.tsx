import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { date } from '../lib/format';
import { Button, Card, PageHeader, Table, StatusBadge, Pagination, Tabs, Img, Avatar, QueryState } from '../components/ui';

interface Review { _id: string; product: { name: string; images: { url: string }[] }; customer: { name: string; avatar?: string }; rating: number; text?: string; status: string; createdAt: string }

export default function ProductReviews() {
  const [status, setStatus] = useState<'' | 'approved' | 'pending' | 'rejected'>('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['reviews', status, page], queryFn: async () => (await api.get<{ items: Review[]; total: number }>('/admin/reviews', { params: { status, page, limit: 10 } })).data });
  const mod = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/admin/reviews/${id}`, { status }),
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Products', to: '/admin/products' }, { label: 'Product Reviews' }]} title="Product Reviews" sub="Moderate reviews from verified purchases before they appear in the app." />
      <Card>
        <div className="p-4"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }, { value: 'rejected', label: 'Hidden' }]} /></div>
        <QueryState q={q}>
          {(d) => (
            <>
              <div className="px-4">
                <Table head={['Product', 'Customer', 'Rating', 'Review', 'Date', 'Status', 'Actions']}>
                  {d.items.map((r) => (
                    <tr key={r._id}>
                      <td><div className="flex items-center gap-2.5"><Img src={r.product?.images?.[0]?.url} alt="" className="size-10 rounded-lg" /><span className="font-medium">{r.product?.name}</span></div></td>
                      <td><div className="flex items-center gap-2"><Avatar src={r.customer?.avatar} name={r.customer?.name ?? '?'} size={28} />{r.customer?.name}</div></td>
                      <td><span className="flex items-center gap-1 font-semibold text-accent-600" aria-label={`${r.rating} out of 5`}>{r.rating} <Star size={13} fill="currentColor" aria-hidden /></span></td>
                      <td className="whitespace-normal! max-w-xs text-muted">{r.text || '—'}</td>
                      <td className="text-muted">{date(r.createdAt)}</td>
                      <td><StatusBadge status={r.status === 'approved' ? 'active' : r.status} label={r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Hidden' : 'Pending'} /></td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status !== 'approved' && <Button size="sm" onClick={() => mod.mutate({ id: r._id, status: 'approved' })}>Approve</Button>}
                          {r.status !== 'rejected' && <Button size="sm" variant="danger-soft" onClick={() => mod.mutate({ id: r._id, status: 'rejected' })}>Hide</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
                {!d.items.length && <p className="py-12 text-center text-sm text-muted">No reviews here.</p>}
              </div>
              <Pagination page={page} total={d.total} limit={10} noun="reviews" onPage={setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
