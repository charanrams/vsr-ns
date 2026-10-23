import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyAccess } from '../utils/security';
import { forbidden, unauthorized } from '../utils/http';
import { isStaff, permissionsFor, Permission, Role } from '../utils/roles';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: { id: string; roles: Role[]; permissions: Permission[] };
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = (req.header('x-request-id') as string) || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const claims = verifyAccess(header.slice(7));
    req.user = { id: claims.sub, roles: claims.roles, permissions: permissionsFor(claims.roles) };
    next();
  } catch {
    next(unauthorized('Session expired. Please sign in again.'));
  }
}

export const requireStaff = (req: Request, _res: Response, next: NextFunction) =>
  req.user && isStaff(req.user.roles) ? next() : next(forbidden());

export const requireCustomer = (req: Request, _res: Response, next: NextFunction) =>
  req.user?.roles.includes('customer') ? next() : next(forbidden('Customer account required'));

/** Server-side authorization by permission (PRD §18 Admin security). */
export const can =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && perms.some((p) => req.user!.permissions.includes(p)) ? next() : next(forbidden());
