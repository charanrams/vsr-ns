import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Megaphone, Package, Info, BellRing } from 'lucide-react';
import { usePushPrompt } from '../lib/push';
import { api, errorMessage } from '../lib/api';
import { dateTime, title } from '../lib/format';
import { Button, Card, CardHeader, PageHeader, Field, Input, Textarea, Select, QueryState, Badge } from '../components/ui';

interface N { _id: string; title: string; body: string; kind: string; audience: string; recipient?: { name: string }; createdAt: string }

export default function Notifications() {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: '', body: '', kind: 'offer' });
  const q = useQuery({ queryKey: ['admin-notifications'], queryFn: async () => (await api.get<{ items: N[] }>('/admin/notifications')).data.items });
  const send = useMutation({
    mutationFn: async () => api.post('/admin/notifications', f),
    onSuccess: () => {
      toast.success('Notification sent to all customers');
      setF({ title: '', body: '', kind: 'offer' });
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const Icon = { offer: Megaphone, order: Package, system: Info } as const;
  return (
    <div className="animate-rise">
      <PageHeader crumbs={[{ label: 'Notifications' }]} title="Notifications" sub="Send in-app announcements and review transactional messages sent to customers." />
      <StaffPushPrompt />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-bold">Create notification</h2>
          <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-3.5">
            <Field label="Audience"><Select disabled value="all"><option value="all">All customers (in-app)</option></Select></Field>
            <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="offer">Offer</option><option value="system">System</option></Select></Field>
            <Field label="Title" required hint={`${f.title.length}/80`}><Input maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Message" required hint={`${f.body.length}/300`}><Textarea maxLength={300} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
            <div className="rounded-xl border border-line bg-[#fcfaf6] p-3">
              <p className="mb-1 text-[11px] font-semibold text-muted uppercase">Preview</p>
              <p className="text-sm font-bold">{f.title || 'Notification title'}</p>
              <p className="text-[13px] text-muted">{f.body || 'Your message appears here.'}</p>
            </div>
            <p className="text-xs text-muted">Promotional messages should only go to customers who opted in. Push/SMS delivery depends on configured providers.</p>
            <Button type="submit" variant="primary" className="w-full" icon={<Send size={15} />} loading={send.isPending} disabled={f.title.length < 2 || f.body.length < 2}>Send Notification</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Delivery history" />
          <QueryState q={q}>
            {(items) => (
              <ul className="divide-y divide-line-soft px-5 pb-4">
                {items.map((n) => {
                  const I = Icon[n.kind as keyof typeof Icon] ?? Info;
                  return (
                    <li key={n._id} className="flex gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><I size={16} aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{n.title}</p><Badge tone={n.audience === 'all_customers' ? 'accent' : 'neutral'}>{n.audience === 'all_customers' ? 'All customers' : n.recipient?.name ?? 'Customer'}</Badge><Badge>{title(n.kind)}</Badge></div>
                        <p className="text-[13px] text-muted">{n.body}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{dateTime(n.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryState>
        </Card>
      </div>
    </div>
  );
}

/** Staff: browser push for new orders and support tickets. */
function StaffPushPrompt() {
  const { state, enable } = usePushPrompt();
  if (state !== 'off' && state !== 'denied') return null;
  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
      <BellRing className="size-5 text-brand-700" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        {state === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your browser settings to get new-order alerts.'
          : 'Get a desktop alert for every new order and support ticket, even when this tab is in the background.'}
      </p>
      {state === 'off' ? <Button onClick={enable}>Turn on alerts</Button> : null}
    </Card>
  );
}
