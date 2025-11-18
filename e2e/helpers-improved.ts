/**
 * Improved version of addTickerToWatchlist with better error handling
 */
export async function addTickerToWatchlistV2(page: Page, symbol: string): Promise<boolean> {
  try {
    console.log(`[TEST] Attempting to add ${symbol} to watchlist...`);
    
    // Look for add button
    const addButton = page.locator('button[aria-label="Add ticker"]').first();
    const isVisible = await addButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isVisible) {
      console.log(`[TEST] ✗ Add ticker button not visible`);
      return false;
    }
    
    await addButton.click();
    console.log(`[TEST]   - Clicked add ticker button`);
    
    // Wait for dialog input
    const dialogInput = page.locator('input#symbol, input[placeholder*="SPX"]').first();
    await dialogInput.waitFor({ state: 'visible', timeout: 3000 });
    console.log(`[TEST]   - Dialog opened`);
    
    // Fill in symbol
    await dialogInput.fill(symbol);
    console.log(`[TEST]   - Filled symbol: ${symbol}`);
    
    // Submit
    const submitButton = page.locator('button[type="submit"]:has-text("Add Ticker")').first();
    await submitButton.click();
    console.log(`[TEST]   - Clicked submit`);
    
    // Wait for dialog to close and data to update
    await page.waitForTimeout(1500);
    
    // Verify ticker was added - look in watchlist panel
    const tickerInList = await page.locator(`[data-testid="watchlist-item-${symbol}"], text="${symbol}"`).first().isVisible({ timeout: 2000 }).catch(() => false);
    
    if (tickerInList) {
      console.log(`[TEST] ✓ Successfully added ${symbol} to watchlist`);
      return true;
    } else {
      console.log(`[TEST] ✗ ${symbol} not visible in watchlist after adding`);
      // Take screenshot for debugging
      await page.screenshot({ path: `test-results/add-ticker-failed-${symbol}.png` });
      return false;
    }
  } catch (error: any) {
    console.log(`[TEST] ✗ Error adding ${symbol}:`, error.message || error);
    return false;
  }
}
