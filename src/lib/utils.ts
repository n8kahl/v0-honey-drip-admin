import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TradeType, Contract, Trade } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inferTradeType(daysToExpiry: number): TradeType {
  if (daysToExpiry === 0) return 'Scalp';
  if (daysToExpiry <= 2) return 'Day';
  if (daysToExpiry <= 10) return 'Swing';
  return 'LEAP';
}

export function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null) return '0.00';
  return price.toFixed(2);
}

/**
 * Round a price to 2 decimal places to avoid floating point artifacts
 * e.g., 1.149999999 → 1.15
 */
export function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

/**
 * Format a price for display in an input, removing trailing zeros
 * e.g., 1.10 → "1.1", 1.00 → "1"
 */
export function formatPriceForInput(price: number): string {
  const rounded = roundPrice(price);
  // Remove unnecessary trailing zeros but keep at least one decimal if present
  return rounded.toString();
}

export function formatPercent(percent: number | undefined): string {
  if (percent === undefined || percent === null) return '+0.00%';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

export function isDataStale(timestamp: Date, thresholdSeconds: number = 10): boolean {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  return diffMs > thresholdSeconds * 1000;
}

// Alert message generators following HoneyDrip microcopy guidelines
export function generateEnterAlert(trade: Trade): string {
  const { ticker, contract, tradeType, entryPrice, targetPrice, stopLoss } = trade;
  const dataAsOf = formatTime(new Date());
  return `Entering ${ticker} ${contract.expiry} ${contract.strike}${contract.type} (${tradeType}) at mid $${formatPrice(entryPrice || contract.mid)}. TP1 $${formatPrice(targetPrice || 0)}, SL $${formatPrice(stopLoss || 0)}. Data as of ${dataAsOf} ET.`;
}

export function generateLightTrimAlert(trade: Trade): string {
  const { ticker, contract } = trade;
  return `Light trim on ${ticker} ${contract.strike}${contract.type} here to lock partial profit.`;
}

export function generateHeavyTrimAlert(trade: Trade): string {
  const { ticker, contract } = trade;
  return `Heavy trim on ${ticker} ${contract.strike}${contract.type} here; taking most off.`;
}

export function generateAddAlert(trade: Trade): string {
  const { ticker, contract } = trade;
  return `Adding to ${ticker} ${contract.strike}${contract.type} position here based on momentum.`;
}

export function generateMoveSLAlert(trade: Trade): string {
  const { ticker, contract } = trade;
  return `Moving SL on ${ticker} ${contract.strike}${contract.type} to lock gains.`;
}

export function generateExitAlert(trade: Trade): string {
  const { ticker, contract } = trade;
  return `Exiting ${ticker} ${contract.strike}${contract.type} here; closing the position.`;
}

export function generateLoadAlert(ticker: string, contract: Contract, tradeType: TradeType): string {
  return `Planning to enter ${ticker} ${contract.expiry} ${contract.strike}${contract.type} (${tradeType}) at mid $${formatPrice(contract.mid)}. Monitoring for entry.`;
}
