import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, Ban, ChevronLeft, ChevronRight, Heart, Info, Lock, PackageX, RotateCcw, Star, Timer, Truck, X } from 'lucide-react';
import { money, date as fmtDate } from '../../lib/format';
import { errMsg, shopApi } from '../api';
import { defaultVariant, hasSizes, qtyOf, useCart, useCartActions, useProduct, useRecentlyViewedIds, useReviews, useWishlist, vAvail, type Review, outOfStock } from '../data';
import { FloatingCartBar } from '../ShopLayout';
import { Btn, ButtonLink, cx, EmptyState, ErrorState, FormField, Page, Panel, Price, ProductImage, ProductRail, SectionHead, Skeleton, Stepper, TextArea, useRequireLogin, View, NotifyMe } from '../ui';

const reviewer = (r: Review) => (typeof r.customer === 'object' ? r.customer?.name : undefined) ?? 'Customer';

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} style={{ width: size, height: size }} className={i < Math.round(value) ? 'fill-accent-500 text-accent-500' : 'text-line'} aria-hidden />
      ))}
    </span>
  );
}

function Unavailable() {
  return (
    <Page>
      <EmptyState icon={<PackageX className="size-8" />} title="This product isn’t available" message="It may have been removed or is temporarily unavailable in your area." action={<ButtonLink to="/categories" className="w-full">Browse categories</ButtonLink>} />
    </Page>
  );
}

// ------------------------------------------------------------------ Product detail
export function ProductPage() {
  const { id = '' } = useParams();
  const q = useProduct(id);
  const cart = useCart().data;
  const { setQty } = useCartActions();
  const wish = useWishlist().data;
  const qc = useQueryClient();
  const need = useRequireLogin();
  const nav = useNavigate();
  const recent = useRecentlyViewedIds();
  const [img, setImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [variantId, setVariantId] = useState<string>();
  const [qty, setQ] = useState(1);
  const [wishBusy, setWishBusy] = useState(false);

  useEffect(() => {
    if (q.data?.product) recent.add(q.data.product._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.product?._id]);

  if (q.isLoading)
    return (
      <Page>
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </Page>
    );
  const status = (q.error as { response?: { status?: number } })?.response?.status;
  if (q.isError && status === 404) return <Unavailable />;
  if (q.isError || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;

  const { product: p, reviews, similar } = q.data;
  if (p.status && p.status !== 'active') return <Unavailable />;
  const sel = hasSizes(p) ? p.variants!.find((v) => v._id === variantId) ?? defaultVariant(p) : undefined;
  const price = sel?.price ?? p.price;
  const mrp = sel ? sel.mrp ?? sel.price : p.mrp;
  const avail = sel ? vAvail(sel) : p.available;
  const oos = avail <= 0;
  const images = p.images?.map((i) => i.url) ?? [];
  const wished = wish?.some((w) => w._id === p._id) ?? false;
  const inCart = qtyOf(cart, p._id, sel?._id);

  const add = () => {
    if (!need('Log in to add items to your cart')) return;
    setQty.mutate(
      { productId: p._id, quantity: inCart + qty, variantId: sel?._id },
      {
        onSuccess: () => toast.success(`${p.name} added to cart`, { action: { label: 'View cart', onClick: () => nav('/cart') } }),
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };
  const toggleWish = async () => {
    if (!need('Log in to save items to your wishlist')) return;
    setWishBusy(true);
    try {
      const { data } = await shopApi.post(`/store/me/wishlist/${p._id}`);
      await qc.invalidateQueries({ queryKey: ['shop', 'wishlist'] });
      toast.success(data.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setWishBusy(false);
    }
  };

  return (
    <Page>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Phones: edge-to-edge swipe carousel from the very top, with floating back + wishlist */}
        <div className="relative -mx-4 -mt-4 sm:-mx-6 md:hidden">
          <div
            className="flex snap-x snap-mandatory overflow-x-auto bg-line-soft"
            onScroll={(e) => {
              const el = e.currentTarget;
              const n = Math.round(el.scrollLeft / el.clientWidth);
              if (n !== img) setImg(n);
            }}
            aria-roledescription="carousel"
            aria-label={`${p.name} images`}
          >
            {(images.length ? images : [undefined]).map((u, i) => (
              <button key={u ?? i} type="button" onClick={() => u && (setImg(i), setZoom(true))} className="w-full shrink-0 snap-center" aria-label={`Image ${i + 1} of ${Math.max(1, images.length)}, open full size`}>
                <ProductImage src={u} alt={i === 0 ? p.name : ''} className="aspect-square w-full" />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back" className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/90 text-[#202923] shadow-[0_2px_10px_rgb(0_0_0/0.15)]">
            <ArrowLeft className="size-5" />
          </button>
          <button type="button" onClick={toggleWish} disabled={wishBusy} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/90 shadow-[0_2px_10px_rgb(0_0_0/0.15)]">
            <Heart className={cx('size-5', wished ? 'fill-danger text-danger' : 'text-[#202923]')} />
          </button>
          {images.length > 1 ? (
            <>
              <span className="tabular absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">{img + 1}/{images.length}</span>
              <div className="absolute inset-x-0 bottom-3.5 flex justify-center gap-1.5" aria-hidden>
                {images.map((u, i) => <span key={u} className={cx('h-1.5 rounded-full transition-all', i === img ? 'w-5 bg-white' : 'w-1.5 bg-white/60')} />)}
              </div>
            </>
          ) : null}
        </div>

        {/* Desktop gallery: large image + thumbnails */}
        <div className="hidden md:block lg:sticky lg:top-24 lg:self-start">
          <button type="button" onClick={() => images.length && setZoom(true)} className="block w-full overflow-hidden rounded-3xl border border-line bg-surface" aria-label="Open image full size">
            <ProductImage src={images[img]} alt={p.name} className="aspect-square w-full" />
          </button>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((u, i) => (
                <button key={u} type="button" onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} aria-current={i === img} className={cx('size-16 shrink-0 overflow-hidden rounded-xl border-2', i === img ? 'border-accent-500' : 'border-transparent')}>
                  <ProductImage src={u} alt="" className="size-full" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Buy box */}
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">{p.name}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{[p.unit, p.brand].filter(Boolean).join(' · ')}</p>
          {p.reviewCount ? (
            <a href="#reviews" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm">
              <Stars value={p.rating ?? 0} />
              <span className="font-bold">{p.rating}</span>
              <span className="text-muted underline">{p.reviewCount} reviews</span>
            </a>
          ) : null}
          <div className="mt-4">
            <Price price={price} mrp={mrp} big />
            <p className="mt-1 text-[13px] text-muted">Inclusive of all taxes</p>
          </div>

          {hasSizes(p) ? (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-bold">Select size</legend>
              <div className="flex flex-wrap gap-2">
                {p.variants!.map((v) => {
                  const on = sel?._id === v._id;
                  const so = vAvail(v) <= 0;
                  return (
                    <button
                      key={v._id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setVariantId(v._id);
                        setQ(1);
                      }}
                      className={cx('min-w-24 rounded-xl border px-4 py-2.5 text-left', on ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-line bg-surface hover:border-brand-700/50')}
                    >
                      <span className="block text-sm font-bold">{v.name}</span>
                      <span className={cx('tabular block text-[13px]', so ? 'text-danger' : 'text-muted')}>{so ? 'Sold out' : money(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <span className={cx('rounded-full px-3 py-1 text-xs font-bold', oos ? 'bg-danger-bg text-danger' : avail <= 10 ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success')}>
              {oos ? 'Out of stock' : avail <= 10 ? `Only ${avail} left` : 'In stock'}
            </span>
            {p.badges?.map((b) => (
              <span key={b} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-600 dark:text-accent-500">{b}</span>
            ))}
          </div>

          {/* Desktop buy row (phones get a sticky bar below) */}
          <div className="mt-6 hidden items-center gap-3 md:flex">
            {!oos ? <Stepper qty={qty} onChange={(n) => setQ(Math.max(1, Math.min(n, Math.min(50, avail))))} label={p.name} /> : null}
            {outOfStock(p) ? (
              <NotifyMe p={p} className="h-13 flex-1" />
            ) : (
              <Btn size="lg" className="flex-1" disabled={oos} loading={setQty.isPending} onClick={add}>
                {oos ? 'Size sold out' : `Add to cart · ${money(price * qty)}`}
              </Btn>
            )}
            <button type="button" onClick={toggleWish} disabled={wishBusy} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} className="grid size-13 place-items-center rounded-xl border border-line bg-surface hover:border-danger/50">
              <Heart className={cx('size-5', wished ? 'fill-danger text-danger' : 'text-ink')} />
            </button>
          </div>
          {inCart > 0 ? (
            <p className="mt-3 text-sm text-muted">
              {inCart} already in your cart · <Link to="/cart" className="font-bold text-brand-700">View cart</Link>
            </p>
          ) : null}

          <section className="mt-10">
            <h2 className="text-lg font-extrabold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted">{p.description ?? p.shortDescription ?? 'No description yet.'}</p>
            {p.allergens ? (
              <div className="mt-4 flex gap-3 rounded-xl bg-warning-bg p-4 text-sm text-ink">
                <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>Ingredients & allergens: {p.allergens}</span>
              </div>
            ) : null}
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-extrabold">Delivery & returns</h2>
            <ul className="mt-3 space-y-4">
              <InfoRow icon={<Truck className="size-5" />} title={p.deliveryType === 'instant' ? 'Instant delivery available' : 'Standard delivery'} text={oos ? 'Currently out of stock' : 'Delivered to serviceable PIN codes. Availability is confirmed at checkout.'} />
              <InfoRow
                icon={p.returnable === false ? <Ban className="size-5 text-danger" /> : <RotateCcw className="size-5" />}
                title={p.returnable === false ? 'Not returnable' : `Returnable within ${p.returnWindowDays ?? 2} day${(p.returnWindowDays ?? 2) === 1 ? '' : 's'} of delivery`}
                text={p.returnable === false ? 'You can still report damaged or wrong items to support.' : 'Damaged or wrong items can be returned from Order details.'}
              />
              {p.type === 'homemade' && p.prepTimeMins ? <InfoRow icon={<Timer className="size-5" />} title="Preparation time" text={`About ${p.prepTimeMins} minutes after the kitchen confirms`} /> : null}
            </ul>
          </section>

          <section id="reviews" className="mt-10 scroll-mt-24">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">Ratings & reviews</h2>
              <Link to={`/product/${p._id}/review`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-brand-700 hover:bg-brand-50">Write a review</Link>
            </div>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No reviews yet. Bought this? Be the first to review it.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {reviews.slice(0, 3).map((r, i) => (
                  <li key={r._id ?? i} className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{reviewer(r)}</span>
                      <Stars value={r.rating} size={14} />
                    </div>
                    {r.text ? <p className="mt-1.5 text-[15px] text-muted">{r.text}</p> : null}
                  </li>
                ))}
              </ul>
            )}
            {(p.reviewCount ?? 0) > 0 ? <ButtonLink tone="outline" to={`/product/${p._id}/reviews`} className="mt-2 w-full sm:w-auto">See all {p.reviewCount} reviews</ButtonLink> : null}
          </section>
        </div>
      </div>

      {similar.length ? (
        <>
          <SectionHead title="You may also like" />
          <ProductRail items={similar} />
        </>
      ) : null}

      {/* Room so the last content clears the cart bar + buy bar */}
      <div className="h-28 md:hidden" aria-hidden />
      {/* Phones: buy bar pinned to the bottom (no tabs on this page) */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
        {/* Cart summary floats above the buy bar once something is in the cart */}
        <FloatingCartBar className="mx-3 mb-2" />
        <div className="border-t border-line bg-surface px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleWish} disabled={wishBusy} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line">
            <Heart className={cx('size-5', wished ? 'fill-danger text-danger' : 'text-ink')} />
          </button>
          {!oos ? <Stepper qty={qty} size="sm" onChange={(n) => setQ(Math.max(1, Math.min(n, Math.min(50, avail))))} label={p.name} /> : null}
          {outOfStock(p) ? (
            <NotifyMe p={p} className="flex-1" />
          ) : (
            <Btn className="flex-1" disabled={oos} loading={setQty.isPending} onClick={add}>
              {oos ? 'Size sold out' : `Add · ${money(price * qty)}`}
            </Btn>
          )}
          </div>
      </div>
      </div>

      {zoom && images.length ? <ImageViewer images={images} start={img} title={p.name} onClose={(n) => { setImg(n); setZoom(false); }} /> : null}
    </Page>
  );
}

function InfoRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-brand-700">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </li>
  );
}

// ------------------------------------------------------------------ All reviews
export function ReviewsPage() {
  const { id = '' } = useParams();
  const q = useReviews(id);
  const name = useProduct(id).data?.product.name;
  return (
    <Page narrow>
      <h1 className="text-2xl font-extrabold">Ratings & reviews</h1>
      {name ? <p className="mt-1 text-muted">{name}</p> : null}
      <View q={q}>
        {(d) => {
          const count = Object.values(d.distribution).reduce((a, b) => a + b, 0);
          const avg = count ? Object.entries(d.distribution).reduce((a, [s, n]) => a + Number(s) * n, 0) / count : 0;
          return (
            <>
              <Panel className="mt-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                <div className="text-center sm:w-40">
                  <p className="tabular text-5xl font-extrabold">{avg.toFixed(1)}</p>
                  <div className="mt-2"><Stars value={avg} size={18} /></div>
                  <p className="mt-1 text-sm text-muted">{count} ratings</p>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[13px]">
                      <span className="w-6 tabular">{s}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                        <div className="h-full rounded-full bg-brand-700" style={{ width: `${count ? ((d.distribution[s] ?? 0) / count) * 100 : 0}%` }} />
                      </div>
                      <span className="tabular w-8 text-right text-muted">{d.distribution[s] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <ButtonLink tone="outline" to={`/product/${id}/review`} className="mt-4 w-full sm:w-auto">Write a review</ButtonLink>
              {d.items.length === 0 ? (
                <EmptyState title="No reviews yet" message="Be the first to share your experience." />
              ) : (
                <ul className="mt-6 space-y-3">
                  {d.items.map((r, i) => (
                    <li key={r._id ?? i}>
                      <Panel className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cx('rounded-md px-1.5 py-0.5 text-xs font-bold text-white', r.rating >= 4 ? 'bg-success' : r.rating >= 3 ? 'bg-warning' : 'bg-danger')}>{r.rating} ★</span>
                          <span className="font-semibold">{reviewer(r)}</span>
                          <span className="ml-auto text-[13px] text-muted">{fmtDate(r.createdAt)}</span>
                        </div>
                        {r.text ? <p className="mt-3 text-[15px]">{r.text}</p> : null}
                        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-success"><BadgeCheck className="size-3.5" /> Verified purchase</p>
                      </Panel>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------ Write / edit review (only after delivery)
const LABELS = ['Tap to rate', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
export function WriteReviewPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const name = useProduct(id).data?.product.name;
  const elig = useQuery({ queryKey: ['shop', 'my-review', id], queryFn: async () => (await shopApi.get(`/store/me/products/${id}/review`)).data as { eligible: boolean; review?: { rating: number; text?: string } } });
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (elig.data?.review) {
      setStars(elig.data.review.rating);
      setText(elig.data.review.text ?? '');
    }
  }, [elig.data]);
  const editing = Boolean(elig.data?.review);

  const submit = async () => {
    setBusy(true);
    try {
      await shopApi.put(`/store/me/products/${id}/review`, { rating: stars, ...(text.trim() ? { text: text.trim() } : {}) });
      qc.invalidateQueries({ queryKey: ['shop', 'reviews', id] });
      qc.invalidateQueries({ queryKey: ['shop', 'product', id] });
      setDone(true);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Page narrow>
        <EmptyState icon={<BadgeCheck className="size-8" />} title={editing ? 'Review updated' : 'Thanks for your review!'} message="Your feedback helps other customers shop better and helps us improve." action={<Btn block onClick={() => nav(`/product/${id}`)}>Back to product</Btn>} />
      </Page>
    );
  return (
    <Page narrow>
      <h1 className="text-2xl font-extrabold">{editing ? 'Edit your review' : 'Write a review'}</h1>
      {name ? <p className="mt-1 text-muted">{name}</p> : null}
      <View q={elig}>
        {(d) =>
          !d.eligible ? (
            <EmptyState icon={<Lock className="size-8" />} title="Review after delivery" message="Only customers who received this product can review it. Once your order is delivered, you can share your experience here." action={<Btn block tone="outline" onClick={() => nav(-1)}>Go back</Btn>} />
          ) : (
            <Panel className="mt-6 p-6">
              <div className="flex flex-col items-center">
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setStars(i)} className="grid size-12 place-items-center rounded-xl hover:bg-accent-50">
                      <Star className={cx('size-9', i <= stars ? 'fill-accent-500 text-accent-500' : 'text-line')} />
                    </button>
                  ))}
                </div>
                <p className={cx('mt-2 font-semibold', !stars && 'text-muted')}>{LABELS[stars]}</p>
              </div>
              <div className="mt-6">
                <FormField label="Your review (optional)" hint="Reviews are public and show your first name. Don’t include personal details." htmlFor="rv">
                  <TextArea id="rv" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you like or dislike? How was the quality?" />
                </FormField>
              </div>
              <Btn block size="lg" className="mt-6" disabled={!stars} loading={busy} onClick={submit}>
                {editing ? 'Update review' : 'Submit review'}
              </Btn>
            </Panel>
          )
        }
      </View>
    </Page>
  );
}

/** Full-screen photo viewer: swipe / arrows / keyboard, pinch to zoom on phones, thumbnails, Esc or ✕ to close. */
function ImageViewer({ images, start, title, onClose }: { images: string[]; start: number; title: string; onClose: (index: number) => void }) {
  const [i, setI] = useState(start);
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const go = (n: number) => {
    const next = Math.max(0, Math.min(images.length - 1, n));
    track.current?.scrollTo({ left: next * (track.current?.clientWidth ?? 0), behavior: 'smooth' });
    setI(next);
  };
  useEffect(() => {
    // Open on the tapped photo, lock page scroll, focus the close button
    track.current?.scrollTo({ left: start * (track.current?.clientWidth ?? 0) });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [start]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(i);
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-[60] flex flex-col bg-black text-white animate-[rise_200ms_ease-out]">
      <div className="flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button ref={closeBtn} type="button" onClick={() => onClose(i)} aria-label="Close photos" className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="size-6" />
        </button>
        <p className="min-w-0 truncate px-3 text-sm font-semibold text-white/85">{title}</p>
        <span className="tabular w-11 text-right text-sm font-bold text-white/85">{images.length > 1 ? `${i + 1}/${images.length}` : ''}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={track}
          className="flex h-full snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== i) setI(n);
          }}
        >
          {images.map((u, n) => (
            <div key={u} className="grid h-full w-full shrink-0 snap-center place-items-center p-2">
              <img src={u} alt={`${title}, photo ${n + 1} of ${images.length}`} className="max-h-full max-w-full touch-pinch-zoom object-contain" draggable={false} />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous photo" className="absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 md:grid">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(i + 1)} disabled={i === images.length - 1} aria-label="Next photo" className="absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 md:grid">
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex justify-center gap-2 overflow-x-auto px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
          {images.map((u, n) => (
            <button key={u} type="button" onClick={() => go(n)} aria-label={`Photo ${n + 1}`} aria-current={n === i} className={cx('size-14 shrink-0 overflow-hidden rounded-xl border-2 transition-opacity', n === i ? 'border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-90')}>
              <img src={u} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <div className="h-[max(14px,env(safe-area-inset-bottom))]" />
      )}
    </div>
  );
}
