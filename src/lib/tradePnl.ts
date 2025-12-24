import type { Trade, TradeUpdate } from "../types";
import { calculatePnL } from "../services/pnlCalculator";

const CONTRACT_MULTIPLIER = 100;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getTrimPercentFromMessage(message?: string): number | null {
  if (!message) return null;
  const match = message.match(/(\d{1,3})%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return clampPercent(parsed);
}

export function getTrimPercent(update: TradeUpdate): number | null {
  if (update.trimPercent !== undefined && update.trimPercent !== null) {
    return clampPercent(update.trimPercent);
  }
  return getTrimPercentFromMessage(update.message);
}

export function getEntryUpdate(updates: TradeUpdate[]): TradeUpdate | null {
  const entry = updates.find((update) => update.type === "enter" && update.price > 0);
  return entry || null;
}

export function getEntryPriceFromUpdates(updates: TradeUpdate[]): number | null {
  const entry = getEntryUpdate(updates);
  return entry?.price ?? null;
}

export function calculateRemainingPercent(updates: TradeUpdate[]): number {
  let trimmed = 0;
  for (const update of updates) {
    if (update.type !== "trim") continue;
    const percent = getTrimPercent(update);
    if (percent !== null) trimmed += percent;
  }
  return clampPercent(100 - trimmed);
}

export interface RealizedPnLResult {
  realizedDollars: number;
  realizedPercent: number;
  remainingPercent: number;
  trimmedPercent: number;
}

export function calculateRealizedPnL(trade: Trade): RealizedPnLResult {
  const updates = Array.isArray(trade.updates) ? trade.updates : [];
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(updates) || trade.contract?.mid || 0;
  const quantity = trade.quantity || 1;
  let trimmedPercent = 0;
  let realizedDollars = 0;

  for (const update of updates) {
    if (update.type !== "trim") continue;
    const trimPercent = getTrimPercent(update);
    if (!trimPercent || update.price <= 0 || entryPrice <= 0) continue;
    trimmedPercent += trimPercent;

    const trimmedQuantity = quantity * (trimPercent / 100);
    const pnl = calculatePnL({
      entryPrice,
      exitPrice: update.price,
      quantity: trimmedQuantity,
    });
    realizedDollars += pnl.netPnL;
  }

  trimmedPercent = clampPercent(trimmedPercent);
  const remainingPercent = clampPercent(100 - trimmedPercent);
  const baseCost = entryPrice > 0 ? entryPrice * quantity * CONTRACT_MULTIPLIER : 0;
  const realizedPercent = baseCost > 0 ? (realizedDollars / baseCost) * 100 : 0;

  return {
    realizedDollars,
    realizedPercent,
    remainingPercent,
    trimmedPercent,
  };
}
