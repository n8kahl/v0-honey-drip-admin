# Data Warehouse Status

## Current Situation

The historical backfill script **failed** because Massive API does not provide historical options snapshot data through REST endpoints. All 404 errors indicate the `/v2/options/snapshots/{symbol}` endpoint doesn't exist.

### What Works

- ✅ Database migration ready: `scripts/012_add_historical_data_warehouse.sql`
- ✅ Real-time gamma worker ready: `server/workers/gammaExposureWorker.ts`
- ✅ Warehouse hooks ready: `src/hooks/useWarehouseData.ts`
- ✅ Admin metrics component ready: `src/components/hd/watchlist/HDWatchlistMetrics.tsx`

### What Doesn't Work

- ❌ Historical backfill: Massive API doesn't provide past options snapshots
- ❌ 90-day IV percentile calculation: Requires historical data

## Path Forward

### Option 1: Start Fresh (Recommended)

**Action**: Begin collecting data **today** and build context forward

1. **Run database migration** in Supabase SQL Editor:

   ```sql
   -- Execute scripts/012_add_historical_data_warehouse.sql
   ```

2. **Start gamma exposure worker** (runs every 15 min during market hours):

   ```bash
   pnpm run dev:gamma
   ```

3. **Wait 7-30 days** to accumulate meaningful context:
   - Day 1-7: Basic gamma/flow patterns emerge
   - Day 7-30: IV percentile calculations become meaningful
   - Day 30+: Full 52-week IV context (need to run continuously)

### Option 2: Alternative Historical Data Source

**Polygon.io Historical Options** (if available in your tier):

- Endpoint: `/v3/snapshot/options/{ticker}/history/{date}`
- Would require rewriting backfill script
- Check if your Massive plan includes this

**Trade-off**: Extra cost/complexity vs waiting to build data naturally

### Option 3: Hybrid Approach

1. **Enable warehouse tables** today
2. **Start real-time collection** (gamma worker)
3. **Display available metrics** in HDWatchlistMetrics:
   - Greeks: Available immediately (current snapshot)
   - Flow: Available immediately (real-time sweeps)
   - Gamma: Available after first worker run
   - IV Percentile: Show "Collecting data (N days)" until 30+ days

## Recommended Next Steps

### Step 1: Run Migration (1 minute)

```sql
-- In Supabase SQL Editor:
-- Paste contents of scripts/012_add_historical_data_warehouse.sql
-- Click "Run"
```

### Step 2: Start Workers (now)

```bash
# Terminal 1: Dev server
pnpm run dev

# Terminal 2: Gamma worker
pnpm run dev:gamma
```

### Step 3: Integrate Metrics Component (5 minutes)

Edit `src/components/hd/cards/HDRowWatchlist.tsx`:

```tsx
import { HDWatchlistMetrics } from "@/components/hd/watchlist/HDWatchlistMetrics";
import { useWarehouseData } from "@/hooks/useWarehouseData";

function HDRowWatchlist({ ticker, ...props }) {
  const { flowSummary, gammaData, ivData, loading } = useWarehouseData(ticker.symbol);

  return (
    <div>
      {/* Existing watchlist row UI */}

      {/* Add expandable metrics panel */}
      <HDWatchlistMetrics
        symbol={ticker.symbol}
        lastBarTimestamp={ticker.lastUpdate}
        dataAvailability={{
          hasGreeks: !!ivData,
          hasFlow: !!flowSummary,
          hasGamma: !!gammaData,
          dataAge: ivData?.age || null,
        }}
        wsStatus={ticker.wsStatus}
        confluence={ticker.confluence}
        flowSummary={flowSummary}
        gammaContext={gammaData}
      />
    </div>
  );
}
```

### Step 4: Monitor Data Collection

- Check `gamma_exposure_snapshots` table daily
- First meaningful metrics after 7 days
- Full IV percentile confidence after 30 days

## Alternative: Remove Backfill Dependency

If you want to launch now without waiting:

1. **Simplify HDWatchlistMetrics** to show:
   - Current Greeks (from live snapshot)
   - Real-time flow (as it happens)
   - Live gamma exposure (15-min snapshots)
   - "Building IV context" message instead of percentiles

2. **Remove IV percentile section** until 30 days of data

3. **Focus on real-time data health**:
   - WebSocket connection status
   - Last update timestamps
   - Data staleness warnings

## Summary

You have two choices:

1. **Wait-and-build**: Run migration + workers today, integrate metrics in 7-30 days when data is meaningful
2. **Launch-now**: Run migration + workers, show simplified metrics immediately, enhance over time as data accumulates

Both are valid - it depends on whether you prioritize launching with institutional metrics now (even if limited) vs waiting for full historical context.
