# Data Provider Migration Guide

This guide shows how to migrate from the old data-fetching pattern to the new production-grade data provider system.

## Overview

### Old Pattern (What We're Replacing)

```typescript
// Old: Direct API calls scattered throughout codebase
async function getOptionsChain(symbol: string) {
  const response = await fetch(`/api/options/chain?symbol=${symbol}`, {
    headers: { 'x-massive-proxy-token': token },
  });
  return response.json();
}

// Old: In component
const [chain, setChain] = useState(null);
useEffect(() => {
  getOptionsChain('SPY').then(setChain);
}, []);
```

**Problems:**
- No validation
- No quality tracking
- No fallback logic
- Scattered across codebase
- Hard to test
- Inconsistent error handling

### New Pattern (What We're Using)

```typescript
// New: Unified provider
const provider = new HybridOptionsProvider(massiveConfig, tradierConfig);
const chain = await provider.getOptionChain('SPY');
// → Includes: validation, quality flags, automatic fallback

// New: In component (via hook)
const { chain, quality } = useOptionChain('SPY');
// → Real-time updates, validation, fallback handling
```

**Benefits:**
- ✅ Built-in validation
- ✅ Quality tracking
- ✅ Automatic fallback
- ✅ Unified interface
- ✅ Easy to test
- ✅ Consistent error handling
- ✅ Type-safe

## Step-by-Step Migration

### Step 1: Initialize Hub (App.tsx)

Replace initialization code in `/src/App.tsx`:

**Before:**

```typescript
// OLD
useEffect(() => {
  // No centralized data management
  loadWatchlistData();
  loadIndicesData();
}, []);

async function loadWatchlistData() {
  // Direct API calls
  for (const symbol of watchlist) {
    const chain = await fetch(`/api/options/chain?symbol=${symbol}`);
    // ...
  }
}
```

**After:**

```typescript
// NEW
import { getGlobalHub } from './lib/data-provider';

useEffect(() => {
  const initHub = async () => {
    const hub = await getGlobalHub({
      massiveApiKey: process.env.VITE_MASSIVE_API_KEY!,
      massiveBaseUrl: process.env.VITE_MASSIVE_BASE_URL,
      tradierAccessToken: process.env.VITE_TRADIER_TOKEN!,
      tradierBaseUrl: process.env.VITE_TRADIER_BASE_URL,
      watchlistSymbols: watchlist.map(w => w.symbol),
      indexTickers: ['SPX', 'NDX', 'VIX'],
      enableLogging: process.env.NODE_ENV === 'development',
      enableMetrics: true,
    });

    // Hub automatically fetches and maintains all data
  };

  initHub();
}, []);
```

### Step 2: Migrate Hooks

Replace hook patterns for real-time data.

#### Old useOptionsChain Hook

```typescript
// OLD: src/hooks/useMassiveData.ts
export function useOptionsChain(symbol: string | null) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/options/chain?symbol=${symbol}`)
      .then(r => r.json())
      .then(data => {
        setContracts(data.contracts);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [symbol]);

  return { contracts, loading };
}
```

**New useOptionChain Hook**

```typescript
// NEW: src/hooks/useOptionChain.ts
import { useState, useEffect } from 'react';
import { useGlobalHub } from '../lib/data-provider';
import type { OptionChainData, DataQualityFlags } from '../lib/data-provider';

export function useOptionChain(underlying: string | null) {
  const hub = useGlobalHub();
  const [chain, setChain] = useState<OptionChainData | null>(null);
  const [quality, setQuality] = useState<DataQualityFlags | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!underlying || !hub) return;

    // Get initial data from hub
    const initial = hub.getOptionChain(underlying);
    if (initial) {
      setChain(initial);
      setQuality(initial.quality);
    }

    // Subscribe to real-time updates
    const unsub = hub.subscribeTick('useOptionChain', (tick) => {
      if (tick.type === 'option' && tick.optionChain?.underlying === underlying) {
        setChain(tick.optionChain);
        setQuality(tick.optionChain.quality);
        setError(null);
      }
    });

    return unsub;
  }, [underlying, hub]);

  return {
    chain,
    contracts: chain?.contracts || [],
    quality,
    isStale: quality?.isStale || false,
    qualityWarnings: quality?.warnings || [],
    confidence: quality?.confidence || 0,
    error,
  };
}
```

**Usage in Component:**

```typescript
// Before: No quality tracking
const { contracts, loading } = useOptionsChain('SPY');

// After: Full quality tracking + real-time
const { contracts, quality, qualityWarnings } = useOptionChain('SPY');

if (quality?.isStale) {
  return <Alert>Data is {(Date.now() - quality.updatedAt) / 1000}s old</Alert>;
}

if (qualityWarnings.length > 0) {
  return (
    <Alert variant="warning">
      {qualityWarnings.map(w => <li key={w}>{w}</li>)}
    </Alert>
  );
}
```

### Step 3: Migrate Services

Update existing service files to use providers.

**Old Service**

```typescript
// OLD: src/services/options.ts
export async function fetchOptionsChain(symbol: string) {
  const response = await fetch(`/api/options/chain?symbol=${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch chain');
  return response.json();
}
```

**New Service**

```typescript
// NEW: src/services/options.ts
import { getGlobalHub } from '../lib/data-provider';
import type { OptionChainData } from '../lib/data-provider';

export async function getOptionsChain(symbol: string): Promise<OptionChainData> {
  const hub = await getGlobalHub({
    massiveApiKey: process.env.VITE_MASSIVE_API_KEY!,
    tradierAccessToken: process.env.VITE_TRADIER_TOKEN!,
  });

  const chain = hub.getOptionChain(symbol);
  if (!chain) {
    // Force fetch if not in hub
    const providers = createDataProviders({
      massiveApiKey: process.env.VITE_MASSIVE_API_KEY!,
      tradierAccessToken: process.env.VITE_TRADIER_TOKEN!,
    });
    return providers.options.getOptionChain(symbol);
  }

  return chain;
}
```

### Step 4: Update Coach Components

Update strategy/coaching components with data quality awareness.

**Old Component**

```typescript
// OLD: Components without quality tracking
export function ContractRecommendations({ chain }: Props) {
  const recommendations = scoreContracts(chain.contracts);

  return (
    <div>
      {recommendations.map(rec => (
        <Card key={rec.id}>
          <div>{rec.ticker}</div>
          <div>{rec.score}</div>
        </Card>
      ))}
    </div>
  );
}
```

**New Component**

```typescript
// NEW: Components with quality tracking
import { validateOptionChain } from '../lib/data-provider/validation';

export function ContractRecommendations({ chain }: Props) {
  // Validate before using
  const validation = validateOptionChain(chain);

  if (!validation.isValid) {
    return <Alert variant="error">{validation.errors.join('; ')}</Alert>;
  }

  if (validation.quality === 'poor') {
    return (
      <Alert variant="warning">
        Data quality is poor ({validation.confidence}% confidence).
        Recommendations may be inaccurate.
      </Alert>
    );
  }

  const recommendations = scoreContracts(chain.contracts);

  return (
    <div>
      {validation.warnings.length > 0 && (
        <Alert variant="info">
          {validation.warnings.map(w => <li key={w}>{w}</li>)}
        </Alert>
      )}

      {recommendations.map(rec => (
        <Card key={rec.id}>
          <div>{rec.ticker}</div>
          <div>{rec.score}</div>
          <div className="text-sm text-muted">
            Data age: {((Date.now() - chain.quality.updatedAt) / 1000).toFixed(1)}s
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### Step 5: Update Risk Engine

The risk engine should validate data before calculations.

**Old Risk Calculation**

```typescript
// OLD: No validation
export function calculateRisk(
  entry: number,
  greek: number,
  dte: number
): RiskResult {
  // Assume data is good
  return doCalculation(entry, greek, dte);
}
```

**New Risk Calculation**

```typescript
// NEW: With validation
import { validateOptionContract } from '../lib/data-provider/validation';

export function calculateRisk(
  contract: OptionContractData,
): RiskResult {
  // Validate first
  const validation = validateOptionContract(contract);

  if (!validation.isValid) {
    throw new Error(`Invalid contract: ${validation.errors.join(', ')}`);
  }

  if (validation.quality === 'poor') {
    console.warn(`Poor quality data: ${validation.warnings.join(', ')}`);
    throw new Error('Cannot calculate risk with poor quality data');
  }

  // Safe to proceed
  return doCalculation(
    contract.quote.mid,
    contract.greeks.delta,
    contract.dte
  );
}
```

### Step 6: Update Navigation & Routing

Ensure navigation components can work with new data.

**Old Navigation**

```typescript
// OLD: Simple navigation without data context
<Button onClick={() => navigate(`/options/${symbol}`)}>
  View Options
</Button>
```

**New Navigation**

```typescript
// NEW: Navigation with data availability check
import { useGlobalHub } from '../lib/data-provider';

function NavigateToOptions({ symbol }: Props) {
  const hub = useGlobalHub();

  const handleClick = () => {
    const chain = hub?.getOptionChain(symbol);

    if (!chain) {
      return alert('Options data not loaded yet. Please wait...');
    }

    if (chain.quality.confidence < 50) {
      return alert('Options data quality is poor. Try again shortly.');
    }

    navigate(`/options/${symbol}`);
  };

  return <Button onClick={handleClick}>View Options</Button>;
}
```

## Migration Checklist

### Phase 1: Setup (Week 1)

- [ ] Create data provider files (`/src/lib/data-provider/`)
- [ ] Install/update dependencies (if any)
- [ ] Set up environment variables
- [ ] Create unit tests
- [ ] Document in README

### Phase 2: Core Hooks (Week 2)

- [ ] Create `useOptionChain()` hook
- [ ] Create `useIndex()` hook
- [ ] Create `useEquity()` hook
- [ ] Update `src/App.tsx` to initialize hub
- [ ] Test hooks in dev environment

### Phase 3: Service Layer (Week 3)

- [ ] Update `src/services/options.ts`
- [ ] Update `src/services/quotes.ts`
- [ ] Update `src/services/bars.ts`
- [ ] Add validation to risk engine
- [ ] Create integration tests

### Phase 4: Component Migration (Week 4-5)

- [ ] Update `MainCockpit` component
- [ ] Update strategy selector components
- [ ] Update coaching components
- [ ] Update charts/tables
- [ ] Test in staging

### Phase 5: Testing & Validation (Week 6)

- [ ] Unit tests (target: >85% coverage)
- [ ] Integration tests with real APIs
- [ ] Load testing
- [ ] Fallback testing (simulate failures)
- [ ] E2E testing in staging

## Common Migration Issues

### Issue: "useGlobalHub returns null"

**Cause:** Hub not initialized before component renders

**Solution:**
```typescript
const hub = useGlobalHub();
if (!hub) return <Loading />; // Wait for initialization
```

### Issue: "Type errors with new types"

**Cause:** Old types don't match new `OptionContractData` etc.

**Solution:**
Update component props:
```typescript
// OLD
interface Props {
  contract: any;
}

// NEW
import type { OptionContractData } from '../lib/data-provider';
interface Props {
  contract: OptionContractData;
}
```

### Issue: "Data updates not showing"

**Cause:** Not subscribed to hub updates

**Solution:**
Ensure using new hooks:
```typescript
// OLD: One-time fetch
useEffect(() => {
  fetchChain(symbol).then(setChain);
}, [symbol]);

// NEW: Real-time updates
const { chain } = useOptionChain(symbol);
```

### Issue: "Performance degradation"

**Cause:** Too many subscribers or inefficient updates

**Solution:**
1. Use `selectorsub` pattern for specific data
2. Memoize components
3. Increase polling interval
4. Monitor metrics: `hub.getMetrics()`

## Rollback Plan

If issues arise, you can temporarily use both systems:

```typescript
// Hybrid approach - use new for better contracts, old as backup
async function getChainSafely(symbol: string) {
  try {
    const newChain = await newProvider.getOptionChain(symbol);
    if (newChain.quality.confidence > 80) return newChain;
  } catch (e) {
    console.warn('New provider failed:', e);
  }

  // Fallback to old system
  return oldFetchOptionsChain(symbol);
}
```

## Support

For migration help:
1. Check README.md for detailed documentation
2. Review test files for usage examples
3. Check existing component migrations in `MIGRATION_EXAMPLES.md`
4. Contact team lead with specific issues

## Timeline

- **Estimated effort:** 2-3 weeks for full migration
- **Risk level:** Low (parallel systems can coexist)
- **Rollback:** Can disable hub and use old services
- **Testing:** Comprehensive unit + integration test suite included

## Success Criteria

- [ ] 100% of hooks migrated to use hub
- [ ] >85% test coverage on data providers
- [ ] All error cases handled gracefully
- [ ] Data quality tracking in UI
- [ ] Fallback logic tested
- [ ] Monitoring/metrics in place
- [ ] Documentation complete
- [ ] Performance not degraded
