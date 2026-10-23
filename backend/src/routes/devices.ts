import { Router } from 'express';
import { z } from 'zod';
import { ah, parse } from '../utils/http';
import { verifyAccess } from '../utils/security';
import { isStaff, type Role } from '../utils/roles';
import { DeviceToken } from '../utils/push';

/**
 * Push-notification device registration. Signed-in users are linked to their token; guests
 * (no or expired Authorization header) are stored without a user and get only store-wide offers.
 */
const r = Router();

function userFrom(header?: string): { id: string; roles: Role[] } | null {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const c = verifyAccess(header.slice(7));
    return { id: c.sub, roles: c.roles };
  } catch {
    return null;
  }
}

const registerSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['android', 'ios', 'web']),
  app: z.enum(['shop', 'admin']).default('shop'),
});

r.post(
  '/',
  ah(async (req, res) => {
    const body = parse(registerSchema, req.body);
    const user = userFrom(req.header('authorization'));
    // Only staff can receive staff-console pushes
    const app = body.app === 'admin' && user && isStaff(user.roles) ? 'admin' : 'shop';
    await DeviceToken.updateOne(
      { token: body.token },
      { $set: { token: body.token, platform: body.platform, app, user: user?.id ?? null } },
      { upsert: true },
    );
    res.json({ ok: true });
  }),
);

// Sign-out: forget the token so the next person on this device doesn't get the previous user's pushes
r.delete(
  '/',
  ah(async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(4096) }), req.body);
    await DeviceToken.deleteOne({ token });
    res.json({ ok: true });
  }),
);

export default r;
