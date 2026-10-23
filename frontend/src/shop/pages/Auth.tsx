import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, Lock, LockOpen, Mail, MailCheck, ShoppingBag, Smartphone, User as UserIcon, X } from 'lucide-react';
import { errMsg, shopApi } from '../api';
import { homeFor } from '../../lib/access';
import { useShopAuth } from '../auth';
import { cx } from '../ui';

/*
 * Customer sign-in, mirroring the app (mobile lib/features/auth/login_flow.dart):
 * entry (email or phone) → registered email: password · registered phone: OTP · new: sign-up
 * forgot → "reset OTP sent" → OTP → new password → password updated · success → home.
 * Always light, like the app's login.
 */

// ------------------------------------------------------------------ Shared pieces
const INK = 'text-[#202923]';
const SUB = 'text-[#4A524E]';
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
/** Last 10 digits of a typed/autofilled number (+91…, 0…, +1 91…); '' if fewer than 10. */
const phoneDigits = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
};
/** Indian mobile number: only digits / + / spaces / dashes / brackets, judged on its last 10 digits. */
const isPhone = (v: string) => /^[\d\s()+-]+$/.test(v.trim()) && v.replace(/\D/g, '').length <= 13 && /^[6-9]\d{9}$/.test(phoneDigits(v));
const mask = (id: string) => {
  if (isEmail(id)) return id.trim();
  const d = id.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : id;
};
const pwProblem = (p: string) => (p.length < 8 ? 'Use at least 8 characters' : !/[A-Za-z]/.test(p) ? 'Include a letter' : !/\d/.test(p) ? 'Include a number' : '');
const fromOf = (state: unknown) => (state as { from?: string } | null)?.from ?? '/';

function TwoTone({ first, highlight, size = 'text-[34px] sm:text-4xl', center }: { first: string; highlight: string; size?: string; center?: boolean }) {
  return (
    <h1 className={cx('font-[family-name:var(--font-display)] leading-[1.08] text-brand-900', size, center && 'text-center')}>
      {first} <span className="text-accent-500">{highlight}</span>
    </h1>
  );
}
function Display({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cx('font-[family-name:var(--font-display)] text-[32px] leading-[1.08] text-brand-900 sm:text-4xl', className)}>{children}</h1>;
}
function Subtitle({ text, strong }: { text: string; strong?: string }) {
  return (
    <p className={cx('mt-3 whitespace-pre-line text-[17px] leading-[1.4]', SUB)}>
      {text}
      {strong ? <strong className={cx('font-bold', INK)}>{strong}</strong> : null}
    </p>
  );
}
function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl bg-[#fde8e6] p-3 text-[13px] text-[#c9362b]">
      {message}
    </p>
  );
}
function Pill({ label, busy, disabled, type = 'submit', onClick }: { label: string; busy?: boolean; disabled?: boolean; type?: 'submit' | 'button'; onClick?: () => void }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-6 text-[15px] font-bold text-white transition-colors hover:bg-brand-800 active:scale-[0.99] disabled:bg-brand-800/55"
    >
      {busy ? <Loader2 className="size-5 animate-spin" aria-label="Please wait" /> : <>{label} <ArrowRight className="size-[18px]" aria-hidden /></>}
    </button>
  );
}
function Field({ icon, children, trailing }: { icon: ReactNode; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-[14px] border border-[#ebe5da] bg-white px-4 focus-within:border-brand-900 focus-within:ring-2 focus-within:ring-brand-900/15">
      <span className="text-[#5e6964]" aria-hidden>{icon}</span>
      {children}
      {trailing}
    </div>
  );
}
// The surrounding Field draws the focus ring; no second (global) ring on the input itself
const inputCls = cx('h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none focus-visible:outline-none placeholder:text-[#8a938e]', INK);

/** Desktop only: photo + tagline on the left, the app-style form on the right (phones get the app layout). */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-900 lg:block">
      <img src="/login-art.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-900/60 to-transparent" />
      <div className="relative flex h-full flex-col justify-end p-12 text-white">
        <p className="font-[family-name:var(--font-display)] text-5xl leading-[1.08]">Shop · Eat · <span className="text-accent-500">Live Better</span></p>
        <p className="mt-4 max-w-md text-lg text-white/85">Fresh groceries, daily essentials and homemade food from local kitchens, delivered to your door.</p>
      </div>
    </aside>
  );
}
function Split({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-[#fbf7ee] lg:grid-cols-[1fr_minmax(480px,40%)]">
      <BrandPanel />
      {children}
    </div>
  );
}

/** Leaves (top-right), back, logo, content, and the green/orange wave at the bottom. Same as the app's AuthFrame. */
function AuthFrame({ children, back = true, logo = true }: { children: ReactNode; back?: boolean; logo?: boolean }) {
  const nav = useNavigate();
  return (
    <Split>
    <div className={cx('relative min-h-dvh overflow-hidden bg-[#fbf7ee] lg:flex lg:flex-col lg:justify-center', INK)}>
      <img src="/leaves.png" alt="" className="pointer-events-none absolute right-0 top-0 w-24 sm:w-32" />
      <Wave />
      <div className="relative mx-auto w-full max-w-[440px] px-6 pb-40 pt-1 lg:py-16">
        <div className="flex h-12 items-center">
          {back ? (
            <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/login'))} className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-black/5" aria-label="Back">
              <ArrowLeft className="size-6" />
            </button>
          ) : null}
        </div>
        {logo ? <img src="/logo-mark.png" alt="VSR" className="mx-auto size-[76px] rounded-2xl object-contain" /> : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>
    </Split>
  );
}
function Wave() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] w-full sm:h-[120px]" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden>
      <path d="M0 25.2 Q32 76.5 64 59.4 Q86 46.8 100 54 L100 64.8 Q85 55.8 62 72 Q30 90 0 37.8 Z" fill="#f58220" fillOpacity="0.85" />
      <path d="M0 31.5 Q30 85.5 62 67.5 Q85 54 100 63 L100 90 L0 90 Z" fill="#064e3b" />
    </svg>
  );
}

export function LegalNote() {
  return (
    <p className={cx('text-center text-xs leading-relaxed', SUB)}>
      By continuing, you agree to VSR’s{' '}
      <Link to="/terms" className="font-bold text-brand-700 underline underline-offset-2">Terms & Conditions</Link> and{' '}
      <Link to="/privacy" className="font-bold text-brand-700 underline underline-offset-2">Privacy Policy</Link>.
    </p>
  );
}

/** Six boxes over one real input (paste, autofill and screen readers all work). */
function OtpBoxes({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(true);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label={`One-time code, ${value.length} of 6 digits entered`}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete(v);
        }}
        className="absolute inset-0 z-10 w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={cx(
              'tabular grid h-14 place-items-center rounded-[10px] border bg-white text-2xl font-extrabold transition-colors',
              focus && i === Math.min(value.length, 5) && value.length < 6 ? 'border-2 border-brand-900' : value[i] ? 'border-brand-700/50' : 'border-[#ebe5da]',
            )}
          >
            {value[i] ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessFrame({ icon, title, message, cta, onTap, bag }: { icon: ReactNode; title: string; message: string; cta: string; onTap: () => void; bag?: boolean }) {
  return (
    <AuthFrame back={false}>
      <div className="mt-6 flex justify-center">
        <div className="relative grid size-[150px] animate-[rise_420ms_cubic-bezier(0.34,1.56,0.64,1)] place-items-center rounded-full" style={{ background: bag ? 'rgb(245 130 32 / 0.12)' : 'rgb(10 92 67 / 0.12)' }}>
          <div className={cx('grid size-24 place-items-center text-white', bag ? 'rounded-[22px] bg-accent-500' : 'rounded-full bg-brand-800')}>{icon}</div>
          {bag ? (
            <span className="absolute bottom-[34px] right-[30px] grid size-8 place-items-center rounded-full bg-white text-accent-500">
              <Check className="size-5" aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
      <h1 className="mt-7 text-center font-[family-name:var(--font-display)] text-[30px] leading-[1.08] text-brand-900" aria-live="polite">{title}</h1>
      <p className={cx('mt-3 text-center text-[17px]', SUB)}>{message}</p>
      <div className="mt-7">
        <Pill type="button" label={cta} onClick={onTap} />
      </div>
    </AuthFrame>
  );
}

function DevCode({ code }: { code?: string }) {
  return code ? <p className="mt-3 rounded-[10px] bg-[#fdf1dc] p-2.5 text-center text-[13px]">Development build: your OTP is {code}</p> : null;
}

// ------------------------------------------------------------------ 1. Entry: email or phone
export function LoginPage() {
  const { user, sendOtp } = useShopAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to={fromOf(loc.state)} replace />;
  const valid = isEmail(id) || isPhone(id);
  const phone = isPhone(id) && !isEmail(id);
  const from = fromOf(loc.state);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return setError('Enter a valid email or 10-digit mobile number');
    setError('');
    setBusy(true);
    // Phones go out as their last 10 digits, so autofilled prefixes (+91, +1 91…) don't matter
    const v = phone ? phoneDigits(id) : id.trim();
    try {
      // Registered → password (email) or OTP (phone). New → sign-up with the email/phone filled in.
      const { data } = await shopApi.post('/auth/check', { identifier: v });
      if (!phone) {
        if (data.exists) nav('/login/password', { state: { email: v, from } });
        else nav('/signup', { state: { email: v.toLowerCase(), from } });
      } else if (data.exists) {
        const dev = await sendOtp(v, 'login');
        nav('/login/otp', { state: { id: v, purpose: 'login', dev, from } });
      } else {
        nav('/signup', { state: { phone: v, from } });
      }
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Split>
    <div className={cx('relative min-h-dvh overflow-hidden bg-[#fbf7ee] lg:flex lg:flex-col lg:justify-center', INK)}>
      <img src="/leaves.png" alt="" className="pointer-events-none absolute right-0 top-0 hidden w-32 lg:block" />
      <div className="relative mx-auto w-full max-w-[480px]">
        {/* Phones: illustration with a curved edge, logo badge overlapping it (as in the app) */}
        <div className="relative h-[clamp(268px,38dvh,378px)] lg:hidden">
          <div className="absolute inset-x-0 bottom-12 top-0 overflow-hidden [clip-path:ellipse(95%_100%_at_50%_0%)] sm:rounded-b-[2px]">
            <img src="/login-art.jpg" alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#fbf7ee]/0" />
          </div>
          <Link to="/" className="absolute right-3 top-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-white/90 px-4 text-sm font-bold text-brand-800" aria-label="Continue as guest">
            <UserIcon className="size-[18px]" aria-hidden /> Guest
          </Link>
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <div className="size-24 rounded-full bg-white p-1.5 shadow-[0_8px_20px_rgb(11_61_46/0.18)]">
              <img src="/logo-mark.png" alt="VSR" className="size-full rounded-full object-cover" />
            </div>
          </div>
        </div>
        {/* Desktop: the photo lives in the left panel; keep the logo badge and a Guest link */}
        <div className="hidden items-center justify-between px-6 lg:flex">
          <img src="/logo-mark.png" alt="VSR" className="size-[76px] rounded-2xl object-contain" />
          <Link to="/" className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#ebe5da] bg-white px-4 text-sm font-bold text-brand-800 hover:border-brand-800/40">
            <UserIcon className="size-[18px]" aria-hidden /> Continue as guest
          </Link>
        </div>
        <form onSubmit={submit} noValidate className="px-6 pb-10 pt-5 lg:pt-8">
          <div className="lg:hidden"><TwoTone first="Welcome" highlight="Back!" center /></div>
          <div className="hidden lg:block"><TwoTone first="Welcome" highlight="Back!" /></div>
          <p className={cx('mt-2 text-center text-[17px] leading-[1.4] lg:text-left', SUB)}>Sign in to shop, track orders and enjoy homemade food.</p>
          <div className="mt-7">
            <Field icon={phone ? <Smartphone className="size-5" /> : <Mail className="size-5" />}>
              <input
                className={inputCls}
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setError('');
                }}
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="Email or phone number"
                aria-label="Email or phone number"
                autoFocus
              />
            </Field>
            {error ? <ErrorText message={error} /> : null}
          </div>
          <div className="mt-5">
            <Pill label="Continue" busy={busy} disabled={!valid} />
          </div>
          <div className="mt-6">
            <LegalNote />
          </div>
        </form>
      </div>
    </div>
    </Split>
  );
}

// ------------------------------------------------------------------ 2. Password
export function PasswordPage() {
  const { user, loginPassword, sendOtp } = useShopAuth();
  const nav = useNavigate();
  const st = useLocation().state as { email?: string; from?: string } | null;
  const [pw, setPw] = useState('');
  const [hide, setHide] = useState(true);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<string | undefined | null>(null);
  if (!st?.email) return <Navigate to="/login" replace />;
  if (user && !busy) return <Navigate to={st.from ?? '/'} replace />;

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return setError('Enter your password');
    setBusy(true);
    setError('');
    try {
      const r = await loginPassword(st.email!, pw, keep);
      if (r.area === 'admin') return nav(st.from?.startsWith('/admin') ? st.from : homeFor(r.roles), { replace: true });
      // Straight in (no success screen on the web): back to where they were, or Home
      toast.success('Welcome back!');
      nav(st.from ?? '/', { replace: true });
    } catch (e2) {
      setError(errMsg(e2));
      setBusy(false);
    }
  };
  const forgot = async () => {
    setSending(true);
    try {
      setSent((await sendOtp(st.email!, 'reset')) ?? undefined);
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthFrame>
      <Display>Enter Your Password</Display>
      <Subtitle text={'Welcome back!\nPlease enter your password for\n'} strong={st.email} />
      <form onSubmit={login} noValidate className="mt-6">
        <input type="email" autoComplete="username" value={st.email} readOnly hidden />
        <Field
          icon={<Lock className="size-5" />}
          trailing={
            <button type="button" onClick={() => setHide(!hide)} className="-mr-2 grid size-11 place-items-center rounded-full text-[#5e6964]" aria-label={hide ? 'Show password' : 'Hide password'}>
              {hide ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        >
          <input className={inputCls} type={hide ? 'password' : 'text'} autoComplete="current-password" placeholder="Enter your password" aria-label="Password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }} />
        </Field>
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-[18px] accent-[#064e3b]" /> Keep me logged in
          </label>
          <button type="button" onClick={forgot} disabled={sending} className="min-h-11 px-1 text-[15px] font-semibold text-accent-600 disabled:opacity-60">
            {sending ? 'Sending…' : 'Forgot Password?'}
          </button>
        </div>
        {error ? <ErrorText message={error} /> : null}
        <div className="mt-4">
          <Pill label="Login" busy={busy} />
        </div>
      </form>
      <div className="mt-4 flex justify-center">
        <Link to="/login" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold"><ArrowLeft className="size-[18px]" aria-hidden /> Use a different account</Link>
      </div>
      {sent !== null ? (
        <OtpSentDialog
          target={st.email}
          onClose={() => {
            const dev = sent;
            setSent(null);
            nav('/login/otp', { state: { id: st.email, purpose: 'reset', dev } });
          }}
        />
      ) : null}
    </AuthFrame>
  );
}

function OtpSentDialog({ target, onClose }: { target: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[calc(100%-32px)] max-w-sm rounded-3xl bg-white p-0 text-[#202923] backdrop:bg-black/45" aria-labelledby="otp-sent">
      <div className="px-5 pb-5 pt-3">
        <div className="flex justify-end">
          <button type="button" onClick={() => ref.current?.close()} className="grid size-11 place-items-center rounded-full hover:bg-black/5" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="mx-auto grid size-24 place-items-center rounded-full bg-[#fff4e8] text-accent-500">
          {isEmail(target) ? <MailCheck className="size-12" aria-hidden /> : <Lock className="size-12" aria-hidden />}
        </div>
        <h2 id="otp-sent" className="mt-4 text-center font-[family-name:var(--font-display)] text-2xl text-brand-900">Password Reset OTP Sent!</h2>
        <p className="mt-2 text-center">We have sent a 6-digit OTP to<br /><strong>{mask(target)}</strong></p>
        <button type="button" onClick={() => ref.current?.close()} className="mt-5 h-12 w-full rounded-full bg-brand-900 font-bold text-white hover:bg-brand-800">OK</button>
      </div>
    </dialog>
  );
}

// ------------------------------------------------------------------ 3. OTP (login / sign-up verification / password reset)
export function OtpPage() {
  const { verifyOtp, sendOtp } = useShopAuth();
  const nav = useNavigate();
  const st = useLocation().state as { id?: string; purpose?: 'login' | 'verify' | 'reset'; dev?: string; from?: string } | null;
  const [code, setCode] = useState('');
  const [dev, setDev] = useState(st?.dev);
  const [left, setLeft] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  if (!st?.id || !st.purpose) return <Navigate to="/login" replace />;

  const verify = async (c = code) => {
    if (c.length !== 6) return;
    if (st.purpose === 'reset') return nav('/login/new-password', { state: { id: st.id, code: c } });
    setBusy(true);
    setError('');
    try {
      const r = await verifyOtp(st.id!, c, st.purpose as 'login' | 'verify');
      if (r.area === 'admin') return nav(st.from?.startsWith('/admin') ? st.from : homeFor(r.roles), { replace: true });
      toast.success(st.purpose === 'verify' ? 'Account verified. Welcome to VSR!' : 'Welcome back!');
      nav(st.from ?? '/', { replace: true });
    } catch (e2) {
      setError(errMsg(e2));
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    try {
      setDev(await sendOtp(st.id!, st.purpose!));
      setLeft(30);
      toast.success('A new OTP has been sent.');
    } catch (e2) {
      toast.error(errMsg(e2));
    }
  };

  return (
    <AuthFrame>
      <Display className="text-[34px]">Enter OTP</Display>
      <p className={cx('mt-3 text-[17px] leading-[1.4]', SUB)}>
        We have sent a 6-digit OTP to
        <br />
        <strong className={cx('font-bold', INK)}>{mask(st.id)}</strong>{' '}
        <button type="button" onClick={() => nav(-1)} className="min-h-11 px-1 font-semibold text-accent-600">Edit</button>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="mt-6"
      >
        <OtpBoxes value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={verify} />
        <DevCode code={dev} />
        <p className="mt-4 flex flex-wrap items-center justify-center gap-1 text-[15px]">
          Didn’t receive OTP?{' '}
          {left > 0 ? (
            <span className="font-semibold text-accent-600">Resend in 00:{String(left).padStart(2, '0')}</span>
          ) : (
            <button type="button" onClick={resend} className="min-h-11 px-1 font-semibold text-accent-600">Resend OTP</button>
          )}
        </p>
        {error ? <ErrorText message={error} /> : null}
        <div className="mt-5">
          <Pill label="Verify OTP" busy={busy} disabled={code.length !== 6} />
        </div>
      </form>
    </AuthFrame>
  );
}

// ------------------------------------------------------------------ 4. Create new password (after reset OTP)
export function NewPasswordPage() {
  const { resetPassword } = useShopAuth();
  const nav = useNavigate();
  const st = useLocation().state as { id?: string; code?: string } | null;
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [hide, setHide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!st?.id || !st.code) return <Navigate to="/login" replace />;
  const checks: [string, boolean][] = [
    ['At least 8 characters', pw.length >= 8],
    ['A letter', /[A-Za-z]/.test(pw)],
    ['A number', /\d/.test(pw)],
  ];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = pwProblem(pw);
    if (p) return setError(p);
    if (pw !== pw2) return setError('Passwords don’t match');
    setBusy(true);
    setError('');
    try {
      await resetPassword(st.id!, st.code!, pw);
      nav('/login/password-updated', { replace: true });
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  const eye = (
    <button type="button" onClick={() => setHide(!hide)} className="-mr-2 grid size-11 place-items-center rounded-full text-[#5e6964]" aria-label={hide ? 'Show passwords' : 'Hide passwords'}>
      {hide ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );
  return (
    <AuthFrame>
      <Display>Create New Password</Display>
      <Subtitle text={'Choose a new password for\n'} strong={mask(st.id)} />
      <form onSubmit={submit} noValidate className="mt-6 space-y-3">
        <Field icon={<Lock className="size-5" />} trailing={eye}>
          <input className={inputCls} type={hide ? 'password' : 'text'} autoComplete="new-password" placeholder="New password" aria-label="New password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }} />
        </Field>
        <Field icon={<Lock className="size-5" />}>
          <input className={inputCls} type={hide ? 'password' : 'text'} autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(''); }} />
        </Field>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px]" aria-label="Password requirements">
          {checks.map(([l, ok]) => (
            <li key={l} className={cx('inline-flex items-center gap-1', ok ? 'text-[#25834a]' : SUB)}>
              <Check className={cx('size-3.5', !ok && 'opacity-30')} aria-hidden /> {l}
            </li>
          ))}
        </ul>
        {error ? <ErrorText message={error} /> : null}
        <div className="pt-2">
          <Pill label="Update Password" busy={busy} />
        </div>
      </form>
    </AuthFrame>
  );
}

export function PasswordUpdatedPage() {
  const nav = useNavigate();
  return (
    <SuccessFrame
      icon={<LockOpen className="size-[54px]" aria-hidden />}
      title="Password Updated!"
      message="Your password has been changed and other devices were signed out. Log in with your new password."
      cta="Back to Login"
      onTap={() => nav('/login', { replace: true })}
    />
  );
}

// ------------------------------------------------------------------ 5. Login success
export function LoginSuccessPage() {
  const nav = useNavigate();
  const st = useLocation().state as { kind?: 'email' | 'phone' | 'new'; from?: string } | null;
  const email = st?.kind === 'email';
  const title = st?.kind === 'new' ? 'Account Verified!' : email ? 'Welcome Back!' : 'Logged In Successfully!';
  const message = st?.kind === 'new' ? 'Welcome to VSR. Your account is ready.' : email ? 'You have successfully logged in.' : 'Welcome back to VSR.';
  return (
    <SuccessFrame
      bag={email}
      icon={email ? <ShoppingBag className="size-[54px]" aria-hidden /> : <Check className="size-[54px]" aria-hidden />}
      title={title}
      message={message}
      cta={st?.from && st.from !== '/' ? 'Continue' : 'Go to Home'}
      onTap={() => nav(st?.from ?? '/', { replace: true })}
    />
  );
}

// ------------------------------------------------------------------ Sign up (new email / phone from the entry screen)
export function SignUpPage() {
  const { user, signUp } = useShopAuth();
  const nav = useNavigate();
  const st = useLocation().state as { email?: string; phone?: string; from?: string } | null;
  const [f, setF] = useState({ name: '', email: st?.email ?? '', phone: st?.phone ?? '', password: '' });
  const [hide, setHide] = useState(true);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value });
    setErr({});
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (f.name.trim().length < 2) x.name = 'Enter your name';
    if (!isEmail(f.email)) x.email = 'Enter a valid email';
    if (!isPhone(f.phone)) x.phone = 'Enter a valid mobile number';
    if (pwProblem(f.password)) x.password = pwProblem(f.password);
    if (!agree) x.agree = 'Please accept the Terms & Conditions and Privacy Policy.';
    setErr(x);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      const dev = await signUp(f);
      nav('/login/otp', { state: { id: f.email.trim().toLowerCase(), purpose: 'verify', dev, from: st?.from } });
    } catch (e2) {
      setErr({ form: errMsg(e2) });
    } finally {
      setBusy(false);
    }
  };
  const first = Object.entries(err).find(([k]) => k !== 'form')?.[1];
  return (
    <AuthFrame>
      <TwoTone first="Create" highlight="Account" />
      <Subtitle text="Join VSR to shop groceries, essentials and homemade food." />
      <form onSubmit={submit} noValidate className="mt-6 space-y-3">
        <Field icon={<UserIcon className="size-5" />}>
          <input className={inputCls} autoComplete="name" placeholder="Full name" aria-label="Full name" aria-invalid={Boolean(err.name)} value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field icon={<Mail className="size-5" />}>
          <input className={inputCls} type="email" autoComplete="email" placeholder="Email" aria-label="Email" aria-invalid={Boolean(err.email)} value={f.email} onChange={set('email')} />
        </Field>
        <Field icon={<Smartphone className="size-5" />}>
          <input className={inputCls} type="tel" autoComplete="tel" placeholder="Mobile number" aria-label="Mobile number" aria-invalid={Boolean(err.phone)} value={f.phone} onChange={set('phone')} />
        </Field>
        <Field
          icon={<Lock className="size-5" />}
          trailing={
            <button type="button" onClick={() => setHide(!hide)} className="-mr-2 grid size-11 place-items-center rounded-full text-[#5e6964]" aria-label={hide ? 'Show password' : 'Hide password'}>
              {hide ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        >
          <input className={inputCls} type={hide ? 'password' : 'text'} autoComplete="new-password" placeholder="Password" aria-label="Password" aria-invalid={Boolean(err.password)} value={f.password} onChange={set('password')} />
        </Field>
        <p className={cx('px-1 text-[13px]', SUB)}>At least 8 characters with a letter and a number</p>
        <label className="flex cursor-pointer items-start gap-3 pt-1 text-[14px] leading-relaxed">
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr({}); }} className="mt-1 size-[18px] shrink-0 accent-[#064e3b]" />
          <span>
            I agree to the <Link to="/terms" target="_blank" className="font-bold text-brand-700 underline underline-offset-2">Terms & Conditions</Link> and{' '}
            <Link to="/privacy" target="_blank" className="font-bold text-brand-700 underline underline-offset-2">Privacy Policy</Link>.
          </span>
        </label>
        {first || err.form ? <ErrorText message={first ?? err.form} /> : null}
        <div className="pt-2">
          <Pill label="Sign Up" busy={busy} />
        </div>
      </form>
      <p className={cx('mt-5 text-center text-[15px]', SUB)}>
        Already have an account? <Link to="/login" className="font-bold text-brand-700">Log in</Link>
      </p>
    </AuthFrame>
  );
}

// ------------------------------------------------------------------ Forgot password (direct link)
export function ForgotPasswordPage() {
  const { sendOtp } = useShopAuth();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<string | undefined | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(id) && !isPhone(id)) return setError('Enter a valid email or 10-digit mobile number');
    setBusy(true);
    try {
      setSent((await sendOtp(id.trim(), 'reset')) ?? undefined);
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame>
      <Display>Forgot Password?</Display>
      <Subtitle text="Enter your email or mobile number and we’ll send you a code to reset it." />
      <form onSubmit={submit} noValidate className="mt-6">
        <Field icon={<Mail className="size-5" />}>
          <input className={inputCls} autoComplete="username" placeholder="Email or phone number" aria-label="Email or phone number" autoFocus value={id} onChange={(e) => { setId(e.target.value); setError(''); }} />
        </Field>
        {error ? <ErrorText message={error} /> : null}
        <div className="mt-5">
          <Pill label="Send OTP" busy={busy} />
        </div>
      </form>
      {sent !== null ? <OtpSentDialog target={id.trim()} onClose={() => { const dev = sent; setSent(null); nav('/login/otp', { state: { id: id.trim(), purpose: 'reset', dev } }); }} /> : null}
    </AuthFrame>
  );
}
