/* Browser push notifications while the VSR tab is closed or in the background (see src/lib/push.ts).
 * The public Firebase web config arrives on this script's URL (?config=...), since workers can't
 * read Vite env vars. */

// Registered before Firebase so our click handling (open the order / product) wins
self.addEventListener('notificationclick', (event) => {
  const msg = event.notification.data && event.notification.data.FCM_MSG;
  const data = (msg && msg.data) || event.notification.data || {};
  let path = '/account/notifications';
  if (data.link && data.link.indexOf('/admin') === 0) path = data.link;
  else if (data.orderId) path = '/account/orders/' + data.orderId;
  else if (data.link && data.link.charAt(0) === '/') path = data.link;
  event.stopImmediatePropagation();
  event.notification.close();
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.focus().then((f) => (f && 'navigate' in f ? f.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

try {
  const config = JSON.parse(new URL(self.location.href).searchParams.get('config') || '{}');
  if (config.apiKey) {
    firebase.initializeApp(config);
    // Pushes with a notification part are shown by Firebase itself; this just has to be initialised
    firebase.messaging();
  }
} catch (e) {
  console.warn('VSR push worker: bad config', e);
}
