import type { Page } from '@playwright/test';

export async function openOptionsChain(page: Page, symbol: string) {
  await page.click(`[data-testid="watchlist-item-${symbol}"]`);
  await page.waitForSelector('[data-testid="options-chain-panel"]', {
    state: 'visible',
    timeout: 5000,
  });
}

export async function waitForExpirations(page: Page) {
  await page.waitForSelector('[data-testid^="expiry-option-"]', {
    state: 'visible',
    timeout: 5000,
  });
}

export async function selectExpiration(page: Page, date: string) {
  // UI uses expandable headers per date; click header directly
  await page.click(`[data-testid="expiry-option-${date}"]`);
}

export async function getATMSeparatorPosition(page: Page): Promise<number> {
  const separator = page.locator('[data-testid="atm-separator"]');
  const box = await separator.boundingBox();
  return box?.y || 0;
}
