const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// VAPID Keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOV6m-17pyTWwl0hIO5lI8IXvDFyGmE8ZjS6TWbbsTi8iFAWGpeBKzpZ0qfRjOjUKEEfOP9EGd0csd70F10ff14';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'dfF2cHLA6KTxh9lvtbEEboCLpn5yV6SQKm1pzAbaLnY';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:piousbrotherscommunity@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.use(cors({ origin: '*' }));
app.use(express.json());

// Persistent subscribers storage
const DB_FILE = path.join(__dirname, 'subscribers.json');

function loadSubscribers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error loading subscribers:', err);
  }
  return [];
}

function saveSubscribers(subscribers) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error saving subscribers:', err);
  }
}

// 1. Health & Info
app.get('/', (req, res) => {
  const subs = loadSubscribers();
  res.json({
    status: 'online',
    app: 'ILMIFY Prayer Web Push Server',
    activeSubscribers: subs.length,
    vapidPublicKey: VAPID_PUBLIC_KEY,
    currentTimeUTC: new Date().toISOString()
  });
});

app.get('/api/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 2. Subscribe endpoint
app.post('/api/subscribe', (req, res) => {
  const { subscription, timings, prayers, timezone, tone } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid subscription object required' });
  }

  const subs = loadSubscribers();
  const existingIdx = subs.findIndex(s => s.subscription.endpoint === subscription.endpoint);

  const subscriberRecord = {
    subscription,
    timings: timings || null,
    prayers: prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    timezone: timezone || 'Asia/Kolkata',
    tone: tone || 'standard',
    lastUpdated: new Date().toISOString(),
    lastNotified: (existingIdx >= 0 && subs[existingIdx].lastNotified) ? subs[existingIdx].lastNotified : {}
  };

  if (existingIdx >= 0) {
    subs[existingIdx] = subscriberRecord;
    console.log('[PUSH] Updated subscription:', subscription.endpoint.slice(-20));
  } else {
    subs.push(subscriberRecord);
    console.log('[PUSH] New subscriber registered! Total:', subs.length);
  }

  saveSubscribers(subs);
  res.json({ success: true, message: 'Subscribed successfully', totalSubscribers: subs.length });
});

// 3. Unsubscribe endpoint
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

  let subs = loadSubscribers();
  subs = subs.filter(s => s.subscription.endpoint !== endpoint);
  saveSubscribers(subs);

  console.log('[PUSH] Unsubscribed:', endpoint.slice(-20));
  res.json({ success: true, message: 'Unsubscribed successfully' });
});

// 4. Send Immediate or Delayed Test Notification
app.post('/api/send-test', (req, res) => {
  const { subscription, delaySeconds = 5, prayer = 'Fajr' } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid subscription object required' });
  }

  console.log(`[TEST PUSH] Scheduling test notification for ${prayer} in ${delaySeconds}s to ${subscription.endpoint.slice(-20)}`);

  setTimeout(async () => {
    const payload = JSON.stringify({
      title: `Time for ${prayer} Prayer!`,
      body: `ILMIFY Web Push Alert: It is currently time for ${prayer}. Tap to open and sound Adhan.`,
      prayer: prayer,
      timestamp: Date.now()
    });

    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`[TEST PUSH] Successfully sent test push to ${subscription.endpoint.slice(-20)}`);
    } catch (err) {
      console.error('[TEST PUSH ERROR]', err.statusCode || err.message);
    }
  }, Math.max(0, delaySeconds) * 1000);

  res.json({
    success: true,
    message: `Test push queued! Lock your phone or close your browser. It will arrive in ${delaySeconds} seconds.`
  });
});

// Helper: normalize time string to HH:MM (24-hour)
function normalizeTime(timeStr) {
  if (!timeStr) return '';
  const clean = timeStr.split(' ')[0].trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return clean;
}

// Helper: get current HH:MM in subscriber's timezone
function getCurrentTimeInTimezone(tz) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(now);
  } catch (e) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

// 5. Automated Prayer Time Push Dispatcher (Runs every 30 seconds)
setInterval(async () => {
  const subs = loadSubscribers();
  if (!subs.length) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  let changed = false;

  for (const sub of subs) {
    if (!sub.timings) continue;

    const tz = sub.timezone || 'Asia/Kolkata';
    const currentTimeStr = getCurrentTimeInTimezone(tz);
    const activePrayers = sub.prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const prayerName of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      if (!activePrayers.includes(prayerName)) continue;

      const rawPrayerTime = sub.timings[prayerName] || sub.timings[prayerName.toLowerCase()];
      if (!rawPrayerTime) continue;

      const normPrayerTime = normalizeTime(rawPrayerTime);

      if (normPrayerTime === currentTimeStr) {
        sub.lastNotified = sub.lastNotified || {};
        if (sub.lastNotified[prayerName] === todayStr) {
          // Already sent today
          continue;
        }

        console.log(`[PRAYER PUSH] Dispatching ${prayerName} push for time ${normPrayerTime} (${tz})`);

        const payload = JSON.stringify({
          title: `Time for ${prayerName} Prayer!`,
          body: `It is time for ${prayerName} prayer. Tap to open and listen to the Adhan.`,
          prayer: prayerName,
          tone: sub.tone || 'standard',
          timestamp: Date.now()
        });

        try {
          await webpush.sendNotification(sub.subscription, payload);
          console.log(`[PRAYER PUSH SENT] Successfully notified ${prayerName} to ${sub.subscription.endpoint.slice(-20)}`);
          sub.lastNotified[prayerName] = todayStr;
          changed = true;
        } catch (err) {
          console.error(`[PRAYER PUSH ERROR] ${prayerName}:`, err.statusCode || err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('[PUSH] Subscription expired/gone. Removing endpoint.');
            sub._remove = true;
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    const activeSubs = subs.filter(s => !s._remove);
    saveSubscribers(activeSubs);
  }
}, 30000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🕌 ILMIFY Prayer Web Push Server Running on Port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔑 VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
  console.log(`==================================================`);
});
