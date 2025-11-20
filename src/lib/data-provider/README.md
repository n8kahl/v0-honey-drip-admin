# Data Provider Architecture - Production Documentation

## Overview

The Data Provider system is a **production-grade, unified market data architecture** that provides:

- **Single Source of Truth** for all market data (options, indices, equities)
- **Intelligent Fallback** between Massive.com (primary) and Tradier (backup)
- **Real-time Data** via WebSockets + REST polling
- **Comprehensive Validation** and data quality tracking
- **Full Test Coverage** with unit + integration tests
- **Type-safe** TypeScript interfaces throughout

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Components                            │
│                   (Strategy, Trading, Charts)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Market Data Hub                                │
│  - Consolidated polling (5s interval)                           │
│  - WebSocket real-time updates                                  │
│  - Batched publishing to subscribers                            │
│  - Health monitoring                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Hybrid   │  │ Hybrid   │  │ Hybrid   │
         │ Options  │  │ Indices  │  │ Broker   │
         │ Provider │  │ Provider │  │ Provider │
         └────┬─────┘  └──────────┘  └────┬─────┘
              │                            │
         ┌────┴────┐                  ┌────┴────┐
         ▼         ▼                  ▼         ▼
     ┌────────┐┌────────┐         ┌────────┐┌────────┐
     │Massive││Tradier │         │Massive ││Tradier │
     │Provider││Provider│         │Provider││Provider│
     └────────┘└────────┘         └────────┘└────────┘
         ▲         ▲                  ▲         ▲
         │         │                  │         │
         └────────────────────────────┴─────────┘
                   │              │
            ┌──────┴──────┐   ┌───┴──────┐
            ▼             ▼   ▼          ▼
        Massive.com     Tradier      Rest APIs
        WebSocket       REST API
        (Real-time)     (Historical)
```

## Core Components

### 1. Types & Interfaces (`types.ts`)

Defines all data structures:

- **OptionContractData** - Single option contract (strike, Greeks, liquidity, quality flags)
- **OptionChainData** - All contracts for an underlying
- **IndexSnapshot** - Index data with indicators and timeframes
- **EquityQuote** - Underlying asset price
- **DataQualityFlags** - Staleness, warnings, confidence scoring
- **OptionsDataProvider** - Interface for options data
- **IndicesDataProvider** - Interface for indices data
- **BrokerDataProvider** - Interface for equity data

### 2. Validation (`validation.ts`)

Production validation rules:

```typescript
// Validate single contract
const result = validateOptionContract(contract);
// → { isValid, quality, confidence, errors, warnings }

// Validate full chain
const result = validateOptionChain(chain);
// → Checks for: empty chains, missing calls/puts, strike gaps, liquidity

// Validate index snapshot
const result = validateIndexSnapshot(snapshot);
// → Checks for: inverted candles, stale data, missing timeframes
```

**Quality Scoring:**
- `excellent` (100-90): All data fresh, no warnings
- `good` (89-70): Minor warnings, acceptable data
- `fair` (69-40): Multiple issues, but usable
- `poor` (<40): Stale, invalid, or incomplete data

### 3. Providers

#### Massive Provider (`massive-provider.ts`)

Primary provider with full API coverage:

```typescript
const provider = new MassiveOptionsProvider({
  apiKey: process.env.MASSIVE_API_KEY,
  baseUrl: 'https://api.massive.com',
  timeoutMs: 10000,
  maxRetries: 3,
  enableLogging: true,
  cacheTtlMs: {
    chain: 30000,
    snapshot: 5000,
    indicators: 30000,
    bars: 60000,
  },
});

// Get full chain
const chain = await provider.getOptionChain('SPY', {
  strikeRange: [440, 460],
  expirationRange: ['2024-01-19', '2024-02-16'],
  minVolume: 10,
  minOpenInterest: 100,
});

// Get single contract
const contract = await provider.getOptionContract('SPY', 450, '2024-01-19', 'call');

// Get flow data
const flow = await provider.getFlowData('SPY');

// Real-time subscriptions
const unsubscribe = provider.subscribeToChain('SPY', (chain) => {
  console.log('Chain updated:', chain.contracts.length);
});
```

**Features:**
- Automatic retry with exponential backoff
- Built-in caching with configurable TTLs
- Rate limit handling (HTTP 429)
- Full Greeks, IV, flow data
- WebSocket subscriptions
- Request timeout enforcement

#### Tradier Provider (`tradier-provider.ts`)

Fallback provider for reliability:

```typescript
const provider = new TradierOptionsProvider({
  accessToken: process.env.TRADIER_ACCESS_TOKEN,
  baseUrl: 'https://api.tradier.com/v1',
  timeoutMs: 10000,
  maxRetries: 3,
});

// Same interface as Massive
const chain = await provider.getOptionChain('SPY');
```

**Limitations:**
- No flow data (returns synthetic)
- Slower response (no WebSocket)
- Good for fallback/backup

#### Hybrid Provider (`hybrid-provider.ts`)

Intelligent routing with fallback:

```typescript
const hybrid = new HybridOptionsProvider(massiveConfig, tradierConfig);

// Always tries Massive first
const chain = await hybrid.getOptionChain('SPY');

// If Massive fails OR returns poor quality:
// 1. Empty chain
// 2. Confidence < 40
// 3. API error
// → Falls back to Tradier

// Monitor health
const health = hybrid.getHealth();
console.log(health.massive.healthy);        // Boolean
console.log(health.massive.consecutiveErrors); // Number (0-N)
console.log(health.massive.responseTimeMs);   // Response time
```

**Smart Fallback Logic:**
- Tracks 3 consecutive errors per provider
- Marks unhealthy provider after 3 errors
- Validates result quality before returning
- Adds fallback reason to quality flags
- Automatic recovery on success

### 4. Market Data Hub (`market-data-hub.ts`)

Unified real-time consolidation:

```typescript
const hub = new MarketDataHub(
  optionsProvider,
  indicesProvider,
  brokerProvider,
  {
    watchlistSymbols: ['SPY', 'QQQ', 'IWM'],
    indexTickers: ['SPX', 'NDX', 'VIX'],
    refreshIntervalMs: 5000,
    wsEnabled: true,
    enableLogging: true,
    enableMetrics: true,
  }
);

// Initialize (starts polling + WebSocket)
await hub.initialize();

// Subscribe to ticks (individual updates)
const unsubTick = hub.subscribeTick('myApp', (tick: MarketDataTick) => {
  if (tick.type === 'option') {
    console.log(`Option updated: ${tick.optionChain?.underlying}`);
  }
});

// Subscribe to snapshots (consolidated view)
const unsubSnapshot = hub.subscribeSnapshot('myApp', (snapshot: MarketDataSnapshot) => {
  console.log(`All data updated. Chains: ${snapshot.optionChains.size}`);
  console.log(`Indices: ${snapshot.indices.size}`);
  console.log(`Equities: ${snapshot.equities.size}`);
  console.log(`Quality: ${snapshot.quality.confidence}%`);
});

// Query current state
const current = hub.getSnapshot();
const spy = hub.getOptionChain('SPY');
const spx = hub.getIndex('SPX');

// Update watchlist dynamically
hub.updateWatchlist(['SPY', 'QQQ', 'AAPL', 'MSFT']);

// Monitor metrics
const metrics = hub.getMetrics();
console.log(metrics.totalTicks);       // Total ticks published
console.log(metrics.subscriberCounts); // Number of subscribers
console.log(metrics.dataCounts);       // Data in store
console.log(metrics.providerHealth);   // Provider status

// Cleanup
await hub.shutdown();
```

**Features:**
- REST polling every N milliseconds
- WebSocket real-time streams
- Batched updates (100ms debounce)
- Consolidated snapshots
- Subscription management
- Health monitoring
- Dynamic watchlist updates

## Usage Patterns

### Pattern 1: Real-time Options Coaching

```typescript
// In React component
export function StrategySelector({ underlying }: Props) {
  const [chain, setChain] = useState<OptionChainData | null>(null);
  const [quality, setQuality] = useState<DataQualityFlags | null>(null);

  useEffect(() => {
    const hub = marketDataHub; // Singleton

    const unsub = hub.subscribeTick('selector', (tick) => {
      if (tick.type === 'option' && tick.optionChain?.underlying === underlying) {
        setChain(tick.optionChain);
        setQuality(tick.optionChain.quality);
      }
    });

    return unsub;
  }, [underlying]);

  if (quality?.isStale) {
    return <Alert>Data is stale</Alert>;
  }

  if (quality?.hasWarnings) {
    return (
      <Alert variant="warning">
        {quality.warnings.map(w => <div key={w}>{w}</div>)}
      </Alert>
    );
  }

  return <OptionsTable contracts={chain?.contracts} />;
}
```

### Pattern 2: Strategy Signal Detection

```typescript
// Hook that monitors strategy conditions in real-time
export function useStrategySignal(strategy: Strategy, underlying: string) {
  const [confidence, setConfidence] = useState(0);
  const [meets, setMeets] = useState(false);

  useEffect(() => {
    const hub = marketDataHub;

    const unsub = hub.subscribeTick('signals', (tick) => {
      if (tick.type === 'option' && tick.optionChain?.underlying === underlying) {
        // Evaluate strategy against latest market data
        const chain = tick.optionChain;
        const spx = hub.getIndex('SPX');

        const signal = evaluateStrategy(strategy, {
          chain,
          index: spx,
          flow: hub.getFlow(underlying),
        });

        setConfidence(signal.confidence);
        setMeets(signal.matches);

        // Send to Discord if confident
        if (signal.matches && signal.confidence > 80) {
          notifyDiscord(`${strategy.name} ready: ${underlying}`);
        }
      }
    });

    return unsub;
  }, [strategy, underlying]);

  return { confidence, meets };
}
```

### Pattern 3: Trade Entry with Validation

```typescript
// Verify data quality before executing trade
async function executeTradeWithValidation(contract: OptionContractData) {
  // Check data quality
  const validation = validateOptionContract(contract);

  if (!validation.isValid) {
    throw new Error(`Invalid contract: ${validation.errors.join(', ')}`);
  }

  if (validation.quality !== 'excellent' && validation.quality !== 'good') {
    const confirmed = await confirm(
      `Warning: Data quality is ${validation.quality}. Proceed?`
    );
    if (!confirmed) return;
  }

  // Check liquidity
  if (contract.liquidity.spreadPercent > 2) {
    console.warn(`Wide spread: ${contract.liquidity.spreadPercent.toFixed(2)}%`);
  }

  if (contract.liquidity.volume === 0) {
    throw new Error('No volume - cannot fill order');
  }

  // Proceed with order
  const order = await submitOrder(contract);
  return order;
}
```

## Environment Configuration

### Required Environment Variables

```bash
# Massive.com
MASSIVE_API_KEY=your_key_here
MASSIVE_BASE_URL=https://api.massive.com  # Optional
MASSIVE_PROXY_TOKEN=your_proxy_token      # For browser WS auth

# Tradier
TRADIER_ACCESS_TOKEN=your_token_here
TRADIER_BASE_URL=https://api.tradier.com/v1  # Optional

# Client-side (Vite)
VITE_MASSIVE_PROXY_TOKEN=your_proxy_token
VITE_MASSIVE_BASE_URL=https://api.massive.com
```

## Error Handling

### Common Error Codes

| Code | Meaning | Fallback | Action |
|------|---------|----------|--------|
| `MASSIVE_API_ERROR` | Massive API failed | Try Tradier | Log + retry |
| `TRADIER_API_ERROR` | Tradier API failed | None | Log + show error |
| `CONTRACT_NOT_FOUND` | Contract doesn't exist | Return 404 | Show not found |
| `ALL_PROVIDERS_FAILED` | Both providers failed | None | Circuit break |
| `MAX_RETRIES_EXCEEDED` | Retry limit hit | Fallback | Use cached data |

### Example Error Handling

```typescript
try {
  const chain = await hybrid.getOptionChain('SPY');
} catch (error) {
  if (error instanceof DataProviderError) {
    switch (error.code) {
      case 'ALL_PROVIDERS_FAILED':
        showError('Market data temporarily unavailable');
        useLastKnownGoodData();
        break;
      case 'MASSIVE_API_ERROR':
        console.warn('Massive failed, using Tradier fallback');
        break;
      default:
        showError(error.message);
    }
  }
}
```

## Testing

### Run Unit Tests

```bash
npm run test                 # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # UI mode
npm run test -- data-provider  # Filter to data-provider tests
```

### Run Integration Tests

```bash
npm run test:integration    # E2E against real APIs (staging)
```

### Test Coverage Goals

- Validation layer: >95%
- Providers: >85%
- Hub: >80%
- Overall: >85%

### Mock API Responses for Testing

```typescript
// vitest
vi.mock('../providers', () => ({
  MassiveOptionsProvider: class {
    getOptionChain = vi.fn().mockResolvedValue(mockChain);
  },
}));
```

## Monitoring & Metrics

### Key Metrics to Track

```typescript
const metrics = hub.getMetrics();

// Ticks
console.log(metrics.totalTicks);              // Total updates sent
console.log(metrics.lastUpdateTime);          // Last update timestamp
console.log(metrics.lastPollingTime);         // Last REST poll

// Subscribers
console.log(metrics.subscriberCounts.ticks);  // Tick subscribers
console.log(metrics.subscriberCounts.snapshots); // Snapshot subscribers

// Data Coverage
console.log(metrics.dataCounts.optionChains); // Chains in memory
console.log(metrics.dataCounts.indices);      // Indices
console.log(metrics.dataCounts.equities);     // Equities

// Provider Health
console.log(metrics.providerHealth.options);  // Options provider status
console.log(metrics.providerHealth.broker);   // Broker provider status
```

### Alerting Recommendations

- **Confidence < 60** → Warning: Data quality degraded
- **Confidence < 30** → Error: Using stale data
- **All providers unhealthy** → Critical: No data
- **Response time > 5s** → Warning: Slow provider
- **0 subscribers for 1m** → Info: Hub may be unused

## Production Deployment

### Checklist

- [ ] Environment variables configured (all 6 required)
- [ ] Rate limits understood (Massive, Tradier)
- [ ] Caching TTLs appropriate for your use case
- [ ] Error logging configured (Sentry, LogRocket, etc.)
- [ ] Metrics/monitoring integrated (DataDog, CloudWatch, etc.)
- [ ] Tests passing (unit + integration)
- [ ] Load tested (concurrent subscribers, update frequency)
- [ ] Fallback tested (simulate provider failures)

### Performance Tuning

```typescript
// Reduce polling frequency for less-critical data
const hub = new MarketDataHub(providers, {
  watchlistSymbols: [...],
  refreshIntervalMs: 10000, // 10s instead of 5s
});

// Increase caching for options chains
new MassiveOptionsProvider({
  cacheTtlMs: {
    chain: 60000, // 60s for chains
  },
});

// Limit concurrent requests
const batcher = new RequestBatcher(maxConcurrent: 5);
```

### Logs to Watch

```
[MarketDataHub] Hub initialized successfully
[HybridProvider] Massive expirations failed, trying Tradier
[MassiveProvider] Rate limited, retrying after Ns
[MarketDataHub] Polling error: ...
[HybridProvider] Both providers failed to fetch option chain
```

## Troubleshooting

### Issue: "Both providers failed"

**Causes:**
- API credentials wrong
- Network connectivity issues
- API rate limits reached
- Market closed (no data)

**Resolution:**
1. Check environment variables
2. Test API manually: `curl https://api.massive.com/v3/snapshot/options/SPY`
3. Check rate limit usage
4. Verify market hours

### Issue: "Data is stale"

**Causes:**
- Polling stopped
- WebSocket disconnected
- Provider unhealthy
- Network latency

**Resolution:**
1. Check hub metrics: `hub.getMetrics()`
2. Check provider health: `hybrid.getHealth()`
3. Check network logs
4. Restart hub: `await hub.shutdown(); await hub.initialize();`

### Issue: "Wide spread / Zero volume"

**Causes:**
- Illiquid contract
- After/before hours
- Recent listing
- Massive API limitation

**Resolution:**
1. Filter by minVolume/minOI in query
2. Use options pricing model for estimation
3. Fall back to ATM contracts
4. Alert user about liquidity

## Contributing

### Adding a New Data Provider

1. Create class implementing `OptionsDataProvider` interface
2. Implement all required methods
3. Add validation logic
4. Write tests (>80% coverage)
5. Document in README
6. Add to `HybridProvider` fallback chain

### Adding a New Data Field

1. Update type in `types.ts`
2. Update validation in `validation.ts`
3. Update all providers to populate field
4. Update tests to verify field
5. Update documentation

## References

- [Massive.com API Docs](https://www.massive.com/api-docs)
- [Tradier API Docs](https://tradier.com/api/documentation)
- TypeScript strict mode: Enabled
- Node.js version: 18+
- Supported browsers: Modern (ES2020+)

## Support

For issues:
1. Check logs and metrics
2. Review error codes
3. Check environment setup
4. Run tests
5. Review provider health
6. Contact support with:
   - Error message
   - Provider metrics
   - Environment variables (redacted)
   - Recent logs
