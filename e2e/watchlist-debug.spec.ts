import { test } from '@playwright/test';

test.describe('Watchlist UI Debug', () => {
  test('Inspect watchlist add ticker flow', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';
    
    console.log(`[DEBUG] Logging in with ${email}...`);
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Login
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    console.log(`[DEBUG] Logged in, looking for add button...`);
    
    // Find all buttons with aria-label
    const allButtons = await page.locator('button').all();
    console.log(`[DEBUG] Total buttons on page: ${allButtons.length}`);
    
    for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
      const btn = allButtons[i];
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => null);
      const text = await btn.textContent().catch(() => '');
      const visible = await btn.isVisible().catch(() => false);
      
      if (ariaLabel || text || visible) {
        console.log(`[DEBUG] Button ${i}: aria-label="${ariaLabel}", text="${text?.trim()}", visible=${visible}`);
      }
    }
    
    // Try to click add ticker button
    console.log(`[DEBUG] Attempting to click add ticker button...`);
    const addButton = page.locator('button[aria-label="Add ticker"]').first();
    const btnVisible = await addButton.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[DEBUG] Add ticker button visible: ${btnVisible}`);
    
    if (btnVisible) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Check for dialog
      const dialogVisible = await page.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`[DEBUG] Dialog visible after click: ${dialogVisible}`);
      
      if (dialogVisible) {
        const inputs = await page.locator('input').all();
        console.log(`[DEBUG] Inputs in dialog: ${inputs.length}`);
        
        for (const input of inputs) {
          const id = await input.getAttribute('id').catch(() => null);
          const placeholder = await input.getAttribute('placeholder').catch(() => null);
          const visible = await input.isVisible().catch(() => false);
          console.log(`[DEBUG] Input: id="${id}", placeholder="${placeholder}", visible=${visible}`);
        }
      }
      
      await page.screenshot({ path: 'test-results/watchlist-ui-debug.png' });
    } else {
      await page.screenshot({ path: 'test-results/no-add-button-found.png' });
    }
  });
});
