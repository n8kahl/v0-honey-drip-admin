# E2E Tests with Playwright

End-to-end tests for the Honey Drip Admin Trading Dashboard using Playwright.

## Test Suites

### 1. Trade Discovery & Loading (`trade-discovery.spec.ts`)

Tests the complete flow from watchlist/setup detection → loaded trade → "Now Playing" panel.

**Test Scenarios:**

- **2.1 Setup / Signal Detection**

  - 2.1.1 New setup detected for watched symbol
  - 2.1.2 Setup detection for symbol NOT on watchlist

- **2.2 Load Trade / Contract from Setup**

  - 2.2.1 Load trade from setup card (happy path)
  - 2.2.2 Load trade while another is already loaded
  - 2.2.3 Load trade when market closed (weekend)
  - 2.2.4 Unload / dismiss loaded trade

- **2.3 Additional Edge Cases**
  - 2.3.1 Rapid symbol switching
  - 2.3.2 Load trade with no options chain available

## Prerequisites

1. **Environment Variables**

   Create a `.env.test` file or set environment variables:

   ```bash
   TEST_USER_EMAIL=test@example.com
   TEST_USER_PASSWORD=testpassword123
   ```

2. **Supabase Setup**

   Ensure your test database is seeded with a test user account.

3. **Dev Server**

   The tests will automatically start the dev server via Playwright's `webServer` config.

## Running Tests

```bash
# Run all e2e tests (headless)
pnpm test:e2e

# Run with UI (interactive mode)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Debug mode (step through tests)
pnpm test:e2e:debug

# Run specific test file
pnpm playwright test e2e/trade-discovery.spec.ts

# Run specific test by name
pnpm playwright test -g "Load trade from setup card"
```

## Test Results

- **HTML Report**: Generated in `playwright-report/` after each run
- **Screenshots**: Saved to `test-results/screenshots/` on failure or via `takeScreenshot()`
- **Traces**: Available for failed tests in `test-results/`

View report:

```bash
pnpm exec playwright show-report
```

## Helper Functions

Located in `e2e/helpers.ts`:

- `login(page, options?)` - Authenticate user
- `addTickerToWatchlist(page, symbol)` - Add ticker to watchlist
- `removeTickerFromWatchlist(page, symbol)` - Remove ticker
- `clickTicker(page, symbol)` - Click ticker in watchlist
- `isTradeLoaded(page, symbol)` - Check if trade is loaded
- `dismissLoadedTrade(page)` - Dismiss loaded trade
- `waitForChart(page)` - Wait for chart to load
- `isMarketClosed()` - Check market hours
- `takeScreenshot(page, name)` - Save screenshot
- `logTestError(testName, error)` - Log detailed error

## Test Strategy

1. **Setup Phase**: Login, add tickers to watchlist
2. **Action Phase**: Click ticker, load contract, interact with UI
3. **Verification Phase**: Assert expected state, check visibility, verify data
4. **Cleanup Phase**: Remove test data (future enhancement)

## Known Limitations

- WebSocket signal injection requires backend mock or integration
- Some tests log warnings for manual verification
- Market hours detection is simplified (doesn't account for holidays)
- Auth bypass may be needed for CI/CD environments

## Debugging Tips

1. **Use headed mode** to see what's happening:

   ```bash
   pnpm test:e2e:headed
   ```

2. **Debug specific test**:

   ```bash
   pnpm test:e2e:debug -g "your test name"
   ```

3. **Check screenshots** in `test-results/screenshots/`

4. **View traces** for failed tests:

   ```bash
   pnpm exec playwright show-trace test-results/.../trace.zip
   ```

5. **Add more logging** in tests with `console.log`

## CI/CD Integration

Add to GitHub Actions or similar:

```yaml
- name: Install Playwright Browsers
  run: pnpm exec playwright install --with-deps chromium

- name: Run E2E Tests
  run: pnpm test:e2e
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Future Enhancements

- [ ] Mock WebSocket setup signals for isolated testing
- [ ] Add test data cleanup between runs
- [ ] Test discord alert sending flows
- [ ] Test chart interaction and annotation
- [ ] Performance testing with Lighthouse
- [ ] Visual regression testing
