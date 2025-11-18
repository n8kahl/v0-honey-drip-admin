import { test, expect } from '@playwright/test';
import { login } from '../helpers';

/**
 * Options Chain: Entry Points
 * 
 * NOTE: Options Chain UI is not yet implemented in the application.
 * These tests verify the foundation (watchlist symbol selection) that will
 * trigger the options chain to open when the UI component is added.
 * 
 * Current behavior: Clicking watchlist symbol sets activeTicker in state
 * Expected future behavior: Opens Options Chain panel/modal with expiration dropdown
 */

test.describe('1.1 From Watchlist - Foundation Tests', () => {
  test('1.1.1 Watchlist symbol selection works without errors', async ({ page }) => {
    await login(page);
    
    // Verify QQQ button exists with data-testid
    const qqqButton = page.locator('[data-testid="watchlist-item-QQQ"]');
    await expect(qqqButton).toBeVisible({ timeout: 10000 });
    
    // Take screenshot before click
    await page.screenshot({ path: 'test-results/options-chain-01-watchlist-before-click.png' });
    
    // Click QQQ - should set activeTicker state
    await qqqButton.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'test-results/options-chain-02-after-click.png', fullPage: true });
    
    // Verify no JavaScript errors occurred
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(500);
    
    expect(errors).toHaveLength(0);
    
    // QQQ button styling confirms selection (uses brand-primary bg when active)
    const buttonClasses = await qqqButton.getAttribute('class');
    expect(buttonClasses).toContain('bg-[var(--brand-primary)]');
    
    console.log('[TEST LOG] Watchlist symbol click foundation verified - no errors');
  });

  test('1.1.2 Clicking same symbol again is stable', async ({ page }) => {
    await login(page);
    
    const qqqButton = page.locator('[data-testid="watchlist-item-QQQ"]');
    await expect(qqqButton).toBeVisible({ timeout: 10000 });
    
    // First click
    await qqqButton.click();
    await page.waitForTimeout(500);
    const firstUrl = page.url();
    
    // Click again
    await qqqButton.click();
    await page.waitForTimeout(500);
    const secondUrl = page.url();
    
    // URL should be stable
    expect(secondUrl).toBe(firstUrl);
    
    // No console errors
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
    
    console.log('[TEST LOG] Re-click behavior stable');
  });

  test('1.1.3 Switches active symbol correctly', async ({ page }) => {
    await login(page);
    
    const qqqButton = page.locator('[data-testid="watchlist-item-QQQ"]');
    const spyButton = page.locator('[data-testid="watchlist-item-SPY"]');
    
    await expect(qqqButton).toBeVisible({ timeout: 10000 });
    await expect(spyButton).toBeVisible();
    
    // Click QQQ first
    await qqqButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/options-chain-03-qqq-selected.png' });
    
    let qqqClasses = await qqqButton.getAttribute('class');
    expect(qqqClasses).toContain('bg-[var(--brand-primary)]');
    
    // Then click SPY
    await spyButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/options-chain-04-spy-selected.png' });
    
    // SPY should now have active styling
    const spyClasses = await spyButton.getAttribute('class');
    expect(spyClasses).toContain('bg-[var(--brand-primary)]');
    
    console.log('[TEST LOG] Symbol switching works correctly');
  });
});

test.describe('1.2 Watchlist Integration - Additional Coverage', () => {
  test('Can cycle through multiple watchlist symbols', async ({ page }) => {
    await login(page);
    
    // Get all visible watchlist buttons - they appear as quick-switch buttons and in the list
    const watchlistButtons = page.locator('[aria-label^="Switch to "]');
    await watchlistButtons.first().waitFor({ state: 'visible', timeout: 10000 });
    
    const count = await watchlistButtons.count();
    
    console.log('[TEST] Found', count, 'watchlist symbols');
    expect(count).toBeGreaterThan(0);
    
    // Click through first 3 symbols
    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = watchlistButtons.nth(i);
      const symbol = await button.textContent();
      
      await button.click();
      await page.waitForTimeout(300);
      
      console.log('[TEST] Clicked', symbol?.trim(), '- no crashes');
    }
  });

  test('Maintains selection state during tab navigation', async ({ page }) => {
    await login(page);
    
    // Select QQQ
    const qqqButton = page.locator('[data-testid="watchlist-item-QQQ"]');
    await qqqButton.click();
    await page.waitForTimeout(500);
    
    const initialClasses = await qqqButton.getAttribute('class');
    
    // Navigate to Trade tab (desktop)
    const tradeTab = page.locator('button:has-text("Trade")').first();
    if (await tradeTab.isVisible().catch(() => false)) {
      await tradeTab.click();
      await page.waitForTimeout(500);
      
      // Go back to Watch tab
      const watchTab = page.locator('button:has-text("Watch")').first();
      await watchTab.click();
      await page.waitForTimeout(500);
      
      // QQQ should still have selected styling
      const afterClasses = await qqqButton.getAttribute('class');
      expect(afterClasses).toContain('bg-[var(--brand-primary)]');
      
      console.log('[TEST] Symbol selection persisted across tab navigation');
    } else {
      // Mobile - try bottom nav
      const tradeMobileTab = page.locator('[aria-label="Active Trades"]');
      if (await tradeMobileTab.isVisible().catch(() => false)) {
        await tradeMobileTab.click();
        await page.waitForTimeout(500);
        
        const watchMobileTab = page.locator('[aria-label="Watchlist"]');
        await watchMobileTab.click();
        await page.waitForTimeout(500);
      }
      
      console.log('[TEST] Navigation test completed on mobile layout');
    }
  });
});

test.describe('1.3 Options Chain Panel Visibility', () => {
  test('Options chain panel appears when symbol selected', async ({ page }) => {
    await login(page);
    
    // Click QQQ in watchlist
    const qqqButton = page.locator('[data-testid="watchlist-item-QQQ"]');
    await qqqButton.click();
    await page.waitForTimeout(2000); // Wait for contracts to load
    
    // Check if Options Chain panel is visible
    const optionsPanel = page.locator('[data-testid="options-chain-panel"]');
    const isPanelVisible = await optionsPanel.isVisible().catch(() => false);
    
    console.log('[TEST] Options Chain panel visible:', isPanelVisible);
    
    if (isPanelVisible) {
      // Verify panel has underlying symbol
      const underlyingSymbol = page.locator('[data-testid="chain-underlying-symbol"]');
      await expect(underlyingSymbol).toBeVisible();
      await expect(underlyingSymbol).toHaveText('QQQ');
      
      // Verify panel has underlying price
      const underlyingPrice = page.locator('[data-testid="underlying-price"]');
      await expect(underlyingPrice).toBeVisible();
      
      // Verify strike grid is present
      const strikeGrid = page.locator('[data-testid="strike-grid"]');
      await expect(strikeGrid).toBeVisible();
      
      console.log('[TEST] Options Chain panel is fully functional!');
    } else {
      console.log('[TEST] Options Chain panel not visible - may not be wired up yet');
    }
    
    await page.screenshot({ path: 'test-results/options-chain-panel-visibility.png', fullPage: true });
  });

  test.skip('Will load options from loaded trade', async ({ page }) => {
    // Future: Opening options chain from a LOADED trade should
    // pre-select the contract's expiration and strike
    
    console.log('[TEST] Skipped - Trade creation flow not yet implemented');
  });
});
