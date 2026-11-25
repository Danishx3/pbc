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

// Version & Health check endpoint
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.3.0',
    features: ['urgency-high', 'ttl-86400', 'night-window-1900'],
    nightWindow: '19:00 - 23:30',
    currentTimeUTC: new Date().toISOString()
  });
});

// Firebase Realtime Database Configuration
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://piousbrothers-c5e99-default-rtdb.firebaseio.com/analytics/prayer_subscribers';
const DB_FILE = path.join(__dirname, 'subscribers.json');

// Canonical MD5 key generator for subscriber endpoints
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

// Unified subscriber loader with deduplication (Firebase RTDB with local file backup)
async function loadSubscribers() {
  try {
    const fbData = await firebaseGet();
    if (fbData && typeof fbData === 'object') {
      const endpointMap = new Map();
      const keysToDelete = [];

      for (const k of Object.keys(fbData)) {
        const item = fbData[k];
        if (!item || !item.subscription || !item.subscription.endpoint) continue;

        const ep = item.subscription.endpoint;
        const canonicalKey = getEndpointKey(ep);

        if (!endpointMap.has(ep)) {
          item._fbKey = canonicalKey;
          endpointMap.set(ep, item);
          // If stored under a rogue or non-MD5 key (e.g. from client slice), migrate it
          if (k !== canonicalKey) {
            keysToDelete.push(k);
            firebasePut(`/${canonicalKey}`, item);
          }
        } else {
          // Merge duplicate records for the same endpoint into the single canonical entry
          const existing = endpointMap.get(ep);
          if (!existing.timings && item.timings) existing.timings = item.timings;
          if ((!existing.city || existing.city === 'Adhkar Reader' || existing.city === 'Quran Reader') && item.city && item.city !== 'Adhkar Reader' && item.city !== 'Quran Reader') {
            existing.city = item.city;
          }
          if (item.reminders) existing.reminders = Object.assign({}, existing.reminders, item.reminders);
          if (item.lastNotified) existing.lastNotified = Object.assign({}, existing.lastNotified, item.lastNotified);
          keysToDelete.push(k);
        }
      }

      // Delete rogue legacy keys from Firebase RTDB
      for (const rogueKey of keysToDelete) {
        firebaseDelete(`/${rogueKey}`);
      }

      const list = Array.from(endpointMap.values());
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
    app: 'ILMIFY Unified Web Push Server',
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

// 2. Subscribe endpoint (Unified: If ANY reminder is turned on, ALL reminders are ON!)
app.post('/api/subscribe', async (req, res) => {
  const { subscription, timings, prayers, timezone, tone, city } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid subscription object required' });
  }

  const key = getEndpointKey(subscription.endpoint);

  // Fetch existing subscriber if already present to preserve timings / history
  let existing = null;
  try {
    existing = await firebaseGet(`/${key}`);
  } catch (e) {}
  if (!existing) {
    existing = loadSubscribersLocal().find(s => s.subscription && s.subscription.endpoint === subscription.endpoint);
  }
  existing = existing || {};

  // Rule: If any reminder is turned on, ALL reminders are ON!
  const unifiedReminders = {
    prayer: true,
    adhkar: true,
    morningAdhkar: true,
    eveningAdhkar: true,
    kahf: true,
    night: true
  };

  const subscriberRecord = {
    subscription,
    timings: timings || existing.timings || null,
    prayers: prayers || existing.prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    timezone: timezone || existing.timezone || 'Asia/Kolkata',
    tone: tone || existing.tone || 'standard',
    city: (city && city.trim() && city !== 'Adhkar Reader' && city !== 'Quran Reader') ? city.trim() : (existing.city || city || ''),
    reminders: unifiedReminders,
    lastUpdated: new Date().toISOString(),
    lastNotified: existing.lastNotified || {}
  };

  // 1. Persist to Firebase Realtime Database
  const fbOk = await firebasePut(`/${key}`, subscriberRecord);

  // 2. Also keep in local backup file
  const subs = loadSubscribersLocal();
  const existingIdx = subs.findIndex(s => s.subscription && s.subscription.endpoint === subscription.endpoint);
  if (existingIdx >= 0) {
    subs[existingIdx] = subscriberRecord;
  } else {
    subs.push(subscriberRecord);
  }
  saveSubscribersLocal(subs);

  console.log(`[PUSH] Unified subscriber saved to Firebase RTDB! (Key: ${key}, Firebase Status: ${fbOk ? 'OK' : 'Local Fallback'})`);
  res.json({
    success: true,
    message: 'Unified subscription saved to Firebase Realtime Database',
    storage: 'Firebase Realtime Database',
    firebaseKey: key,
    reminders: unifiedReminders,
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
  subs = subs.filter(s => s.subscription && s.subscription.endpoint !== endpoint);
  saveSubscribersLocal(subs);

  console.log('[PUSH] Unsubscribed from Firebase RTDB:', key);
  res.json({ success: true, message: 'Unsubscribed successfully from Firebase' });
});

// 4. Send Immediate or Delayed Test Notification
app.post('/api/send-test', (req, res) => {
  const { subscription, delaySeconds = 5, prayer = 'Fajr' } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription required' });

  const delayMs = Math.max(1, parseInt(delaySeconds, 10)) * 1000;
  console.log(`[PUSH TEST] Queuing test push in ${delaySeconds}s for ${prayer}`);

  setTimeout(async () => {
    try {
      const payload = JSON.stringify({
        title: `Time for ${prayer} Prayer!`,
        body: `It is currently time for ${prayer} prayer. Test delivered successfully!`,
        prayer: prayer,
        url: '/times.html',
        timestamp: Date.now()
      });
      await webpush.sendNotification(subscription, payload, { TTL: 86400, urgency: 'high' });
      console.log('[PUSH TEST] Delivered successfully');
    } catch (err) {
      console.error('[PUSH TEST ERROR]:', err);
    }
  }, delayMs);

  res.json({ success: true, message: `Test notification scheduled in ${delaySeconds} seconds.` });
});

// Helper: Normalize 12-hour/24-hour time to HH:MM format
function normalizeTime(timeStr) {
  if (!timeStr) return '';
  let clean = timeStr.trim().toUpperCase();
  clean = clean.replace(/\s*\(.*?\)/g, '').trim();

  if (clean.includes('AM') || clean.includes('PM')) {
    const isPM = clean.includes('PM');
    clean = clean.replace(/AM|PM/g, '').trim();
    const parts = clean.split(':').map(Number);
    let hours = parts[0];
    const minutes = parts[1] || 0;
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

// 5. Core Automated Reminders Dispatch Engine (Prayers, Adhkar, Friday Kahf, Night Surahs)
async function checkAndDispatchAutomatedReminders() {
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
    if (!sub || !sub.subscription || !sub.subscription.endpoint) continue;

    const tz = sub.timezone || 'Asia/Kolkata';
    const currentTimeStr = getCurrentTimeInTimezone(tz);
    const currentMin = timeToMinutes(currentTimeStr);
    const todayStr = getLocalDateStr(tz);
    const key = sub._fbKey || getEndpointKey(sub.subscription.endpoint);

    sub.lastNotified = sub.lastNotified || {};
    let modifiedLastNotified = false;

    const subReport = {
      subscriberId: idx + 1,
      key: key,
      city: sub.city || 'Unknown',
      timezone: tz,
      currentTime: currentTimeStr,
      notificationsSent: []
    };

    // Helper to send push
    async function sendPush(title, body, url, tag) {
      const payload = JSON.stringify({
        title,
        body,
        url,
        tag: tag || ('ilmify-' + Date.now()),
        timestamp: Date.now()
      });
      const pushOptions = {
        TTL: 86400,
        urgency: 'high'
      };
      try {
        await webpush.sendNotification(sub.subscription, payload, pushOptions);
        console.log(`[AUTO-REMINDER SENT] "${title}" to device ${key.substring(0, 8)}...`);
        subReport.notificationsSent.push(title);
        return true;
      } catch (err) {
        console.error(`[AUTO-REMINDER ERROR] "${title}" for ${key.substring(0, 8)}:`, err.statusCode || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PUSH] Subscription expired. Removing from Firebase RTDB: ${key}`);
          firebaseDelete(`/${key}`);
        }
        return false;
      }
    }

    // --- A. Prayer Times ---
    const isIndia = (tz.includes('Calcutta') || tz.includes('Kolkata'));
    const defaultTimings = isIndia
      ? { Fajr: '05:10', Dhuhr: '12:15', Asr: '15:35', Maghrib: '18:00', Isha: '19:15' }
      : { Fajr: '05:15', Dhuhr: '12:30', Asr: '16:00', Maghrib: '18:30', Isha: '20:00' };
    const timings = sub.timings || defaultTimings;
    const activePrayers = sub.prayers || ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const prayerName of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      if (!activePrayers.includes(prayerName)) continue;
      const rawPrayerTime = timings[prayerName] || timings[prayerName.toLowerCase()];
      if (!rawPrayerTime) continue;

      const normPrayerTime = normalizeTime(rawPrayerTime);
      const prayerMin = timeToMinutes(normPrayerTime);
      if (prayerMin < 0 || currentMin < 0) continue;

      const diff = currentMin - prayerMin;
      const alreadySentToday = (sub.lastNotified[prayerName] === todayStr);
      // Window: -1 to +12 minutes allows timely dispatch even if cron or render wake was slightly delayed
      const isDue = (diff >= -1 && diff <= 12);

      if (isDue && !alreadySentToday) {
        const sent = await sendPush(
          `Time for ${prayerName} Prayer!`,
          `It is currently time for ${prayerName} prayer (${normPrayerTime}).`,
          '/times.html',
          `prayer-${prayerName}`
        );
        if (sent) {
          sub.lastNotified[prayerName] = todayStr;
          modifiedLastNotified = true;
        }
      }
    }

    // --- B. Morning Adhkar (Every morning between 05:45 and 08:30) ---
    const isMorningAdhkarWindow = (currentMin >= timeToMinutes('05:45') && currentMin <= timeToMinutes('08:30'));
    if (isMorningAdhkarWindow && sub.lastNotified.morningAdhkar !== todayStr) {
      const sent = await sendPush(
        '🌅 Morning Adhkar Reminder',
        'Begin your day with the remembrance of Allah. Read your Morning Adhkar.',
        '/adhkar.html',
        'adhkar-morning'
      );
      if (sent) {
        sub.lastNotified.morningAdhkar = todayStr;
        modifiedLastNotified = true;
      }
    }

    // --- C. Evening Adhkar (Every evening between 16:30 and 18:45) ---
    const isEveningAdhkarWindow = (currentMin >= timeToMinutes('16:30') && currentMin <= timeToMinutes('18:45'));
    if (isEveningAdhkarWindow && sub.lastNotified.eveningAdhkar !== todayStr) {
      const sent = await sendPush(
        '🌇 Evening Adhkar Reminder',
        'Protect your evening with the remembrance of Allah. Read your Evening Adhkar.',
        '/adhkar.html',
        'adhkar-evening'
      );
      if (sent) {
        sub.lastNotified.eveningAdhkar = todayStr;
        modifiedLastNotified = true;
      }
    }

    // --- D. Night Adhkar (Every night between 19:00 and 23:30) ---
    const isNightAdhkarWindow = (currentMin >= timeToMinutes('19:00') && currentMin <= timeToMinutes('23:30'));
    if (isNightAdhkarWindow && sub.lastNotified.nightAdhkar !== todayStr) {
      const sent = await sendPush(
        '🌙 Night Adhkar Reminder',
        'Before sleeping, remember Allah with your Night Adhkar and Sleep Duas.',
        '/adhkar.html',
        'adhkar-night'
      );
      if (sent) {
        sub.lastNotified.nightAdhkar = todayStr;
        modifiedLastNotified = true;
      }
    }

    // --- E. Friday Surah Al-Kahf (Thursday evening after 19:00 or Friday before 18:00) ---
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const dayOfWeek = nowInTz.getDay(); // 0=Sun, 4=Thu, 5=Fri
    let isKahfWindow = false;
    let fridayTargetDate = new Date(nowInTz);
    if (dayOfWeek === 4 && currentMin >= timeToMinutes('19:00')) {
      isKahfWindow = true;
      fridayTargetDate.setDate(fridayTargetDate.getDate() + 1);
    } else if (dayOfWeek === 5 && currentMin <= timeToMinutes('18:00')) {
      isKahfWindow = true;
    }
    const fridayDateKey = fridayTargetDate.toISOString().slice(0, 10);

    if (isKahfWindow && sub.lastNotified.kahf !== fridayDateKey) {
      const sent = await sendPush(
        '🕌 Friday Surah Al-Kahf Reminder',
        'Blessed Friday: Don\'t forget to recite Surah Al-Kahf today for light between the two Fridays.',
        '/quran.html',
        'quran-kahf'
      );
      if (sent) {
        sub.lastNotified.kahf = fridayDateKey;
        modifiedLastNotified = true;
      }
    }

    // --- F. Night Surahs (Every night between 19:00 and 23:30) ---
    const isNightSurahsWindow = (currentMin >= timeToMinutes('19:00') && currentMin <= timeToMinutes('23:30'));
    if (isNightSurahsWindow && sub.lastNotified.nightSurahs !== todayStr) {
      const sent = await sendPush(
        '📖 Night Surahs Reminder',
        'Before sleeping, recite Surah Al-Mulk, As-Sajdah, and Ayatul Kursi for protection.',
        '/quran.html',
        'quran-night'
      );
      if (sent) {
        sub.lastNotified.nightSurahs = todayStr;
        modifiedLastNotified = true;
      }
    }

    // Persist updated lastNotified to Firebase RTDB
    if (modifiedLastNotified) {
      firebasePut(`/${key}/lastNotified`, sub.lastNotified);
    }

    diagnostics.results.push(subReport);
  }

  return diagnostics;
}

// Alias for backwards compatibility
const checkAndDispatchPrayers = checkAndDispatchAutomatedReminders;

// 6. Manual and Cron Trigger Endpoints
app.get('/api/check-prayers', async (req, res) => {
  try {
    const diag = await checkAndDispatchAutomatedReminders();
    res.json(diag);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Alias for keep-alive services like cron-job.org, UptimeRobot, or client pings
app.get('/api/cron', async (req, res) => {
  try {
    const diag = await checkAndDispatchAutomatedReminders();
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
      await webpush.sendNotification(sub.subscription, payload, { TTL: 86400, urgency: 'high' });
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

// Automated internal loop (every 30 seconds when server is running)
setInterval(async () => {
  try {
    await checkAndDispatchAutomatedReminders();
  } catch (err) {
    console.error('[CRON LOOP ERROR]', err);
  }
}, 30000);

// Keep-alive self-ping (pings every 8 minutes to prevent Render free-tier idle sleep)
const SERVER_PING_URL = process.env.RENDER_EXTERNAL_URL || 'https://pbc-onuf.onrender.com';
setInterval(() => {
  try {
    https.get(`${SERVER_PING_URL}/api/cron`, () => {}).on('error', () => {});
  } catch (e) {}
}, 8 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🕌 ILMIFY Unified Web Push Server Running on Port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔥 Database: Firebase Realtime Database (${FIREBASE_DB_URL})`);
  console.log(`🔑 VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
  console.log(`==================================================`);
});
