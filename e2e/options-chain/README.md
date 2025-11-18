# Options Chain Test Suite - Quick Start

## Status: Foundation Complete ✅

**5/5 Foundation Tests Passing** | **17 Tests Blocked (Waiting for Options Chain UI)**

## What's Implemented

✅ **Entry Point Tests** (`01-entry-points.spec.ts`)

- Watchlist symbol selection without errors
- Re-click stability
- Symbol switching functionality
- Multi-symbol cycling
- State persistence across tab navigation

## What's Blocked

⚠️ **Waiting for Options Chain UI Component** to be implemented:

1. **Expiration Tests** (`02-expiration-loading.spec.ts`) - 6 tests

   - Expiration loading and selection
   - Default nearest expiration behavior
   - Manual expiration switching
   - Data quality validation

2. **ATM Detection Tests** (`03-atm-detection.spec.ts`) - 11 tests

   - ATM strike identification
   - ATM separator rendering
   - Strike distribution (10 ITM + 10 OTM)
   - Dynamic ATM updates on price changes

3. **Future Tests** (Not yet scaffolded)
   - Contract filtering (calls/puts toggle)
   - Data refresh and streaming
   - Trade integration flow
   - Edge cases and responsive layout

## Running Tests

```bash
# Run all Options Chain tests (includes skipped tests)
pnpm test:e2e e2e/options-chain/

# Run only passing foundation tests
pnpm test:e2e e2e/options-chain/01-entry-points.spec.ts

# Run with UI visible
pnpm exec playwright test e2e/options-chain/01-entry-points.spec.ts --headed

# Debug mode
pnpm exec playwright test e2e/options-chain/01-entry-points.spec.ts --debug
```

## Next Implementation Steps

### 1. Create Options Chain UI Component

**File**: `src/components/trading/OptionsChainPanel.tsx`

```typescript
interface OptionsChainPanelProps {
  symbol: string;
  onClose: () => void;
  onContractSelect?: (contract: Contract) => void;
}

export function OptionsChainPanel({
  symbol,
  onClose,
  onContractSelect,
}: OptionsChainPanelProps) {
  // Use existing hook for streaming data
  const { contracts, loading } = useStreamingOptionsChain(symbol);

  // Add expiration selection state
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(
    null
  );

  // Calculate ATM strike
  const atmStrike = calculateATM(contracts, underlyingPrice);

  // Filter to 10 ITM + 1 ATM + 10 OTM
  const visibleStrikes = getStrikeDistribution(contracts, atmStrike);

  return (
    <div data-testid="options-chain-panel">
      {/* Underlying info */}
      <div>
        <span data-testid="chain-underlying-symbol">{symbol}</span>
        <span data-testid="underlying-price">${underlyingPrice}</span>
      </div>

      {/* Expiration dropdown */}
      <ExpirationDropdown
        data-testid="expiration-dropdown"
        selected={selectedExpiration}
        onChange={setSelectedExpiration}
      />

      {/* Strike grid */}
      <div data-testid="strike-grid">
        {visibleStrikes.map((strike, index) => (
          <StrikeRow
            key={strike.strikePrice}
            data-testid={`strike-row-${index}`}
            data-strike={strike.strikePrice}
            contract={strike}
            isATM={strike.strikePrice === atmStrike}
          />
        ))}
        <div data-testid="atm-separator">AT THE MONEY</div>
      </div>
    </div>
  );
}
```

### 2. Add Required Test IDs

Add these `data-testid` attributes to enable testing:

```typescript
// Panel
[data-testid="options-chain-panel"]
[data-testid="chain-underlying-symbol"]
[data-testid="underlying-price"]

// Expiration
[data-testid="expiration-dropdown"]
[data-testid="selected-expiration"]
[data-testid="expiry-option-YYYY-MM-DD"]  // Each expiration option

// Strike Grid
[data-testid="strike-grid"]
[data-testid="strike-row-N"]  // 0-based index
[data-testid="atm-separator"]

// Contract Details
[data-testid="selected-contract-ticker"]
[data-testid="contract-detail-panel"]
```

### 3. Wire Up to State Management

**In** `src/components/DesktopLiveCockpitSlim.tsx`:

```typescript
const { activeTicker, setActiveTicker } = useTradeStateMachine();
const [showOptionsChain, setShowOptionsChain] = useState(false);

// When ticker clicked
const handleTickerClick = (ticker: Ticker) => {
  setActiveTicker(ticker);
  setShowOptionsChain(true); // Open Options Chain panel
};

return (
  <>
    <HDPanelWatchlist
      watchlist={watchlist}
      activeTicker={activeTicker?.symbol}
      onTickerClick={handleTickerClick}
    />

    {showOptionsChain && activeTicker && (
      <OptionsChainPanel
        symbol={activeTicker.symbol}
        onClose={() => setShowOptionsChain(false)}
      />
    )}
  </>
);
```

### 4. Test Helpers

Create `e2e/helpers/options-chain.ts`:

```typescript
export async function openOptionsChain(page: Page, symbol: string) {
  // Click watchlist symbol
  await page.click(`[data-testid="watchlist-item-${symbol}"]`);

  // Wait for panel to open
  await page.waitForSelector('[data-testid="options-chain-panel"]', {
    state: "visible",
    timeout: 5000,
  });
}

export async function waitForExpirations(page: Page) {
  await page.waitForSelector('[data-testid^="expiry-option-"]', {
    state: "visible",
    timeout: 5000,
  });
}

export async function selectExpiration(page: Page, date: string) {
  await page.click('[data-testid="expiration-dropdown"]');
  await page.click(`[data-testid="expiry-option-${date}"]`);
}

export async function getATMSeparatorPosition(page: Page): Promise<number> {
  const separator = page.locator('[data-testid="atm-separator"]');
  const box = await separator.boundingBox();
  return box?.y || 0;
}
```

### 5. Enable Blocked Tests

Once Options Chain UI is implemented:

1. Remove `.skip` from tests in `02-expiration-loading.spec.ts`
2. Remove `.skip` from tests in `03-atm-detection.spec.ts`
3. Run test suite: `pnpm test:e2e e2e/options-chain/`
4. Fix any failing tests by adjusting selectors/assertions
5. Add remaining P1/P2 test files as needed

## Architecture Integration

### Existing Hooks (Already Implemented)

```typescript
// Streaming options data
useStreamingOptionsChain(symbol: string) → { contracts, loading, error }

// Fetch options chain snapshot
useMassiveData() → { fetchOptionsChain(symbol, expiry?) }

// Confluence data for risk calculation
useConfluenceData(trade, state) → { keyLevels, atr, vwap }
```

### Backend Routes (Already Implemented)

```typescript
// REST API
GET /api/massive/options/chain?symbol=QQQ&expiration=2024-12-20

// WebSocket
ws://localhost:3000/ws/options
  - Subscribe to options chain updates
  - Real-time bid/ask/volume changes
```

## Success Metrics

- ✅ **Foundation**: 5/5 tests passing (100%)
- ⏳ **P0 (Critical)**: 0/12 tests passing (blocked)
- ⏳ **P1 (Core)**: 0/8 tests (not started)
- ⏳ **P2 (Polish)**: 0/5 tests (not started)

**Total**: 5/30 tests implemented (16.7%)

## Related Documentation

- **Full Specification**: `e2e/OPTIONS_CHAIN_TEST_SPEC.md`
- **Implementation Status**: `e2e/OPTIONS_CHAIN_IMPLEMENTATION_STATUS.md`
- **Test Files**: `e2e/options-chain/*.spec.ts`

---

**Questions?** See `e2e/OPTIONS_CHAIN_TEST_SPEC.md` for detailed test scenarios and expected behavior.
