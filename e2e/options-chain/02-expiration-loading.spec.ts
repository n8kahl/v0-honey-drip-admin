import { test, expect } from '@playwright/test';
import { login } from '../helpers';

/**
 * Options Chain: Expiration Loading & Selection
 * 
 * ⚠️ BLOCKED: Options Chain UI not yet implemented
 * 
 * These tests will validate:
 * - Expirations load when symbol is selected
 * - Nearest expiration is selected by default
 * - User can manually switch expirations
 * - Expiration data is complete and accurate
 */

test.describe('2.1 Expiration Loading', () => {
  test('Loads all available expirations for symbol', async ({ page }) => {
    await login(page);
    
    // Click watchlist symbol to open Options Chain
    await page.click('[data-testid="watchlist-item-QQQ"]');
    
    // Wait for Options Chain panel to appear
    await expect(page.locator('[data-testid="options-chain-panel"]')).toBeVisible();
    
    // Verify expiration headers are populated
    const expirations = page.locator('[data-testid^="expiry-option-"]');
    const count = await expirations.count();
    expect(count).toBeGreaterThan(0);
    
    console.log(`[TEST] Found ${count} expiration dates`);
  });

  test('Selects nearest expiration by default', async ({ page }) => {
    await login(page);

    // Open Options Chain for QQQ
    await page.click('[data-testid="watchlist-item-QQQ"]');
    await expect(page.locator('[data-testid="options-chain-panel"]')).toBeVisible();

    // Take the first expiration header (soonest) and read its date from data-testid
    const firstHeader = page.locator('[data-testid^="expiry-option-"]').first();
    const attr = await firstHeader.getAttribute('data-testid');
    const firstDate = attr?.replace('expiry-option-', '') || '';

    // Read the selected-expiration value from the UI
    const selected = await page.locator('[data-testid="selected-expiration"]').textContent();
    expect(selected?.trim()).toBe(firstDate);
  });

  test('Can manually switch to different expiration', async ({ page }) => {
    await login(page);

    // Open chain for QQQ
    await page.click('[data-testid="watchlist-item-QQQ"]');
    await expect(page.locator('[data-testid="options-chain-panel"]')).toBeVisible();

    // Get soonest and next expiration headers
    const expHeaders = page.locator('[data-testid^="expiry-option-"]');
    const headerCount = await expHeaders.count();
    expect(headerCount).toBeGreaterThan(1);
    const firstAttr = await expHeaders.first().getAttribute('data-testid');
    const secondAttr = await expHeaders.nth(1).getAttribute('data-testid');
    const firstDate = firstAttr?.replace('expiry-option-', '') || '';
    const secondDate = secondAttr?.replace('expiry-option-', '') || '';

    // Verify initially selected is first
    const selectedBefore = (await page.locator('[data-testid="selected-expiration"]').textContent())?.trim();
    expect(selectedBefore).toBe(firstDate);

    // Click second expiration directly; wait for its rows to render
    const secondHeader = page.locator(`[data-testid="expiry-option-${secondDate}"]`);
    await secondHeader.scrollIntoViewIfNeeded();
    await secondHeader.click();
    await expect(page.locator(`[data-testid="contract-row"][data-exp="${secondDate}"]`).first()).toBeVisible();
    await expect(page.locator('[data-testid="selected-expiration"]')).toHaveText(secondDate);
  });

  test('Switching expirations updates contract data', async ({ page }) => {
    await login(page);

    // Open chain for QQQ
    await page.click('[data-testid="watchlist-item-QQQ"]');
    await expect(page.locator('[data-testid="options-chain-panel"]')).toBeVisible();

    // Read selected expiration value and the first visible contract row's expiry
    const selectedBefore = (await page.locator('[data-testid="selected-expiration"]').textContent())?.trim() || '';
    const firstRowExpBefore = await page.locator('[data-testid="contract-row"]').first().getAttribute('data-exp');

    // Switch to the next expiration and wait for UI change
    const expHeaders = page.locator('[data-testid^="expiry-option-"]');
    const secondAttr = await expHeaders.nth(1).getAttribute('data-testid');
    const secondDate = secondAttr?.replace('expiry-option-', '') || '';
    const secondHeader = page.locator(`[data-testid="expiry-option-${secondDate}"]`);
    await secondHeader.scrollIntoViewIfNeeded();
    await secondHeader.click();
    await expect(page.locator(`[data-testid="contract-row"][data-exp="${secondDate}"]`).first()).toBeVisible();

    // Verify selected-expiration and the first row's expiry match the new date
    const selectedAfter = (await page.locator('[data-testid="selected-expiration"]').textContent())?.trim() || '';
    const rowsForNew = await page.locator(`[data-testid="contract-row"][data-exp="${selectedAfter}"]`).count();
    const rowsForOld = await page.locator(`[data-testid="contract-row"][data-exp="${firstRowExpBefore}"]`).count();

    expect(selectedAfter).toBe(secondDate);
    expect(rowsForNew).toBeGreaterThan(0);
    expect(rowsForOld).toBe(0);
  });
});

test.describe('2.2 Expiration Data Quality (BLOCKED)', () => {
  test.skip('All expirations have valid dates', async ({ page }) => {
    await login(page);
    
    // TODO: Open Options Chain
    // TODO: Get all expiration options
    // TODO: Verify each date is:
    //   - A valid date (YYYY-MM-DD format)
    //   - In the future (>= today)
    //   - A Friday (standard expiration day)
    
    console.log('[TEST] Skipped - Options Chain UI not implemented');
  });

  test.skip('Expirations include DTE information', async ({ page }) => {
    await login(page);
    
    // TODO: Open Options Chain
    // TODO: Verify each expiration shows DTE (Days To Expiration)
    // TODO: Verify DTE calculations are accurate
    
    console.log('[TEST] Skipped - Options Chain UI not implemented');
  });
});

/**
 * Implementation Checklist for Options Chain UI:
 * 
 * 1. Create OptionsChainPanel component:
 *    - Prop: symbol (string)
 *    - Prop: onClose (function)
 *    - State: selectedExpiration (string)
 *    - Hook: useOptionsChain(symbol, selectedExpiration)
 * 
 * 2. Add Expiration Dropdown:
 *    - data-testid="expiration-dropdown"
 *    - Populates from massiveClient.getExpirations(symbol)
 *    - Each option: data-testid="expiry-option-YYYY-MM-DD"
 *    - Shows DTE for each option (e.g., "Dec 20 (5 DTE)")
 * 
 * 3. Add Selected Expiration Display:
 *    - data-testid="selected-expiration"
 *    - Shows currently selected expiration prominently
 * 
 * 4. Wire up to useStreamingOptionsChain:
 *    - Fetch contracts for selected symbol + expiration
 *    - Auto-refresh every 12 seconds (already implemented in hook)
 *    - Handle rate limiting gracefully
 * 
 * 5. Default Behavior:
 *    - On open, select nearest expiration
 *    - Exclude today if market is closed
 *    - Prefer weeklies over monthlies if same distance
 */
