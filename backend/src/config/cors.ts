import type { CorsOptions } from 'cors';
import { env, isProd } from './env';

/**
 * CORS policy for the API and the Socket.IO live-update channel.
 *
 * Allowed:
 *  - every origin listed in CORS_ORIGINS (comma separated; `https://*.vsr.in` style wildcards allowed)
 *  - in development, any http://localhost:<port> / 127.0.0.1:<port> (e.g. a second Vite on 5174)
 *  - requests with no Origin header: the mobile app, curl, server-to-server calls, payment webhooks
 * Everything else is refused (no CORS headers), so browsers block the response.
 */
const patterns = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)
  .map((o) => (o.includes('*') ? new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`) : o));

const localDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (!isProd && localDev.test(origin)) return true;
  return patterns.some((p) => (typeof p === 'string' ? p === origin : p.test(origin)));
}

export const corsOptions: CorsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new CorsRejected(origin!));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  // Tokens travel in the Authorization header, never cookies
  credentials: false,
  maxAge: 600, // browsers cache the preflight for 10 minutes
  optionsSuccessStatus: 204,
};

export class CorsRejected extends Error {
  status = 403;
  constructor(origin: string) {
    super(`Origin ${origin} is not allowed by VSR's CORS policy. Add it to CORS_ORIGINS in backend/.env.`);
  }
}
