# Win Rate Optimization Implementation

**Date**: December 8, 2025  
**Goal**: Maximize trade quality and win rate through historical data warehouse, real-time gamma exposure tracking, and admin-focused metrics

---

## 🎯 What Was Built

### 1. Historical Data Warehouse (SQL Migration)

**File**: `scripts/012_add_historical_data_warehouse.sql`

Five institutional-grade tables for trade quality analysis:

- **`historical_greeks`**: Time-series Greeks and IV data (15-min updates)
- **`options_flow_history`**: Smart money tracking (sweeps, blocks, real-time)
- **`iv_percentile_cache`**: 52-week IV percentile calculations (daily)
- **`gamma_exposure_snapshots`**: Dealer positioning and gamma walls (15-min)
- **`market_regime_history`**: VIX, breadth, correlation (daily)

All tables include:

- RLS policies (read for authenticated, write for service role only)
- Cleanup functions (auto-delete old data)
- Utility functions for querying (`get_flow_summary`, `get_latest_gamma_exposure`, etc.)

### 2. 90-Day Historical Backfill Script

**File**: `scripts/backfill-historical-data.ts`

Backfills 90 days of:

- ATM options Greeks (delta, gamma, theta, vega, IV)
- Gamma exposure snapshots by strike
- IV percentile calculations

**Run**: `pnpm run backfill:warehouse`

Features:

- Fetches historical snapshots from Massive API
- Filters for ATM contracts (within 10% of underlying)
- Calculates gamma walls (resistance/support levels)
- Determines dealer positioning (SHORT_GAMMA = bullish, LONG_GAMMA = bearish)
- Rate limit handling with exponential backoff
- Progress logging with `[v0]` prefix

### 3. Real-Time Gamma Exposure Worker

**File**: `server/workers/gammaExposureWorker.ts`

Continuously monitors gamma exposure every 15 minutes during market hours (9:30 AM - 4:00 PM ET).

**Run**: `pnpm run dev:gamma` (development) or `pnpm run start:gamma` (production)

Calculates and stores:

- Total gamma by strike (positive/negative)
- Dealer net gamma (negative = dealers short = bullish)
- Gamma walls (largest concentrations above/below price)
- Expected behavior (PINNING, TRENDING, VOLATILE, RANGE_BOUND)
- Distance to gamma walls (%)
- Put/call OI and volume ratios

**Why This Matters for Win Rate**:

- Gamma walls predict where price will stall or break through
- Dealer positioning tells you if institutions are hedging (amplifying moves) or stabilizing
- Expected behavior helps you choose scalps vs. swings

### 4. Admin Watchlist Metrics Component

**File**: `src/components/hd/watchlist/HDWatchlistMetrics.tsx`

Expandable metrics panel showing:

**Data Health** (always visible):

- WebSocket status (🟢 connected, 🟡 fallback, 🔴 offline)
- Staleness indicator (⚠️ if >5 minutes old)
- Last update timestamp

**Confluence Breakdown** (expandable):

- 5 weighted components: Trend (30%), Momentum (25%), Technical (20%), Volume (15%), Volatility (10%)
- Binary checks: ✓/✗ for each component
- Color-coded scores: <40 red, 40-60 yellow, >60 green

**Smart Money Flow** (from warehouse):

- Sweep count (bullish/bearish split)
- Total premium flow ($X.XM)
- Bias indicator (BULLISH/BEARISH/NEUTRAL)

**Gamma Context** (from warehouse):

- Dealer positioning (📈 Bullish, 📉 Bearish, ➡️ Neutral)
- Support/Resistance levels from gamma walls

### 5. Scanner Heartbeat Integration

**Existing**: `scanner_heartbeat` table with `composite_scanner` record

**Health Check Endpoint**: `/api/health` already checks:

- Last scan timestamp
- Signals detected count
- Scanner status (healthy if last scan <2 minutes)

---

## 🚀 Quick Start

### Step 1: Run Database Migration

```bash
# In Supabase SQL Editor, run:
scripts/012_add_historical_data_warehouse.sql
```

### Step 2: Backfill Historical Data (90 days)

```bash
pnpm run backfill:warehouse
```

**Expected Output**:

```
[v0] Found 8 unique symbols: SPY, QQQ, TSLA, AAPL, NVDA, META, GOOGL, AMZN
[v0] ====== Backfilling SPY (90 days) ======
[v0] Processing 90 trading days...
[v0] ✅ Inserted 45 Greeks records for SPY
[v0] ✅ Gamma snapshot for SPY: SHORT_GAMMA (TRENDING)
[v0] ✅ Updated IV percentile for SPY: 62.3% (HIGH)
[v0] ✅ Backfill complete for SPY:
  - Greeks records: 4050
  - Gamma snapshots: 90
```

**Time Estimate**: ~10-15 minutes for 8 symbols (rate limits apply)

### Step 3: Start Real-Time Gamma Worker

```bash
# Development (with hot reload)
pnpm run dev:gamma

# Production
pnpm run start:gamma
```

### Step 4: Start All Workers Together

```bash
# Development
pnpm run dev:workers

# Production
pnpm run start:workers
```

This starts:

- Composite Scanner (signal detection)
- Historical Data Ingestion (bars/Greeks/flow)
- Gamma Exposure Worker (15-min snapshots)
- Watchlist Backfill (flat file processing)

---

## 📊 How This Improves Win Rate

### Before: Trading Blind

- ❌ No historical IV context → entering trades at IV peaks
- ❌ No gamma awareness → getting pinned at strikes
- ❌ No flow data → trading against institutional money
- ❌ Single confluence score → no visibility into WHY a setup is good/bad

### After: Institutional-Grade Data

- ✅ **IV Percentile**: Only enter when IV rank <50 (selling premium) or >70 (buying premium)
- ✅ **Gamma Walls**: Avoid resistance levels, target breakouts above SHORT_GAMMA zones
- ✅ **Smart Money Flow**: Align with sweeps (bullish flow = higher confidence longs)
- ✅ **Confluence Breakdown**: See which components are weak (e.g., momentum failing despite trend)

### Example Trade Decision Tree

**Signal**: Bullish breakout on SPY at $685

**Check Warehouse Data**:

1. **IV Percentile**: 45% (NORMAL) → ✅ Good for buying calls
2. **Gamma Exposure**: SHORT_GAMMA, resistance at $690 → ✅ Dealers will hedge by buying, amplifying upside
3. **Smart Money Flow**: 8 bullish sweeps, $2.3M premium → ✅ Institutions are positioned long
4. **Confluence**: Trend 85, Momentum 72, Technical 68 → ✅ All components aligned

**Result**: High-confidence entry with institutional backing and favorable dealer positioning

---

## 🔧 Integration with Existing Code

### Query Flow Summary (Smart Money)

```typescript
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Get last 60 minutes of sweep activity
const { data } = await supabase.rpc("get_flow_summary", {
  p_symbol: "SPY",
  p_minutes: 60,
});

console.log(data);
// {
//   symbol: 'SPY',
//   total_sweeps: 12,
//   bullish_sweeps: 8,
//   bearish_sweeps: 4,
//   total_premium: 2300000,
//   smart_money_bias: 'BULLISH'
// }
```

### Query Gamma Exposure

```typescript
const { data } = await supabase.rpc("get_latest_gamma_exposure", {
  p_symbol: "SPY",
});

console.log(data);
// {
//   symbol: 'SPY',
//   dealer_positioning: 'SHORT_GAMMA',
//   gamma_wall_resistance: 690,
//   gamma_wall_support: 680,
//   expected_behavior: 'TRENDING'
// }
```

### Query IV Percentile

```typescript
const { data } = await supabase.rpc("get_latest_iv_percentile", {
  p_symbol: "SPY",
});

console.log(data);
// {
//   symbol: 'SPY',
//   current_iv: 0.18,
//   iv_rank: 0.62,
//   iv_percentile: 0.68,
//   iv_regime: 'HIGH'
// }
```

---

## 🎨 UI Integration Points

### 1. Watchlist Row Enhancement

Add `HDWatchlistMetrics` component below each symbol:

```tsx
import { HDWatchlistMetrics } from "@/components/hd/watchlist/HDWatchlistMetrics";

// In HDRowWatchlist.tsx, after the main row:
<HDWatchlistMetrics
  symbol={ticker.symbol}
  lastBarTimestamp={symbolData?.lastBarTime}
  dataAvailability={{
    "1m": symbolData?.candles?.["1m"]?.length > 0,
    "5m": symbolData?.candles?.["5m"]?.length > 0,
    "15m": symbolData?.candles?.["15m"]?.length > 0,
    "1h": symbolData?.candles?.["60m"]?.length > 0,
  }}
  wsStatus={wsConnected ? "connected" : "fallback"}
  confluence={{
    overall: symbolData?.confluence?.score || 0,
    trend: symbolData?.confluence?.trend || 0,
    momentum: symbolData?.confluence?.momentum || 0,
    technical: symbolData?.confluence?.technical || 0,
    volume: symbolData?.confluence?.volume || 0,
    volatility: symbolData?.confluence?.volatility || 0,
    trendConfirmed: symbolData?.confluence?.trendConfirmed || false,
    momentumConfirmed: symbolData?.confluence?.momentumConfirmed || false,
    vwapAligned: symbolData?.confluence?.vwapAligned || false,
    emaAligned: symbolData?.confluence?.emaAligned || false,
    volumeAboveAvg: symbolData?.confluence?.volumeAboveAvg || false,
  }}
  flowSummary={flowData} // From database query
  gammaContext={gammaData} // From database query
/>;
```

### 2. Composite Scanner Enhancement

Modify `server/workers/compositeScanner.ts` to query warehouse data:

```typescript
// After detecting signal, enrich with warehouse data
const { data: ivData } = await supabase.rpc("get_latest_iv_percentile", { p_symbol: symbol });
const { data: gammaData } = await supabase.rpc("get_latest_gamma_exposure", { p_symbol: symbol });
const { data: flowData } = await supabase.rpc("get_flow_summary", {
  p_symbol: symbol,
  p_minutes: 60,
});

// Boost confidence if conditions align
if (ivData?.iv_regime === "LOW" && signal.direction === "LONG") {
  signal.baseScore += 5; // Prefer buying when IV is low
}

if (gammaData?.dealer_positioning === "SHORT_GAMMA" && signal.direction === "LONG") {
  signal.baseScore += 10; // Dealers will hedge by buying, amplifying upside
}

if (flowData?.smart_money_bias === signal.direction) {
  signal.baseScore += 8; // Institutional alignment
}
```

---

## 📈 Monitoring & Health Checks

### Worker Health Dashboard

All workers update their heartbeat:

```typescript
// Check all worker health
const { data: heartbeats } = await supabase
  .from("scanner_heartbeat")
  .select("*")
  .order("last_scan", { ascending: false });

// composite_scanner: last scan, signals detected
// (future: gamma_worker, flow_listener)
```

### Data Warehouse Metrics

```sql
-- Check warehouse table sizes
SELECT
  'historical_greeks' as table_name,
  COUNT(*) as rows,
  COUNT(DISTINCT symbol) as symbols,
  MAX(timestamp) as latest_timestamp
FROM historical_greeks
UNION ALL
SELECT
  'gamma_exposure_snapshots',
  COUNT(*),
  COUNT(DISTINCT symbol),
  MAX(timestamp)
FROM gamma_exposure_snapshots
UNION ALL
SELECT
  'iv_percentile_cache',
  COUNT(*),
  COUNT(DISTINCT symbol),
  MAX(date)::text::bigint
FROM iv_percentile_cache;
```

---

## 🛡️ Rate Limits & Best Practices

### Massive API Limits

- **Free Tier**: 5 requests/second, 100k/month
- **OPTIONS ADVANCED**: Higher limits, check dashboard

### Backfill Strategy

1. Start with liquid symbols (SPY, QQQ) to test
2. Use `BACKFILL_DAYS = 30` initially, then increase to 90
3. Monitor rate limit errors (429 responses)
4. Backfill runs once, workers handle real-time updates

### Worker Schedule

- **Composite Scanner**: Every 60 seconds (all hours)
- **Gamma Worker**: Every 15 minutes (market hours only)
- **Historical Ingestion**: Every 5 minutes (market hours)

---

## 🚧 Next Steps (Future Enhancements)

1. **Options Flow Listener** (real-time WebSocket)
   - Subscribe to Massive options trade feed
   - Classify sweeps/blocks in real-time
   - Insert into `options_flow_history` table
   - Send Discord alerts for unusual activity

2. **Market Regime Daily Update**
   - Fetch VIX, breadth, correlation at market close
   - Insert into `market_regime_history` table
   - Use for strategy selection (e.g., avoid mean reversion in STRONG_DOWNTREND)

3. **Signal Badge Component**
   - Replace "EMA9: 687" display with "SETUP READY" badge
   - Show strategy name, confidence, entry/stop/target on hover
   - Link to chart with signal highlighted

4. **Backtest Integration**
   - Use historical Greeks for realistic option pricing
   - Calculate IV rank at entry time for historical context
   - Factor gamma walls into exit logic (take profit before resistance)

---

## 📝 Summary

**Files Created**:

- ✅ `scripts/backfill-historical-data.ts` - 90-day historical backfill
- ✅ `server/workers/gammaExposureWorker.ts` - Real-time gamma tracking
- ✅ `src/components/hd/watchlist/HDWatchlistMetrics.tsx` - Admin metrics UI

**Database Changes**:

- ✅ 5 warehouse tables (see `012_add_historical_data_warehouse.sql`)
- ✅ Utility functions for querying
- ✅ Cleanup functions for data retention

**Package Scripts Added**:

- ✅ `pnpm run backfill:warehouse` - Run 90-day backfill
- ✅ `pnpm run dev:gamma` - Start gamma worker (dev)
- ✅ `pnpm run start:gamma` - Start gamma worker (prod)
- ✅ `pnpm run dev:workers` - Start all workers (dev)
- ✅ `pnpm run start:workers` - Start all workers (prod)

**Impact on Win Rate**:

- 🎯 **IV Context**: Avoid entering at IV peaks (improves entry timing)
- 🎯 **Gamma Awareness**: Target breakouts above SHORT_GAMMA zones (higher win rate on trending moves)
- 🎯 **Smart Money Alignment**: Trade with institutional flow (confirms conviction)
- 🎯 **Confluence Visibility**: Identify weak components before entry (filter low-quality setups)

**Next Action**: Run `pnpm run backfill:warehouse` to populate 90 days of data!
