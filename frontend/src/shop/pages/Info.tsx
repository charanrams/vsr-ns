import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronRight, CookingPot, KeyRound, Mail, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBasket, Store, Truck, Wallet } from 'lucide-react';
import { useShopAuth } from '../auth';
import { SERVICE_CITY, SUPPORT_EMAIL, SUPPORT_PHONE } from '../config';
import { DOCS, FAQS, LEGAL_ENTITY, LEGAL_UPDATED } from '../legal';
import { ButtonLink, Page, Panel } from '../ui';

function useTitle(t: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${t} · VSR`;
    return () => {
      document.title = prev;
    };
  }, [t]);
}

// ------------------------------------------------------------------ About (marketing)
export function AboutPage() {
  useTitle('About');
  const offer = [
    { icon: ShoppingBasket, title: 'Groceries & essentials', text: 'Fresh produce, dairy, staples, household and personal care, in one cart.' },
    { icon: CookingPot, title: 'Homemade food', text: 'Meals and snacks from local home kitchens, with prep times and ingredients shown.' },
    { icon: Store, title: 'Everyday categories', text: 'Beauty, kids, fashion and more, all with clear pack sizes and prices.' },
  ];
  const steps = [
    { icon: ShoppingBasket, title: 'You order', text: 'Pick products, apply a coupon, pay online or choose cash on delivery.' },
    { icon: PackageCheck, title: 'We confirm', text: 'Our team checks stock and payment, then confirms and packs your order.' },
    { icon: Truck, title: 'We deliver', text: 'Track every step live. A delivery partner brings it to your door.' },
    { icon: KeyRound, title: 'You verify', text: 'Share your 6-digit delivery code at the door. Only then is it marked delivered.' },
  ];
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Shop. Eat.<br />
              <span className="text-brand-700">Live better.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              VSR brings groceries, daily essentials and homemade food from local kitchens together in one place, and delivers them to your door in {SERVICE_CITY}, with every order checked by a real team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/" tone="primary" className="h-12 px-6">Start shopping</ButtonLink>
              <ButtonLink to="/categories" tone="outline" className="h-12 px-6">Browse categories</ButtonLink>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl">
            <img src="/login-art.jpg" alt="Fresh vegetables and groceries" className="aspect-[4/3] w-full object-cover" />
          </div>
        </div>
      </section>

      <Page>
        <section className="mt-6">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">What you’ll find</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {offer.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon className="size-8 text-accent-500" aria-hidden />
                <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">How an order works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
                  <span className="text-sm font-bold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-extrabold">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 grid gap-8 rounded-3xl bg-brand-900 p-8 text-white sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">Built on trust</h2>
            <ul className="mt-6 space-y-4 text-white/90">
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-500" aria-hidden /> Stock is reserved when your order is confirmed, so we don’t sell what we don’t have.</li>
              <li className="flex gap-3"><Wallet className="mt-0.5 size-5 shrink-0 text-accent-500" aria-hidden /> Prices and the full bill are shown before you pay. Payments are verified with Razorpay.</li>
              <li className="flex gap-3"><KeyRound className="mt-0.5 size-5 shrink-0 text-accent-500" aria-hidden /> Code-verified handover means your order reaches you, not someone else.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white/10 p-6">
            <p className="text-lg font-bold">Ready when you are.</p>
            <p className="mt-1 text-white/80">Create an account in a minute and get your first order delivered.</p>
            <ButtonLink to="/signup" tone="accent" className="mt-5 h-12 w-full">Create an account</ButtonLink>
          </div>
        </section>
      </Page>
    </>
  );
}

// ------------------------------------------------------------------ Contact
export function ContactPage() {
  useTitle('Contact');
  const { user } = useShopAuth();
  return (
    <Page narrow>
      <h1 className="text-3xl font-extrabold tracking-[-0.02em]">Contact us</h1>
      <p className="mt-2 text-muted">We’re here for orders, deliveries, payments and anything else.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a href={`tel:${SUPPORT_PHONE}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-brand-700/50">
          <Phone className="size-6 text-brand-700" aria-hidden />
          <span><span className="block font-bold">Call us</span><span className="text-muted">{SUPPORT_PHONE}</span></span>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-brand-700/50">
          <Mail className="size-6 text-brand-700" aria-hidden />
          <span><span className="block font-bold">Email us</span><span className="text-muted">{SUPPORT_EMAIL}</span></span>
        </a>
      </div>
      <Panel className="mt-3 p-5">
        <h2 className="font-bold">Have a problem with an order?</h2>
        <p className="mt-1 text-[15px] text-muted">Raising a ticket links it to your order, so our team sees the details straight away.</p>
        <ButtonLink to={user ? '/account/help' : '/login'} className="mt-4">{user ? 'Raise a ticket' : 'Log in to raise a ticket'}</ButtonLink>
      </Panel>
      {LEGAL_ENTITY.address ? (
        <p className="mt-8 flex gap-2 text-sm text-muted"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}</p>
      ) : null}
      <p className="mt-8 text-sm text-muted">Looking for quick answers? See our <Link to="/faq" className="font-bold text-brand-700">FAQs</Link>.</p>
    </Page>
  );
}

// ------------------------------------------------------------------ FAQ
export function FaqPage() {
  useTitle('FAQs');
  return (
    <Page narrow>
      <h1 className="text-3xl font-extrabold tracking-[-0.02em]">Frequently asked questions</h1>
      <Panel className="mt-8 divide-y divide-line">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group px-5">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold">
              {q}
              <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <p className="pb-5 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </Panel>
      <p className="mt-8 text-muted">Still need help? <Link to="/contact" className="font-bold text-brand-700">Contact us</Link>.</p>
    </Page>
  );
}

// ------------------------------------------------------------------ Policies (terms / privacy / refunds / delivery)
export function LegalPage() {
  const slug = useLocation().pathname.slice(1);
  const doc = DOCS[slug];
  useTitle(doc?.title ?? 'Policy');
  if (!doc) return <Navigate to="/" replace />;
  const id = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <Page>
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Policies" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {Object.values(DOCS).map((d) => (
              <li key={d.slug}>
                <Link to={`/${d.slug}`} aria-current={d.slug === slug ? 'page' : undefined} className={d.slug === slug ? 'block rounded-lg bg-brand-50 px-3 py-2 font-bold text-brand-700' : 'block rounded-lg px-3 py-2 text-muted hover:text-ink'}>
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-[70ch]">
          <h1 className="text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
          <p className="mt-6 text-lg leading-relaxed">{doc.intro}</p>
          {doc.sections.length > 3 ? (
            <nav aria-label="On this page" className="mt-8 rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-bold">On this page</p>
              <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {doc.sections.map((s) => (
                  <li key={s.heading}><a href={`#${id(s.heading)}`} className="inline-block py-1 text-brand-700 hover:underline">{s.heading}</a></li>
                ))}
              </ol>
            </nav>
          ) : null}
          {doc.sections.map((s) => (
            <section key={s.heading} id={id(s.heading)} className="mt-10 scroll-mt-24">
              <h2 className="text-xl font-extrabold">{s.heading}</h2>
              {s.body?.map((p) => <p key={p} className="mt-3 leading-relaxed text-ink/90">{p}</p>)}
              {s.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink/90 marker:text-brand-700">
                  {s.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
          {LEGAL_ENTITY.address || LEGAL_ENTITY.gstin ? (
            <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
              {LEGAL_ENTITY.name}{LEGAL_ENTITY.address ? `, ${LEGAL_ENTITY.address}` : ''}{LEGAL_ENTITY.gstin ? ` · GSTIN ${LEGAL_ENTITY.gstin}` : ''}
            </p>
          ) : null}
        </article>
      </div>
    </Page>
  );
}
