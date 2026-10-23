import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, ChevronRight, FileText, Heart, HelpCircle, Info, LogOut, Mail, MapPin, Monitor, Moon, Phone, Plus, Receipt, Settings, Shield, Sun, Tag, Trash2, Truck, UserRound } from 'lucide-react';
import { ago, dateTime, date as fmtDate } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { useShopAuth } from '../auth';
import { couponLabel, useAddresses, useCoupons, useNotifications, useTickets, useWishlist } from '../data';
import { useShopTheme, type ThemeMode } from '../ShopLayout';
import { Btn, ButtonLink, cx, EmptyState, FormField, Page, PageTitle, Panel, ProductGrid, SelectBox, Sheet, SkeletonGrid, StatusPill, TextArea, TextInput, View } from '../ui';
import { AddressCard } from './Checkout';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../config';


function Row({ to, icon, label, detail, onClick, danger }: { to?: string; icon: ReactNode; label: string; detail?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className={cx('shrink-0', danger ? 'text-danger' : 'text-brand-700')}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cx('block text-[15px] font-semibold', danger && 'text-danger')}>{label}</span>
        {detail ? <span className="block truncate text-[13px] text-muted">{detail}</span> : null}
      </span>
      {!danger && (to || onClick) ? <ChevronRight className="size-5 text-muted" aria-hidden /> : null}
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3.5 px-4 py-3 hover:bg-line-soft';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title ? <h2 className="mb-2 px-1 text-sm font-bold text-muted">{title}</h2> : null}
      <Panel className="divide-y divide-line overflow-hidden">{children}</Panel>
    </section>
  );
}

// ------------------------------------------------------------------ Profile hub
export function AccountPage() {
  const { user, logout } = useShopAuth();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!user) return null;
  return (
    <Page narrow>
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl font-extrabold text-brand-700">
          {user.avatar ? <img src={user.avatar} alt="" className="size-full object-cover" /> : user.name.trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{user.name}</h1>
          {user.phone ? <p className="text-sm text-muted">{user.phone}</p> : null}
          {user.email ? <p className="truncate text-sm text-muted">{user.email}</p> : null}
        </div>
        <ButtonLink to="/account/edit" tone="outline">Edit</ButtonLink>
      </div>
      <div className="mt-8 space-y-6">
        <Group title="Your account">
          <Row to="/account/orders" icon={<Receipt className="size-5" />} label="My orders" />
          <Row to="/account/addresses" icon={<MapPin className="size-5" />} label="My addresses" />
          <Row to="/account/wishlist" icon={<Heart className="size-5" />} label="My wishlist" />
          <Row to="/account/coupons" icon={<Tag className="size-5" />} label="Offers & coupons" />
          <Row to="/account/notifications" icon={<Bell className="size-5" />} label="Notifications" />
        </Group>
        <Group title="Support & app">
          <Row to="/account/help" icon={<HelpCircle className="size-5" />} label="Help & support" />
          <Row to="/account/settings" icon={<Settings className="size-5" />} label="Settings & legal" />
        </Group>
        <Group>
          <Row icon={<LogOut className="size-5" />} label="Log out" danger onClick={() => setConfirm(true)} />
        </Group>
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Log out?"
        footer={<div className="flex gap-3"><Btn tone="outline" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Btn><Btn tone="danger" className="flex-1" onClick={async () => { await logout(); nav('/'); }}>Log out</Btn></div>}
      >
        <p className="text-muted">You’ll need to sign in again to place orders.</p>
      </Sheet>
    </Page>
  );
}

export function EditProfilePage() {
  const { user, updateUser } = useShopAuth();
  const nav = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr('Enter your name');
    setBusy(true);
    try {
      const { data } = await shopApi.patch('/store/me/profile', { name: name.trim() });
      updateUser({ ...user!, ...data.user, id: data.user._id ?? data.user.id ?? user!.id });
      toast.success('Profile updated');
      nav('/account');
    } catch (e2) {
      toast.error(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page narrow>
      <PageTitle>Edit profile</PageTitle>
      <form onSubmit={save} noValidate className="space-y-5">
        <FormField label="Full name" htmlFor="p-name" error={err}><TextInput id="p-name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={Boolean(err)} /></FormField>
        <FormField label="Email" htmlFor="p-email"><TextInput id="p-email" value={user?.email ?? ''} disabled /></FormField>
        <FormField label="Phone" htmlFor="p-phone" hint="Contact support to change your email or phone."><TextInput id="p-phone" value={user?.phone ?? ''} disabled /></FormField>
        <Btn type="submit" block size="lg" loading={busy}>Save changes</Btn>
      </form>
    </Page>
  );
}

// ------------------------------------------------------------------ Addresses
export function AddressesPage() {
  const q = useAddresses();
  const nav = useNavigate();
  return (
    <Page narrow>
      <PageTitle>My addresses</PageTitle>
      <ButtonLink to="/account/addresses/new" tone="outline" className="mb-4 w-full"><Plus className="size-4" /> Add new address</ButtonLink>
      <View q={q} empty={(l) => (l.length ? null : <EmptyState icon={<MapPin className="size-8" />} title="No saved addresses" message="Add an address to see delivery options." />)}>
        {(l) => <div className="space-y-3">{l.map((a) => <AddressCard key={a._id} a={a} onEdit={() => nav(`/account/addresses/${a._id}`)} />)}</div>}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Wishlist / coupons
export function WishlistPage() {
  const q = useWishlist();
  return (
    <Page>
      <PageTitle>My wishlist</PageTitle>
      <View q={q} skeleton={<SkeletonGrid />} empty={(l) => (l.length ? null : <EmptyState icon={<Heart className="size-8" />} title="Your wishlist is empty" message="Tap the heart on any product to save it here." action={<ButtonLink to="/" className="w-full">Start shopping</ButtonLink>} />)}>
        {(items) => <ProductGrid items={items} />}
      </View>
    </Page>
  );
}

export function CouponsPage() {
  const q = useCoupons();
  return (
    <Page narrow>
      <PageTitle>Offers & coupons</PageTitle>
      <View q={q} empty={(l) => (l.length ? null : <EmptyState icon={<Tag className="size-8" />} title="No offers right now" message="New coupons show up here as soon as they go live." />)}>
        {(l) => (
          <ul className="space-y-3">
            {l.map((c) => (
              <li key={c._id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-500"><Tag className="size-6" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">{couponLabel(c)}</span>
                  <span className="text-[13px] text-muted">Min order ₹{c.minOrder}{c.endDate ? ` · Ends ${fmtDate(c.endDate)}` : ''}</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast.success(`Copied ${c.code}`), () => undefined)}
                  className="rounded-lg border border-brand-700/50 px-3 py-2 text-sm font-extrabold tracking-wide text-brand-700 hover:bg-brand-50"
                  aria-label={`Copy code ${c.code}`}
                >
                  {c.code}
                </button>
              </li>
            ))}
          </ul>
        )}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Notifications
const kindIcon = (k: string) => (k === 'order' ? Truck : k === 'offer' ? Tag : Info);

export function NotificationsPage() {
  const q = useNotifications();
  const qc = useQueryClient();
  const readAll = async () => {
    try {
      await shopApi.post('/store/me/notifications/read-all');
      qc.invalidateQueries({ queryKey: ['shop', 'notifications'] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Page narrow>
      <PageTitle action={q.data?.some((n) => !n.read) ? <Btn tone="ghost" onClick={readAll}>Mark all read</Btn> : undefined}>Notifications</PageTitle>
      <View q={q} empty={(l) => (l.length ? null : <EmptyState icon={<Bell className="size-8" />} title="No notifications yet" message="Order updates and offers will appear here." />)}>
        {(l) => (
          <ul className="space-y-2">
            {l.map((n) => {
              const Icon = kindIcon(n.kind);
              return (
                <li key={n._id}>
                  <Link to={`/account/notifications/${n._id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand-700/50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cx('flex-1 truncate', n.read ? 'font-semibold' : 'font-extrabold')}>{n.title}</span>
                        {!n.read ? <span className="size-2 rounded-full bg-accent-500" aria-label="Unread" /> : null}
                      </span>
                      {n.body ? <span className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</span> : null}
                      <span className="mt-1.5 block text-xs text-muted">{ago(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </View>
    </Page>
  );
}

export function NotificationDetailPage() {
  const { id = '' } = useParams();
  const q = useNotifications();
  const qc = useQueryClient();
  const n = q.data?.find((x) => x._id === id);
  useEffect(() => {
    if (n && !n.read) shopApi.post(`/store/me/notifications/${n._id}/read`).then(() => qc.invalidateQueries({ queryKey: ['shop', 'notifications'] }), () => undefined);
  }, [n, qc]);
  return (
    <Page narrow>
      <View q={q} empty={() => (n ? null : <EmptyState title="Notification not found" action={<ButtonLink to="/account/notifications" className="w-full">All notifications</ButtonLink>} />)}>
        {() => {
          const Icon = kindIcon(n!.kind);
          const hasOrder = /#VSR\d{8}-\d+/.test(`${n!.title} ${n!.body ?? ''}`);
          return (
            <article>
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><Icon className="size-6" aria-hidden /></span>
                <span>
                  <span className="block text-sm font-bold text-brand-700">{n!.kind === 'order' ? 'Order update' : n!.kind === 'offer' ? 'Offer' : 'Update'}</span>
                  <span className="text-[13px] text-muted">{dateTime(n!.createdAt)}</span>
                </span>
              </div>
              <h1 className="mt-6 text-2xl font-extrabold">{n!.title}</h1>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed">{n!.body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {hasOrder ? <ButtonLink to="/account/orders"><Receipt className="size-4" /> View my orders</ButtonLink> : null}
                {n!.link ? <ButtonLink to={n!.link}>View product</ButtonLink> : n!.kind === 'offer' ? <ButtonLink to="/deals"><Tag className="size-4" /> See offers & deals</ButtonLink> : null}
              </div>
            </article>
          );
        }}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Help & support
const ISSUES: [string, string][] = [
  ['order', 'Order issue'],
  ['delivery', 'Delivery issue'],
  ['return_refund', 'Return / Refund'],
  ['product', 'Product quality'],
  ['payment', 'Payment issue'],
  ['other', 'Other'],
];
const FAQ: [string, string][] = [
  ['When will my order be confirmed?', 'VSR checks stock and payment for every order, usually within a few minutes. You’ll get a notification once it is confirmed.'],
  ['What is the delivery code?', 'When your order is out for delivery, a 6-digit code appears on the order screen. Share it only with the delivery partner at your door.'],
  ['How do refunds work?', 'Refunds go back to your original payment method after the payment provider confirms them. COD refunds are settled by bank transfer.'],
];

export function HelpPage() {
  const [sp] = useSearchParams();
  const orderId = sp.get('order') ?? undefined;
  const tickets = useTickets();
  const qc = useQueryClient();
  const [open, setOpen] = useState(Boolean(orderId));
  const [f, setF] = useState({ issueType: 'order', subject: '', description: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.subject.trim().length < 3 || f.description.trim().length < 5) return setErr('Add a subject and a short description');
    setBusy(true);
    try {
      await shopApi.post('/store/me/tickets', { ...(orderId ? { orderId } : {}), issueType: f.issueType, subject: f.subject.trim(), description: f.description.trim() });
      qc.invalidateQueries({ queryKey: ['shop', 'tickets'] });
      setOpen(false);
      setF({ issueType: 'order', subject: '', description: '' });
      toast.success('Ticket created. Our team will get back to you soon.');
    } catch (e2) {
      toast.error(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page narrow>
      <PageTitle>Help & support</PageTitle>
      <div className="space-y-6">
        <Group title="Get in touch">
          <Row icon={<HelpCircle className="size-5" />} label="Raise a ticket" detail="Order, delivery, payment or return issues" onClick={() => setOpen(true)} />
          <Row to={`tel:${SUPPORT_PHONE}`} icon={<Phone className="size-5" />} label="Call support" detail={SUPPORT_PHONE} />
          <Row to={`mailto:${SUPPORT_EMAIL}`} icon={<Mail className="size-5" />} label="Email us" detail={SUPPORT_EMAIL} />
        </Group>
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted">Common questions</h2>
          <Panel className="divide-y divide-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold">
                  {q}
                  <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <p className="pb-4 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </Panel>
          <Link to="/faq" className="mt-2 inline-flex min-h-11 items-center px-1 text-sm font-bold text-brand-700">All FAQs</Link>
        </section>
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted">My tickets</h2>
          <View q={tickets} empty={(l) => (l.length ? null : <Panel className="p-4 text-sm text-muted">No tickets yet. Anything you raise shows up here with its status.</Panel>)}>
            {(l) => (
              <Panel className="divide-y divide-line">
                {l.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.subject}</span>
                      <span className="text-[13px] text-muted">{t.ticketNumber} · {fmtDate(t.createdAt)}</span>
                    </span>
                    <StatusPill status={t.status} />
                  </div>
                ))}
              </Panel>
            )}
          </View>
        </section>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Raise a ticket">
        <form onSubmit={submit} noValidate className="space-y-4">
          {orderId ? <p className="text-sm text-muted">Linked to this order</p> : null}
          <FormField label="Issue type" htmlFor="t-type">
            <SelectBox id="t-type" value={f.issueType} onChange={(e) => setF({ ...f, issueType: e.target.value })}>
              {ISSUES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectBox>
          </FormField>
          <FormField label="Subject" htmlFor="t-sub"><TextInput id="t-sub" maxLength={120} value={f.subject} onChange={(e) => { setF({ ...f, subject: e.target.value }); setErr(''); }} /></FormField>
          <FormField label="Describe the issue" htmlFor="t-desc" error={err}><TextArea id="t-desc" maxLength={2000} value={f.description} onChange={(e) => { setF({ ...f, description: e.target.value }); setErr(''); }} aria-invalid={Boolean(err)} /></FormField>
          <Btn type="submit" block size="lg" loading={busy}>Submit</Btn>
        </form>
      </Sheet>
    </Page>
  );
}

// ------------------------------------------------------------------ Settings & legal
export function SettingsPage() {
  const { mode, setMode } = useShopTheme();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestDeletion = async () => {
    setBusy(true);
    try {
      await shopApi.post('/store/me/tickets', { issueType: 'other', subject: 'Account deletion request', description: 'Please delete my VSR account and personal data.' });
      setConfirm(false);
      toast.success('Request received. Our team will confirm by email.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const modes: [ThemeMode, string, ReactNode][] = [
    ['system', 'System', <Monitor key="m" className="size-4" />],
    ['light', 'Light', <Sun key="s" className="size-4" />],
    ['dark', 'Dark', <Moon key="d" className="size-4" />],
  ];
  return (
    <Page narrow>
      <PageTitle>Settings & legal</PageTitle>
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-muted">Appearance</h2>
          <Panel className="p-4">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
              {modes.map(([v, l, icon]) => (
                <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cx('flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold', mode === v ? 'border-brand-700 bg-brand-100 text-ink' : 'border-line text-muted')}>
                  {icon} {l}
                </button>
              ))}
            </div>
          </Panel>
        </section>
        <Group title="Legal">
          <Row to="/privacy" icon={<Shield className="size-5" />} label="Privacy Policy" />
          <Row to="/terms" icon={<FileText className="size-5" />} label="Terms & Conditions" />
          <Row to="/refund-policy" icon={<Receipt className="size-5" />} label="Refunds & cancellations" />
          <Row to="/delivery-policy" icon={<Truck className="size-5" />} label="Delivery policy" />
          <Row to="/faq" icon={<HelpCircle className="size-5" />} label="FAQs" />
          <Row to="/contact" icon={<Mail className="size-5" />} label="Contact us" />
          <Row to="/about" icon={<UserRound className="size-5" />} label="About VSR" detail="Shop · Eat · Live Better" />
        </Group>
        <Group>
          <Row icon={<Trash2 className="size-5" />} label="Request account deletion" danger onClick={() => setConfirm(true)} />
        </Group>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete your account?" footer={<div className="flex gap-3"><Btn tone="outline" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Btn><Btn tone="danger" className="flex-1" loading={busy} onClick={requestDeletion}>Send request</Btn></div>}>
        <p className="text-muted">We’ll raise a request with our team to delete your account and personal data. They’ll confirm by email.</p>
      </Sheet>
    </Page>
  );
}
