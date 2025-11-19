# 🚀 Quick Start Guide - Get Your Scanner Running in 30 Minutes

This is the **fastest path** to getting your 24/7 trading signal scanner deployed and running.

---

## ✅ Prerequisites Checklist

Before starting, make sure you have:

- [x] Railway account (sign up at https://railway.app)
- [x] Supabase project already set up
- [x] Discord webhook URLs configured
- [x] This codebase ready to deploy

---

## 📋 5-Step Deployment

### Step 1: Database Setup (5 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `scripts/005_add_scanner_heartbeat.sql`
4. Click **Run**
5. Verify: Check that `scanner_heartbeat` table exists

**Get your service role key:**
- Supabase Dashboard → Settings → API
- Copy the **service_role** key (long token starting with `eyJhbGci...`)
- ⚠️ **SAVE THIS** - you'll need it in Step 3

---

### Step 2: Deploy to Railway (10 minutes)

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `v0-honey-drip-admin` repository
4. Wait for deployment to complete (~3 minutes)

**Your main server is now deployed!** ✅

---

### Step 3: Configure Main Server (5 minutes)

In Railway Dashboard → Your Project → Main Service → **Variables**:

Click **"+ New Variable"** and add these (copy-paste from your `.env`):

```
MASSIVE_API_KEY=X1yfaGtpB0ga35h6pQ_wa0rJ_UVgriUj
MASSIVE_BASE_URL=https://api.massive.com
MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb
VITE_MASSIVE_PROXY_TOKEN=57825048d317cc9c402266a3c5d25becb8982468f249c9b2c73c42a5125085eb
VITE_SUPABASE_URL=https://ejsaflvzljklapbrcfxr.supabase.co
VITE_SUPABASE_ANON_KEY=(your anon key)
SUPABASE_SERVICE_ROLE_KEY=(service role key from Step 1)
WEB_ORIGIN=https://YOUR-RAILWAY-URL.up.railway.app
PORT=8080
OPTIONS_PROVIDER=tradier
NODE_ENV=production
```

⚠️ **Important:** Replace:
- `VITE_SUPABASE_ANON_KEY` - your anon key
- `SUPABASE_SERVICE_ROLE_KEY` - service role key from Step 1
- `WEB_ORIGIN` - your actual Railway URL (find it in Railway dashboard)

Click **Save** - Railway will redeploy automatically.

---

### Step 4: Add Scanner Worker Service (7 minutes)

1. In Railway Dashboard → Your Project → Click **"+ New"** → **"Empty Service"**
2. Name it: `Scanner Worker`
3. Click the service → **Settings** → **Source** → Connect to same GitHub repo
4. **Settings** → **Deploy**:
   - **Start Command:** `pnpm run start:worker`
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm run build`
5. **Variables** → **Raw Editor** → Copy ALL variables from Step 3 (same exact values)
6. Click **Deploy**

**Your scanner worker is now running 24/7!** ✅

---

### Step 5: Verify Everything Works (3 minutes)

#### 5.1 Check Health Endpoint

Open in browser:
```
https://your-railway-url.up.railway.app/api/health
```

**You should see:**
```json
{
  "status": "ok",
  "services": {
    "massive": true,
    "supabase": true,
    "scanner": true  ← Should be true!
  }
}
```

✅ **All three should be `true`**

#### 5.2 Check Scanner Logs

Railway Dashboard → Scanner Worker → Deployments → Latest → **View Logs**

**You should see:**
```
[Scanner Worker] Starting 24/7 Signal Scanner Worker
[Scanner Worker] ====== Starting scan at ...
[Scanner Worker] Scanning 1 users
```

✅ **Logs should update every 60 seconds**

#### 5.3 Test Discord Alert (Optional)

Create a test signal in Supabase SQL Editor:

```sql
-- Replace YOUR_USER_ID with your actual user ID
INSERT INTO strategy_signals (symbol, strategy_id, owner, confidence, status, payload)
SELECT
  'SPY',
  sd.id,
  'YOUR_USER_ID',
  85,
  'ACTIVE',
  '{"time": "2025-11-19T12:00:00Z", "price": 450, "confidence_ready": true}'::jsonb
FROM strategy_definitions sd
WHERE sd.enabled = true
LIMIT 1;
```

✅ **Check Discord - you should get an alert within 60 seconds!**

---

## 🎉 You're Done!

Your 24/7 trading signal scanner is now running on Railway!

### What's happening now:

- 🔄 Scanner runs every 60 seconds
- 📊 Checks all symbols in your watchlist
- 🎯 Detects signals based on your strategies
- 🔔 Sends Discord alerts automatically
- ♾️ Runs continuously, even when you're offline

---

## 🛠️ Common Issues & Quick Fixes

### Issue: Health check shows `"scanner": false`

**Fix:**
1. Check Scanner Worker service is running (Railway dashboard)
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Worker Variables
3. Check Worker deployment logs for errors

### Issue: No Discord alerts

**Fix:**
1. Check Discord channels are enabled:
   ```sql
   SELECT * FROM discord_channels WHERE enabled = true;
   ```
2. Verify webhook URLs are correct
3. Check you have symbols in watchlist:
   ```sql
   SELECT * FROM watchlist;
   ```

### Issue: "MASSIVE_API_KEY is not configured"

**Fix:**
- Verify environment variables are set in **BOTH** services (Main + Worker)
- Check spelling of variable names (must match exactly)

---

## 📚 Next Steps

### Optional but Recommended:

1. **Set up uptime monitoring** (https://betteruptime.com)
   - Monitor: `https://your-url.up.railway.app/api/health`
   - Get alerts if scanner goes down

2. **Review your strategies**
   ```sql
   SELECT name, slug, enabled FROM strategy_definitions;
   ```

3. **Add more symbols to watchlist**
   ```sql
   INSERT INTO watchlist (symbol, owner)
   VALUES ('AAPL', 'YOUR_USER_ID');
   ```

---

## 📖 Full Documentation

For detailed information, see:

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment guide
- **[OPTIMIZATION_SUMMARY.md](OPTIMIZATION_SUMMARY.md)** - What was optimized and why

---

## 🆘 Need Help?

If something isn't working:

1. Check Railway deployment logs
2. Check `/api/health` endpoint response
3. Review Supabase for scanner heartbeat:
   ```sql
   SELECT * FROM scanner_heartbeat WHERE id = 'main_scanner';
   ```
4. Ask me for help! I'm here to guide you through any issues.

---

**Happy Trading! 🚀📈**
