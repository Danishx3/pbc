self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // Note: a push event only fires if the user is subscribed to Push
  // and your server (or FCM) sends a push message.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'ILMIFY', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ILMIFY';
  const body = payload.body || payload.message || '';
  const url = (payload.data && payload.data.url) || payload.url || '/main.html';

  const options = {
    body,
    icon: payload.icon || '/logoo.png',
    badge: payload.badge || '/logoo.png',
    tag: payload.tag || 'ilmify-push',
    vibrate: payload.vibrate || [200, 100, 200],
    data: { ...(payload.data || {}), url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const targetUrl = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
