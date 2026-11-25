// ILMIFY Service Worker - Web Push Notifications (v4 - High Priority & Persistent)
const SW_VERSION = 'ilmify-sw-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache for scheduled prayer reminders in service worker
let scheduledPrayers = [];

// Listen for messages from front-end to schedule prayer notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_PRAYER_NOTIFICATIONS') {
    scheduledPrayers = event.data.prayers || [];
    schedulePrayerTriggers(scheduledPrayers);
  }
});

// Schedule local notification triggers (When supported by Chrome/Edge/Android)
function schedulePrayerTriggers(prayers) {
  if (!('showTrigger' in Notification.prototype) || typeof TimestampTrigger === 'undefined') {
    return;
  }

  const now = Date.now();
  prayers.forEach(prayer => {
    if (prayer.timestamp && prayer.timestamp > now) {
      try {
        const title = `Time for ${prayer.name} Prayer!`;
        const options = {
          body: `It is currently time for ${prayer.name} prayer.`,
          icon: '/logoo.png',
          badge: '/logoo.png',
          tag: `prayer-notification-${prayer.name}`,
          renotify: true,
          requireInteraction: false,
          vibrate: [300, 150, 300],
          showTrigger: new TimestampTrigger(prayer.timestamp),
          data: {
            url: '/times.html'
          },
          actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

        self.registration.showNotification(title, options);
      } catch (e) {
        console.warn('TimestampTrigger scheduling error for ' + prayer.name, e);
      }
    }
  });
}

// Web Push API (Handles push notifications sent from Push Server / Firebase)
self.addEventListener('push', function(event) {
  let data = {
    title: 'ILMIFY Alert',
    body: 'You have a new update.',
    url: '/main.html'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const title = data.title || (data.prayer ? `Time for ${data.prayer} Prayer` : 'ILMIFY Notification');
  const targetUrl = data.url || (data.prayer ? '/times.html' : '/main.html');
  const tag = data.tag || (data.prayer ? `prayer-${data.prayer}` : `ilmify-${Date.now()}`);

  const options = {
    body: data.body || (data.prayer ? `It is time for ${data.prayer} prayer.` : ''),
    icon: '/logoo.png',
    badge: '/logoo.png',
    vibrate: [400, 200, 400, 200, 400],
    tag: tag,
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('showNotification failed with actions, retrying without actions:', err);
      // Fallback without actions in case browser environment rejects actions array
      delete options.actions;
      return self.registration.showNotification(title, options);
    })
  );
});

// Periodic Sync handler
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'prayer-time-check') {
    // Background check
  }
});

// Notification click handler: opens or focuses the specified URL cleanly
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const rawUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/main.html';
  // Strip any legacy ring parameters just in case
  const targetUrl = rawUrl.replace(/[?&]ring=1/g, '').replace(/\?$/, '');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const targetBase = targetUrl.split('?')[0];
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && client.url.includes(targetBase) && 'focus' in client) {
          if (client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
