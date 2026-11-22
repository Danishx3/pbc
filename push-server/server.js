const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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

// Normalize duplicate slashes in request URLs (e.g. //api/send-test -> /api/send-test)
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// Firebase Realtime Database Configuration
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://piousbrothers-c5e99-default-rtdb.firebaseio.com/analytics/prayer_subscribers';
const DB_FILE = path.join(__dirname, 'subscribers.json');

function getEndpointKey(endpoint) {
  return crypto.createHash('md5').update(endpoint || '').digest('hex');
}

// REST helper to fetch from Firebase RTDB
function firebaseGet(subPath = '') {
  return new Promise((resolve) => {
    const url = `${FIREBASE_DB_URL}${subPath}.json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn('[FIREBASE DB GET ERROR]', err.message);
      resolve(null);
    });
  });
}

// REST helper to write to Firebase RTDB
function firebasePut(subPath, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const url = new URL(`${FIREBASE_DB_URL}${subPath}.json`);
    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let resData = '';
      res.on('data', c => resData += c);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', (err) => {
      console.warn('[FIREBASE DB PUT ERROR]', err.message);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

// REST helper to delete from Firebase RTDB
function firebaseDelete(subPath) {
  return new Promise((resolve) => {
    const url = new URL(`${FIREBASE_DB_URL}${subPath}.json`);
    const req = https.request(url, {
      method: 'DELETE'
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', (err) => {
      console.warn('[FIREBASE DB DELETE ERROR]', err.message);
      resolve(false);
    });
    req.end();
  });
}

// Unified subscriber loader (Firebase RTDB with local file backup)
async function loadSubscribers() {
  try {
    const fbData = await firebaseGet();
    if (fbData && typeof fbData === 'object') {
      const list = Object.keys(fbData).map(k => {
        const item = fbData[k];
        if (item) item._fbKey = k;
        return item;
      }).filter(s => s && s.subscription && s.subscription.endpoint);

      saveSubscribersLocal(list);
      return list;
    }
  } catch (err) {
    console.warn('[FIREBASE] Fetch failed, using local backup:', err.message);
  }
  return loadSubscribersLocal();
}

function loadSubscribersLocal() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error loading local subscribers:', err);
  }
  return [];
}

function saveSubscribersLocal(subscribers) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
  } catch (err) { }
}

// 1. Health & Info
app.get('/', async (req, res) => {
  const subs = await loadSubscribers();
  res.json({
    status: 'online',
    app: 'ILMIFY Prayer Web Push Server',
    database: 'Firebase Realtime Database',
    activeSubscribers: subs.length,
    vapidPublicKey: VAPID_PUBLIC_KEY,
    currentTimeUTC: new Date().toISOString()
  });
});

app.get('/api/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// View all stored subscriptions & details
app.get('/api/subscribers', async (req, res) => {
  const subs = await loadSubscribers();
  res.json({
    status: 'ok',
    database: 'Firebase Realtime Database',
    firebaseUrl: FIREBASE_DB_URL,
    total: subs.length,
    subscribers: subs
  });
});

// 2. Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
  const { subscription, timings, prayers, timezone, tone, city } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid subscription object required' });
  }

  const key = getEndpointKey(subscription.endpoint);

  const subscriberRecord = {
    subscription,
    timings: timings || null,
    prayers: prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    timezone: timezone || 'Asia/Kolkata',
    tone: tone || 'standard',
    city: city || '',
    lastUpdated: new Date().toISOString(),
    lastNotified: {}
  };

  // 1. Persist to Firebase Realtime Database
  const fbOk = await firebasePut(`/${key}`, subscriberRecord);

  // 2. Also keep in local backup file
  const subs = loadSubscribersLocal();
  const existingIdx = subs.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (existingIdx >= 0) {
    subscriberRecord.lastNotified = subs[existingIdx].lastNotified || {};
    subs[existingIdx] = subscriberRecord;
  } else {
    subs.push(subscriberRecord);
  }
  saveSubscribersLocal(subs);

  console.log(`[PUSH] Subscriber saved to Firebase RTDB! (Key: ${key}, Firebase Status: ${fbOk ? 'OK' : 'Local Fallback'})`);
  res.json({
    success: true,
    message: 'Subscribed successfully and stored in Firebase Realtime Database',
    storage: 'Firebase Realtime Database',
    firebaseKey: key,
    totalSubscribers: subs.length
  });
});

// 3. Unsubscribe endpoint
app.post('/api/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

  const key = getEndpointKey(endpoint);
  await firebaseDelete(`/${key}`);

  let subs = loadSubscribersLocal();
  subs = subs.filter(s => s.subscription.endpoint !== endpoint);
  saveSubscribersLocal(subs);

  console.log('[PUSH] Unsubscribed from Firebase RTDB:', key);
  res.json({ success: true, message: 'Unsubscribed successfully from Firebase' });
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
      body: `ILMIFY Web Push Alert: It is currently time for ${prayer}.`,
      prayer: prayer,
      url: '/times.html',
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

// Convert HH:MM to minutes since midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return -1;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

// Helper: get current local date (YYYY-MM-DD) in subscriber timezone
function getLocalDateStr(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Kolkata' }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
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

// 5. Core Prayer Time Check and Dispatch Engine
async function checkAndDispatchPrayers() {
  const subs = await loadSubscribers();
  const diagnostics = {
    checkedAtUTC: new Date().toISOString(),
    database: 'Firebase Realtime Database',
    totalSubscribers: subs.length,
    results: []
  };

  if (!subs.length) {
    return diagnostics;
  }

  for (let idx = 0; idx < subs.length; idx++) {
    const sub = subs[idx];
    if (!sub.timings) continue;

    const tz = sub.timezone || 'Asia/Kolkata';
    const currentTimeStr = getCurrentTimeInTimezone(tz);
    const currentMin = timeToMinutes(currentTimeStr);
    const todayStr = getLocalDateStr(tz);
    const activePrayers = sub.prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const key = sub._fbKey || getEndpointKey(sub.subscription && sub.subscription.endpoint);

    const subReport = {
      subscriberId: idx + 1,
      key: key,
      city: sub.city || 'Unknown',
      timezone: tz,
      currentTime: currentTimeStr,
      prayers: {}
    };

    for (const prayerName of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      if (!activePrayers.includes(prayerName)) continue;

      const rawPrayerTime = sub.timings[prayerName] || sub.timings[prayerName.toLowerCase()];
      if (!rawPrayerTime) continue;

      const normPrayerTime = normalizeTime(rawPrayerTime);
      const prayerMin = timeToMinutes(normPrayerTime);
      if (prayerMin < 0 || currentMin < 0) continue;

      const diff = currentMin - prayerMin;
      sub.lastNotified = sub.lastNotified || {};
      const alreadySentToday = (sub.lastNotified[prayerName] === todayStr);
      const isDue = (diff >= 0 && diff <= 4);

      subReport.prayers[prayerName] = {
        time: normPrayerTime,
        diffMinutes: diff,
        isDue: isDue,
        alreadySentToday: alreadySentToday
      };

      if (isDue && !alreadySentToday) {
        console.log(`[PRAYER PUSH] Dispatching ${prayerName} push for time ${normPrayerTime} (Now: ${currentTimeStr}, tz: ${tz})`);

        const payload = JSON.stringify({
          title: `Time for ${prayerName} Prayer!`,
          body: `It is time for ${prayerName} prayer (${normPrayerTime}).`,
          prayer: prayerName,
          url: '/times.html',
          timestamp: Date.now()
        });

        try {
          await webpush.sendNotification(sub.subscription, payload);
          console.log(`[PRAYER PUSH SENT] Successfully notified ${prayerName} to ${sub.subscription.endpoint.slice(-20)}`);
          sub.lastNotified[prayerName] = todayStr;
          subReport.prayers[prayerName].status = 'SENT';

          // Update lastNotified in Firebase RTDB
          firebasePut(`/${key}/lastNotified/${prayerName}`, todayStr);
        } catch (err) {
          console.error(`[PRAYER PUSH ERROR] ${prayerName}:`, err.statusCode || err.message);
          subReport.prayers[prayerName].status = `ERROR_${err.statusCode || err.message}`;
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('[PUSH] Subscription expired/gone. Removing from Firebase RTDB.');
            firebaseDelete(`/${key}`);
          }
        }
      } else {
        subReport.prayers[prayerName].status = alreadySentToday ? 'ALREADY_SENT_TODAY' : (diff < 0 ? 'UPCOMING' : 'PAST');
      }
    }

    diagnostics.results.push(subReport);
  }

  return diagnostics;
}

// 6. Manual and Cron Trigger Endpoints
app.get('/api/check-prayers', async (req, res) => {
  try {
    const diag = await checkAndDispatchPrayers();
    res.json(diag);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Alias for keep-alive services like cron-job.org or UptimeRobot
app.get('/api/cron', async (req, res) => {
  try {
    const diag = await checkAndDispatchPrayers();
    res.json(diag);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Admin Endpoint: Send Custom Push Notification (Broadcast or Target Single Device)
app.post('/api/send-custom-notification', async (req, res) => {
  const { title, body, url, targetKey } = req.body;

  if (!title && !body) {
    return res.status(400).json({ error: 'Title or message body is required.' });
  }

  const subs = await loadSubscribers();
  if (!subs.length) {
    return res.json({ success: false, message: 'No active subscribers found in database.' });
  }

  let targets = subs;
  if (targetKey && targetKey !== 'all') {
    targets = subs.filter(s => (s._fbKey === targetKey || getEndpointKey(s.subscription && s.subscription.endpoint) === targetKey));
    if (!targets.length) {
      return res.status(404).json({ error: 'Selected subscriber device was not found.' });
    }
  }

  console.log(`[ADMIN BROADCAST] Sending "${title}" to ${targets.length} subscriber(s)...`);

  let sentCount = 0;
  let failedCount = 0;
  const errors = [];
  const targetUrl = (url && url.trim()) ? url.trim() : '/main.html';

  for (const sub of targets) {
    const payload = JSON.stringify({
      title: title || 'ILMIFY Notification',
      body: body || '',
      url: targetUrl,
      timestamp: Date.now()
    });

    try {
      await webpush.sendNotification(sub.subscription, payload);
      sentCount++;
    } catch (err) {
      failedCount++;
      errors.push(err.statusCode || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        const key = sub._fbKey || getEndpointKey(sub.subscription && sub.subscription.endpoint);
        firebaseDelete(`/${key}`);
      }
    }
  }

  res.json({
    success: true,
    message: `Push delivered to ${sentCount} device(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
    sentCount,
    failedCount,
    totalTargets: targets.length,
    errors
  });
});

// Automated internal loop (every 30 seconds)
setInterval(async () => {
  try {
    await checkAndDispatchPrayers();
  } catch (err) {
    console.error('[CRON LOOP ERROR]', err);
  }
}, 30000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🕌 ILMIFY Prayer Web Push Server Running on Port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔥 Database: Firebase Realtime Database (${FIREBASE_DB_URL})`);
  console.log(`🔑 VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
  console.log(`==================================================`);
});
