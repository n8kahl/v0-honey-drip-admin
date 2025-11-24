# Composite Scanner Fixes - Implementation Summary

**Date**: November 24, 2025
**Branch**: `claude/radar-weekend-aftermarket-01LzspTtoomRtGB9mLZ7SHjn`
**Status**: ✅ All Critical Fixes Implemented

---

## 🔴 Critical Bugs Fixed

### 1. ✅ Watchlist Column Name Mismatch (BLOCKING)
**File**: `server/workers/compositeScanner.ts:453`

**Before**:
```typescript
const symbols = watchlist.map((w) => w.ticker);  // ❌ Wrong column
```

**After**:
```typescript
const symbols = watchlist.map((w) => w.symbol);  // ✅ Correct column
```

**Impact**: Was returning `[undefined, undefined, ...]` → Scanner couldn't scan any symbols

---

### 2. ✅ Market Hours Filter Blocking Weekend Signals
**File**: `src/lib/composite/OptimizedScannerConfig.ts:98-100`

**Before**:
```typescript
marketHoursOnly: true,  // ❌ Filtered ALL weekend/evening signals
```

**After**:
```typescript
// TESTING: Disabled for weekend/after-hours development
// Re-enable for production or override with MARKET_HOURS_ONLY env var
marketHoursOnly: process.env.MARKET_HOURS_ONLY === 'true' ? true : false,
```

**Environment Variable**:
- Set `MARKET_HOURS_ONLY=true` for production
- Leave unset or set to `false` for development/testing

**Impact**: On weekends/evenings, ALL symbols were filtered out → Zero signals generated

---

### 3. ✅ Discord Channel Query Error
**File**: `server/workers/compositeScanner.ts:373-374`

**Before**:
```typescript
.eq("user_id", userId)
.eq("enabled", true);  // ❌ 'enabled' column doesn't exist
```

**After**:
```typescript
.eq("user_id", userId);
// Note: 'enabled' column doesn't exist in schema, fetching all channels
```

**Impact**: Discord query was failing, preventing alerts even if signals were generated

---

## 🟢 Weekend Mode Support (CRITICAL FIX)

### 4. ✅ Detector Weekend Mode (ALL 8 DETECTORS UPDATED)

**Problem**: All detectors had hardcoded `isRegularHours === true` checks, blocking ALL weekend/evening signals

**Files**:
- `src/lib/composite/detectors/utils.ts` (NEW)
- 8 detector files updated with weekend mode support

**Before**:
```typescript
// ❌ Blocked ALL weekend signals
const regularHours = features.session?.isRegularHours === true;
if (!regularHours) return false;
```

**After**:
```typescript
// ✅ Allows weekend mode when enabled
import { shouldRunDetector } from './utils.js';

// Check if detector should run (market hours or weekend mode)
if (!shouldRunDetector(features)) return false;
```

**How It Works**:
- `shouldRunDetector()` returns `true` if:
  - It's regular market hours, OR
  - `ALLOW_WEEKEND_SIGNALS=true` environment variable is set, OR
  - Analyzing historical data (has timestamp but not in regular hours)

**Environment Variable**:
```bash
# Railway Production
ALLOW_WEEKEND_SIGNALS=true  # Enable weekend/evening analysis
```

**Impact**: This was the **primary blocker** preventing weekend signals. Patterns were being detected, but detectors immediately rejected them due to market hours.

---

## 🟡 Production Threshold Adjustments

### 5. ✅ Realistic Production Thresholds

**Problem**: Production thresholds (80/85/2.0) were too strict, generating zero signals even with patterns detected

**User Feedback**: *"But if it isn't in testing mode-id still want trades"*

**File**: `src/lib/composite/OptimizedScannerConfig.ts`

**Before** (Too Strict):
```typescript
// Equity/ETF Production Thresholds
minBaseScore: 80,    // ❌ Only top 20% of setups
minStyleScore: 85,   // ❌ Near-perfect fit required
minRiskReward: 2.0,  // ❌ Excellent R:R only
maxSignalsPerSymbolPerHour: 1,
cooldownMinutes: 30,

// Index Production Thresholds
minBaseScore: 85,    // ❌ Very high bar
minStyleScore: 88,   // ❌ Near-perfect required
minRiskReward: 2.5,  // ❌ Excellent R:R only
```

**After** (Realistic):
```typescript
// Equity/ETF Production Thresholds
minBaseScore: 70,    // ✅ Solid setups
minStyleScore: 75,   // ✅ Good style fit
minRiskReward: 1.8,  // ✅ Healthy R:R
maxSignalsPerSymbolPerHour: 2,   // ✅ Allow reasonable frequency
cooldownMinutes: 20,

// Index Production Thresholds
minBaseScore: 75,    // ✅ Strong setups
minStyleScore: 80,   // ✅ Very good fit
minRiskReward: 2.0,  // ✅ Healthy R:R
maxSignalsPerSymbolPerHour: 3,   // ✅ More due to liquidity
cooldownMinutes: 15,
```

**Rationale**:
- RADAR_WEEKEND_FEASIBILITY.md expected "2-4 signals/day per symbol"
- Previous thresholds (80/85) were ultra-selective
- New thresholds (70/75) maintain quality while allowing signals
- Testing thresholds (60/65) remain unchanged for development

**Impact**: Production mode will now generate signals on weekends/evenings while maintaining quality

---

## 🟡 Additional Enhancements

### 6. ✅ Comprehensive Logging Added

**Enhanced Feature Logging** (`compositeScanner.ts:276-284`):
```typescript
console.log(`[FEATURES] ${symbol}:`, {
  hasPattern: !!features.pattern,
  patternKeys: features.pattern ? Object.keys(features.pattern).filter(k => features.pattern![k] === true) : [],
  rsi: features.mtf?.['5m']?.rsi?.[14]?.toFixed(1),
  price: latestBar.close.toFixed(2),
  volume: latestBar.volume,
  barCount: bars.length,
});
```

**Enhanced Scan Result Logging** (`compositeScanner.ts:494-506`):
```typescript
console.log(`[SCAN] ${symbol}:`, {
  filtered: result.filtered,
  filterReason: result.filterReason,
  hasSignal: !!result.signal,
  signal: result.signal ? {
    type: result.signal.opportunityType,
    baseScore: result.signal.baseScore.toFixed(1),
    direction: result.signal.direction,
    entry: result.signal.entryPrice,
    rr: result.signal.riskReward?.toFixed(2),
  } : null,
});
```

**Watchlist Debug Logging** (`compositeScanner.ts:457`):
```typescript
console.log(`[DEBUG] Watchlist raw data:`, watchlist.slice(0, 3));
```

---

### 7. ✅ Testing Mode Thresholds

**File**: `src/lib/composite/OptimizedScannerConfig.ts:61-82, 87-108`

**Added Low Thresholds for Development**:

For **Equities/ETFs**:
```typescript
const TESTING_DEFAULT_THRESHOLDS: SignalThresholds = {
  minBaseScore: 60,          // Was 80 (production)
  minStyleScore: 65,         // Was 85 (production)
  minRiskReward: 1.5,        // Was 2.0 (production)
  maxSignalsPerSymbolPerHour: 5,   // Was 1 (production)
  cooldownMinutes: 10,       // Was 30 (production)
};
```

For **Indices (SPX/NDX)**:
```typescript
const TESTING_INDEX_THRESHOLDS: SignalThresholds = {
  minBaseScore: 65,          // Was 85 (production)
  minStyleScore: 70,         // Was 88 (production)
  minRiskReward: 1.5,        // Was 2.5 (production)
  maxSignalsPerSymbolPerHour: 5,   // Was 2 (production)
  cooldownMinutes: 10,       // Was 20 (production)
};
```

**Activation**:
- Automatically used when `NODE_ENV=development`
- Or when `TESTING_MODE=true` environment variable is set
- Production values used otherwise

---

## 📊 Verification Checklist

### Before Starting Scanner:

- [ ] **Add symbols to watchlist** (via Watch tab)
  - Recommended: SPY, QQQ, AAPL, TSLA
  - Or indices: I:SPX, I:NDX

- [ ] **Run database migration** (Supabase SQL Editor)
  ```sql
  -- Run scripts/013_add_composite_scanner_heartbeat.sql
  INSERT INTO public.scanner_heartbeat (id, last_scan, signals_detected, status, metadata)
  VALUES ('composite_scanner', NOW(), 0, 'initializing', '{"version": "2.0"}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
  ```

- [ ] **Set environment variables** (CRITICAL for weekend signals)
  ```bash
  # REQUIRED for weekend/evening signals
  ALLOW_WEEKEND_SIGNALS=true

  # Optional: Enforce market hours filter (for additional filtering)
  MARKET_HOURS_ONLY=false  # or leave unset

  # Optional: Use low testing thresholds (for development)
  NODE_ENV=development
  # OR
  TESTING_MODE=true
  ```

### Start Scanner:

```bash
# Development (with all debugging)
pnpm dev:all

# Or scanner only
pnpm dev:composite

# Production
pnpm start:composite
```

### Expected Log Output:

```
[Composite Scanner] ======================================
[Composite Scanner] Starting Composite Signal Scanner
[Composite Scanner] Found X profiles to scan
[Composite Scanner] Scanning Y symbols for user abc-123
[DEBUG] Watchlist raw data: [{ symbol: 'SPY', ... }]
[Composite Scanner] Found Y symbols to scan
[FEATURES] SPY: { hasPattern: true, patternKeys: [...], rsi: 52.3, ... }
[SCAN] SPY: { filtered: false, hasSignal: true, signal: { type: 'breakout_bullish', ... }}
[Composite Scanner] 🎯 NEW SIGNAL SAVED: SPY breakout_bullish (78/100) ID: xyz-789
```

### Check Results:

1. **Radar Page** - Should show signals within 60-120 seconds
2. **Scanner Status** - Should show "Scanner: Active" (green)
3. **Database** - Check `composite_signals` table:
   ```sql
   SELECT symbol, opportunity_type, base_score, created_at
   FROM composite_signals
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## 🐛 Debugging Guide

### No Signals Appearing?

**Check 1: Watchlist has symbols**
```bash
# Look for this in logs:
[Composite Scanner] Scanning 0 symbols for user...  # ❌ Empty watchlist
[Composite Scanner] Scanning 5 symbols for user...  # ✅ Symbols loaded
```

**Check 2: Symbols are being scanned**
```bash
# Look for this in logs:
[FEATURES] SPY: { hasPattern: true, ... }  # ✅ Features building
[SCAN] SPY: { filtered: false, ... }       # ✅ Not filtered
```

**Check 3: Signals pass thresholds**
```bash
# Look for this in logs:
[SCAN] SPY: {
  signal: { baseScore: 78.0, ... }  # ✅ Above threshold (60 in testing mode)
}
```

**Check 4: Market hours filter**
```bash
# If you see this on weekends:
[Composite Scanner] SPY: Filtered (market hours only)  # ❌ Need to disable filter

# Should see instead:
[SCAN] SPY: { filtered: false, ... }  # ✅ Filter disabled
```

### Common Issues:

**Issue**: "Scanner: Down" in UI
- **Check**: Is scanner process running?
- **Fix**: Run `pnpm dev:all` or `pnpm dev:composite`

**Issue**: No watchlist symbols
- **Check**: Did you add symbols in Watch tab?
- **Fix**: Click "Add Ticker" and add SPY, QQQ, etc.

**Issue**: All symbols filtered
- **Check**: `marketHoursOnly` setting and time of day
- **Fix**: Set `MARKET_HOURS_ONLY=false` or unset for testing

**Issue**: Signals detected but scores too low
- **Check**: Are you using testing thresholds?
- **Fix**: Set `NODE_ENV=development` or `TESTING_MODE=true`

---

## 🚀 Production Deployment

### Before Deploying:

1. **Re-enable Market Hours Filter**:
   ```bash
   MARKET_HOURS_ONLY=true
   ```

2. **Use Production Thresholds**:
   ```bash
   NODE_ENV=production
   # Do NOT set TESTING_MODE=true
   ```

3. **Run Migration**:
   ```sql
   -- In Supabase SQL Editor
   \i scripts/013_add_composite_scanner_heartbeat.sql
   ```

4. **Verify Build**:
   ```bash
   pnpm build
   pnpm typecheck
   ```

### Railway Environment Variables:

```bash
# Required
MASSIVE_API_KEY=your_key_here
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Production settings
NODE_ENV=production

# Weekend/Evening Signals (CRITICAL)
ALLOW_WEEKEND_SIGNALS=true  # Enable signals outside market hours

# Optional: Additional market hours filtering
MARKET_HOURS_ONLY=false  # Leave unset or set to false for weekend signals
```

---

## 📈 Expected Performance

### Development Mode (Testing Thresholds):
- **More signals** (thresholds: 60/65/1.5)
- **Faster iteration** (10min cooldown vs 20min)
- **Weekend/evening signals** (when ALLOW_WEEKEND_SIGNALS=true)

### Production Mode (NEW - Adjusted Thresholds):
- **Quality signals** (thresholds: 70/75/1.8 equity, 75/80/2.0 index)
- **Reasonable frequency** (~2-4 signals/day per symbol)
- **Weekend/evening signals** (when ALLOW_WEEKEND_SIGNALS=true)
- **Target: 60-65% win rate**

---

## 📝 Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `server/workers/compositeScanner.ts` | Fixed watchlist column, discord query, added logging | 4 changes |
| `src/lib/composite/OptimizedScannerConfig.ts` | Market hours override, testing thresholds, lowered production thresholds | 3 major sections |
| `src/lib/composite/detectors/utils.ts` | NEW: Weekend mode detection utility | 45 lines |
| `src/lib/composite/detectors/*.ts` | Updated 8 detectors for weekend mode support | 2 lines per file |
| `scripts/013_add_composite_scanner_heartbeat.sql` | Already exists (created earlier) | N/A |

---

## ✅ Completion Status

- [x] Phase 1: Critical Fixes (15 min) ← **DONE**
- [x] Phase 2: Enhanced Features (1 hour) ← **DONE**
- [x] Phase 3: Production Ready (30 min) ← **DONE**
- [x] Phase 4: Weekend Mode Support (1 hour) ← **DONE** (Nov 24, 2025)
- [x] Phase 5: Production Threshold Adjustment (15 min) ← **DONE** (Nov 24, 2025)

**Total Implementation Time**: ~3 hours (across 2 sessions)
**Total Files Modified**: 12 files + 1 migration (already exists)
**Lines Changed**: ~150 lines

**Key Breakthrough**: Identified and fixed the root cause - detectors had hardcoded `isRegularHours` checks blocking ALL weekend signals

---

## 🎯 Next Steps

1. **Commit and push changes** ← YOU ARE HERE
2. **Add `ALLOW_WEEKEND_SIGNALS=true` to Railway** (CRITICAL!)
3. **Deploy to Railway** (or wait for auto-deploy)
4. **Verify symbols in watchlist** (SPY, QQQ, SPX, NDX)
5. **Monitor scanner logs** for signals
6. **Check Radar tab** for signals (should appear within 60-120 seconds)

**Expected Result After Deployment**:
```
[Composite Scanner] Min Base Score: 70 (Equity), 75 (Index)  ← NEW THRESHOLDS
[Composite Scanner] Weekend Mode: ENABLED  ← NEW
[FEATURES] SPX: { hasPattern: true, patternKeys: [...] }
[SCAN] SPX: {
  filtered: false,   ← ✅ NOT FILTERED ANYMORE!
  hasSignal: true,
  signal: { type: 'mean_reversion_long', baseScore: 72.5 }
}
[Composite Scanner] 🎯 NEW SIGNAL SAVED: SPX mean_reversion_long (72/100)
```

**🎉 Weekend Radar should now work!**
