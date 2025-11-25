# Historical Data Backfill Guide

**Last Updated**: November 25, 2025

This guide covers everything you need to know about backfilling historical market data.

---

## Quick Start

```bash
# Recommended: Backfill all watchlist symbols (90 days)
pnpm backfill:watchlist -- --days=90

# Run backtests after backfill
pnpm backtest
```

---

## Overview

The **Hybrid Backfill System** combines:
- **Flat Files** for historical data (fast, accurate, complete)
- **API** for recent data (real-time, up-to-date)

| Method | Speed | Coverage | Best For |
|--------|-------|----------|----------|
| API Only | 45-60 min | 90 days | Small ranges (<7 days) |
| Flat Files | 10-15 min | Unlimited | Historical (>7 days) |
| **Hybrid** | 15-20 min | Best of both | Recommended |

---

## Commands

### Primary Commands

```bash
# Auto-backfill all watchlist symbols
pnpm backfill:watchlist -- --days=90

# Hybrid backfill specific symbols
pnpm backfill:hybrid -- --symbols=SPX,NDX --days=90

# API-only backfill (recent data)
pnpm backfill:api -- --days=2

# Run backtests
pnpm backtest
```

### Development Commands

```bash
# Start watchlist worker (auto-backfills new symbols)
pnpm dev:watchlist

# Download flat files only
pnpm backfill:download -- --dataset=indices --startDate=2024-08-01 --endDate=2024-11-23

# Parse downloaded files
pnpm backfill:parse -- --file=./data/flat-files/indices/2024-11-23.csv --symbols=SPX,NDX
```

---

## Storage Planning

### Supabase Free Tier: 500 MB

| Symbols | Storage (90 days) | Storage (1 year) |
|---------|-------------------|------------------|
| 3 (SPX, NDX, VIX) | ~13 MB | ~36 MB |
| 10 symbols | ~43 MB | ~120 MB |
| 20 symbols | ~86 MB | ~240 MB |

**Recommendation**: Keep 10-20 core symbols with 90-day history.

### Tiered Approach

```bash
# Tier 1: Core indices (1 year)
pnpm backfill:hybrid -- --symbols=SPX,NDX,VIX --days=365

# Tier 2: Major ETFs (90 days)
pnpm backfill:hybrid -- --symbols=SPY,QQQ,IWM --days=90

# Tier 3: Individual stocks (30 days)
pnpm backfill:hybrid -- --symbols=AAPL,MSFT,TSLA --days=30
```

---

## Automatic Maintenance

### Watchlist Worker

The worker automatically:
- Scans watchlist every hour for new symbols
- Backfills 90 days of data for new symbols
- Cleans up data >1 year old (daily at 2am)

```bash
# Start in development
pnpm dev:watchlist

# Production (Railway)
pnpm start:watchlist
```

### Daily Incremental Updates

```bash
# Add to cron or Railway schedule
pnpm backfill:api -- --days=1
```

---

## Verification

### Check Data in Supabase

```sql
-- Check row counts by symbol
SELECT symbol, COUNT(*) as bars,
       MIN(TO_TIMESTAMP(timestamp / 1000)) as earliest,
       MAX(TO_TIMESTAMP(timestamp / 1000)) as latest
FROM historical_bars
WHERE timeframe = '1m'
GROUP BY symbol;

-- Check storage size
SELECT pg_size_pretty(pg_total_relation_size('historical_bars')) as total_size;
```

---

## Environment Setup

Add to `.env.local`:

```bash
# Massive.com S3 (for flat files)
MASSIVE_AWS_ACCESS_KEY=your_access_key
MASSIVE_AWS_SECRET_KEY=your_secret_key
MASSIVE_S3_REGION=us-east-1

# Massive.com API (for real-time)
MASSIVE_API_KEY=your_api_key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Troubleshooting

### S3 Authentication Error
**Cause**: Missing AWS credentials
**Fix**: Add `MASSIVE_AWS_ACCESS_KEY` and `MASSIVE_AWS_SECRET_KEY` to env vars

### NoSuchKey Errors
**Cause**: Requesting data for weekends/holidays
**Fix**: This is normal - system skips non-trading days automatically

### Database Too Large
```sql
-- Manual cleanup
SELECT cleanup_old_historical_bars();

-- Delete specific symbols
DELETE FROM historical_bars WHERE symbol = 'UNWANTED';
VACUUM FULL historical_bars;
```

---

## Database Schema

```sql
CREATE TABLE historical_bars (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,        -- '1m', '5m', '15m', etc.
  timestamp BIGINT NOT NULL,       -- Epoch milliseconds
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT,
  vwap NUMERIC,
  trades INTEGER,
  PRIMARY KEY (symbol, timeframe, timestamp)
);
```

---

## Performance Benchmarks

| Operation | Time | Rate |
|-----------|------|------|
| Download 90 days | 3-5 min | ~10 MB/s |
| Parse + Insert 90 days | 8-12 min | ~3,500 rows/s |
| Full hybrid backfill | 15-20 min | N/A |

---

## Next Steps After Backfill

1. **Run backtests**: `pnpm backtest`
2. **Analyze results**: Open `backtest-results/*.csv`
3. **Identify top performers**: Keep detectors with 65%+ win rate
4. **Disable low performers**: Comment out detectors <55% win rate
5. **Set up daily automation**: Add cron job for `pnpm backfill:api -- --days=1`
