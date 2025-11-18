import { test, expect, type Page } from '@playwright/test';

/**
 * Helper functions for Playwright e2e tests
 */

/**
 * Login helper - authenticates user and waits for app to load
 */
export async function login(page: Page, options?: {
  email?: string;
  password?: string;
  skipAuth?: boolean;
}) {
  const email = options?.email || process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = options?.password || process.env.TEST_USER_PASSWORD || 'testpassword123';
  
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  if (options?.skipAuth) {
    // For testing without auth, just wait for app
    await page.waitForLoadState('networkidle');
    return;
  }
  
  // Wait a bit for initial render
  await page.waitForTimeout(1000);
  
  // Check if already logged in by looking for app elements
  const appElements = [
    'header',
    '[data-testid="watchlist-panel"]',
    '.watchlist',
    '[class*="HDHeader"]',
    'text=WATCHLIST',
    'text=Watch',
  ];
  
  for (const selector of appElements) {
    const exists = await page.locator(selector).first().isVisible({ timeout: 1000 }).catch(() => false);
    if (exists) {
      console.log('[TEST] Already logged in - found', selector);
      return;
    }
  }
  
  // Look for auth form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const hasEmailInput = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (hasEmailInput) {
    console.log('[TEST] Auth form found, logging in...');
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
    
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitButton.click();
    
    // Wait for login to complete - check for any app element
    const loginSuccess = await Promise.race([
      page.waitForSelector('header', { timeout: 15000, state: 'visible' }).then(() => true),
      page.waitForSelector('[data-testid="watchlist-panel"]', { timeout: 15000, state: 'visible' }).then(() => true),
      page.waitForSelector('.watchlist', { timeout: 15000, state: 'visible' }).then(() => true),
      page.locator('text=WATCHLIST').first().waitFor({ timeout: 15000, state: 'visible' }).then(() => true),
    ]).catch(() => false);
    
    if (loginSuccess) {
      console.log('[TEST] Login successful');
    } else {
      console.log('[TEST] Login may have failed - no app elements detected');
      await page.screenshot({ path: 'test-results/login-failed.png' });
    }
  } else {
    console.log('[TEST] No auth form found, checking page state...');
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/login-debug.png' });
    
    // Try to wait for any app indicator
    await page.waitForTimeout(2000);
  }
}

/**
 * Add a ticker to the watchlist
 */
export async function addTickerToWatchlist(page: Page, symbol: string): Promise<boolean> {
  try {
    // Look for add button
    const addButton = page.locator('button[aria-label="Add ticker"], button:has-text("+")').first();
    await addButton.click({ timeout: 5000 });
    
    // Wait for dialog
    await page.waitForTimeout(300);
    
    // Fill in symbol
    const symbolInput = page.locator('input[placeholder*="SPX"], input[placeholder*="symbol"], input#symbol, input[name="symbol"]');
    await symbolInput.fill(symbol);
    
    // Submit
    const submitButton = page.locator('button:has-text("Add Ticker"), button[type="submit"]').last();
    await submitButton.click();
    
    // Wait for success toast or ticker to appear
    await page.waitForTimeout(1000);
    
    // Verify ticker was added
    const tickerVisible = await page.locator(`text=${symbol}`).first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (tickerVisible) {
      console.log(`[TEST] Successfully added ${symbol} to watchlist`);
      return true;
    } else {
      console.log(`[TEST] Failed to add ${symbol} - not visible after adding`);
      return false;
    }
  } catch (error) {
    console.error(`[TEST] Error adding ${symbol}:`, error);
    return false;
  }
}

/**
 * Remove a ticker from the watchlist
 */
export async function removeTickerFromWatchlist(page: Page, symbol: string): Promise<boolean> {
  try {
    // Hover over ticker to reveal remove button
    const tickerRow = page.locator(`text=${symbol}`).first();
    await tickerRow.hover();
    
    // Click remove button (X icon)
    const removeButton = tickerRow.locator('..').locator('button[title*="Remove"], button:has(svg)').last();
    await removeButton.click({ timeout: 2000 });
    
    // Confirm if dialog appears
    const confirmButton = page.locator('button:has-text("Remove"), button:has-text("Confirm"), button:has-text("Delete")');
    const hasConfirm = await confirmButton.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (hasConfirm) {
      await confirmButton.click();
    }
    
    await page.waitForTimeout(500);
    
    // Verify removed
    const stillVisible = await page.locator(`text=${symbol}`).first().isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!stillVisible) {
      console.log(`[TEST] Successfully removed ${symbol} from watchlist`);
      return true;
    } else {
      console.log(`[TEST] Failed to remove ${symbol} - still visible`);
      return false;
    }
  } catch (error) {
    console.error(`[TEST] Error removing ${symbol}:`, error);
    return false;
  }
}

/**
 * Click on a ticker in the watchlist
 */
export async function clickTicker(page: Page, symbol: string) {
  await page.click(`text=${symbol}`);
  await page.waitForTimeout(500);
}

/**
 * Check if trade is loaded in "Now Playing" panel
 */
export async function isTradeLoaded(page: Page, symbol: string): Promise<boolean> {
  // Check for various indicators that a trade is loaded
  const indicators = [
    page.locator('[data-testid="now-playing-sheet"]'),
    page.locator('[data-testid="alert-composer"]'),
    page.locator(`text=${symbol}`).first(),
  ];
  
  for (const indicator of indicators) {
    const visible = await indicator.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) return true;
  }
  
  return false;
}

/**
 * Dismiss/unload the currently loaded trade
 */
export async function dismissLoadedTrade(page: Page): Promise<boolean> {
  try {
    const dismissButton = page.locator(
      'button:has-text("Dismiss"), button:has-text("Clear"), button:has-text("Close"), button[aria-label*="close" i]'
    ).first();
    
    const visible = await dismissButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (visible) {
      await dismissButton.click();
      await page.waitForTimeout(500);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[TEST] Error dismissing trade:', error);
    return false;
  }
}

/**
 * Wait for chart to load
 */
export async function waitForChart(page: Page, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="chart"], canvas', { timeout, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if market is closed (weekend or after hours)
 */
export function isMarketClosed(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  // Weekend
  if (day === 0 || day === 6) return true;
  
  // Before 9 AM or after 4 PM EST (simplified)
  if (hour < 9 || hour >= 16) return true;
  
  return false;
}

/**
 * Take screenshot with name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true 
  });
  console.log(`[TEST] Screenshot saved: ${name}`);
}

/**
 * Log test error with details
 */
export function logTestError(testName: string, error: any) {
  console.error(`\n[TEST ERROR] ${testName}`);
  console.error('Details:', error);
  console.error('Stack:', error?.stack);
}
