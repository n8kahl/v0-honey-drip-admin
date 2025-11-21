# 🚀 Production Deployment Guide - Honey Drip Signal Scanner

Complete step-by-step guide to deploy your 24/7 trading signal detection and Discord notification system to Railway.

---

## 📋 Overview

This deployment sets up **two Railway services**:
1. **Main Web Server** - Serves the React dashboard + REST API + WebSocket proxy
2. **Scanner Worker** - Background process that continuously scans watchlists and sends Discord alerts

---

## 🔧 Prerequisites

### 1. Accounts Required
- ✅ [Railway](https://railway.app) account (Free tier works, Pro recommended for 24/7)
- ✅ [Supabase](https://supabase.com) project already set up
- ✅ [Massive.com](https://massive.com) API key (you have this)
- ✅ Discord webhook URLs configured in your Supabase `discord_channels` table

### 2. Local Setup
- ✅ Node.js 18+ installed
- ✅ pnpm installed (`npm install -g pnpm`)
- ✅ Git repository initialized

---

## 📦 Step 1: Database Setup

### 1.1 Run Migration for Scanner Heartbeat Table

Open your Supabase SQL Editor and run:

```bash
# Navigate to Supabase dashboard → SQL Editor → New Query
# Then paste and run the contents of:
scripts/005_add_scanner_heartbeat.sql
```

**Verify:** Check that the `scanner_heartbeat` table exists in your Supabase database.

### 1.2 Get Supabase Service Role Key

⚠️ **CRITICAL:** The scanner worker needs the **service role key** (not the anon key) to bypass RLS policies.

1. Go to Supabase Dashboard → Settings → API
2. Copy the `service_role` key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
3. ⚠️ **Keep this secret!** Never commit to git or share publicly

---

## 🛠️ Step 2: Build the Application Locally (Test First)

### 2.1 Build TypeScript

```bash
pnpm run build
```

**Expected output:**
```
✓ Built client bundle → dist/
✓ Built server TypeScript → server/dist/
```

**Verify files exist:**
```bash
ls server/dist/index.js          # Main server
ls server/dist/workers/scanner.js # Scanner worker
```

### 2.2 Test Scanner Worker Locally (Optional)

Set up your `.env.local` file:

```env
# Massive.com
MASSIVE_API_KEY=X1yfaGtpB0ga35h6pQ_wa0rJ_UVgriUj
MASSIVE_BASE_URL=https://api.massive.com

# Supabase
VITE_SUPABASE_URL=https://ejsaflvzljklapbrcfxr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(YOUR_SERVICE_ROLE_KEY)

# Proxy
MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb
VITE_MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb
```

Test the worker:

```bash
pnpm run dev:worker
```

**Expected output:**
```
[Scanner Worker] ======================================
[Scanner Worker] Starting 24/7 Signal Scanner Worker
[Scanner Worker] Scan interval: 60 seconds
[Scanner Worker] Primary timeframe: 5m
[Scanner Worker] ======================================

[Scanner Worker] ====== Starting scan at 2025-11-19T... ======
[Scanner Worker] Scanning 1 users
[Scanner Worker] Scanning 7 symbols for user abc123: SPY, QQQ, SPX, ...
...
```

---

## ☁️ Step 3: Deploy to Railway

### 3.1 Install Railway CLI (Optional)

```bash
npm install -g @railway/cli
railway login
```

### 3.2 Create Railway Project via Dashboard

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `v0-honey-drip-admin` repository
4. Railway will auto-detect Node.js and create a service

**Important:** This creates the **Main Web Server**. We'll add the worker service next.

---

## 🔑 Step 4: Configure Environment Variables

### 4.1 Main Web Server Variables

In Railway Dashboard → Your Project → Main Service → Variables:

Add these variables:

```env
# Massive.com
MASSIVE_API_KEY=X1yfaGtpB0ga35h6pQ_wa0rJ_UVgriUj
MASSIVE_BASE_URL=https://api.massive.com

# Proxy Auth
MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb
VITE_MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb

# Supabase
VITE_SUPABASE_URL=https://ejsaflvzljklapbrcfxr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqc2FmbHZ6bGprbGFwYnJjZnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIyNTM5NjgsImV4cCI6MjA0NzgyOTk2OH0.0VJXZmCpIc7gqUuJlxJ6H7uY8mFUwJ_AkSGJ7qCfcLE
SUPABASE_SERVICE_ROLE_KEY=(YOUR_SERVICE_ROLE_KEY_HERE)

# Deployment
WEB_ORIGIN=https://v0-honey-drip-admin-production.up.railway.app
PORT=8080
OPTIONS_PROVIDER=tradier
NODE_ENV=production
```

⚠️ **Replace** `SUPABASE_SERVICE_ROLE_KEY` with your actual service role key!

⚠️ **Update** `WEB_ORIGIN` with your actual Railway deployment URL (check Railway dashboard for the generated URL).

### 4.2 Build & Start Commands

Railway should auto-detect these, but verify in **Settings → Deploy**:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm run build
```

**Start Command:**
```bash
pnpm run start
```

---

## 🔁 Step 5: Add Scanner Worker Service

### 5.1 Add New Service

1. In Railway Dashboard → Your Project → Click **"+ New"** → **"Empty Service"**
2. Name it: `Scanner Worker`

### 5.2 Link to Same Repo

1. Click the new service → **Settings** → **Source**
2. Connect to the same GitHub repository
3. Set **Root Directory:** ` ` (same as main service)

### 5.3 Configure Worker Variables

Add the **same environment variables** as the main service (copy from Step 4.1).

### 5.4 Override Start Command

In Scanner Worker service → **Settings** → **Deploy** → **Start Command**:

```bash
pnpm run start:worker
```

⚠️ **Critical:** Make sure build command is:
```bash
pnpm install --frozen-lockfile && pnpm run build
```

### 5.5 Deploy Worker

Click **"Deploy"** in the Scanner Worker service.

---

## ✅ Step 6: Verify Deployment

### 6.1 Check Main Server Health

Open in browser:
```
https://your-railway-url.up.railway.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T12:34:56.789Z",
  "uptime": 123.45,
  "services": {
    "massive": true,
    "supabase": true,
    "scanner": true  ← Should be true!
  },
  "details": {
    "scanner": {
      "lastScan": "2025-11-19T12:33:00.000Z",
      "ageMinutes": 1.2,
      "signalsDetected": 0,
      "status": "healthy",
      "healthy": true
    }
  }
}
```

✅ **All services should show `true`**

### 6.2 Check Scanner Worker Logs

In Railway Dashboard → Scanner Worker service → **Deployments** → Click latest deployment → **View Logs**

**Expected logs:**
```
[Scanner Worker] Starting 24/7 Signal Scanner Worker
[Scanner Worker] ====== Starting scan at 2025-11-19T... ======
[Scanner Worker] Scanning 1 users
[Scanner Worker] Scanning 7 symbols for user abc123
[Scanner Worker] Fetched data for 7/7 symbols
[Scanner Worker] ====== Scan complete in 2341ms - 0 total signals ======
```

### 6.3 Test Discord Notifications

1. Manually insert a test signal in Supabase:

```sql
-- In Supabase SQL Editor:
INSERT INTO strategy_signals (
  symbol,
  strategy_id,
  owner,
  confidence,
  payload,
  status
)
SELECT
  'SPY',
  sd.id,
  p.id,
  85,
  '{"time": "2025-11-19T12:00:00Z", "price": 450.25, "confidence_ready": true}'::jsonb,
  'ACTIVE'
FROM strategy_definitions sd
CROSS JOIN profiles p
WHERE sd.slug = 'orb-bounce-5m'  -- Use an existing strategy slug
  AND sd.enabled = true
  AND p.id = '(YOUR_USER_ID)'    -- Replace with your user ID
LIMIT 1;
```

2. Check Discord channel for alert within ~60 seconds

---

## 🔧 Step 7: Configure Uptime Monitoring (Recommended)

### 7.1 Sign Up for Better Uptime (Free Tier)

https://betteruptime.com

### 7.2 Create Monitor

1. Add new monitor → **HTTP(S)**
2. URL: `https://your-railway-url.up.railway.app/api/health`
3. Check interval: **1 minute**
4. Expected status code: **200**

### 7.3 Set Up Alerts

1. Configure email/SMS notifications
2. Alert if health check fails 2 consecutive times
3. Alert if `services.scanner` is `false`

**Advanced:** Use custom assertions to check JSON response:
```javascript
response.body.services.scanner === true
response.body.services.massive === true
response.body.services.supabase === true
```

---

## 🐛 Troubleshooting

### Issue: Scanner service shows `scanner: false` in health check

**Possible causes:**
1. Scanner worker service not running
2. `SUPABASE_SERVICE_ROLE_KEY` not set or incorrect
3. Database migration not run (heartbeat table doesn't exist)

**Fix:**
```bash
# Check Railway logs for scanner worker
# Look for errors in deployment logs

# Verify service role key is set:
# Railway Dashboard → Scanner Worker → Variables → SUPABASE_SERVICE_ROLE_KEY

# Re-run database migration (Step 1.1)
```

### Issue: No Discord notifications

**Possible causes:**
1. No Discord channels configured in database
2. Webhook URLs invalid
3. No signals being detected (watchlist empty or no strategy matches)

**Fix:**
```sql
-- Check Discord channels exist:
SELECT * FROM discord_channels WHERE enabled = true;

-- Check watchlist:
SELECT * FROM watchlist;

-- Check enabled strategies:
SELECT * FROM strategy_definitions WHERE enabled = true;

-- Check recent signals:
SELECT * FROM strategy_signals ORDER BY created_at DESC LIMIT 10;
```

### Issue: Worker crashes with "MASSIVE_API_KEY is not configured"

**Fix:**
Ensure environment variables are set in **both services** (main + worker).

### Issue: "Cannot find module '@supabase/supabase-js'"

**Fix:**
Check build command includes `pnpm install`:
```bash
pnpm install --frozen-lockfile && pnpm run build
```

---

## 📊 Monitoring Your Deployment

### Key Metrics to Watch

1. **Health Check Status**
   - URL: `/api/health`
   - Should return 200 with all services `true`

2. **Scanner Heartbeat Age**
   - Check `details.scanner.ageMinutes` in health response
   - Should be < 2 minutes

3. **Railway Service Logs**
   - Main server: HTTP requests, WebSocket connections
   - Scanner worker: Scan cycles, signal detections

4. **Supabase Database**
   ```sql
   -- Check signal volume
   SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*)
   FROM strategy_signals
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY hour
   ORDER BY hour DESC;

   -- Check scanner heartbeat
   SELECT * FROM scanner_heartbeat WHERE id = 'main_scanner';
   ```

---

## 💰 Cost Estimate

### Railway Pricing (as of 2025)

**Hobby Plan (Free):**
- $5 free credit per month
- ~500 hours execution time
- ✅ Enough for testing, **not enough for 24/7** (2 services × 24 hours × 30 days = 1,440 hours)

**Pro Plan ($20/month):**
- Unlimited execution time
- Priority support
- ✅ **Recommended for production**

**Alternative:** Use Railway free tier + run scanner worker locally 24/7 on a Raspberry Pi or always-on computer.

---

## 🔄 Making Updates

### Deploying Code Changes

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "feat: improve signal detection"
   git push origin main
   ```

2. Railway auto-deploys on push (if auto-deploy enabled)

3. Monitor deployment logs

### Manual Deployment

Railway Dashboard → Service → Deployments → **"Redeploy"**

---

## 🎉 Success Checklist

- [✅] Main web server accessible at Railway URL
- [✅] `/api/health` returns all services `true`
- [✅] Scanner worker logs show regular scan cycles
- [✅] Test Discord alert received
- [✅] Uptime monitoring configured
- [✅] Watchlist populated in Supabase
- [✅] At least one strategy enabled
- [✅] Discord channels configured

---

## 📞 Support & Next Steps

### Modifying Strategies

**Easy way (no coding):**
```sql
-- In Supabase SQL Editor, update strategy conditions
UPDATE strategy_definitions
SET conditions = '...'  -- JSON condition tree
WHERE slug = 'your-strategy-slug';
```

**Advanced way:** Use the Strategy Library Admin UI (if implemented).

### Adding Symbols to Watchlist

**Via Supabase:**
```sql
INSERT INTO watchlist (symbol, owner)
VALUES ('AAPL', '(YOUR_USER_ID)');
```

**Via UI:** Add Ticker dialog in the dashboard.

### Modifying Confidence Thresholds

```sql
UPDATE strategy_definitions
SET alert_behavior = jsonb_set(
  alert_behavior,
  '{confidenceThresholds,min}',
  '60'::jsonb  -- Change min confidence from 50 to 60
)
WHERE slug = 'your-strategy';
```

---

## 🚨 Emergency Procedures

### Disable All Alerts Immediately

```sql
-- Turn off Discord notifications globally
UPDATE discord_channels SET enabled = false;

-- Or disable all strategies
UPDATE strategy_definitions SET enabled = false;
```

### Stop Scanner Worker

Railway Dashboard → Scanner Worker service → **Settings** → **Pause Service**

### Restart Everything

Railway Dashboard → Service → **Settings** → **Restart**

---

## 📝 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Supabase Documentation](https://supabase.com/docs)
- [Massive.com API Docs](https://massive.com/docs)
- [Discord Webhooks Guide](https://support.discord.com/hc/en-us/articles/228383668)

---

**🎯 You're now running a production-grade 24/7 trading signal detection system!**

Good luck with your trades! 🚀📈
