# Historical Data Ingestion System

**Phase 1**: Enhanced Strategy Engine with Massive.com Historical Data
**Version**: 1.0.0
**Date**: November 24, 2025

## Overview

This system ingests and processes historical options and indices data from Massive.com to power institutional-grade trading analytics. It provides the data foundation for:

- **IV Percentile Context** - Know when options are cheap or expensive
- **Smart Money Tracking** - Follow institutional options flow
- **Gamma Exposure Intelligence** - Predict pinning vs breakout behavior
- **Market Regime Detection** - Auto-adapt strategies to market conditions
- **Backtesting Infrastructure** - Know win rates before trading

---

## Architecture

```
Historical Data Warehouse (PostgreSQL)
├─ historical_greeks            (Greeks & IV time-series)
├─ options_flow_history         (Sweeps, blocks, large trades)
├─ iv_percentile_cache          (52-week IV percentile)
├─ gamma_exposure_snapshots     (Dealer positioning)
└─ market_regime_history        (VIX, breadth, correlation)

Data Ingestion Worker (historicalDataIngestion.ts)
├─ greeksIngestion.ts           (Every 15 min)
├─ flowIngestion.ts             (Every 1 min / real-time)
├─ ivPercentileCalculation.ts  (Daily at market close)
├─ gammaExposureSnapshot.ts    (Every 15 min)
└─ marketRegimeCalculation.ts  (Daily at market close)
```

---

## Database Schema

### `historical_greeks`

**Purpose**: Time-series Greeks and IV data for percentile calculations

**Update Frequency**: Every 15 minutes during market hours

**Retention**: 1 year

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | TEXT | Underlying symbol (SPX, NDX, etc.) |
| `contract_ticker` | TEXT | Option contract ticker (O:SPX251219C06475000) |
| `strike` | NUMERIC | Strike price |
| `expiration` | DATE | Expiration date |
| `timestamp` | BIGINT | Epoch milliseconds |
| `delta` | NUMERIC | Delta Greek |
| `gamma` | NUMERIC | Gamma Greek |
| `theta` | NUMERIC | Theta Greek |
| `vega` | NUMERIC | Vega Greek |
| `implied_volatility` | NUMERIC | IV at this timestamp |
| `underlying_price` | NUMERIC | Underlying price |
| `dte` | INTEGER | Days to expiration |
| `bid`, `ask`, `last` | NUMERIC | Pricing |
| `volume`, `open_interest` | INTEGER | Volume metrics |

**Key Queries**:
```sql
-- Get latest IV for SPX
SELECT * FROM get_latest_iv_percentile('SPX');

-- Query 52-week Greeks history
SELECT * FROM historical_greeks
WHERE symbol = 'SPX'
  AND timestamp >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '52 weeks'))::BIGINT * 1000
ORDER BY timestamp DESC;
```

### `options_flow_history`

**Purpose**: Track institutional options flow (sweeps, blocks, large trades)

**Update Frequency**: Real-time (1-minute batch processing)

**Retention**: 90 days

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | TEXT | Underlying symbol |
| `contract_ticker` | TEXT | Option contract ticker |
| `timestamp` | BIGINT | Trade timestamp (epoch ms) |
| `price` | NUMERIC | Trade price |
| `size` | INTEGER | Contract size |
| `premium` | NUMERIC | Total premium (price × size × 100) |
| `trade_type` | TEXT | SWEEP, BLOCK, SPLIT, LARGE, REGULAR |
| `sentiment` | TEXT | BULLISH, BEARISH, NEUTRAL |
| `aggressiveness` | TEXT | PASSIVE, NORMAL, AGGRESSIVE |
| `is_sweep` | BOOLEAN | Sweep trade flag |
| `is_above_ask` | BOOLEAN | Aggressive buy |
| `is_below_bid` | BOOLEAN | Aggressive sell |

**Key Queries**:
```sql
-- Get flow summary for last hour
SELECT * FROM get_flow_summary('SPX', 60);

-- Query sweeps in last 24 hours
SELECT * FROM options_flow_history
WHERE symbol = 'SPX'
  AND is_sweep = true
  AND timestamp >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '24 hours'))::BIGINT * 1000
ORDER BY premium DESC;
```

### `iv_percentile_cache`

**Purpose**: Cached IV percentile calculations (expensive to compute)

**Update Frequency**: Daily at market close (4:00pm ET)

**Retention**: 2 years

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | TEXT | Underlying symbol |
| `date` | DATE | Calculation date |
| `current_iv` | NUMERIC | Current implied volatility |
| `iv_rank` | NUMERIC | (current - low) / (high - low) [0-1] |
| `iv_percentile` | NUMERIC | % of days below current [0-1] |
| `iv_regime` | TEXT | EXTREMELY_LOW to EXTREMELY_HIGH |
| `iv_52w_high`, `iv_52w_low` | NUMERIC | 52-week bounds |
| `iv_trend` | TEXT | EXPANDING, STABLE, CONTRACTING |

**Key Queries**:
```sql
-- Get current IV context
SELECT * FROM get_latest_iv_percentile('SPX');

-- Historical IV regime distribution
SELECT iv_regime, COUNT(*) FROM iv_percentile_cache
WHERE symbol = 'SPX'
GROUP BY iv_regime;
```

### `gamma_exposure_snapshots`

**Purpose**: Dealer gamma positioning and gamma wall detection

**Update Frequency**: Every 15 minutes during market hours

**Retention**: 90 days

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | TEXT | Underlying symbol |
| `timestamp` | BIGINT | Snapshot timestamp |
| `total_gamma` | NUMERIC | Net dealer gamma |
| `dealer_positioning` | TEXT | LONG_GAMMA, SHORT_GAMMA, NEUTRAL |
| `gamma_wall_resistance` | NUMERIC | Resistance strike (negative gamma) |
| `gamma_wall_support` | NUMERIC | Support strike (positive gamma) |
| `expected_behavior` | TEXT | PINNING, TRENDING, VOLATILE, RANGE_BOUND |
| `gamma_by_strike` | JSONB | Gamma distribution by strike |
| `oi_by_strike` | JSONB | Open interest by strike |

**Key Queries**:
```sql
-- Get latest gamma exposure
SELECT * FROM get_latest_gamma_exposure('SPX');

-- Track gamma walls over time
SELECT timestamp, gamma_wall_resistance, gamma_wall_support
FROM gamma_exposure_snapshots
WHERE symbol = 'SPX'
  AND timestamp >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '7 days'))::BIGINT * 1000
ORDER BY timestamp;
```

### `market_regime_history`

**Purpose**: Overall market regime tracking (VIX, breadth, correlation)

**Update Frequency**: Daily at market close

**Retention**: 5 years

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | Trading date |
| `vix_level` | NUMERIC | VIX level |
| `vix_regime` | TEXT | EXTREMELY_LOW to EXTREME |
| `breadth_regime` | TEXT | EXTREMELY_BEARISH to EXTREMELY_BULLISH |
| `market_regime` | TEXT | STRONG_UPTREND, CHOPPY, RANGE_BOUND, etc. |
| `confidence_score` | NUMERIC | Confidence in classification [0-100] |
| `spy_close`, `ndx_close` | NUMERIC | Index closes |
| `put_call_ratio_total` | NUMERIC | Total P/C ratio |

**Key Queries**:
```sql
-- Get current market regime
SELECT * FROM get_current_market_regime();

-- VIX regime distribution
SELECT vix_regime, COUNT(*) FROM market_regime_history
WHERE date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY vix_regime;
```

---

## Ingestion Modules

### greeksIngestion.ts

**Function**: `ingestHistoricalGreeks(supabase, symbol)`

**What It Does**:
1. Fetches options chain from Massive.com
2. Extracts Greeks (delta, gamma, theta, vega, rho)
3. Calculates DTE for each contract
4. Stores time-series data in `historical_greeks`

**Schedule**: Every 15 minutes during market hours

**Usage**:
```typescript
import { ingestHistoricalGreeks } from './ingestion/greeksIngestion.js';

const result = await ingestHistoricalGreeks(supabase, 'SPX');
console.log(result.contractsProcessed); // e.g., 450 contracts
```

### flowIngestion.ts

**Function**: `ingestOptionsFlow(supabase, symbol)`

**What It Does**:
1. Processes options trades from WebSocket feed
2. Classifies trades: SWEEP, BLOCK, LARGE, REGULAR
3. Detects sentiment: BULLISH, BEARISH, NEUTRAL
4. Identifies aggressive execution (above ask / below bid)
5. Stores in `options_flow_history`

**Schedule**: Every 1 minute (real-time batching)

**Usage**:
```typescript
import { ingestOptionsFlow, processTrade } from './ingestion/flowIngestion.js';

// Batch ingestion
const result = await ingestOptionsFlow(supabase, 'SPX');

// Single trade processing (from WebSocket)
const success = await processTrade(supabase, trade, 'SPX', contract, underlyingPrice);
```

**Note**: Currently a placeholder. Full implementation requires WebSocket trade feed integration.

### ivPercentileCalculation.ts

**Function**: `calculateIVPercentile(supabase, symbol)`

**What It Does**:
1. Queries last 52 weeks of Greeks data
2. Calculates current IV from ATM options (30-45 DTE)
3. Computes IV rank: `(current - low) / (high - low)`
4. Computes IV percentile: `% of days below current`
5. Detects IV trend (expanding/contracting)
6. Classifies IV regime
7. Stores in `iv_percentile_cache`

**Schedule**: Daily at 4:00pm ET (market close)

**Usage**:
```typescript
import { calculateIVPercentile } from './ingestion/ivPercentileCalculation.js';

const result = await calculateIVPercentile(supabase, 'SPX');
console.log(result.ivPercentile); // e.g., 0.68 (68th percentile)
console.log(result.ivRegime);     // e.g., "ELEVATED"
```

### gammaExposureSnapshot.ts

**Function**: `snapshotGammaExposure(supabase, symbol)`

**What It Does**:
1. Fetches options chain
2. Calculates dealer gamma = -(market gamma)
3. Aggregates gamma by strike
4. Identifies gamma walls (max negative/positive gamma)
5. Determines dealer positioning (long/short gamma)
6. Predicts market behavior (pinning/trending/volatile)
7. Stores in `gamma_exposure_snapshots`

**Schedule**: Every 15 minutes during market hours

**Usage**:
```typescript
import { snapshotGammaExposure } from './ingestion/gammaExposureSnapshot.ts';

const result = await snapshotGammaExposure(supabase, 'SPX');
console.log(result.dealerPositioning);     // e.g., "SHORT_GAMMA"
console.log(result.gammaWallResistance);   // e.g., 6475
console.log(result.gammaWallSupport);      // e.g., 6400
```

### marketRegimeCalculation.ts

**Function**: `calculateMarketRegime(supabase)`

**What It Does**:
1. Fetches indices snapshot (VIX, SPY, NDX, RUT, TICK)
2. Classifies VIX regime (low → extreme)
3. Analyzes breadth (advance/decline, new highs/lows)
4. Calculates put/call ratios
5. Determines overall market regime
6. Assigns confidence score
7. Stores in `market_regime_history`

**Schedule**: Daily at 4:00pm ET (market close)

**Usage**:
```typescript
import { calculateMarketRegime } from './ingestion/marketRegimeCalculation.js';

const result = await calculateMarketRegime(supabase);
console.log(result.marketRegime);  // e.g., "WEAK_UPTREND"
console.log(result.vixRegime);     // e.g., "ELEVATED"
```

---

## Running the Worker

### Development

```bash
# Start ingestion worker
pnpm dev:ingestion

# Or run directly with tsx
npx tsx server/workers/historicalDataIngestion.ts
```

### Production (Railway)

**Deploy as separate service**:

```json
{
  "build": "pnpm build",
  "start": "node server/dist/server/workers/historicalDataIngestion.js",
  "healthCheck": "N/A (worker has no HTTP endpoint)"
}
```

**Environment Variables**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MASSIVE_API_KEY`

### Monitoring

Worker prints statistics every cycle:

```
=============================================================
📊 Historical Data Ingestion Worker Stats
=============================================================
Uptime: 142 minutes
Cycles Completed: 14
Greeks Ingestions: 28
Flow Ingestions: 142
IV Calculations: 2
Gamma Snapshots: 28
Regime Calculations: 2
Errors: 0
Last Greeks: 11/24/2025, 2:45:00 PM
Last Flow: 11/24/2025, 2:45:30 PM
Last Gamma: 11/24/2025, 2:45:15 PM
Last IV: 11/24/2025, 4:05:00 PM
Last Regime: 11/24/2025, 4:05:15 PM
=============================================================
```

---

## Backfilling Historical Data

To backfill 3-6 months of data (recommended for percentile calculations):

```typescript
// scripts/backfillHistoricalData.ts

import { createClient } from "@supabase/supabase-js";
import { ingestHistoricalGreeks } from "./server/workers/ingestion/greeksIngestion.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Backfill 90 days of Greeks data
for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  console.log(`Backfilling ${date.toISOString()}...`);

  // Fetch and store Greeks for this date
  // Note: Would need historical options chain API
  // Massive.com typically only provides snapshot, not historical chains
}
```

**Important**: Massive.com's API typically provides real-time/snapshot data only. Historical options chains may require:
1. Paying for historical data access
2. Using a data vendor like OptionMetrics or CBOE DataShop
3. Starting fresh and building history going forward

---

## Integration with Strategy Engine

### Phase 2: Context Engines

Once data is ingested, build context engines to query it:

```typescript
// Example: IV Context Engine
class IVPercentileEngine {
  async getIVContext(symbol: string) {
    const { data } = await supabase
      .from('iv_percentile_cache')
      .select('*')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return {
      currentIV: data.current_iv,
      ivPercentile: data.iv_percentile,
      ivRegime: data.iv_regime,
      recommendation: data.iv_percentile < 0.3 ? 'BUY_PREMIUM' : 'SELL_PREMIUM',
    };
  }
}
```

### Phase 3: Enhanced Scanner

Apply context to signal scoring:

```typescript
// In CompositeScanner
const ivContext = await ivEngine.getIVContext(symbol);
const flowContext = await flowEngine.getFlowContext(symbol);
const gammaContext = await gammaEngine.getGammaContext(symbol);

// Boost/penalize scores based on context
let adjustedScore = baseScore;

if (direction === 'LONG' && ivContext.ivPercentile < 0.3) {
  adjustedScore *= 1.15; // 15% boost for cheap premium
}

if (flowContext.smartMoneyBias === 'BULLISH') {
  adjustedScore *= 1.1; // 10% boost for smart money alignment
}
```

---

## Data Storage & Costs

### Storage Estimates

| Table | Rows/Day (2 symbols) | Size/Row | Daily Storage | Annual Storage |
|-------|---------------------|----------|---------------|----------------|
| `historical_greeks` | ~18,000 (450 contracts × 40 snapshots) | 500 bytes | 9 MB | 3.3 GB |
| `options_flow_history` | ~500 (sweeps/blocks only) | 400 bytes | 200 KB | 73 MB |
| `iv_percentile_cache` | 2 | 300 bytes | 600 bytes | 219 KB |
| `gamma_exposure_snapshots` | 80 (40 snapshots × 2 symbols) | 2 KB | 160 KB | 58 MB |
| `market_regime_history` | 1 | 500 bytes | 500 bytes | 183 KB |
| **Total** | | | **9.4 MB/day** | **3.4 GB/year** |

**Supabase Free Tier**: 500 MB (insufficient)
**Supabase Pro**: 8 GB included ($25/mo) → **Sufficient for 2+ years**

### API Call Estimates

| Operation | Frequency | Calls/Day | Massive.com Cost |
|-----------|-----------|-----------|------------------|
| Options chain fetch | 15 min | 96 (2 symbols × 48) | **Free** (within limits) |
| Indices snapshot | 15 min | 96 | **Free** |
| WebSocket trades | Real-time | 1 connection | **Free** |
| **Total** | | ~200 calls/day | **$0/day** |

**Massive.com API Limits**: 5 requests/second, unlimited monthly (OPTIONS ADVANCED plan)

---

## Next Steps

### Phase 1 Complete ✅
- [x] Database schema (5 tables)
- [x] Ingestion modules (5 modules)
- [x] Orchestration worker
- [x] Documentation

### Phase 2: Context Engines (Next)
- [ ] IVPercentileEngine
- [ ] FlowAnalysisEngine
- [ ] GammaExposureEngine
- [ ] RegimeDetectionEngine
- [ ] MTFAlignmentEngine

### Phase 3: Backtesting (Future)
- [ ] BacktestEngine
- [ ] Performance analytics
- [ ] Equity curve generation

### Phase 4: ML Optimization (Future)
- [ ] Factor weight optimization
- [ ] Auto-threshold adjustment

---

## Troubleshooting

### Worker not storing data

**Check**:
1. Environment variables set correctly
2. Supabase service role key has write permissions
3. RLS policies allow service role writes
4. Migration 012 applied successfully

```bash
# Test Supabase connection
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from('historical_greeks').select('count');
console.log(data, error);
"
```

### Massive.com API errors

**Check**:
1. API key valid and active
2. OPTIONS ADVANCED subscription active
3. Rate limits not exceeded (5 req/sec)
4. Symbol format correct (e.g., "SPX" not "I:SPX")

```bash
# Test Massive.com connection
curl -H "Authorization: Bearer $MASSIVE_API_KEY" \
  https://api.massive.com/v3/snapshot/options/SPX
```

### Data quality issues

**Check**:
1. Market hours (data only available during trading hours)
2. Weekend vs weekday (no real-time data on weekends)
3. Options expiration weeks (data may be sparse far OTM)
4. Symbol liquidity (illiquid symbols have poor data)

---

## Support & Contact

**Documentation**: See `CLAUDE.md` for full project context
**Issues**: GitHub Issues
**Architecture**: Phase 1 of Enhanced Strategy Engine plan

**Authors**: Claude + Development Team
**Last Updated**: November 24, 2025
