import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Auth Debug', () => {
  test('Login with real credentials', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    console.log(`[DEBUG] Attempting login with: ${email}`);
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check initial state
    const hasAuthForm = await page.locator('input[type="email"]').isVisible({ timeout: 3000 });
    console.log(`[DEBUG] Auth form visible: ${hasAuthForm}`);
    
    if (hasAuthForm) {
      // Fill and submit manually to see response
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
      
      // Take screenshot before submit
      await page.screenshot({ path: 'test-results/before-login.png' });
      
      // Submit and wait
      await page.click('button[type="submit"]');
      
      // Wait and check for any response
      await page.waitForTimeout(5000);
      
      // Take screenshot after submit
      await page.screenshot({ path: 'test-results/after-login.png' });
      
      // Check what we have now
      const currentUrl = page.url();
      console.log(`[DEBUG] Current URL: ${currentUrl}`);
      
      const hasError = await page.locator('[role="alert"], text=Invalid, text=error').first().isVisible().catch(() => false);
      console.log(`[DEBUG] Has error message: ${hasError}`);
      
      if (hasError) {
        const errorText = await page.locator('[role="alert"], text=Invalid, text=error').first().textContent();
        console.log(`[DEBUG] Error text: ${errorText}`);
      }
      
      const hasAddButton = await page.locator('button[aria-label="Add ticker"], button:has-text("+")').first().isVisible().catch(() => false);
      console.log(`[DEBUG] Has add ticker button: ${hasAddButton}`);
      
      const hasHeader = await page.locator('header').isVisible().catch(() => false);
      console.log(`[DEBUG] Has header: ${hasHeader}`);
      
      const bodyText = await page.locator('body').textContent();
      console.log(`[DEBUG] Body text (first 500 chars): ${bodyText?.substring(0, 500)}`);
      
      // List all visible buttons
      const buttons = await page.locator('button:visible').allTextContents();
      console.log(`[DEBUG] Visible buttons: ${JSON.stringify(buttons)}`);
    }
    
    // The test will pass/fail based on what we see in logs
    expect(hasAuthForm).toBe(true);
  });
});
