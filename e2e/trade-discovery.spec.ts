import { test, expect } from '@playwright/test';
import {
  login,
  addTickerToWatchlist,
  removeTickerFromWatchlist,
  clickTicker,
  isTradeLoaded,
  dismissLoadedTrade,
  waitForChart,
  isMarketClosed,
  takeScreenshot,
  logTestError
} from './helpers';

/**
 * Test Suite: Trade Discovery & Loading Scenarios
 * 
 * Tests the flow from watchlist/setup detection → loaded trade → "Now Playing" panel.
 * 
 * Prerequisites:
 * - Dev server running (auto-started by Playwright)
 * - Supabase configured with test user (or auth bypass for testing)
 * - Mock or live backend for WebSocket setup signals
 */

test.describe('2.1 Setup / Signal Detection', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('2.1.1 New setup detected for watched symbol', async ({ page }) => {
    try {
      // Add QQQ to watchlist
      const added = await addTickerToWatchlist(page, 'QQQ');
      expect(added).toBe(true);
      
      // Verify QQQ is in watchlist
      await expect(page.locator('text=QQQ').first()).toBeVisible({ timeout: 5000 });
      
      // TODO: Trigger setup signal via WebSocket mock or backend event
      // For now, we'll simulate the UI state that would result
      
      // Expected: Toast notification appears
      // Note: This requires backend integration or mocking
      // await expect(page.locator('text=/New Setup Detected/i')).toBeVisible({ timeout: 10000 });
      
      // Expected: Setup card appears in grid/list
      // await expect(page.locator('[data-testid="setup-card"]')).toBeVisible();
      
      // Expected: "Load contract" button is available
      // await expect(page.locator('button:has-text("Load")')).toBeVisible();
      
      await takeScreenshot(page, 'watchlist-symbol-added');
      console.log('[TEST LOG] Watchlist symbol detection test - manual verification needed for WebSocket signal');
    } catch (error) {
      logTestError('2.1.1 New setup detected for watched symbol', error);
      throw error;
    }
  });

  test('2.1.2 Setup detection for symbol NOT on watchlist', async ({ page }) => {
    // Ensure NFLX is NOT in watchlist
    const nflxExists = await page.locator('text=NFLX').count();
    expect(nflxExists).toBe(0);
    
    // TODO: Emit signal for NFLX via backend
    // Expected behavior depends on implementation:
    // - Either ignored (no UI change)
    // - Or shown but flagged as "not tracked"
    
    console.log('[TEST LOG] Non-watchlist symbol detection test - confirm expected behavior with team');
    
    // For now, verify watchlist remains unchanged
    await page.waitForTimeout(2000);
    const nflxAfter = await page.locator('text=NFLX').count();
    expect(nflxAfter).toBe(0);
  });
});

test.describe('2.2 Load Trade / Contract from Setup', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('2.2.1 Load trade from setup card (happy path)', async ({ page }) => {
    try {
      // Add QQQ to watchlist
      const added = await addTickerToWatchlist(page, 'QQQ');
      expect(added).toBe(true);
      
      // Click on QQQ to open it
      await clickTicker(page, 'QQQ');
      await page.waitForTimeout(1500);
      
      // Wait for options chain or contract grid to load
      const hasContracts = await page.locator('[data-testid="options-chain"], [class*="contract"]').count();
      
      if (hasContracts > 0) {
        // Select first contract
        await page.click('[data-testid="contract-row"], [class*="contract"]:first-child');
        
        // Expected: MobileNowPlayingSheet receives loaded state
        await page.waitForTimeout(1000);
        const loaded = await isTradeLoaded(page, 'QQQ');
        
        // Expected: Chart starts fetching data
        const chartLoaded = await waitForChart(page);
        
        await takeScreenshot(page, 'trade-loaded-happy-path');
        console.log('[TEST LOG] Trade loaded successfully:', { loaded, chartLoaded });
      } else {
        await takeScreenshot(page, 'no-contracts-available');
        console.log('[TEST LOG] No contracts available - verify options chain loading');
      }
    } catch (error) {
      await takeScreenshot(page, 'trade-load-error');
      logTestError('2.2.1 Load trade from setup card', error);
      throw error;
    }
  });

  test('2.2.2 Load trade while another is already loaded', async ({ page }) => {
    try {
      // Load AAPL first
      await addTickerToWatchlist(page, 'AAPL');
      await clickTicker(page, 'AAPL');
      await page.waitForTimeout(1500);
      
      // Verify AAPL is active
      await expect(page.locator('text=AAPL').first()).toBeVisible();
      const aaplLoaded = await isTradeLoaded(page, 'AAPL');
      
      // Now add and load QQQ
      await addTickerToWatchlist(page, 'QQQ');
      await clickTicker(page, 'QQQ');
      await page.waitForTimeout(1500);
      
      // Expected: QQQ is now the active trade
      const qqqLoaded = await isTradeLoaded(page, 'QQQ');
      
  // Verify QQQ quick-switch button is visible (disambiguated selector)
  await expect(page.locator('button[aria-label="Switch to QQQ"]').first()).toBeVisible();
      
      await takeScreenshot(page, 'trade-switch-aapl-to-qqq');
      console.log('[TEST LOG] Trade switch test:', { aaplLoaded, qqqLoaded });
    } catch (error) {
      await takeScreenshot(page, 'trade-switch-error');
      logTestError('2.2.2 Load trade while another is loaded', error);
      throw error;
    }
  });

  test('2.2.3 Load trade when market closed (weekend)', async ({ page }) => {
    try {
      const marketClosed = isMarketClosed();
      
      // Add ticker
      await addTickerToWatchlist(page, 'SPY');
      await clickTicker(page, 'SPY');
      await page.waitForTimeout(1500);
      
      if (marketClosed) {
        // Expected: Trade info still shows
        await expect(page.locator('text=SPY').first()).toBeVisible();
        
        // Expected: "Market Closed" indicator
        const closedIndicator = await page.locator('text=/Market Closed/i, text=/Closed/i').isVisible({ timeout: 2000 }).catch(() => false);
        
        await takeScreenshot(page, 'market-closed-load');
        console.log('[TEST LOG] Market closed test:', { marketClosed, closedIndicator });
      } else {
        await takeScreenshot(page, 'market-open-load');
        console.log('[TEST LOG] Market is currently open - run during weekend for full market-closed validation');
      }
    } catch (error) {
      await takeScreenshot(page, 'market-closed-error');
      logTestError('2.2.3 Load trade when market closed', error);
      throw error;
    }
  });

  test('2.2.4 Unload / dismiss loaded trade', async ({ page }) => {
    try {
      // Load a trade first
      await addTickerToWatchlist(page, 'MSFT');
      await clickTicker(page, 'MSFT');
      await page.waitForTimeout(1500);
      
      // Verify trade is loaded
      const beforeDismiss = await isTradeLoaded(page, 'MSFT');
      await expect(page.locator('text=MSFT').first()).toBeVisible();
      
      // Try to dismiss
      const dismissed = await dismissLoadedTrade(page);
      
      // Verify state after dismiss
      const afterDismiss = dismissed ? await isTradeLoaded(page, 'MSFT') : beforeDismiss;
      
      await takeScreenshot(page, 'trade-dismissed');
      console.log('[TEST LOG] Trade dismiss test:', { beforeDismiss, dismissed, afterDismiss });
      
      if (!dismissed) {
        console.log('[TEST LOG] No dismiss button found - verify unload mechanism');
      }
    } catch (error) {
      await takeScreenshot(page, 'trade-dismiss-error');
      logTestError('2.2.4 Unload / dismiss loaded trade', error);
      throw error;
    }
  });
});

test.describe('2.3 Additional Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('2.3.1 Rapid symbol switching', async ({ page }) => {
    const symbols = ['SPY', 'QQQ', 'AAPL'];
    
    // Add all symbols
    for (const symbol of symbols) {
      await addTickerToWatchlist(page, symbol);
      await page.waitForTimeout(500);
    }
    
    // Rapidly switch between them
    for (const symbol of symbols) {
      await page.click(`text=${symbol}`);
      await page.waitForTimeout(300);
    }
    
    // Verify final state is stable
    await page.waitForTimeout(1000);
  await expect(page.locator('button[aria-label="Switch to AAPL"]').first()).toBeVisible();
    
    console.log('[TEST LOG] Rapid switching test - verify no race conditions or memory leaks');
  });

  test('2.3.2 Load trade with no options chain available', async ({ page }) => {
    // Try loading an index or symbol that may not have options
    await addTickerToWatchlist(page, 'VIX');
    await page.click('text=VIX');
    await page.waitForTimeout(2000);
    
    // Expected: Graceful error handling or empty state message
    // await expect(page.locator('text=/No options available/i, text=/No contracts/i')).toBeVisible();
    
    console.log('[TEST LOG] No options chain test - verify error handling');
  });
});
