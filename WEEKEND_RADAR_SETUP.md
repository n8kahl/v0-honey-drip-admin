# Weekend Radar Setup Guide

## Problem: "Disconnected" and "Scanner: Down" on Weekends

If you see this on weekends/evenings:
- 🔴 **Disconnected** - WebSocket status
- 🔴 **Scanner: Down** - Scanner worker status
- **No signals found** - Empty Radar

This guide will fix it.

---

## Understanding the Issue

### Two Separate Issues

1. **"Disconnected" (Red dot)** ✅ **This is NORMAL on weekends**
   - The WebSocket connects to Massive.com for real-time streaming
   - When market is closed, there's no real-time data stream
   - This is expected behavior and does NOT prevent weekend analysis

2. **"Scanner: Down"** ❌ **This is the ACTUAL problem**
   - The composite scanner worker is not running
   - Without the scanner, no signals are detected or stored
   - This needs to be fixed

---

## Quick Fix (Development)

### Option 1: Start Everything Together (Easiest)

Stop your current `pnpm dev` and run:

```bash
pnpm dev:all
```

This starts:
- ✅ Frontend (Vite on port 5173)
- ✅ Backend (Express on port 3000)
- ✅ Composite Scanner Worker (runs every 60 seconds)

### Option 2: Add Scanner to Existing Session

If you already have `pnpm dev` running, open a **new terminal** and run:

```bash
pnpm dev:composite
```

This starts only the scanner worker in watch mode.

---

## Verify Scanner is Running

After starting the scanner, check the terminal output. You should see:

```
[Composite Scanner] ======================================
[Composite Scanner] Starting Composite Signal Scanner
[Composite Scanner] Configuration: OPTIMIZED (High Accuracy)
[Composite Scanner] Scan interval: 60 seconds
[Composite Scanner] Primary timeframe: 5m
[Composite Scanner] Min Base Score: 80 (Equity), 85 (Index)
[Composite Scanner] Min R:R Ratio: 2.0:1
[Composite Scanner] Target Win Rate: 65%+
[Composite Scanner] ======================================

[Composite Scanner] Starting scan cycle...
[Composite Scanner] Fetching watchlist symbols...
[Composite Scanner] Found 5 symbols to scan
```

Within 60-120 seconds, refresh the Radar page and you should see:
- ✅ **Scanner: Active** (green)
- ✅ Signals appearing (if any detected)

---

## Database Setup (One-Time)

The scanner needs a heartbeat record in the database. Run this SQL in your Supabase SQL Editor:

```sql
-- Insert composite scanner heartbeat record
INSERT INTO public.scanner_heartbeat (id, last_scan, signals_detected, status, metadata)
VALUES (
  'composite_scanner',
  NOW(),
  0,
  'initializing',
  '{"version": "2.0", "description": "Composite signal scanner worker"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();
```

Or run the migration script:

```bash
# Copy and paste this SQL into Supabase SQL Editor
cat scripts/013_add_composite_scanner_heartbeat.sql
```

---

## Production Setup

### Railway Deployment

You need TWO services:

**Service 1: Main App**
```json
{
  "build": "pnpm build",
  "start": "node server/dist/server/index.js"
}
```

**Service 2: Composite Scanner Worker**
```json
{
  "build": "pnpm build",
  "start": "node server/dist/server/workers/compositeScanner.js"
}
```

Both services need the same environment variables:
- `MASSIVE_API_KEY`
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

### Local Production Test

```bash
# Build everything
pnpm build

# Start both processes (in separate terminals)
# Terminal 1:
pnpm start

# Terminal 2:
pnpm start:composite
```

Or use the combined command:
```bash
pnpm start:all
```

---

## Troubleshooting

### Scanner shows "Down" even after starting

1. **Check scanner terminal** - Look for errors
2. **Check database** - Verify heartbeat table exists:
   ```sql
   SELECT * FROM scanner_heartbeat WHERE id = 'composite_scanner';
   ```
3. **Check Supabase credentials** - Scanner needs `SUPABASE_SERVICE_ROLE_KEY`

### No signals appearing

1. **Wait 60-120 seconds** - Scanner runs every 60 seconds
2. **Check watchlist** - Do you have symbols added to your watchlist?
3. **Check scanner output** - Should show "Found X symbols to scan"
4. **Check minimum score** - Only signals with score ≥80 (equity) or ≥85 (index) appear

### "Disconnected" won't go away on weekends

This is **normal and expected**:
- WebSocket only works during market hours (9:30am-4pm ET Mon-Fri)
- Premarket (4am-9:30am) and afterhours (4pm-8pm) should connect
- Weekends (Fri 8pm - Mon 4am) will show "Disconnected"
- Weekend Radar uses historical data from database, not WebSocket

---

## How Weekend Radar Works

### Data Flow on Weekends

```
Friday 4:05pm ET
↓
Weekend Pre-Warm Worker (Phase 1) [OPTIONAL]
- Fetches Friday's data for all symbols
- Stores in historical_bars table
↓
Weekend (Sat-Sun)
↓
Scanner Worker (runs every 60 seconds)
- Fetches historical data from database OR Massive.com API
- Analyzes patterns on 5-minute bars
- Detects composite signals
- Stores in composite_signals table
↓
Radar Page
- Reads signals from composite_signals table
- Displays active signals
- Real-time updates via Supabase subscriptions
```

### What Works on Weekends

✅ Historical data fetching (REST API)
✅ Signal detection (pattern analysis)
✅ Signal storage (database)
✅ Signal display (Radar page)
✅ Database subscriptions (real-time updates)

### What Doesn't Work on Weekends

❌ WebSocket streaming (no live quotes)
❌ Real-time price updates (market closed)
❌ Options chain (stale data from Friday)

---

## Expected Performance (Phase 1 Optimizations)

With Phase 1 optimizations active:

| Metric | Before | After (Phase 1) |
|--------|--------|----------------|
| Weekend Radar Load | 25 seconds | <1 second |
| API Calls per Symbol | 5 requests | 1 request (database cache) |
| Backtest 90 days (repeat) | 45 seconds | 0.5 seconds |

### Verify Phase 1 is Working

Check API responses for `_source` field:

```bash
# In browser DevTools Network tab, look for /api/bars response:
{
  "bars": [...],
  "_source": "database"  // ✅ Phase 1 working (10-50x faster)
}

# vs

{
  "bars": [...],
  "_source": "api"  // ⚠️ Cache miss, fetching from Massive.com
}
```

---

## Testing Checklist

- [ ] Scanner worker is running (`pnpm dev:all` or `pnpm dev:composite`)
- [ ] Scanner shows "Active" on Radar page (wait 60-120 seconds)
- [ ] Database has `scanner_heartbeat` record for `composite_scanner`
- [ ] Watchlist has symbols added
- [ ] Signals appear on Radar (if market conditions produce them)
- [ ] "Disconnected" status is expected on weekends (not an error)

---

## Quick Commands Reference

```bash
# Development
pnpm dev              # Frontend + Backend only (NO scanner)
pnpm dev:all          # Frontend + Backend + Scanner (RECOMMENDED)
pnpm dev:composite    # Scanner only (add to existing dev session)
pnpm dev:prewarm      # Weekend pre-warm worker (optional)

# Production
pnpm build            # Build all (frontend + backend + workers)
pnpm start            # Main app only
pnpm start:composite  # Scanner only
pnpm start:all        # Main app + Scanner
pnpm start:prewarm    # Weekend pre-warm worker (manual trigger)

# Testing
pnpm test             # Unit tests
bash scripts/test-phase1-optimizations.sh  # Test Phase 1 optimizations
```

---

## Next Steps

1. ✅ Start the scanner worker
2. ✅ Verify database heartbeat record
3. ✅ Wait 60-120 seconds for first scan
4. ✅ Check Radar page - should show "Scanner: Active"
5. ✅ Accept "Disconnected" on weekends (this is normal)

**Weekend Radar is now ready!** 🎉
