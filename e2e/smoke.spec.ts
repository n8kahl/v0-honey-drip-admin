import { test, expect } from '@playwright/test';

/**
 * Smoke tests to verify basic app loading and auth
 */

test.describe('App Smoke Tests', () => {
  test('01 - App loads without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/01-app-loads.png', fullPage: true });
    
    // Get page title
    const title = await page.title();
    console.log('[TEST] Page title:', title);
    
    // Get all visible text
    const bodyText = await page.locator('body').textContent();
    console.log('[TEST] Body text preview:', bodyText?.substring(0, 200));
    
    // Check for common elements
    const hasHeader = await page.locator('header').isVisible().catch(() => false);
    const hasMain = await page.locator('main').isVisible().catch(() => false);
    const hasNav = await page.locator('nav').isVisible().catch(() => false);
    
    console.log('[TEST] Element visibility:', { hasHeader, hasMain, hasNav });
    
    // The app should at least load something
    expect(title).toBeTruthy();
  });

  test('02 - Can find watchlist or auth form', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/02-page-state.png', fullPage: true });
    
    // Look for either watchlist or auth
    const watchlistVisible = await page.locator('text=WATCHLIST, text=Watchlist, [class*="watchlist"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    const authFormVisible = await page.locator('input[type="email"], input[type="password"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    const headerVisible = await page.locator('header').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log('[TEST] Page state:', {
      watchlistVisible,
      authFormVisible,
      headerVisible,
      url: page.url()
    });
    
    // We should find at least one of these
    expect(watchlistVisible || authFormVisible || headerVisible).toBe(true);
  });

  test('03 - Check for error messages or loading states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: 'test-results/03-error-check.png', fullPage: true });
    
    // Check for common error indicators
    const hasError = await page.locator('text=/error/i, text=/failed/i, [class*="error"]').first().isVisible({ timeout: 1000 }).catch(() => false);
    const hasLoading = await page.locator('text=/loading/i, [class*="loading"]').first().isVisible({ timeout: 1000 }).catch(() => false);
    
    console.log('[TEST] Error/Loading states:', { hasError, hasLoading });
    
    // Log any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[BROWSER ERROR]', msg.text());
      }
    });
    
    // Log network errors
    page.on('requestfailed', request => {
      console.log('[NETWORK ERROR]', request.url(), request.failure()?.errorText);
    });
    
    await page.waitForTimeout(2000);
  });
});
