// ILMIFY Service Worker - Background Push Notifications & Prayer Alarms
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache for scheduled prayer triggers in service worker
let scheduledPrayers = [];

// Listen for messages from front-end to schedule prayer alarms
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_PRAYER_ALARMS') {
    scheduledPrayers = event.data.prayers || [];
    schedulePrayerTriggers(scheduledPrayers);
  }
});

// Schedule local notification triggers (Supported in Chrome/Edge/Android when web is closed)
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
          body: `It is currently time for ${prayer.name} prayer. Tap to open and sound the Adhan alarm.`,
          icon: '/logoo.png',
          badge: '/logoo.png',
          tag: `prayer-alarm-${prayer.name}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 1000],
          showTrigger: new TimestampTrigger(prayer.timestamp),
          data: {
            url: `/times.html?ring=1&prayer=${encodeURIComponent(prayer.name)}&time=${encodeURIComponent(prayer.time || '')}`
          },
          actions: [
            { action: 'ring', title: '🔊 Open & Sound Alarm' },
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

// Web Push API (Handles background push messages sent from servers/FCM)
self.addEventListener('push', function(event) {
  let data = {
    title: 'Prayer Time Alert',
    body: 'Time for prayer. Tap to open and pray.',
    prayer: 'Salah'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const title = data.title || `Time for ${data.prayer || 'Prayer'}`;
  const targetUrl = data.url || (data.ringAlarm || data.prayer ? `/times.html?ring=1&prayer=${encodeURIComponent(data.prayer || 'Alert')}` : '/main.html');
  const options = {
    body: data.body || `It is time for ${data.prayer || 'Salah'} prayer.`,
    icon: '/logoo.png',
    badge: '/logoo.png',
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 1000],
    tag: 'ilmify-push-' + (data.prayer || Date.now()),
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      prayer: data.prayer || null,
      ringAlarm: !!data.ringAlarm
    },
    actions: [
      { action: 'open', title: data.ringAlarm ? '🔊 Open & Sound Alarm' : 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Periodic Sync handler (Runs periodically in background on supported devices)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'prayer-time-check') {
    // Background check
  }
});

// Notification click handler: opens or focuses the tab and triggers alarm ringing
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const prayerName = (event.notification.data && event.notification.data.prayer) || 'Prayer';
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : `/times.html?ring=1&prayer=${encodeURIComponent(prayerName)}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (targetUrl.includes('/times.html') && client.url && client.url.includes('/times.html')) {
          client.postMessage({
            type: 'TRIGGER_ALARM',
            prayer: prayerName,
            ring: true
          });
          client.navigate(targetUrl);
          return client.focus();
        } else if (client.url && client.url.includes(targetUrl.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
