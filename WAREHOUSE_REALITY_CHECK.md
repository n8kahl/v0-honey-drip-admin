# Warehouse Reality Check

## What You Actually Have

### From Flat Files (Phase 3) ✅

- **`historical_bars`** table: Stock/index OHLCV minute bars
- **Symbols**: SPY, QQQ, TSLA, etc. (90 days of bar data)
- **Source**: Massive.com S3 flat files (`.csv.gz`)
- **Use case**: Backtesting **stock strategies**, chart display

### What's Missing (Options Data) ❌

- **`historical_greeks`**: Empty (needs options snapshot data)
- **`gamma_exposure_snapshots`**: Empty (needs options chain + calculations)
- **`iv_percentile_cache`**: Empty (needs 52 weeks of IV data)
- **`options_flow_history`**: Empty (needs real-time trade feed)
- **`market_regime_history`**: Empty (needs daily calculations)

## Why the Backfill Failed

**Issue**: The script tried to fetch historical **options snapshots** via REST API
**Reality**: Massive API doesn't provide historical options snapshots - only real-time

**What flat files gave you**:

```
us_stocks_sip/minute_bars/{YEAR}/{MONTH}/{symbol}.csv.gz
└─ Stock OHLCV data (not options)
```

**What you need for warehouse**:

```
Options chain snapshots with Greeks (not in flat files)
├─ Delta, gamma, theta, vega, rho per contract
├─ IV per strike
├─ OI and volume
└─ Historical snapshots (doesn't exist in any API)
```

## Your Two Options

### Option 1: Go Live Today (Recommended)

**Start collecting options data NOW** - you'll have meaningful metrics in 7-30 days

#### Step 1: Verify Migration Status

Run in Supabase SQL Editor:

```sql
-- Check if warehouse tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'historical_greeks',
    'gamma_exposure_snapshots',
    'iv_percentile_cache',
    'options_flow_history',
    'market_regime_history'
  );
```

If empty → Run `scripts/012_add_historical_data_warehouse.sql` first

#### Step 2: Start Gamma Worker

```bash
# Terminal 1: Main dev server
pnpm run dev

# Terminal 2: Gamma exposure worker (15-min snapshots)
pnpm run dev:gamma
```

**What happens**:

- Worker fetches live options chain every 15 minutes
- Calculates gamma exposure and dealer positioning
- Stores in `gamma_exposure_snapshots`
- After 7 days: Meaningful patterns emerge
- After 30 days: IV percentiles become accurate

#### Step 3: Display Partial Metrics

Edit `HDWatchlistMetrics` component to show:

- ✅ Current Greeks (available immediately from live snapshot)
- ✅ Real-time gamma exposure (available after first 15-min cycle)
- ⏳ IV Percentile: "Building context (N days)" message
- ⏳ Historical flow: "Collecting data..."

**Timeline**:

- **Day 0**: Greeks + current gamma available
- **Day 7**: Gamma patterns, basic flow trends
- **Day 30**: IV percentiles become meaningful
- **Day 90**: Full institutional-grade context

### Option 2: Skip Warehouse for Now

**Focus on what you have** - bar data is already powerful

Use `historical_bars` for:

- Backtesting stock strategies ✅
- Chart rendering (90 days) ✅
- Scanner validation ✅
- Win rate analysis on price action ✅

**Skip** institutional options metrics until later

## Recommendation: Go Live with Partial Data

**Why**:

1. Current Greeks are valuable even without history
2. Data accumulates passively (just run the worker)
3. You can launch today with "Building context" messages
4. In 30 days you'll have full institutional metrics
5. Options data can't be backfilled anyway

**Quick Win**: Add a "Data Age" badge to `HDWatchlistMetrics`:

```tsx
{
  dataAge < 7 && (
    <Badge variant="outline" className="text-xs">
      Collecting data ({dataAge} days)
    </Badge>
  );
}
```

## Next Command

Check migration status:

```bash
# Create quick check script
cat > check_warehouse.sql << 'EOF'
SELECT
  'historical_greeks' as table_name,
  COUNT(*) as rows
FROM historical_greeks
UNION ALL
SELECT 'gamma_exposure_snapshots', COUNT(*) FROM gamma_exposure_snapshots
UNION ALL
SELECT 'iv_percentile_cache', COUNT(*) FROM iv_percentile_cache
UNION ALL
SELECT 'options_flow_history', COUNT(*) FROM options_flow_history
UNION ALL
SELECT 'market_regime_history', COUNT(*) FROM market_regime_history;
EOF

# Run this in Supabase SQL Editor
```

If all show `0 rows` → Tables exist but empty (start gamma worker)  
If error → Tables don't exist (run migration first)
