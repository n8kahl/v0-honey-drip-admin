# Options Chain E2E Test Specification

> **Test Coverage Plan for v0-honey-drip-admin Options Chain**  
> Generated: November 17, 2025

## Test Organization

```
e2e/
├── options-chain/
│   ├── 01-entry-points.spec.ts          # Watchlist & trade entry flows
│   ├── 02-expiration-loading.spec.ts    # Expiry selection & defaults
│   ├── 03-strike-distribution.spec.ts   # ATM detection & ITM/OTM slicing
│   ├── 04-contract-filtering.spec.ts    # Calls/Puts toggle & filtering
│   ├── 05-data-refresh.spec.ts          # Auto-refresh & real-time updates
│   ├── 06-contract-selection.spec.ts    # Row selection & detail view
│   ├── 07-trade-integration.spec.ts     # Trade/Alert creation from chain
│   └── 08-edge-cases.spec.ts            # Error handling & boundary conditions
```

---

## 1. Entry Points into Options Chain

### 1.1 From Watchlist (No Trade Loaded)

#### Test: Click watchlist symbol → open options chain (happy path)

```typescript
test("Opens options chain when clicking watchlist symbol", async ({ page }) => {
  // Given: Authenticated, QQQ on watchlist
  await login(page);
  await ensureSymbolOnWatchlist(page, "QQQ");

  // When: Click QQQ in watchlist
  await page.click('[data-testid="watchlist-item-QQQ"]');

  // Then: Options panel opens
  await expect(
    page.locator('[data-testid="options-chain-panel"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="chain-underlying-symbol"]')
  ).toHaveText("QQQ");

  // Underlying details populated
  await expect(page.locator('[data-testid="underlying-price"]')).not.toHaveText(
    "$0.00"
  );

  // Expirations populated
  const expirationCount = await page
    .locator('[data-testid^="expiry-option-"]')
    .count();
  expect(expirationCount).toBeGreaterThan(0);

  // Nearest expiry selected by default
  const selectedExpiry = page.locator('[data-testid="selected-expiration"]');
  await expect(selectedExpiry).toBeVisible();

  // Strike grid visible
  const strikeRows = await page.locator('[data-testid^="strike-row-"]').count();
  expect(strikeRows).toBeGreaterThan(0);
});
```

#### Test: Click watchlist symbol that is already open

```typescript
test("Re-clicking open symbol does not duplicate requests", async ({
  page,
}) => {
  await login(page);
  await ensureSymbolOnWatchlist(page, "QQQ");

  // Open chain first time
  let apiCallCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/options/chain")) apiCallCount++;
  });

  await page.click('[data-testid="watchlist-item-QQQ"]');
  await page.waitForTimeout(1000);
  const firstCallCount = apiCallCount;

  // Click again
  await page.click('[data-testid="watchlist-item-QQQ"]');
  await page.waitForTimeout(1000);

  // Should not trigger new API call or should toggle collapse
  expect(apiCallCount).toBeLessThanOrEqual(firstCallCount + 1);
});
```

#### Test: Click different symbol while chain is open

```typescript
test("Switches chain when clicking different watchlist symbol", async ({
  page,
}) => {
  await login(page);
  await ensureSymbolOnWatchlist(page, "QQQ");
  await ensureSymbolOnWatchlist(page, "SPY");

  // Open QQQ
  await page.click('[data-testid="watchlist-item-QQQ"]');
  await expect(
    page.locator('[data-testid="chain-underlying-symbol"]')
  ).toHaveText("QQQ");

  // Switch to SPY
  await page.click('[data-testid="watchlist-item-SPY"]');
  await expect(
    page.locator('[data-testid="chain-underlying-symbol"]')
  ).toHaveText("SPY");

  // Expirations reloaded for SPY
  const spyExpirations = page.locator('[data-testid^="expiry-option-"]');
  await expect(spyExpirations.first()).toBeVisible();

  // Previous QQQ selection cleared
  await expect(
    page.locator('[data-testid="selected-contract-ticker"]')
  ).not.toContainText("QQQ");
});
```

### 1.2 From Loaded Trade / Now Playing

#### Test: Open chain pre-populated from existing trade

```typescript
test("Opens chain with trade contract pre-selected", async ({ page }) => {
  await login(page);

  // Given: Active trade exists for QQQ 250320P590
  await createTestTrade(page, {
    underlying: "QQQ",
    contractTicker: "O:QQQ250320P00590000",
    expiration: "2025-03-20",
    strike: 590,
    type: "put",
  });

  // When: Open options from loaded trade
  await page.click('[data-testid="trade-options-button"]');

  // Then: Chain opens with correct context
  await expect(
    page.locator('[data-testid="chain-underlying-symbol"]')
  ).toHaveText("QQQ");

  // Trade's expiration selected (not nearest)
  await expect(
    page.locator('[data-testid="selected-expiration"]')
  ).toContainText("2025-03-20");

  // Specific strike highlighted
  const strikeRow = page.locator('[data-testid="strike-row-590"]');
  await expect(strikeRow).toHaveClass(/selected|highlighted/);

  // ATM bar still shown relative to current price
  await expect(page.locator('[data-testid="atm-separator"]')).toBeVisible();
});
```

---

## 2. Expiration Loading & Selection

### 2.1 Loading All Expirations

#### Test: All expirations returned & rendered

```typescript
test("Loads and displays all future expirations", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-QQQ"]');

  // Wait for expirations to load
  await page.waitForSelector('[data-testid^="expiry-option-"]');

  const expirations = await page
    .locator('[data-testid^="expiry-option-"]')
    .allTextContents();

  // All dates should be future dates
  const today = new Date();
  for (const expText of expirations) {
    // Parse date from text (format: "Nov 22 (Fri)" or similar)
    // Verify each is >= today
  }

  // Formatted clearly
  expect(expirations[0]).toMatch(/[A-Z][a-z]{2}\s+\d{1,2}/); // e.g., "Nov 22"

  // Weekly + monthly expirations present
  expect(expirations.length).toBeGreaterThan(5);
});
```

#### Test: No expirations available

```typescript
test("Shows empty state when no options available", async ({ page }) => {
  await login(page);
  await addInvalidSymbolToWatchlist(page, "XYZABC"); // Non-existent ticker

  await page.click('[data-testid="watchlist-item-XYZABC"]');

  // Should show error message
  await expect(page.locator("text=/No options available/i")).toBeVisible();

  // Grid should be empty but not crash
  const strikeRows = await page.locator('[data-testid^="strike-row-"]').count();
  expect(strikeRows).toBe(0);

  // No expander shown
  await expect(
    page.locator('[data-testid="expiration-dropdown"]')
  ).not.toBeVisible();
});
```

### 2.2 Default Selection Behavior

#### Test: Nearest non-expired expiry auto-selected

```typescript
test("Auto-selects nearest future expiration", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Get all expiration dates
  const expirations = await page
    .locator('[data-testid^="expiry-option-"]')
    .allTextContents();

  // Selected should be first (nearest)
  const selected = await page
    .locator('[data-testid="selected-expiration"]')
    .textContent();
  expect(selected).toBe(expirations[0]);

  // Verify it's actually future
  // Parse and compare dates
});
```

#### Test: Existing trade overrides default expiry

```typescript
test("Trade expiration takes precedence over nearest", async ({ page }) => {
  await login(page);

  // Create trade with LEAP (far-dated) expiry
  await createTestTrade(page, {
    underlying: "SPY",
    expiration: "2026-01-16", // LEAP
    strike: 600,
  });

  // Open chain from trade
  await page.click('[data-testid="trade-options-button"]');

  // Selected expiry should be the LEAP, not nearest
  await expect(
    page.locator('[data-testid="selected-expiration"]')
  ).toContainText("2026-01-16");

  // Now open from watchlist (fresh)
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Should default back to nearest
  const nearestExpiry = await page
    .locator('[data-testid^="expiry-option-"]')
    .first()
    .textContent();
  await expect(page.locator('[data-testid="selected-expiration"]')).toHaveText(
    nearestExpiry
  );
});
```

### 2.3 Changing Expiration

#### Test: User manually switches expiration

```typescript
test("Reloads chain when expiration changed", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Get initial ATM strike
  const initialAtm = await page
    .locator('[data-testid="atm-strike"]')
    .textContent();

  // Select different expiration
  await page.click('[data-testid="expiration-dropdown"]');
  await page.click('[data-testid="expiry-option-2"]'); // Second expiry

  // Grid reloads
  await page.waitForSelector('[data-testid="atm-separator"]');

  // ATM may differ (different expiry)
  // Strike grid updated for new expiry
  const newStrikeCount = await page
    .locator('[data-testid^="strike-row-"]')
    .count();
  expect(newStrikeCount).toBeGreaterThan(0);

  // 10 ITM / 10 OTM displayed
  // (validation depends on underlying price and available strikes)
});
```

#### Test: Switch back-and-forth between expiries

```typescript
test("Preserves selection when toggling expirations", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-QQQ"]');

  // Select a contract on Expiry A
  await page.click('[data-testid="strike-row-500"]');
  const selectedContract = await page
    .locator('[data-testid="selected-contract-ticker"]')
    .textContent();

  // Switch to Expiry B
  await page.click('[data-testid="expiration-dropdown"]');
  await page.click('[data-testid="expiry-option-2"]');

  // Switch back to Expiry A
  await page.click('[data-testid="expiration-dropdown"]');
  await page.click('[data-testid="expiry-option-1"]');

  // Previous selection should persist if strike exists
  await expect(page.locator('[data-testid="strike-row-500"]')).toHaveClass(
    /selected/
  );

  // No unnecessary API calls (check via network monitoring)
});
```

---

## 3. Strike Distribution & ATM Separator

### 3.1 ATM Detection

#### Test: ATM separator correctly placed

```typescript
test("Places ATM separator at closest strike to underlying", async ({
  page,
}) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Get underlying price
  const underlyingPrice = parseFloat(
    await page.locator('[data-testid="underlying-price"]').textContent()
  );

  // Get ATM strike
  const atmStrike = parseFloat(
    await page.locator('[data-testid="atm-strike"]').textContent()
  );

  // ATM should be closest to underlying
  // Verify no other strike is closer
  const allStrikes = await page
    .locator('[data-testid^="strike-row-"]')
    .allTextContents();
  const strikeValues = allStrikes.map((s) =>
    parseFloat(s.match(/\d+/)?.[0] || "0")
  );

  const closestStrike = strikeValues.reduce((prev, curr) => {
    return Math.abs(curr - underlyingPrice) < Math.abs(prev - underlyingPrice)
      ? curr
      : prev;
  });

  expect(atmStrike).toBe(closestStrike);

  // ATM separator shows underlying price
  await expect(page.locator('[data-testid="atm-separator"]')).toContainText(
    underlyingPrice.toString()
  );
});
```

#### Test: Tie case for ATM

```typescript
test("Handles ATM tie consistently", async ({ page }) => {
  // Mock underlying at exactly between two strikes (e.g., 610 with strikes 605, 615)
  await mockUnderlyingPrice(page, 610);

  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // ATM should follow defined rule (e.g., round up)
  const atmStrike = await page
    .locator('[data-testid="atm-strike"]')
    .textContent();

  // Verify consistent behavior (document which rule is used)
  expect(atmStrike).toMatch(/610|615/); // Or whichever rule you define

  // Separator placed consistently
  await expect(page.locator('[data-testid="atm-separator"]')).toBeVisible();
});
```

### 3.2 10 ITM / 10 OTM Selection

#### Test: Exact 10 ITM & 10 OTM available

```typescript
test("Shows 10 ITM and 10 OTM strikes around ATM", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Count ITM rows (above ATM for calls, below for puts)
  const itmRows = await page
    .locator('[data-testid^="strike-row-"][data-moneyness="itm"]')
    .count();
  const otmRows = await page
    .locator('[data-testid^="strike-row-"][data-moneyness="otm"]')
    .count();

  expect(itmRows).toBeLessThanOrEqual(10);
  expect(otmRows).toBeLessThanOrEqual(10);

  // Total visible strikes (excluding ATM separator row)
  const totalRows = await page.locator('[data-testid^="strike-row-"]').count();
  expect(totalRows).toBeGreaterThan(0);
  expect(totalRows).toBeLessThanOrEqual(21); // 10 ITM + ATM + 10 OTM
});
```

#### Test: Not enough ITM strikes

```typescript
test("Shows all available ITM when less than 10", async ({ page }) => {
  await login(page);

  // Use symbol with underlying near top of chain
  await mockUnderlyingAtChainTop(page, "SPY");

  await page.click('[data-testid="watchlist-item-SPY"]');

  const itmRows = await page
    .locator('[data-testid^="strike-row-"][data-moneyness="itm"]')
    .count();
  const otmRows = await page
    .locator('[data-testid^="strike-row-"][data-moneyness="otm"]')
    .count();

  // Should show all available ITM (< 10)
  expect(itmRows).toBeLessThan(10);

  // Still show up to 10 OTM
  expect(otmRows).toBeGreaterThan(0);

  // No empty dummy rows
  await expect(
    page.locator('[data-testid="empty-strike-row"]')
  ).not.toBeVisible();
});
```

#### Test: Narrow chain with <20 total strikes

```typescript
test("Handles narrow options chain gracefully", async ({ page }) => {
  await login(page);

  // Use illiquid symbol with few strikes
  await mockNarrowChain(page, 12); // Only 12 strikes available

  await page.click('[data-testid="watchlist-item-TEST"]');

  const totalRows = await page.locator('[data-testid^="strike-row-"]').count();
  expect(totalRows).toBe(12);

  // ATM still highlighted
  await expect(page.locator('[data-testid="atm-separator"]')).toBeVisible();

  // No off-by-one errors
  // All 12 strikes should be visible
});
```

---

## 4. Contract Type & Side Filtering

### 4.1 Calls / Puts View

#### Test: Toggle between calls and puts

```typescript
test("Switches between calls and puts view", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Default to calls
  await expect(page.locator('[data-testid="contract-type-filter"]')).toHaveText(
    "Calls"
  );

  // Toggle to puts
  await page.click('[data-testid="contract-type-puts"]');

  await expect(page.locator('[data-testid="contract-type-filter"]')).toHaveText(
    "Puts"
  );

  // ATM separator still visible
  await expect(page.locator('[data-testid="atm-separator"]')).toBeVisible();

  // ITM/OTM definitions flipped for puts
  const firstStrike = await page
    .locator('[data-testid^="strike-row-"]')
    .first();
  const moneyness = await firstStrike.getAttribute("data-moneyness");

  // Verify ITM/OTM logic correct for puts
});
```

#### Test: Both-sides view (if supported)

```typescript
test("Shows calls and puts side-by-side", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Enable split view
  await page.click('[data-testid="contract-type-both"]');

  // Calls on left
  await expect(page.locator('[data-testid="calls-column"]')).toBeVisible();

  // Puts on right
  await expect(page.locator('[data-testid="puts-column"]')).toBeVisible();

  // ATM separator in middle
  const separator = page.locator('[data-testid="atm-separator"]');
  const separatorBox = await separator.boundingBox();
  const callsBox = await page
    .locator('[data-testid="calls-column"]')
    .boundingBox();
  const putsBox = await page
    .locator('[data-testid="puts-column"]')
    .boundingBox();

  // Separator between columns
  expect(separatorBox.x).toBeGreaterThan(callsBox.x);
  expect(separatorBox.x).toBeLessThan(putsBox.x);
});
```

---

## 5. Options Chain Data & Updates

### 5.1 Initial Load Data Completeness

#### Test: Columns populated correctly

```typescript
test("All contract data columns are populated", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Select a contract row
  const firstRow = page.locator('[data-testid^="strike-row-"]').first();

  // Verify all columns present
  await expect(firstRow.locator('[data-column="strike"]')).not.toBeEmpty();
  await expect(firstRow.locator('[data-column="last"]')).not.toHaveText(
    "$0.00"
  );
  await expect(firstRow.locator('[data-column="bid"]')).toBeVisible();
  await expect(firstRow.locator('[data-column="ask"]')).toBeVisible();
  await expect(firstRow.locator('[data-column="iv"]')).not.toHaveText("—");
  await expect(firstRow.locator('[data-column="delta"]')).toBeVisible();
  await expect(firstRow.locator('[data-column="volume"]')).toBeVisible();
  await expect(firstRow.locator('[data-column="oi"]')).toBeVisible();

  // No NaN or undefined rendered
  const rowText = await firstRow.textContent();
  expect(rowText).not.toContain("NaN");
  expect(rowText).not.toContain("undefined");
});
```

#### Test: Greeks missing for some contracts

```typescript
test("Handles missing Greeks gracefully", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Select deep OTM contract (likely missing Greeks)
  const otmRows = page.locator(
    '[data-testid^="strike-row-"][data-moneyness="otm"]'
  );
  const deepOtm = otmRows.nth(-1); // Last OTM (deepest)

  await deepOtm.click();

  // Greeks may show — or placeholder
  const delta = await deepOtm.locator('[data-column="delta"]').textContent();
  expect(delta).toMatch(/—|0\.\d{2}|N\/A/);

  // Row still selectable
  await expect(deepOtm).toHaveClass(/selected/);
});
```

### 5.2 Auto-Refresh Behavior

#### Test: Auto-refresh while panel is open

```typescript
test("Updates prices without losing selection", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Select a contract
  await page.click('[data-testid="strike-row-500"]');
  const initialPrice = await page
    .locator('[data-testid="strike-row-500"] [data-column="last"]')
    .textContent();

  // Wait for refresh cycle (15s or configured interval)
  await page.waitForTimeout(16000);

  // Price may have changed
  const updatedPrice = await page
    .locator('[data-testid="strike-row-500"] [data-column="last"]')
    .textContent();

  // Selection still maintained
  await expect(page.locator('[data-testid="strike-row-500"]')).toHaveClass(
    /selected/
  );

  // Scroll position not reset
  // (validate viewport hasn't jumped)
});
```

#### Test: Pause refresh when panel hidden

```typescript
test("Stops refreshing when chain closed", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  let requestCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/options/chain")) requestCount++;
  });

  await page.waitForTimeout(2000);
  const openRequestCount = requestCount;

  // Close chain
  await page.click('[data-testid="close-options-chain"]');

  // Wait refresh interval
  await page.waitForTimeout(16000);

  // No new requests while closed
  expect(requestCount).toBe(openRequestCount);

  // Re-open triggers fresh fetch
  await page.click('[data-testid="watchlist-item-SPY"]');
  await page.waitForTimeout(2000);
  expect(requestCount).toBeGreaterThan(openRequestCount);
});
```

### 5.3 Rate-Limit / Error Handling

#### Test: Massive rate-limited (429/502)

```typescript
test("Shows rate limit message gracefully", async ({ page }) => {
  await login(page);

  // Mock 429 response
  await page.route("**/api/options/chain*", (route) => {
    route.fulfill({
      status: 429,
      body: JSON.stringify({ error: "Rate limit exceeded" }),
    });
  });

  await page.click('[data-testid="watchlist-item-SPY"]');

  // Friendly error message
  await expect(page.locator("text=/rate limit/i")).toBeVisible();

  // No spinner stuck
  await expect(
    page.locator('[data-testid="loading-spinner"]')
  ).not.toBeVisible();

  // No React errors
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.waitForTimeout(2000);
  expect(consoleErrors.filter((e) => e.includes("React"))).toHaveLength(0);
});
```

#### Test: Network failure

```typescript
test("Handles network error with retry option", async ({ page }) => {
  await login(page);

  // Simulate network offline
  await page.context().setOffline(true);

  await page.click('[data-testid="watchlist-item-SPY"]');

  // Error message shown
  await expect(page.locator("text=/network error/i")).toBeVisible();

  // Retry button present
  const retryButton = page.locator('button:has-text("Retry")');
  await expect(retryButton).toBeVisible();

  // Re-enable network
  await page.context().setOffline(false);

  // Click retry
  await retryButton.click();

  // Chain loads successfully
  await expect(
    page.locator('[data-testid="options-chain-panel"]')
  ).toBeVisible();
});
```

---

## 6. Interactions Within the Chain

### 6.1 Selecting a Contract

#### Test: Click contract to focus it

```typescript
test("Selects contract and shows detail panel", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Click contract row
  await page.click('[data-testid="strike-row-600"]');

  // Row gains selected styling
  await expect(page.locator('[data-testid="strike-row-600"]')).toHaveClass(
    /selected/
  );

  // Detail panel appears
  await expect(
    page.locator('[data-testid="contract-detail-panel"]')
  ).toBeVisible();

  // Detail shows full ticker
  await expect(
    page.locator('[data-testid="selected-contract-ticker"]')
  ).toContainText("SPY");
  await expect(
    page.locator('[data-testid="selected-contract-ticker"]')
  ).toContainText("600");

  // Greeks shown
  await expect(page.locator('[data-testid="detail-delta"]')).toBeVisible();
  await expect(page.locator('[data-testid="detail-theta"]')).toBeVisible();

  // Risk metrics
  await expect(page.locator('[data-testid="detail-spread"]')).not.toHaveText(
    "$0.00"
  );
});
```

#### Test: Deselect contract

```typescript
test("Clears selection when clicking selected row again", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Select
  await page.click('[data-testid="strike-row-600"]');
  await expect(page.locator('[data-testid="strike-row-600"]')).toHaveClass(
    /selected/
  );

  // Click again to deselect
  await page.click('[data-testid="strike-row-600"]');
  await expect(page.locator('[data-testid="strike-row-600"]')).not.toHaveClass(
    /selected/
  );

  // Detail panel hidden or shows neutral state
  await expect(
    page.locator('[data-testid="contract-detail-panel"]')
  ).toContainText(/Select a contract/i);
});
```

### 6.2 Opening Trade Flow from Chain

#### Test: Open "Enter Trade" from selected contract

```typescript
test("Pre-fills trade composer with selected contract", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Select contract
  await page.click('[data-testid="strike-row-600"]');

  // Click "Trade this"
  await page.click('[data-testid="trade-from-contract-button"]');

  // Trade composer opens
  await expect(page.locator('[data-testid="trade-composer"]')).toBeVisible();

  // Pre-filled with contract details
  await expect(page.locator('[data-testid="composer-underlying"]')).toHaveValue(
    "SPY"
  );
  await expect(page.locator('[data-testid="composer-strike"]')).toHaveValue(
    "600"
  );
  await expect(page.locator('[data-testid="composer-direction"]')).toHaveValue(
    "BTO"
  ); // Buy to open

  // User can adjust quantity, stop, targets
  await page.fill('[data-testid="composer-quantity"]', "2");
  await page.fill('[data-testid="composer-stop"]', "5.50");
});
```

#### Test: Open "Create Alert" from selected contract

```typescript
test("Creates alert for selected contract", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');
  await page.click('[data-testid="strike-row-600"]');

  // Click "Alert on this"
  await page.click('[data-testid="alert-from-contract-button"]');

  // Alert composer opens
  await expect(page.locator('[data-testid="alert-composer"]')).toBeVisible();

  // Pre-filled with contract ticker
  const contractTicker = await page
    .locator('[data-testid="selected-contract-ticker"]')
    .textContent();
  await expect(
    page.locator('[data-testid="alert-contract-input"]')
  ).toHaveValue(contractTicker);

  // Default condition
  await expect(page.locator('[data-testid="alert-condition"]')).toContainText(
    /price|delta/i
  );
});
```

---

## 7. Cross-Component Trade Scenarios

### 7.1 Chain Reacts to Trade Changes

#### Test: Selected contract becomes active trade

```typescript
test("Highlights contract when trade entered", async ({ page }) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');
  await page.click('[data-testid="strike-row-600"]');

  // Enter trade
  await page.click('[data-testid="trade-from-contract-button"]');
  await page.fill('[data-testid="composer-quantity"]', "1");
  await page.click('[data-testid="composer-submit"]');

  // Trade appears in list
  await expect(page.locator('[data-testid="active-trades"]')).toContainText(
    "SPY"
  );

  // Chain shows "in position" marker
  await expect(
    page.locator(
      '[data-testid="strike-row-600"] [data-testid="position-badge"]'
    )
  ).toBeVisible();

  // Now Playing aware of contract
  await expect(page.locator('[data-testid="now-playing"]')).toContainText(
    "600"
  );
});
```

#### Test: Close trade from elsewhere while chain open

```typescript
test("Updates chain when trade closed externally", async ({ page }) => {
  await login(page);

  // Create trade first
  await createTestTrade(page, { underlying: "SPY", strike: 600 });

  // Open chain
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Verify position badge visible
  await expect(
    page.locator(
      '[data-testid="strike-row-600"] [data-testid="position-badge"]'
    )
  ).toBeVisible();

  // Close trade from Now Playing
  await page.click('[data-testid="now-playing-close-button"]');

  // Badge should disappear
  await expect(
    page.locator(
      '[data-testid="strike-row-600"] [data-testid="position-badge"]'
    )
  ).not.toBeVisible();

  // Contract still selectable for new trade
  await page.click('[data-testid="strike-row-600"]');
  await expect(
    page.locator('[data-testid="trade-from-contract-button"]')
  ).toBeEnabled();
});
```

---

## 8. Edge Cases, Layout & Device

### Test: Very wide chain / many columns

```typescript
test("Handles horizontal scroll on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Verify horizontal scroll works
  const chainGrid = page.locator('[data-testid="options-chain-grid"]');
  const isScrollable = await chainGrid.evaluate(
    (el) => el.scrollWidth > el.clientWidth
  );

  if (isScrollable) {
    // Headers should be fixed
    const headerRow = page.locator('[data-testid="chain-header-row"]');
    const initialHeaderPosition = await headerRow.boundingBox();

    // Scroll horizontally
    await chainGrid.evaluate((el) => (el.scrollLeft = 200));

    // Header position unchanged (fixed)
    const scrolledHeaderPosition = await headerRow.boundingBox();
    expect(scrolledHeaderPosition.y).toBe(initialHeaderPosition.y);
  }
});

test("Shows reduced columns on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  // Verify fewer columns visible
  const visibleColumns = await page
    .locator('[data-testid="chain-header-row"] [data-column]')
    .count();
  expect(visibleColumns).toBeLessThan(8); // Desktop shows ~12

  // Tap for details pattern
  await page.click('[data-testid="strike-row-600"]');
  await expect(
    page.locator('[data-testid="contract-detail-sheet"]')
  ).toBeVisible(); // Bottom sheet
});
```

### Test: Symbol with extremely high price

```typescript
test("Handles high-priced underlying and wide strikes", async ({ page }) => {
  await login(page);

  // Mock high-price symbol (e.g., SPX at 6700+)
  await mockHighPriceSymbol(page, "SPX", 6700);

  await page.click('[data-testid="watchlist-item-SPX"]');

  // ATM detection still accurate
  const atmStrike = parseFloat(
    await page.locator('[data-testid="atm-strike"]').textContent()
  );
  expect(atmStrike).toBeCloseTo(6700, -2); // Within ~50 points

  // 10 ITM / 10 OTM logic correct
  const itmCount = await page
    .locator('[data-testid^="strike-row-"][data-moneyness="itm"]')
    .count();
  expect(itmCount).toBeLessThanOrEqual(10);
});
```

### Test: Rapid underlying move (ATM jumps)

```typescript
test("Updates ATM when underlying price moves significantly", async ({
  page,
}) => {
  await login(page);
  await page.click('[data-testid="watchlist-item-SPY"]');

  const initialAtm = await page
    .locator('[data-testid="atm-strike"]')
    .textContent();

  // Simulate large price move (mock WebSocket update)
  await mockPriceUpdate(page, "SPY", +10); // +$10 move

  // Wait for re-render
  await page.waitForTimeout(2000);

  const updatedAtm = await page
    .locator('[data-testid="atm-strike"]')
    .textContent();

  // ATM should shift
  expect(updatedAtm).not.toBe(initialAtm);

  // ITM/OTM slices re-evaluated
  // Selection remains usable (no jump off-screen)
  await page.click('[data-testid="strike-row-600"]');
  await expect(page.locator('[data-testid="strike-row-600"]')).toBeVisible();
});
```

---

## Test Helpers & Utilities

```typescript
// e2e/helpers/options-chain.ts

export async function ensureSymbolOnWatchlist(page: Page, symbol: string) {
  // Check if symbol exists, add if not
  const exists = await page
    .locator(`[data-testid="watchlist-item-${symbol}"]`)
    .isVisible();
  if (!exists) {
    await page.click('[data-testid="add-ticker-button"]');
    await page.fill('[data-testid="symbol-input"]', symbol);
    await page.click('[data-testid="add-ticker-submit"]');
    await page.waitForSelector(`[data-testid="watchlist-item-${symbol}"]`);
  }
}

export async function createTestTrade(
  page: Page,
  opts: {
    underlying: string;
    contractTicker?: string;
    expiration: string;
    strike: number;
    type?: "call" | "put";
  }
) {
  // Helper to create a trade via API or UI for test setup
  // ...
}

export async function mockUnderlyingPrice(page: Page, price: number) {
  // Mock underlying price for specific test scenarios
  await page.route("**/api/massive/v3/snapshot/**", (route) => {
    const response = route.request().url().includes("stocks")
      ? { results: [{ day: { c: price }, last_quote: { p: price } }] }
      : { results: [{ value: price }] };
    route.fulfill({ status: 200, body: JSON.stringify(response) });
  });
}

export async function mockNarrowChain(page: Page, strikeCount: number) {
  // Mock a chain with limited strikes for edge case testing
  // ...
}
```

---

## Execution Plan

### Phase 1: Critical Paths (P0)

- Entry points (1.1, 1.2)
- Expiration loading & defaults (2.1, 2.2)
- ATM detection & strike distribution (3.1, 3.2)
- Contract selection basics (6.1)

### Phase 2: Core Interactions (P1)

- Calls/Puts toggle (4.1)
- Trade integration (6.2, 7.1)
- Data refresh (5.2)
- Error handling (5.3)

### Phase 3: Edge Cases & Polish (P2)

- Layout & responsive (8)
- Narrow chains, tie cases (3.2, 3.1)
- Rapid price moves (8)
- Advanced filtering (6.3)

### CI Integration

```yaml
# .github/workflows/e2e-options-chain.yml
name: Options Chain E2E
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:e2e e2e/options-chain/
```

---

## Success Criteria

✅ **100% of P0 tests passing** (entry, expiration, ATM, selection)  
✅ **95%+ of P1 tests passing** (interactions, refresh, errors)  
✅ **Zero console errors** during normal flows  
✅ **Mobile & desktop layouts** validated  
✅ **Rate limit & network errors** handled gracefully  
✅ **Trade integration** end-to-end (chain → trade → Now Playing)

---

**Next Steps**: Implement priority tests in `e2e/options-chain/01-entry-points.spec.ts` and validate against live dev environment.
