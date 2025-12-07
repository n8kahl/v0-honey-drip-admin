import { Trade, Challenge } from "../types";
import { ensureArray } from "./utils/validation";

/**
 * Get all trades that have been ENTERED for a specific challenge
 * Returns trades grouped by state (active and exited)
 */
export function getTradesForChallenge(
  challengeId: string,
  allTrades: Trade[]
): {
  active: Trade[];
  exited: Trade[];
} {
  // Filter trades that include this challenge and have been entered
  // Use ensureArray to safely handle null/undefined/non-array challenges
  const tradesForChallenge = allTrades.filter(
    (t) =>
      ensureArray(t.challenges).includes(challengeId) &&
      (t.state === "ENTERED" || t.state === "EXITED")
  );

  return {
    active: tradesForChallenge.filter((t) => t.state === "ENTERED"),
    exited: tradesForChallenge.filter((t) => t.state === "EXITED"),
  };
}

/**
 * Calculate aggregate P&L stats for a challenge
 */
export function getChallengeStats(challengeId: string, allTrades: Trade[]) {
  const { active, exited } = getTradesForChallenge(challengeId, allTrades);
  const allChallengeTrades = [...active, ...exited];

  if (allChallengeTrades.length === 0) {
    return {
      totalTrades: 0,
      activeTrades: 0,
      exitedTrades: 0,
      avgPnL: 0,
      winRate: 0,
    };
  }

  const wins = allChallengeTrades.filter((t) => (t.movePercent || 0) > 0).length;
  const totalPnL = allChallengeTrades.reduce((sum, t) => sum + (t.movePercent || 0), 0);

  return {
    totalTrades: allChallengeTrades.length,
    activeTrades: active.length,
    exitedTrades: exited.length,
    avgPnL: totalPnL / allChallengeTrades.length,
    winRate: (wins / allChallengeTrades.length) * 100,
  };
}
