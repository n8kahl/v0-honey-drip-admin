/**
 * Discord Strategy Signal Alerts
 * 
 * Formats and sends strategy signal notifications to Discord channels.
 */

import type { StrategySignal, StrategyDefinition } from '../../types/strategy.js';
import { sendToMultipleChannels } from './webhook.js';

export const STRATEGY_COLORS = {
  setup: 0xf39c12,    // Orange (50-79% confidence)
  ready: 0x2ecc71,    // Green (80%+ confidence)
  fired: 0x3498db,    // Blue (general signal)
};

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds: DiscordEmbed[];
}

/**
 * Send strategy signal alert to multiple Discord channels.
 */
export async function sendStrategySignalToDiscord(
  webhookUrls: string[],
  signal: StrategySignal,
  strategy: StrategyDefinition
): Promise<boolean> {
  try {
    const embed = formatStrategySignalEmbed(signal, strategy);
    const message: DiscordMessage = {
      content: getAlertPingContent(signal.confidence),
      embeds: [embed],
    };

    const results = await sendToMultipleChannels(webhookUrls, async (client, url) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      return response.ok;
    });

    const successCount = results.success;
    const failureCount = results.failed;

    if (failureCount > 0) {
      console.warn(`[v0] Discord strategy alert: ${successCount} succeeded, ${failureCount} failed`);
    }

    return successCount > 0;
  } catch (err) {
    console.error('[v0] sendStrategySignalToDiscord error:', err);
    return false;
  }
}

/**
 * Format strategy signal as Discord embed.
 */
function formatStrategySignalEmbed(
  signal: StrategySignal,
  strategy: StrategyDefinition
): DiscordEmbed {
  const confidence = signal.confidence ?? 0;
  const isReady = confidence >= 80;
  const isSetup = confidence >= 50 && confidence < 80;

  // Determine color based on confidence
  let color = STRATEGY_COLORS.fired;
  if (isReady) color = STRATEGY_COLORS.ready;
  else if (isSetup) color = STRATEGY_COLORS.setup;

  // Title with emoji indicator
  const emoji = isReady ? '🎯' : isSetup ? '📊' : '🔔';
  const statusLabel = isReady ? 'READY' : isSetup ? 'SETUP' : 'SIGNAL';
  const title = `${emoji} ${statusLabel}: ${signal.symbol}`;

  // Description
  const description = `**${strategy.name}**\n${strategy.description || 'Strategy signal detected'}`;

  // Fields
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: 'Confidence',
      value: `${Math.round(confidence)}%`,
      inline: true,
    },
    {
      name: 'Category',
      value: formatCategory(strategy.category),
      inline: true,
    },
    {
      name: 'Timeframe',
      value: strategy.barTimeframe.toUpperCase(),
      inline: true,
    },
  ];

  // Add signal payload details if available
  if (signal.payload) {
    const payload = signal.payload as any;
    
    if (payload.price !== undefined) {
      fields.push({
        name: 'Price',
        value: `$${formatPrice(payload.price)}`,
        inline: true,
      });
    }

    if (payload.time !== undefined) {
      const timeStr = new Date(payload.time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: strategy.timeWindow?.timezone || 'America/New_York',
      });
      fields.push({
        name: 'Time',
        value: timeStr,
        inline: true,
      });
    }

    if (payload.confidence_ready !== undefined) {
      fields.push({
        name: 'Status',
        value: payload.confidence_ready ? '✅ Ready to trade' : '⏳ Setup forming',
        inline: false,
      });
    }
  }

  // Add strategy parameters
  const params: string[] = [];
  
  if (strategy.entrySide !== 'BOTH') {
    params.push(`Direction: ${strategy.entrySide}`);
  }
  
  if (strategy.optionsPlayType) {
    params.push(`Type: ${formatPlayType(strategy.optionsPlayType)}`);
  }
  
  if (strategy.underlyingScope !== 'ANY') {
    params.push(`Scope: ${formatScope(strategy.underlyingScope)}`);
  }

  if (params.length > 0) {
    fields.push({
      name: 'Parameters',
      value: params.join(' • '),
      inline: false,
    });
  }

  // Add time window if restricted
  if (strategy.timeWindow) {
    const { start, end, timezone } = strategy.timeWindow;
    fields.push({
      name: 'Active Window',
      value: `${start} - ${end} ${formatTimezone(timezone)}`,
      inline: false,
    });
  }

  // Footer with strategy slug
  const footer = {
    text: `Strategy: ${strategy.slug} | Cooldown: ${strategy.cooldownMinutes}m`,
  };

  return {
    title,
    description,
    color,
    fields,
    footer,
    timestamp: signal.createdAt,
  };
}

/**
 * Get ping content based on confidence level.
 */
function getAlertPingContent(confidence: number): string | undefined {
  if (confidence >= 80) {
    return ''; // No ping for ready signals (avoid spam)
  }
  return undefined; // No content prefix
}

/**
 * Format helpers
 */

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(2);
  return price.toFixed(2);
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatPlayType(playType: string): string {
  const map: Record<string, string> = {
    single_leg: 'Single Leg',
    vertical_spread: 'Vertical Spread',
    '0dte_spx': '0DTE SPX',
    lotto: 'Lotto',
    other: 'Other',
  };
  return map[playType] || playType;
}

function formatScope(scope: string): string {
  const map: Record<string, string> = {
    ANY: 'All Symbols',
    SPX_ONLY: 'SPX Only',
    INDEXES: 'Indexes',
    ETFS: 'ETFs',
    SINGLE_STOCKS: 'Single Stocks',
  };
  return map[scope] || scope;
}

function formatTimezone(timezone: string): string {
  const map: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Los_Angeles': 'PT',
    'America/Denver': 'MT',
  };
  return map[timezone] || timezone;
}
