import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, ZodSchema } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error', public details?: unknown) {
    super(message);
  }
}
export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, 'bad_request', details);
export const unauthorized = (m = 'Authentication required') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = 'You do not have permission to do this') => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found');
export const conflict = (m: string) => new HttpError(409, m, 'conflict');

/** Wraps async handlers so rejections reach the error middleware (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('Validation failed', r.error.flatten().fieldErrors);
  return r.data;
}

export function paginate(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details }, requestId: req.id });
  }
  // Browser request from a website that isn't on the CORS allow-list (config/cors.ts)
  if ((err as Error)?.constructor?.name === 'CorsRejected') {
    return res.status(403).json({ error: { code: 'cors_rejected', message: (err as Error).message }, requestId: req.id });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Validation failed', details: err.flatten().fieldErrors } });
  }
  const e = err as { code?: number; name?: string; message?: string };
  if (e?.code === 11000) return res.status(409).json({ error: { code: 'conflict', message: 'A record with these details already exists' } });
  if (e?.name === 'CastError') return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid identifier' } });
  console.error(`[${req.id}]`, err);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong. Please try again.' }, requestId: req.id });
}
