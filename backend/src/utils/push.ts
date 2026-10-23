import fs from 'fs';
import path from 'path';
import { Schema, model, Types } from 'mongoose';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message, type MulticastMessage } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { STAFF_ROLES } from './roles';

/**
 * Push notifications (Firebase Cloud Messaging) for the mobile app and both websites.
 *
 * Every device that allows notifications registers its FCM token here (POST /api/v1/devices).
 * Guests register too, so they still get store-wide offers. Every in-app Notification that is
 * saved (order updates, refunds, tickets, back in stock, admin broadcasts) is pushed by the
 * Notification post-save hook (models/Ops.ts), so no route has to remember to push.
 * Pushes show on the lock screen: Android channel "vsr_alerts" is high importance + public
 * visibility, iOS uses the time-sensitive interruption level, web uses the system notification.
 */
const deviceSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // null = guest
    /** 'shop' = customer app / storefront, 'admin' = staff console */
    app: { type: String, enum: ['shop', 'admin'], default: 'shop', index: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
  },
  { timestamps: true },
);
export const DeviceToken = model('DeviceToken', deviceSchema);

export const ANDROID_CHANNEL = 'vsr_alerts';

let app: App | null | undefined;
function firebase(): App | null {
  if (app !== undefined) return app;
  try {
    // Hosting: FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON or base64). Local: FIREBASE_SERVICE_ACCOUNT_PATH.
    let raw = env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    if (raw && !raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    if (!raw && env.FIREBASE_SERVICE_ACCOUNT_PATH) raw = fs.readFileSync(path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8');
    app = raw ? initializeApp({ credential: cert(JSON.parse(raw)) }, 'vsr-push') : null;
    if (!app) console.warn('[push] Firebase not configured; push notifications are off');
  } catch (e) {
    console.error('[push] Firebase init failed; push notifications are off:', (e as Error).message);
    app = null;
  }
  return app;
}
export const pushEnabled = () => Boolean(firebase());

export interface PushPayload {
  title: string;
  body?: string;
  /** Where a tap should go: kind + ids, mapped to each client's own route */
  data?: { kind?: string; orderId?: string; link?: string; notificationId?: string; ticketId?: string };
}

function message(p: PushPayload): Omit<MulticastMessage, 'tokens'> {
  const data = Object.fromEntries(Object.entries(p.data ?? {}).filter(([, v]) => v)) as Record<string, string>;
  return {
    notification: { title: p.title, body: p.body ?? '' },
    data,
    android: {
      priority: 'high',
      notification: { channelId: ANDROID_CHANNEL, visibility: 'public', sound: 'default', defaultVibrateTimings: true, icon: 'ic_notification', color: '#064E3B' },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default', 'interruption-level': 'time-sensitive' } as Record<string, unknown> },
    },
    webpush: {
      headers: { Urgency: 'high' },
      notification: { icon: '/favicon.png', badge: '/favicon.png', requireInteraction: false },
      fcmOptions: data.link?.startsWith('/') ? { link: data.link } : undefined,
    },
  };
}

/** Send to every device matching the filter; tokens Firebase reports as dead are removed. */
export async function pushTo(filter: Record<string, unknown>, payload: PushPayload) {
  const fb = firebase();
  if (!fb) return { sent: 0 };
  const tokens = (await DeviceToken.find(filter).select('token').lean()).map((d) => d.token);
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await getMessaging(fb).sendEachForMulticast({ ...message(payload), tokens: batch });
      sent += res.successCount;
      const dead = res.responses
        .map((r, n) => (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code ?? '') ? batch[n] : null))
        .filter((t): t is string => !!t);
      if (dead.length) await DeviceToken.deleteMany({ token: { $in: dead } });
    } catch (e) {
      console.error('[push] send failed:', (e as Error).message);
    }
  }
  return { sent };
}

export const pushToUser = (userId: string | Types.ObjectId, p: PushPayload) => pushTo({ user: userId, app: 'shop' }, p);
export const pushToAllCustomers = (p: PushPayload) => pushTo({ app: 'shop' }, p);

/** Staff consoles (admin web). Only tokens whose owner still has a staff role. */
export async function pushToStaff(p: PushPayload) {
  const { User } = await import('../models/User');
  const staff = await User.find({ roles: { $in: STAFF_ROLES }, status: 'active' }).select('_id').lean();
  return pushTo({ app: 'admin', user: { $in: staff.map((s) => s._id) } }, p);
}

/** Called by the Notification post-save hook. Never throws: a push failure must not fail the request. */
export async function pushNotification(n: { _id: unknown; recipient?: unknown; audience?: string | null; kind?: string | null; title: string; body?: string | null; link?: string | null; order?: unknown }) {
  try {
    const payload: PushPayload = {
      title: n.title,
      body: n.body ?? '',
      data: { kind: n.kind ?? 'system', notificationId: String(n._id), link: n.link ?? undefined, orderId: n.order ? String(n.order) : undefined },
    };
    if (n.audience === 'all_customers') await pushToAllCustomers(payload);
    else if (n.recipient) await pushToUser(String(n.recipient), payload);
  } catch (e) {
    console.error('[push] notification push failed:', (e as Error).message);
  }
}

// Exposed for one-off sends (e.g. a test push to a single device)
export async function pushToToken(token: string, p: PushPayload) {
  const fb = firebase();
  if (!fb) throw new Error('Firebase is not configured');
  const msg: Message = { ...message(p), token } as Message;
  return getMessaging(fb).send(msg);
}
