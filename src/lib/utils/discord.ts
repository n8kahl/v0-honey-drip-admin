// Shared Discord formatting utilities
import { Trade } from '../../types';
import { formatPrice, formatPercent } from '../utils';

/**
 * Format a trade for Discord sharing (individual trade from history)
 */
export function getShareText(trade: Trade): string {
  const duration = trade.entryTime && trade.exitTime
    ? formatDuration(trade.entryTime, trade.exitTime)
    : 'N/A';

  return `**${trade.ticker} ${trade.contract.strike}${trade.contract.type} (${trade.tradeType})**

Entry: $${formatPrice(trade.entryPrice || 0)}
Exit: $${formatPrice(trade.exitPrice || 0)}
P&L: ${formatPercent(trade.movePercent || 0)}
Duration: ${duration}`;
}

/**
 * Format trade duration (entry to exit)
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const startTime = typeof start === 'string' ? new Date(start) : start;
  const endTime = typeof end === 'string' ? new Date(end) : end;

  const diff = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format summary statistics for export
 */
export function getSummaryStats(trades: Trade[]) {
  if (trades.length === 0) {
    return null;
  }

  const wins = trades.filter((t) => (t.movePercent || 0) > 0).length;
  const winRate = (wins / trades.length) * 100;
  const avgPnL = trades.reduce((sum, t) => sum + (t.movePercent || 0), 0) / trades.length;

  const biggestWinner = trades.reduce((max, t) =>
    (t.movePercent || 0) > (max.movePercent || 0) ? t : max
  );
  const biggestLoser = trades.reduce((min, t) =>
    (t.movePercent || 0) < (min.movePercent || 0) ? t : min
  );

  return {
    totalTrades: trades.length,
    wins,
    winRate,
    avgPnL,
    biggestWinner,
    biggestLoser,
  };
}

/**
 * Format summary text for Discord export
 */
export function getSummaryText(
  trades: Trade[],
  filters: {
    challengeName?: string;
    dateRangeLabel?: string;
    tickerLabel?: string;
  }
): string {
  const stats = getSummaryStats(trades);

  if (!stats) return '';

  const challengeLabel = filters.challengeName || 'All Challenges';
  const dateRangeLabel = filters.dateRangeLabel || 'All Time';
  const tickerLabel = filters.tickerLabel || 'All Tickers';

  return `**Trade Summary – ${challengeLabel} – ${dateRangeLabel} – ${tickerLabel}**

- Trades: ${stats.totalTrades}
- Wins: ${stats.wins} (${stats.winRate.toFixed(1)}%)
- Average P&L: ${stats.avgPnL > 0 ? '+' : ''}${stats.avgPnL.toFixed(1)}%
- Biggest winner: ${stats.biggestWinner.ticker} ${stats.biggestWinner.contract.strike}${stats.biggestWinner.contract.type} ${formatPercent(stats.biggestWinner.movePercent || 0)}
- Biggest loser: ${stats.biggestLoser.ticker} ${stats.biggestLoser.contract.strike}${stats.biggestLoser.contract.type} ${formatPercent(stats.biggestLoser.movePercent || 0)}`;
}
