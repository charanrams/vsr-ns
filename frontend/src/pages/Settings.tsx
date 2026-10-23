import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/access';
import { dateTime, date } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, Table, StatusBadge, Avatar, QueryState, Tabs, Dialog, Field, Input, Badge, Pagination } from '../components/ui';

interface Staff { _id: string; name: string; email: string; avatar?: string; roles: string[]; status: string; lastLoginAt?: string; createdAt: string }
interface Log { _id: string; actor?: { name: string; email: string }; action: string; resourceType?: string; summary?: string; createdAt: string }
const STAFF_ROLES = ['super_admin', 'order_manager', 'catalogue_manager', 'inventory_manager', 'finance_manager', 'support_agent'];

export default function Settings() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', roles: ['order_manager'] });
  const users = useQuery({ queryKey: ['staff'], queryFn: async () => (await api.get<{ items: Staff[] }>('/admin/users')).data.items, enabled: can('users') });
  const logs = useQuery({ queryKey: ['audit', page], queryFn: async () => (await api.get<{ items: Log[]; total: number }>('/admin/audit-logs', { params: { page, limit: 15 } })).data, enabled: tab === 'audit' });
  const create = useMutation({
    mutationFn: async () => api.post('/admin/users', f),
    onSuccess: () => { toast.success('Staff account created'); setAdding(false); setF({ name: '', email: '', password: '', roles: ['order_manager'] }); qc.invalidateQueries({ queryKey: ['staff'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: object }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => { toast.success('Access updated'); qc.invalidateQueries({ queryKey: ['staff'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Settings' }]} title="Settings" sub="Staff access, roles and the audit trail of sensitive actions." actions={tab === 'users' && can('users') ? <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add Staff</Button> : undefined} />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: 'users', label: 'Staff & Roles' }, { value: 'audit', label: 'Audit Log' }]} />
      {tab === 'users' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <Card>
            <QueryState q={users}>
              {(items) => (
                <div className="p-4">
                  <Table head={['Staff', 'Email', 'Role', 'Status', 'Last sign-in', 'Actions']}>
                    {items.map((u) => (
                      <tr key={u._id}>
                        <td><div className="flex items-center gap-2.5"><Avatar src={u.avatar} name={u.name} size={32} /><span className="font-semibold">{u.name}</span>{u._id === user?.id && <Badge tone="brand">You</Badge>}</div></td>
                        <td className="text-muted">{u.email}</td>
                        <td>
                          <select aria-label={`Role for ${u.name}`} value={u.roles[0]} disabled={u._id === user?.id} onChange={(e) => update.mutate({ id: u._id, body: { roles: [e.target.value] } })} className="h-9 rounded-lg border border-line bg-white px-2 text-[13px] disabled:opacity-60">
                            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        </td>
                        <td><StatusBadge status={u.status} /></td>
                        <td className="text-xs text-muted">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'}</td>
                        <td>{u._id !== user?.id && <Button size="sm" variant={u.status === 'active' ? 'danger-soft' : 'secondary'} onClick={() => update.mutate({ id: u._id, body: { status: u.status === 'active' ? 'inactive' : 'active' } })}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</Button>}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
            </QueryState>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand-700" aria-hidden /> How roles work</span>} />
            <ul className="space-y-2.5 px-5 pb-5 text-[13px]">
              <li><b>Super Admin</b>: everything, including staff and audit log.</li>
              <li><b>Order Manager</b>: orders, customers, delivery and notifications.</li>
              <li><b>Catalogue Manager</b>: products, categories, homemade food and offers.</li>
              <li><b>Inventory Manager</b>: stock levels, adjustments and history.</li>
              <li><b>Finance Manager</b>: payments, refunds, reports.</li>
              <li><b>Support Agent</b>: tickets, returns and customer lookup.</li>
              <li className="pt-1 text-muted">After sign-in, each email is sent to its role’s workspace. The server enforces every permission, so hidden pages can’t be opened by URL.</li>
            </ul>
          </Card>
        </div>
      ) : (
        <Card>
          <QueryState q={logs}>
            {(d) => (
              <>
                <div className="p-4">
                  <Table head={['When', 'Actor', 'Action', 'Resource', 'Summary']}>
                    {d.items.map((l) => (
                      <tr key={l._id}>
                        <td className="tabular text-xs text-muted">{dateTime(l.createdAt)}</td>
                        <td>{l.actor?.name ?? 'System'}</td>
                        <td className="tabular"><Badge>{l.action}</Badge></td>
                        <td className="text-muted">{l.resourceType}</td>
                        <td className="whitespace-normal! max-w-md text-muted">{l.summary}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
                <Pagination page={page} total={d.total} limit={15} noun="events" onPage={setPage} />
              </>
            )}
          </QueryState>
        </Card>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add staff account" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>Create Account</Button></>}>
        <div className="space-y-3">
          <Field label="Full name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Work email" required hint="The role below decides where this email lands after sign-in."><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Temporary password" required hint="At least 8 characters."><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role" required>
            <select value={f.roles[0]} onChange={(e) => setF({ ...f, roles: [e.target.value] })} className="h-10 w-full rounded-[10px] border border-line bg-white px-3 text-sm">
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <p className="text-xs text-muted">Created {date(new Date())} by {user?.name}. Recorded in the audit log.</p>
        </div>
      </Dialog>
    </div>
  );
}
