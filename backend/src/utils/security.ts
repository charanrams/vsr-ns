import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { Session, Otp } from '../models/User';
import type { Role } from './roles';

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export interface AccessClaims {
  sub: string;
  roles: Role[];
}

export function signAccess(claims: AccessClaims) {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}
export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
}

/** Opaque refresh token; only its hash is stored so a DB leak can't be replayed. */
export async function issueRefresh(userId: string, userAgent?: string) {
  const token = crypto.randomBytes(48).toString('base64url');
  await Session.create({
    user: userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 864e5),
    userAgent,
  });
  return token;
}

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function createOtp(target: string, purpose: 'login' | 'verify' | 'reset') {
  // Invalidate any previous unused codes for the same target/purpose
  await Otp.updateMany({ target, purpose, usedAt: null }, { usedAt: new Date() });
  const code = generateOtp();
  await Otp.create({ target, purpose, codeHash: sha256(code), expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60e3) });
  return code;
}

/** Returns true if valid. Single-use, time-limited, attempt-limited. */
export async function consumeOtp(target: string, purpose: 'login' | 'verify' | 'reset', code: string) {
  const otp = await Otp.findOne({ target, purpose, usedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date() || otp.attempts >= env.OTP_MAX_ATTEMPTS) return false;
  if (otp.codeHash !== sha256(code)) {
    otp.attempts += 1;
    await otp.save();
    return false;
  }
  otp.usedAt = new Date();
  await otp.save();
  return true;
}
