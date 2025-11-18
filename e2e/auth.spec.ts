import { test, expect } from '@playwright/test';

/**
 * Auth flow test - verifies login works with valid credentials
 * 
 * BEFORE RUNNING:
 * 1. Create .env.test file with TEST_USER_EMAIL and TEST_USER_PASSWORD
 * 2. Ensure test user exists in Supabase
 * 3. Run: pnpm playwright test e2e/auth.spec.ts
 */

test.describe('Authentication Flow', () => {
  test('Can log in with valid credentials', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    
    if (!email || !password) {
      console.log('[TEST] Skipping - no credentials set in environment');
      console.log('[TEST] Set TEST_USER_EMAIL and TEST_USER_PASSWORD to enable this test');
      test.skip();
      return;
    }
    
    // Go to app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Should see login form
    await page.screenshot({ path: 'test-results/auth-01-login-form.png', fullPage: true });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    
    // Fill in credentials
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    await page.screenshot({ path: 'test-results/auth-02-credentials-filled.png' });
    
    // Submit
    await page.click('button:has-text("Log In"), button[type="submit"]');
    
    // Wait for redirect/load
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/auth-03-after-submit.png', fullPage: true });
    
    // Should see app content (watchlist, header, etc.)
    const appLoaded = await page.locator('header, text=WATCHLIST, text=Watch, [class*="HDHeader"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    
    await page.screenshot({ path: 'test-results/auth-04-logged-in.png', fullPage: true });
    
    console.log('[TEST] Login result:', {
      appLoaded,
      url: page.url()
    });
    
    expect(appLoaded).toBe(true);
  });
  
  test.skip('Shows error with invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Try bad credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Log In"), button[type="submit"]');
    
    // Should see error message
    await page.waitForTimeout(1000);
    const hasError = await page.locator('text=/invalid/i, text=/error/i, text=/failed/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    
    expect(hasError).toBe(true);
  });
});
