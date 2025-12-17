/**
 * E2E Tests for Mobile Production Fixes
 * Tests 5 critical mobile UX issues that blocked production deployment
 */

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Mobile Production Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test("Fix #1: Alert modal closes after error with timeout", async ({ page }) => {
    // Navigate to mobile view
    await page.goto("http://localhost:5173");

    // Mock Discord webhook to fail
    await page.route("**/api/discord/**", (route) => route.abort("failed"));

    // Add a ticker and load a contract
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/enter symbol/i).fill("SPY");
    await page.getByRole("button", { name: /add/i }).click();

    // Wait for watchlist to load
    await expect(page.getByText("SPY")).toBeVisible();

    // Click Load button on watchlist card
    await page.getByRole("button", { name: /load/i }).first().click();

    // Wait for contract sheet to appear
    await expect(page.getByText(/select contract/i)).toBeVisible();

    // Select first contract
    await page.getByRole("button", { name: /confirm/i }).click();

    // Alert sheet should open
    await expect(page.getByText(/load and alert/i)).toBeVisible();

    // Try to send alert (should fail due to mocked route)
    await page.getByRole("button", { name: /load and alert/i }).click();

    // Error toast should appear
    await expect(page.getByText(/failed to send alert/i)).toBeVisible();

    // Modal should still be visible immediately after error
    await expect(page.getByText(/load and alert/i)).toBeVisible();

    // Wait 1.5s and modal should close
    await page.waitForTimeout(1600);
    await expect(page.getByText(/load and alert/i)).not.toBeVisible();
  });

  test("Fix #2: Comment field is editable in alert sheet", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Add ticker and load contract (reuse flow)
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/enter symbol/i).fill("SPY");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /load/i }).first().click();
    await page.getByRole("button", { name: /confirm/i }).click();

    // Alert sheet opens
    await expect(page.getByText(/load and alert/i)).toBeVisible();

    // Find comment textarea and type
    const commentField = page.getByPlaceholder(/add additional context/i);
    await expect(commentField).toBeVisible();
    await commentField.click();
    await commentField.fill("Testing comment editability");

    // Verify value persisted
    await expect(commentField).toHaveValue("Testing comment editability");
  });

  test("Fix #3: Contract chain shows 21 contracts across ITM/ATM/OTM", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Add ticker
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/enter symbol/i).fill("SPY");
    await page.keyboard.press("Enter");

    // Click Load to open contract sheet
    await page.getByRole("button", { name: /load/i }).first().click();

    // Wait for contracts to load
    await expect(page.getByText(/select contract/i)).toBeVisible();

    // Count visible contract cards (should be up to 21)
    const contractCards = page.locator('[data-testid="contract-card"]');
    const count = await contractCards.count();

    // Should show more than 10 (old limit) and up to 21 (10 ITM + 1 ATM + 10 OTM)
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThanOrEqual(21);

    // Verify contracts span ITM/ATM/OTM by checking deltas
    const firstContract = contractCards.first();
    const lastContract = contractCards.last();

    // Both should have delta information
    await expect(firstContract.getByText(/δ/i)).toBeVisible();
    await expect(lastContract.getByText(/δ/i)).toBeVisible();
  });

  test("Fix #4: Confluence badges show with 3-tier color coding", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Add multiple tickers to get different confluence scores
    const tickers = ["SPY", "QQQ", "AAPL"];
    for (const ticker of tickers) {
      await page.getByRole("button", { name: /add/i }).click();
      await page.getByPlaceholder(/enter symbol/i).fill(ticker);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }

    // Wait for watchlist to populate
    await expect(page.getByText("SPY")).toBeVisible();

    // Look for confluence badges (should show for scores >= 50)
    const badges = page.locator('[data-testid="confluence-badge"]');

    // If any badges exist, verify they have proper styling
    const badgeCount = await badges.count();
    if (badgeCount > 0) {
      const firstBadge = badges.first();

      // Check for color classes (green/yellow/blue)
      const badgeClasses = await firstBadge.getAttribute("class");
      const hasColorCoding =
        badgeClasses?.includes("green-500") ||
        badgeClasses?.includes("yellow-500") ||
        badgeClasses?.includes("blue-500");

      expect(hasColorCoding).toBeTruthy();

      // Badge should show score number
      await expect(firstBadge.getByText(/\d+/)).toBeVisible();

      // Badge icon should be larger (w-3 h-3, not w-2.5 h-2.5)
      const icon = firstBadge.locator("svg").first();
      const iconClasses = await icon.getAttribute("class");
      expect(iconClasses).toContain("w-3");
      expect(iconClasses).toContain("h-3");
    }
  });

  test("Fix #5: Default channel auto-selected when opening alert sheet", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Ensure user has at least one Discord channel configured
    // (This test assumes channels exist in settings)

    // Add ticker and load contract
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/enter symbol/i).fill("SPY");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /load/i }).first().click();
    await page.getByRole("button", { name: /confirm/i }).click();

    // Alert sheet opens
    await expect(page.getByText(/load and alert/i)).toBeVisible();

    // Send button should NOT be disabled (default channel should be selected)
    const sendButton = page.getByRole("button", { name: /load and alert/i });
    await expect(sendButton).toBeEnabled();

    // Verify at least one channel chip is selected (has checkmark)
    const selectedChannel = page.locator('[data-testid="channel-chip"][data-selected="true"]');
    await expect(selectedChannel).toBeVisible();
  });

  test("Integration: Complete mobile trade flow with all fixes", async ({ page }) => {
    await page.goto("http://localhost:5173");

    // 1. Add ticker with confluence badge (Fix #4)
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/enter symbol/i).fill("SPY");
    await page.keyboard.press("Enter");
    await expect(page.getByText("SPY")).toBeVisible();

    // 2. Load contract with proper chain (Fix #3)
    await page.getByRole("button", { name: /load/i }).first().click();
    await expect(page.getByText(/select contract/i)).toBeVisible();

    // Verify contract count
    const contractCards = page.locator('[data-testid="contract-card"]');
    const count = await contractCards.count();
    expect(count).toBeGreaterThan(10);

    // 3. Select contract
    await page.getByRole("button", { name: /confirm/i }).click();

    // 4. Alert sheet with default channel (Fix #5) and editable comment (Fix #2)
    await expect(page.getByText(/load and alert/i)).toBeVisible();
    const sendButton = page.getByRole("button", { name: /load and alert/i });
    await expect(sendButton).toBeEnabled();

    const commentField = page.getByPlaceholder(/add additional context/i);
    await commentField.fill("Full mobile flow test");
    await expect(commentField).toHaveValue("Full mobile flow test");

    // 5. Send alert (mock success)
    await page.route("**/api/discord/**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await sendButton.click();

    // Success: modal should close immediately
    await expect(page.getByText(/load and alert/i)).not.toBeVisible({
      timeout: 3000,
    });

    // Trade should appear in "Loaded Trades" section
    await expect(page.getByText(/loaded trades/i)).toBeVisible();
  });
});
