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
 * Calculate aggregate P&L stats for a challenge (basic version)
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

/**
 * Comprehensive challenge statistics including dollar P&L, R-multiples, and best/worst trades.
 * This is the canonical stats function - all UI components should use this for consistency.
 */
export interface FullChallengeStats {
  active: Trade[];
  completed: Trade[];
  totalTrades: number;
  activeTrades: number;
  completedTrades: number;
  winRate: number;
  avgPnL: number; // Average percentage P&L
  totalPnL: number; // Total percentage P&L
  dollarPnL: number; // Total dollar P&L (with $100 options multiplier)
  avgR: number; // Average R-multiple
  bestTrade: { ticker: string; pnl: number } | null;
  worstTrade: { ticker: string; pnl: number } | null;
}

export function getFullChallengeStats(challengeId: string, allTrades: Trade[]): FullChallengeStats {
  const { active, exited } = getTradesForChallenge(challengeId, allTrades);

  // Only include ENTERED trades in active (not LOADED - those haven't been entered yet)
  const activeTrades = allTrades.filter(
    (t) => ensureArray(t.challenges).includes(challengeId) && t.state === "ENTERED"
  );

  if (activeTrades.length === 0 && exited.length === 0) {
    return {
      active: activeTrades,
      completed: exited,
      totalTrades: 0,
      activeTrades: 0,
      completedTrades: 0,
      winRate: 0,
      avgPnL: 0,
      totalPnL: 0,
      dollarPnL: 0,
      avgR: 0,
      bestTrade: null,
      worstTrade: null,
    };
  }

  // Win rate based on movePercent (positive = win)
  const wins = exited.filter((t) => (t.movePercent ?? 0) > 0).length;
  const winRate = exited.length > 0 ? (wins / exited.length) * 100 : 0;

  // Total percentage P&L across all completed trades
  const totalPnL = exited.reduce((sum, t) => sum + (t.movePercent ?? 0), 0);
  const avgPnL = exited.length > 0 ? totalPnL / exited.length : 0;

  // Dollar P&L with $100 options multiplier
  const dollarPnL = exited.reduce((sum, t) => {
    if (!t.exitPrice || !t.entryPrice) return sum;
    const diff = t.exitPrice - t.entryPrice;
    return sum + diff * (t.quantity ?? 1) * 100;
  }, 0);

  // Average R-multiple
  const avgR =
    exited.length > 0 ? exited.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / exited.length : 0;

  // Best and worst trades by movePercent
  let bestTrade: { ticker: string; pnl: number } | null = null;
  let worstTrade: { ticker: string; pnl: number } | null = null;

  for (const t of exited) {
    const pnl = t.movePercent ?? 0;
    if (!bestTrade || pnl > bestTrade.pnl) {
      bestTrade = { ticker: t.ticker, pnl };
    }
    if (!worstTrade || pnl < worstTrade.pnl) {
      worstTrade = { ticker: t.ticker, pnl };
    }
  }

  return {
    active: activeTrades,
    completed: exited,
    totalTrades: activeTrades.length + exited.length,
    activeTrades: activeTrades.length,
    completedTrades: exited.length,
    winRate,
    avgPnL,
    totalPnL,
    dollarPnL,
    avgR,
    bestTrade,
    worstTrade,
  };
}
