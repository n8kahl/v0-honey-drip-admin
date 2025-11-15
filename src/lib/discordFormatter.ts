import { Trade, AlertType } from '../types';
import { formatPrice } from './utils';

interface DiscordAlertOptions {
  updateKind?: 'trim' | 'generic' | 'sl';
  includeEntry?: boolean;
  includeCurrent?: boolean;
  includeTarget?: boolean;
  includeStopLoss?: boolean;
  includePnL?: boolean;
  includeConfluence?: boolean;
  comment?: string;
  confluenceData?: {
    rsi?: number;
    macdSignal?: 'bullish' | 'bearish' | 'neutral';
    emaStatus?: string;
    volumeChange?: number;
    ivPercentile?: number;
  };
}

/**
 * Format a trade alert for Discord with proper emojis, timestamps, and structure
 */
export function formatDiscordAlert(
  trade: Trade,
  alertType: AlertType,
  options: DiscordAlertOptions = {}
): string {
  const lines: string[] = [];
  
  // Get current time in EST
  const now = new Date();
  const estTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);
  
  const estDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  
  // Get alert emoji and title
  const { emoji, title } = getAlertTypeDisplay(alertType, options.updateKind);
  
  // Header line with timestamp
  lines.push(`${emoji} **${title}** | ${estTime} EST | ${estDate}`);
  
  // Trade identifier line
  const strikeStr = `$${trade.contract.strike}${trade.contract.type}`;
  const expiryStr = trade.contract.expiry;
  lines.push(`**${trade.ticker} ${strikeStr} ${expiryStr}** (${trade.tradeType})`);
  lines.push('');
  
  // Price fields
  if (options.includeEntry && trade.entryPrice) {
    lines.push(`✅ Entry: $${formatPrice(trade.entryPrice)}`);
  }
  
  if (options.includeCurrent) {
    const currentPrice = trade.currentPrice || trade.contract.mid;
    lines.push(`📊 Current: $${formatPrice(currentPrice)}`);
  }
  
  if (options.includeTarget && trade.targetPrice) {
    lines.push(`🎯 Target: $${formatPrice(trade.targetPrice)}`);
  }
  
  if (options.includeStopLoss && trade.stopLoss) {
    lines.push(`🛡️ Stop: $${formatPrice(trade.stopLoss)}`);
  }
  
  if (options.includePnL && trade.movePercent !== undefined) {
    const sign = trade.movePercent >= 0 ? '+' : '';
    const pnlEmoji = trade.movePercent >= 0 ? '💰' : '📉';
    lines.push(`${pnlEmoji} P&L: ${sign}${trade.movePercent.toFixed(1)}%`);
  }
  
  // Confluence metrics (optional)
  if (options.includeConfluence && options.confluenceData) {
    lines.push('');
    const confluenceParts: string[] = [];
    const conf = options.confluenceData;
    
    if (conf.rsi) {
      confluenceParts.push(`RSI ${conf.rsi}`);
    }
    if (conf.macdSignal) {
      const macdText = conf.macdSignal === 'bullish' ? 'MACD bullish' : 
                       conf.macdSignal === 'bearish' ? 'MACD bearish' : 
                       'MACD neutral';
      confluenceParts.push(macdText);
    }
    if (conf.emaStatus) {
      confluenceParts.push(conf.emaStatus);
    }
    if (conf.volumeChange !== undefined) {
      confluenceParts.push(`Volume ${conf.volumeChange >= 0 ? '+' : ''}${conf.volumeChange.toFixed(0)}%`);
    }
    if (conf.ivPercentile !== undefined) {
      confluenceParts.push(`IV ${conf.ivPercentile}th %ile`);
    }
    
    if (confluenceParts.length > 0) {
      lines.push(`📈 Confluence: ${confluenceParts.join(' | ')}`);
    }
  }
  
  // Comment
  if (options.comment && options.comment.trim()) {
    lines.push('');
    lines.push(`💭 ${options.comment.trim()}`);
  }
  
  // Footer
  lines.push('');
  lines.push('📢 honeydripnetwork.com');
  
  return lines.join('\n');
}

/**
 * Get emoji and display title for alert type
 */
function getAlertTypeDisplay(
  alertType: AlertType,
  updateKind?: 'trim' | 'generic' | 'sl'
): { emoji: string; title: string } {
  if (alertType === 'load') {
    return { emoji: '🟡', title: 'LOAD ALERT' };
  }
  if (alertType === 'enter') {
    return { emoji: '🚀', title: 'ENTRY ALERT' };
  }
  if (alertType === 'exit') {
    return { emoji: '🏁', title: 'EXIT ALERT' };
  }
  if (alertType === 'add') {
    return { emoji: '➕', title: 'ADD TO POSITION' };
  }
  if (alertType === 'trail_stop') {
    return { emoji: '🏃', title: 'TRAIL STOP ACTIVATED' };
  }
  if (alertType === 'update') {
    if (updateKind === 'trim') {
      return { emoji: '💰', title: 'TRIM ALERT' };
    }
    if (updateKind === 'sl') {
      return { emoji: '🛡️', title: 'STOP LOSS UPDATE' };
    }
    return { emoji: '📝', title: 'UPDATE ALERT' };
  }
  return { emoji: '📢', title: 'ALERT' };
}

/**
 * Format a challenge summary for Discord export
 */
export function formatChallengeDiscordExport(
  challengeName: string,
  trades: Trade[],
  stats: {
    totalTrades: number;
    winRate: number;
    avgPnL: number;
    bestTrade: { ticker: string; pnl: number } | null;
    worstTrade: { ticker: string; pnl: number } | null;
    totalPnL: number;
  }
): string {
  const lines: string[] = [];
  
  // Get current time in EST
  const now = new Date();
  const estDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  
  // Header
  lines.push(`🏆 **${challengeName.toUpperCase()} - SUMMARY**`);
  lines.push(`📅 ${estDate}`);
  lines.push('');
  
  // Summary stats
  lines.push('**📊 Performance**');
  lines.push(`Total Trades: ${stats.totalTrades}`);
  lines.push(`Win Rate: ${stats.winRate.toFixed(1)}%`);
  lines.push(`Avg P&L: ${stats.avgPnL >= 0 ? '+' : ''}${stats.avgPnL.toFixed(1)}%`);
  lines.push(`Total P&L: ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(1)}%`);
  lines.push('');
  
  // Best and worst
  if (stats.bestTrade) {
    lines.push(`🥇 Best: ${stats.bestTrade.ticker} +${stats.bestTrade.pnl.toFixed(1)}%`);
  }
  if (stats.worstTrade) {
    lines.push(`📉 Worst: ${stats.worstTrade.ticker} ${stats.worstTrade.pnl.toFixed(1)}%`);
  }
  lines.push('');
  
  // Trade list
  lines.push('**📋 Trades Entered**');
  const enteredTrades = trades.filter(t => t.state === 'ENTERED' || t.state === 'EXITED');
  
  if (enteredTrades.length === 0) {
    lines.push('_No trades entered yet_');
  } else {
    enteredTrades.forEach((trade, idx) => {
      const pnl = trade.movePercent || 0;
      const pnlEmoji = pnl >= 0 ? '✅' : '❌';
      const pnlStr = pnl >= 0 ? `+${pnl.toFixed(1)}%` : `${pnl.toFixed(1)}%`;
      lines.push(`${idx + 1}. ${pnlEmoji} ${trade.ticker} $${trade.contract.strike}${trade.contract.type} ${pnlStr}`);
    });
  }
  
  lines.push('');
  lines.push('📢 honeydripnetwork.com');
  
  return lines.join('\n');
}

/**
 * Format a single trade for sharing/screenshot
 */
export function formatTradeShareMessage(trade: Trade): string {
  const lines: string[] = [];
  
  const now = new Date();
  const estDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);
  
  const pnl = trade.movePercent || 0;
  const emoji = pnl >= 0 ? '🎯' : '📉';
  
  lines.push(`${emoji} **TRADE RESULT** | ${estDate}`);
  lines.push(`**${trade.ticker} $${trade.contract.strike}${trade.contract.type} ${trade.contract.expiry}**`);
  lines.push('');
  
  if (trade.entryPrice) {
    lines.push(`✅ Entry: $${formatPrice(trade.entryPrice)}`);
  }
  if (trade.exitPrice) {
    lines.push(`🏁 Exit: $${formatPrice(trade.exitPrice)}`);
  }
  lines.push(`${pnl >= 0 ? '💰' : '📉'} P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`);
  
  lines.push('');
  lines.push('📢 honeydripnetwork.com');
  
  return lines.join('\n');
}
