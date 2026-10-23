import { useEffect, useState } from 'react';
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { toast } from 'sonner';
import { api, onSession } from './api';
import { onShopSession, shopApi } from '../shop/api';

/**
 * Browser push notifications (Firebase Cloud Messaging), for the storefront and the admin console.
 *
 * - Tab closed / in background: public/firebase-messaging-sw.js shows a system notification
 *   (lock screen / notification centre); a click opens the order, product or notifications page.
 * - Tab open: a toast with a "View" button.
 * - The browser token is registered with the API (POST /devices) for whichever side is open:
 *   /admin → staff console pushes (new orders, tickets), otherwise customer / guest pushes.
 *   Re-registered on sign-in / sign-out so pushes follow the account.
 * The Firebase web config + VAPID key live in backend/.env and arrive via GET /store/config;
 * without them push stays off.
 */
interface WebPushConfig {
  config: FirebaseOptions;
  vapidKey: string;
}
// Firebase web config + VAPID key come from the backend (backend/.env → GET /store/config)
let remote: Promise<WebPushConfig | null> | null = null;
const loadConfig = () =>
  (remote ??= shopApi.get<{ webPush?: WebPushConfig | null }>('/store/config').then(
    (r) => r.data.webPush ?? null,
    () => {
      remote = null; // API unreachable: try again next time
      return null;
    },
  ));

export type PushState = 'on' | 'off' | 'denied' | 'unsupported' | 'unconfigured';

let messaging: Messaging | null = null;
let listening = false;

const isAdminPage = () => location.pathname.startsWith('/admin');

/** Where a push leads on this website. */
export function pushHref(data: Record<string, string | undefined>) {
  if (data.link?.startsWith('/admin')) return data.link;
  if (data.orderId) return `/account/orders/${data.orderId}`;
  if (data.link?.startsWith('/')) return data.link;
  return '/account/notifications';
}

// In-app navigation without a reload (react-router's BrowserRouter listens to popstate)
function go(path: string) {
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

let cfg: WebPushConfig | null = null;
async function setup(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) return null;
  cfg = await loadConfig();
  if (!cfg) return null;
  messaging = getMessaging(initializeApp(cfg.config, 'vsr-push'));
  return messaging;
}

export async function pushState(): Promise<PushState> {
  if (!(await setup())) return (await loadConfig()) ? 'unsupported' : 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Registers this browser for pushes. `ask` shows the browser's permission prompt (call it from a
 * click); without it we only (re)register when permission was already granted.
 */
export async function enableWebPush(ask = false): Promise<PushState> {
  const m = await setup();
  if (!m) return (await loadConfig()) ? 'unsupported' : 'unconfigured';
  if (ask && Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'off';
  try {
    // The worker can't call our API before Firebase starts, so the public web config rides on its URL
    const sw = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(cfg!.config))}`);
    const token = await getToken(m, { vapidKey: cfg!.vapidKey, serviceWorkerRegistration: sw });
    if (!token) return 'off';
    const admin = isAdminPage();
    await (admin ? api : shopApi).post('/devices', { token, platform: 'web', app: admin ? 'admin' : 'shop' });
    if (!listening) {
      listening = true;
      onMessage(m, (p) => {
        const data = (p.data ?? {}) as Record<string, string>;
        toast(p.notification?.title ?? 'VSR', {
          description: p.notification?.body,
          action: { label: 'View', onClick: () => go(pushHref(data)) },
          duration: 8000,
        });
      });
    }
    return 'on';
  } catch (e) {
    console.warn('Web push registration failed', e);
    return 'off';
  }
}

/** Keep this browser's push registration linked to whoever is signed in (call once at startup). */
export function startWebPush() {
  const sync = () => void enableWebPush(false);
  sync();
  onShopSession(sync);
  onSession(sync);
}

/** Push status + an `enable` to call from a click (the browser's permission prompt needs one). */
export function usePushPrompt() {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setState(s), () => live && setState('unsupported'));
    return () => {
      live = false;
    };
  }, []);
  const enable = async () => {
    const s = await enableWebPush(true);
    setState(s);
    if (s === 'on') toast.success('Push notifications are on');
    else if (s === 'denied') toast.error('Notifications are blocked. Allow them in your browser\'s site settings.');
  };
  return { state, enable };
}
