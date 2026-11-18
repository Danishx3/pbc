# ILMIFY Cloud Web Push Server

This server handles background Web Push notifications and Adhan alarms for ILMIFY when browsers or PWAs are completely closed on mobile or desktop devices.

## How it works
1. When a user toggles **Web Push Notifications** in `times.html`, their browser creates a Push Subscription using your VAPID Public Key and sends it to this server via `/api/subscribe`.
2. The server stores subscriptions in `subscribers.json`.
3. Every 30 seconds, the server checks current prayer times for each subscriber's timezone (`Asia/Kolkata`, etc.).
4. When a prayer time arrives, it sends a high-priority Web Push message through Google FCM / Web Push standard.
5. The device receives the push notification, vibrates, and tapping it immediately opens ILMIFY and sounds the vocal Adhan!

---

## 1. Running Locally (For Testing)
```bash
cd push-server
node server.js
```
Or double-click `start.bat`.

---

## 2. Deploying to Cloud 24/7 (Free Tier)
To receive push notifications on mobile when your computer is off, deploy this folder to a free cloud host like **Render** or **Railway**:

### Option A: Render (Free)
1. Push this project to GitHub.
2. Go to [render.com](https://render.com) and click **New Web Service**.
3. Connect your repository.
4. Set:
   - **Root Directory**: `push-server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**.
6. Copy the resulting URL (e.g., `https://ilmify-push.onrender.com`).
7. In ILMIFY `times.html`, click **Push Server Connection Settings** and paste this URL!

### Option B: Railway (Free)
1. Go to [railway.app](https://railway.app).
2. Deploy from GitHub repo selecting the `push-server` folder.
3. Copy your generated public domain URL and save it in `times.html`.
