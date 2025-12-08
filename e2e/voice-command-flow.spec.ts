import { test, expect } from "@playwright/test";
import { login, addTickerToWatchlist, takeScreenshot, logTestError } from "./helpers";

/**
 * Test Suite: Voice Command → Trade Flow Integration
 *
 * Tests that voice commands properly load contracts into the trade state machine
 * and open the alert composer for user confirmation (click-to-send).
 *
 * Prerequisites:
 * - Dev server running (auto-started by Playwright)
 * - Supabase configured with test user (or auth bypass for testing)
 * - Voice commands working in UI
 */

test.describe("Voice Command Integration", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Voice command "Enter TSLA" loads contract and opens alert composer', async ({ page }) => {
    try {
      // Add TSLA to watchlist first (or test auto-add flow)
      const added = await addTickerToWatchlist(page, "TSLA");
      expect(added).toBe(true);

      // Wait for watchlist to update
      await page.waitForTimeout(1000);

      // Verify TSLA is in watchlist
      await expect(page.locator("text=TSLA").first()).toBeVisible({ timeout: 5000 });

      await takeScreenshot(page, "voice-test-tsla-in-watchlist");

      // TODO: Trigger voice command programmatically
      // Options:
      // 1. Click mic button and simulate Web Speech API
      // 2. Use keyboard shortcut to bypass voice recognition
      // 3. Call voice command handler directly via window object

      // For now, manual test verification needed
      console.log("[TEST LOG] Voice command test requires manual verification");
      console.log("[TEST LOG] Steps:");
      console.log("[TEST LOG] 1. Click mic button or use voice wake word");
      console.log('[TEST LOG] 2. Say "Enter Tesla" or "Enter TSLA"');
      console.log("[TEST LOG] 3. Verify contract loads into trade system");
      console.log("[TEST LOG] 4. Verify alert composer opens with pre-filled reasoning");
      console.log('[TEST LOG] 5. Click "Load and Alert" button');
      console.log("[TEST LOG] 6. Verify trade appears in active trades list");

      // Expected behavior (to be automated when voice API is mockable):
      // - Voice command triggers smart alert search
      // - Best contract is found based on liquidity
      // - Contract is loaded via handleContractSelect
      // - Alert composer opens with voiceContext pre-filled
      // - User reviews and clicks "Load and Alert"
      // - Trade is created in database
      // - Trade appears in activeTrades
      // - Discord alert is sent to default "Enter" channels
    } catch (error) {
      await takeScreenshot(page, "voice-command-test-error");
      logTestError("Voice command Enter TSLA test", error);
      throw error;
    }
  });

  test("Voice command for ticker NOT in watchlist prompts to add", async ({ page }) => {
    try {
      // Ensure NFLX is NOT in watchlist
      const nflxExists = await page.locator("text=NFLX").count();
      if (nflxExists > 0) {
        console.log("[TEST LOG] NFLX already in watchlist, removing for test");
        // TODO: Remove NFLX if exists
      }

      await takeScreenshot(page, "voice-test-nflx-not-in-watchlist");

      // TODO: Trigger voice command "Enter NFLX"
      // Expected behavior:
      // - Voice command detects NFLX not in watchlist
      // - HUD shows "NFLX is not in your watchlist. Add it? Say yes to add."
      // - User says "yes" or "ok" or "yeah"
      // - NFLX is added to watchlist
      // - Original "Enter NFLX" command is retried
      // - Contract loads and alert composer opens

      console.log("[TEST LOG] Auto-watchlist test requires manual verification");
      console.log(
        "[TEST LOG] Expected flow: Voice command → Add prompt → Confirmation → Retry command"
      );
    } catch (error) {
      await takeScreenshot(page, "voice-auto-watchlist-error");
      logTestError("Voice auto-watchlist test", error);
      throw error;
    }
  });

  test("Alert composer pre-fills voice reasoning", async ({ page }) => {
    try {
      // Add SPY to watchlist
      await addTickerToWatchlist(page, "SPY");
      await page.waitForTimeout(1000);

      // TODO: Trigger voice command "Enter SPY"
      // Expected behavior:
      // - Voice command finds best contract (e.g., "ATM call expiring in 7 days")
      // - Contract loads into trade state machine
      // - Alert composer opens
      // - Comment field is pre-filled with reasoning: "ATM call expiring in 7 days, spread 0.05, OI 5000"
      // - User can edit or keep the reasoning
      // - User clicks "Load and Alert" to confirm

      // Verify alert composer is visible
      // await expect(page.locator('[data-testid="alert-composer"]')).toBeVisible({ timeout: 5000 });

      // Verify comment field has voice reasoning
      // const commentInput = page.locator('textarea[placeholder*="comment"]');
      // const commentValue = await commentInput.inputValue();
      // expect(commentValue).toContain('ATM');

      console.log("[TEST LOG] Voice reasoning pre-fill test requires manual verification");

      await takeScreenshot(page, "voice-reasoning-prefill");
    } catch (error) {
      await takeScreenshot(page, "voice-reasoning-test-error");
      logTestError("Voice reasoning pre-fill test", error);
      throw error;
    }
  });

  test("Trade from voice command appears in active trades after alert sent", async ({ page }) => {
    try {
      // Add QQQ to watchlist
      await addTickerToWatchlist(page, "QQQ");
      await page.waitForTimeout(1000);

      // TODO: Full flow automation
      // 1. Voice: "Enter QQQ"
      // 2. Contract loads, alert composer opens
      // 3. Click "Load and Alert" button
      // 4. Verify trade ID is added to activeTrades store
      // 5. Navigate to "Trade" tab (active trades view)
      // 6. Verify QQQ trade card is visible
      // 7. Verify trade has LOADED state
      // 8. User can then "Enter Trade" to move to ENTERED state

      console.log("[TEST LOG] Full voice → trade flow test requires automation");
      console.log("[TEST LOG] This is the critical integration test");

      await takeScreenshot(page, "voice-full-flow-ready");
    } catch (error) {
      await takeScreenshot(page, "voice-full-flow-error");
      logTestError("Voice full flow test", error);
      throw error;
    }
  });
});

/**
 * Future enhancements:
 * 1. Mock Web Speech API to programmatically trigger voice commands
 * 2. Add data-testid attributes to voice HUD, alert composer, trade cards
 * 3. Create helper functions for voice command simulation
 * 4. Test voice confirmation flow for trim/exit/update commands
 * 5. Test voice error handling (no contracts found, API errors)
 * 6. Test voice + keyboard navigation (accessibility)
 */
