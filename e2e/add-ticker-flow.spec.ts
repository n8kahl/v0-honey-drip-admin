import { test, expect } from '@playwright/test';

test.describe('Add Ticker Flow Test', () => {
  test('Complete add ticker workflow for QQQ', async ({ page }) => {
    // Capture browser console logs
    page.on('console', (msg) => {
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    });
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';
    
    console.log(`[TEST] Step 1: Login`);
    await page.goto('/');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    console.log(`[TEST] Step 2: Count initial watchlist items`);
    const initialItems = await page.locator('[aria-label^="Switch to"]').count();
    console.log(`[TEST] Initial watchlist count: ${initialItems}`);
    
    console.log(`[TEST] Step 3: Click add ticker button`);
    await page.click('button[aria-label="Add ticker"]');
    await page.waitForSelector('input#symbol', { state: 'visible', timeout: 3000 });
    
    console.log(`[TEST] Step 4: Fill and submit QQQ`);
    await page.fill('input#symbol', 'QQQ');
    await page.screenshot({ path: 'test-results/before-submit-qqq.png' });
    
    await page.click('button[type="submit"]:has-text("Add Ticker")');
    
    console.log(`[TEST] Step 5: Wait for response`);
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/after-submit-qqq.png' });
    
    // Check for toast notifications
    const hasToast = await page.locator('[role="status"], [data-testid="toast"], .toast').isVisible().catch(() => false);
    if (hasToast) {
      const toastText = await page.locator('[role="status"], [data-testid="toast"], .toast').textContent();
      console.log(`[TEST] Toast message: ${toastText}`);
    }
    
    // Check for error messages
    const hasError = await page.locator('[role="alert"], .error, text=error').first().isVisible().catch(() => false);
    if (hasError) {
      const errorText = await page.locator('[role="alert"], .error, text=error').first().textContent();
      console.log(`[TEST] Error message: ${errorText}`);
    }
    
    console.log(`[TEST] Step 6: Check if QQQ appears in watchlist`);
    const finalItems = await page.locator('[aria-label^="Switch to"]').count();
    console.log(`[TEST] Final watchlist count: ${finalItems}`);
    
    const qqqButton = page.locator('[aria-label="Switch to QQQ"]');
    const qqqVisible = await qqqButton.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[TEST] QQQ button visible: ${qqqVisible}`);
    
    // Also check for QQQ text anywhere on page
    const qqqTextExists = await page.locator('text="QQQ"').count();
    console.log(`[TEST] "QQQ" text appears ${qqqTextExists} times on page`);
    
    // List all switch buttons
    const switchButtons = await page.locator('[aria-label^="Switch to"]').allTextContents();
    console.log(`[TEST] All watchlist symbols: ${JSON.stringify(switchButtons)}`);
    
    expect(qqqVisible || finalItems > initialItems).toBe(true);
  });
});
