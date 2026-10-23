import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, Session } from '../models/User';
import { ah, parse, badRequest, unauthorized, forbidden } from '../utils/http';
import { hashPassword, verifyPassword, signAccess, issueRefresh, sha256, createOtp, consumeOtp } from '../utils/security';
import { sendMail, otpEmail } from '../utils/services';
import { isStaff, permissionsFor, Role } from '../utils/roles';
import { authenticate } from '../middleware/auth';
import { isProd } from '../config/env';

const r = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many attempts. Please wait 15 minutes and try again.' } } });
const otpLimiter = rateLimit({ windowMs: 10 * 60e3, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many OTP requests. Please wait a few minutes.' } } });

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const normalizePhone = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d.length === 10 ? `+91${d}` : d.length === 12 && d.startsWith('91') ? `+${d}` : s.trim();
};
const identifierQuery = (id: string) => (isEmail(id) ? { email: id.toLowerCase().trim() } : { phone: normalizePhone(id) });

const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

function publicUser(u: { _id: unknown; name: string; email?: string | null; phone?: string | null; roles: string[]; avatar?: string | null }) {
  const roles = u.roles as Role[];
  return { id: String(u._id), name: u.name, email: u.email, phone: u.phone, avatar: u.avatar, roles, permissions: permissionsFor(roles) };
}

async function tokensFor(user: { _id: unknown; roles: string[] }, ua?: string) {
  const accessToken = signAccess({ sub: String(user._id), roles: user.roles as Role[] });
  const refreshToken = await issueRefresh(String(user._id), ua);
  return { accessToken, refreshToken };
}

/** Portal guard: the admin portal only admits staff; the customer app only admits customers. */
function assertPortal(roles: string[], portal?: string) {
  if (portal === 'admin' && !isStaff(roles as Role[])) throw forbidden('This portal is for VSR staff. Customers can shop on the VSR mobile app.');
  if (portal === 'customer' && !roles.includes('customer')) throw forbidden('Please use the VSR admin portal to sign in.');
}

// Identifier check for the app's login step: registered → password/OTP, new → sign-up (pre-filled).
// Product decision: this reveals whether an account exists, so it is tightly rate-limited.
const checkLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' } } });
r.post(
  '/check',
  checkLimiter,
  ah(async (req, res) => {
    const { identifier } = parse(z.object({ identifier: z.string().min(3) }), req.body);
    const kind = isEmail(identifier) ? 'email' : 'phone';
    const user = await User.findOne(identifierQuery(identifier)).select('status roles');
    res.json({ kind, exists: Boolean(user), normalized: kind === 'email' ? identifier.toLowerCase().trim() : normalizePhone(identifier) });
  }),
);

// Email (or phone) + password
r.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ identifier: z.string().min(3), password: z.string().min(1), portal: z.enum(['admin', 'customer']).optional() }), req.body);
    const user = await User.findOne(identifierQuery(body.identifier)).select('+passwordHash');
    // Generic message — don't reveal whether the account exists (PRD §6.2)
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) throw unauthorized('Incorrect email/phone or password');
    if (user.status !== 'active') throw forbidden('Your account is not active. Please contact support.');
    assertPortal(user.roles, body.portal);
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ user: publicUser(user), ...(await tokensFor(user, req.header('user-agent'))) });
  }),
);

// Customer sign up → email verification OTP
r.post(
  '/signup',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().min(10).max(15),
        password: strongPassword,
        acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms' }) }),
      }),
      req.body,
    );
    const email = body.email.toLowerCase();
    const phone = normalizePhone(body.phone);
    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) throw badRequest('An account with these details already exists. Try signing in.');
    await User.create({ name: body.name, email, phone, passwordHash: await hashPassword(body.password), roles: ['customer'] });
    const code = await createOtp(email, 'verify');
    await sendMail(email, 'Verify your VSR account', otpEmail(code, 'verify your account'), `otp=${code}`);
    res.status(201).json({ needsVerification: true, target: email, ...(isProd ? {} : { devOtp: code }) });
  }),
);

// Send OTP: login (phone/email), verify, reset
r.post(
  '/otp/send',
  otpLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ identifier: z.string().min(3), purpose: z.enum(['login', 'verify', 'reset']) }), req.body);
    const user = await User.findOne(identifierQuery(body.identifier));
    let devOtp: string | undefined;
    if (user && user.status === 'active') {
      const target = isEmail(body.identifier) ? user.email! : user.phone!;
      const code = await createOtp(target, body.purpose);
      devOtp = code;
      // SMS needs a separate provider (PRD §13.3); OTP is emailed to the account's address.
      if (user.email) await sendMail(user.email, 'Your VSR verification code', otpEmail(code, body.purpose === 'reset' ? 'reset your password' : 'sign in'), `otp=${code}`);
    }
    // Same response whether or not the account exists
    res.json({ sent: true, ...(isProd || !devOtp ? {} : { devOtp }) });
  }),
);

r.post(
  '/otp/verify',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ identifier: z.string().min(3), code: z.string().length(6), purpose: z.enum(['login', 'verify']), portal: z.enum(['admin', 'customer']).optional() }), req.body);
    const user = await User.findOne(identifierQuery(body.identifier));
    if (!user) throw badRequest('Invalid or expired code');
    const target = isEmail(body.identifier) ? user.email! : user.phone!;
    if (!(await consumeOtp(target, body.purpose, body.code))) throw badRequest('Invalid or expired code');
    if (isEmail(body.identifier)) user.emailVerified = true;
    else user.phoneVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    assertPortal(user.roles, body.portal);
    res.json({ user: publicUser(user), ...(await tokensFor(user, req.header('user-agent'))) });
  }),
);

r.post(
  '/password/reset',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ identifier: z.string().min(3), code: z.string().length(6), password: strongPassword }), req.body);
    const user = await User.findOne(identifierQuery(body.identifier));
    if (!user) throw badRequest('Invalid or expired code');
    const target = isEmail(body.identifier) ? user.email! : user.phone!;
    if (!(await consumeOtp(target, 'reset', body.code))) throw badRequest('Invalid or expired code');
    user.passwordHash = await hashPassword(body.password);
    await user.save();
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }); // sign out everywhere
    res.json({ reset: true });
  }),
);

// Rotating refresh tokens
r.post(
  '/refresh',
  ah(async (req, res) => {
    const { refreshToken } = parse(z.object({ refreshToken: z.string().min(10) }), req.body);
    const session = await Session.findOne({ tokenHash: sha256(refreshToken) });
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw unauthorized('Session expired. Please sign in again.');
    const user = await User.findById(session.user);
    if (!user || user.status !== 'active') throw unauthorized();
    session.revokedAt = new Date();
    await session.save();
    res.json({ user: publicUser(user), ...(await tokensFor(user, req.header('user-agent'))) });
  }),
);

r.post(
  '/logout',
  ah(async (req, res) => {
    const token = req.body?.refreshToken;
    if (typeof token === 'string') await Session.updateOne({ tokenHash: sha256(token) }, { revokedAt: new Date() });
    res.json({ ok: true });
  }),
);

r.get(
  '/me',
  authenticate,
  ah(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw unauthorized();
    res.json({ user: publicUser(user) });
  }),
);

export default r;
