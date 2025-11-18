/**
 * Strategy Alert Behavior Processor
 * 
 * Processes alert behaviors when strategy signals fire:
 * - flashWatchlist: Temporarily highlight watchlist row
 * - showNowPlaying: Auto-open trade modal with pre-loaded contract
 * - notifyDiscord: Send Discord webhook notification
 * - autoOpenTradePlanner: Open trade planner with suggested entry/TP/SL
 */

import type { StrategySignal, StrategyDefinition } from '../../types/strategy';

export interface AlertProcessorContext {
  // UI callbacks
  flashWatchlist?: (symbol: string, durationMs?: number) => void;
  showNowPlaying?: (symbol: string, signal: StrategySignal, strategy: StrategyDefinition) => void;
  openTradePlanner?: (symbol: string, signal: StrategySignal, strategy: StrategyDefinition) => void;
  
  // Discord webhook URLs (by channel ID)
  discordChannels?: Array<{ id: string; name: string; webhookUrl: string }>;
  
  // User context
  userId?: string;
}

export interface ProcessedAlertResult {
  flashedWatchlist: boolean;
  openedNowPlaying: boolean;
  openedTradePlanner: boolean;
  sentDiscord: boolean;
  discordChannels: string[]; // Names of channels notified
  errors: string[];
}

/**
 * Process all alert behaviors for a fired strategy signal.
 * Call this when a new signal is received from realtime subscription.
 */
export async function processAlertBehavior(
  signal: StrategySignal,
  strategy: StrategyDefinition,
  context: AlertProcessorContext
): Promise<ProcessedAlertResult> {
  const result: ProcessedAlertResult = {
    flashedWatchlist: false,
    openedNowPlaying: false,
    openedTradePlanner: false,
    sentDiscord: false,
    discordChannels: [],
    errors: [],
  };

  const { alertBehavior } = strategy;
  if (!alertBehavior) {
    console.warn('[v0] processAlertBehavior: No alert behavior defined for strategy', strategy.slug);
    return result;
  }

  console.log('[v0] Processing alert behavior for signal:', {
    symbol: signal.symbol,
    strategy: strategy.slug,
    confidence: signal.confidence,
    behaviors: alertBehavior,
  });

  // 1. Flash Watchlist
  if (alertBehavior.flashWatchlist && context.flashWatchlist) {
    try {
      context.flashWatchlist(signal.symbol, 3000); // 3-second flash
      result.flashedWatchlist = true;
      console.log(`[v0] ✨ Flashed watchlist for ${signal.symbol}`);
    } catch (err) {
      result.errors.push(`Flash watchlist failed: ${err}`);
      console.error('[v0] Flash watchlist error:', err);
    }
  }

  // 2. Show Now Playing (auto-open trade modal)
  if (alertBehavior.showNowPlaying && context.showNowPlaying) {
    try {
      context.showNowPlaying(signal.symbol, signal, strategy);
      result.openedNowPlaying = true;
      console.log(`[v0] 📺 Opened Now Playing for ${signal.symbol}`);
    } catch (err) {
      result.errors.push(`Show now playing failed: ${err}`);
      console.error('[v0] Show now playing error:', err);
    }
  }

  // 3. Auto Open Trade Planner
  if (alertBehavior.autoOpenTradePlanner && context.openTradePlanner) {
    try {
      context.openTradePlanner(signal.symbol, signal, strategy);
      result.openedTradePlanner = true;
      console.log(`[v0] 📊 Opened Trade Planner for ${signal.symbol}`);
    } catch (err) {
      result.errors.push(`Open trade planner failed: ${err}`);
      console.error('[v0] Open trade planner error:', err);
    }
  }

  // 4. Notify Discord
  if (alertBehavior.notifyDiscord && context.discordChannels && context.discordChannels.length > 0) {
    try {
      // Import Discord sender (dynamic to avoid circular deps)
      const { sendStrategySignalToDiscord } = await import('../../lib/discord/strategyAlerts');
      
      const webhookUrls = context.discordChannels.map(ch => ch.webhookUrl);
      const channelNames = context.discordChannels.map(ch => ch.name);
      
      const success = await sendStrategySignalToDiscord(
        webhookUrls,
        signal,
        strategy
      );
      
      if (success) {
        result.sentDiscord = true;
        result.discordChannels = channelNames;
        console.log(`[v0] 📢 Sent Discord alert to ${channelNames.join(', ')}`);
      } else {
        result.errors.push('Discord send failed (see logs)');
      }
    } catch (err) {
      result.errors.push(`Discord notification failed: ${err}`);
      console.error('[v0] Discord notification error:', err);
    }
  }

  // Log summary
  const summary = {
    signal: `${signal.symbol} @ ${signal.confidence}%`,
    strategy: strategy.name,
    actions: {
      flash: result.flashedWatchlist,
      nowPlaying: result.openedNowPlaying,
      tradePlanner: result.openedTradePlanner,
      discord: result.sentDiscord ? result.discordChannels.join(', ') : false,
    },
    errors: result.errors.length > 0 ? result.errors : undefined,
  };
  
  console.log('[v0] Alert behavior processing complete:', summary);

  return result;
}

/**
 * Check if alert should be processed based on cooldown/rate limiting.
 * Returns true if alert should proceed, false if it should be suppressed.
 */
export function shouldProcessAlert(
  signal: StrategySignal,
  strategy: StrategyDefinition,
  recentSignals: StrategySignal[]
): boolean {
  // Check global rate limit: max 1 alert per symbol per minute across all strategies
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentForSymbol = recentSignals.filter(
    s => s.symbol === signal.symbol && new Date(s.createdAt) > oneMinuteAgo
  );
  
  if (recentForSymbol.length > 0) {
    console.log(`[v0] Suppressing alert for ${signal.symbol}: already alerted within last minute`);
    return false;
  }

  // Strategy-specific cooldown already enforced by scanner, but double-check here
  const cooldownMs = (strategy.cooldownMinutes ?? 5) * 60 * 1000;
  const cooldownExpiry = new Date(Date.now() - cooldownMs);
  const recentForStrategy = recentSignals.filter(
    s => s.strategyId === strategy.id && s.symbol === signal.symbol && new Date(s.createdAt) > cooldownExpiry
  );
  
  if (recentForStrategy.length > 1) {
    console.log(`[v0] Suppressing alert for ${signal.symbol} (${strategy.slug}): within cooldown period`);
    return false;
  }

  return true;
}
