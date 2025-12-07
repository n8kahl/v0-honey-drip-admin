import { Trade, Challenge } from '../../../types';
import { formatPrice, formatPercent, cn } from '../../../lib/utils';
import { TrendingUp, TrendingDown, Clock, Target, Shield, Zap } from 'lucide-react';

interface HDShareCardV2Props {
  trade: Trade;
  challenges?: Challenge[];
  className?: string;
}

/**
 * Enhanced social media share card
 * Designed to look exciting like Webull/Robinhood share cards
 * Features: Large P&L, gradient backgrounds, challenge badges, full trade journey
 */
export function HDShareCardV2({ trade, challenges = [], className }: HDShareCardV2Props) {
  const isProfit = (trade.movePercent || 0) >= 0;
  const isBigWin = (trade.movePercent || 0) >= 50;
  const duration = trade.entryTime && trade.exitTime
    ? formatDuration(trade.entryTime, trade.exitTime)
    : null;

  // Get all challenge names for display
  const tradeChallengeNames = trade.challenges
    .map(cId => challenges.find(c => c.id === cId)?.name)
    .filter(Boolean);

  // Format date/time
  const exitDateTime = trade.exitTime ? new Date(trade.exitTime) : null;
  const dateStr = exitDateTime
    ? exitDateTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const timeStr = exitDateTime
    ? exitDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  // Calculate actual gain if exit and entry prices available
  const priceGain = trade.exitPrice && trade.entryPrice
    ? trade.exitPrice - trade.entryPrice
    : 0;

  return (
    <div
      className={cn(
        "relative w-full aspect-[4/5] rounded-2xl overflow-hidden",
        "bg-gradient-to-br",
        isProfit
          ? "from-[#0D1F0D] via-[#0A1A0A] to-[#051005]"
          : "from-[#1F0D0D] via-[#1A0A0A] to-[#100505]",
        "border-2",
        isProfit ? "border-[var(--accent-positive)]/30" : "border-[var(--accent-negative)]/30",
        className
      )}
    >
      {/* Animated gradient background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Main glow */}
        <div
          className={cn(
            "absolute top-1/4 left-1/2 -translate-x-1/2 w-[150%] h-[150%] rounded-full blur-[100px] opacity-30",
            isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
          )}
        />
        {/* Secondary glow */}
        <div
          className={cn(
            "absolute bottom-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20",
            isProfit ? "bg-emerald-500" : "bg-rose-500"
          )}
        />
        {/* Sparkle effects for big wins */}
        {isBigWin && (
          <>
            <div className="absolute top-20 left-8 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <div className="absolute top-32 right-12 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse delay-100" />
            <div className="absolute top-48 left-16 w-1 h-1 bg-yellow-200 rounded-full animate-pulse delay-200" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Header - Logo & Challenge Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <span className="text-black font-bold text-lg">HD</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">HoneyDrip</div>
              <div className="text-white/50 text-micro">Network</div>
            </div>
          </div>

          {/* Challenge badges */}
          {tradeChallengeNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[50%]">
              {tradeChallengeNames.map((name, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 backdrop-blur-sm"
                >
                  <span className="text-white/90 text-micro font-medium">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticker & Contract - Prominent */}
        <div className="text-center mb-4">
          <div className="text-white text-4xl font-bold tracking-tight mb-1">
            {trade.ticker}
          </div>
          <div className="text-white/60 text-sm">
            ${trade.contract.strike}{trade.contract.type} • {trade.contract.daysToExpiry}DTE
          </div>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-white/80 text-micro font-medium">{trade.tradeType}</span>
          </div>
        </div>

        {/* Hero P&L Display */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {/* P&L Icon */}
            <div
              className={cn(
                "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                "bg-gradient-to-br shadow-2xl",
                isProfit
                  ? "from-emerald-500/30 to-emerald-600/10"
                  : "from-rose-500/30 to-rose-600/10"
              )}
            >
              {isProfit ? (
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-rose-400" />
              )}
            </div>

            {/* P&L Percentage - HUGE */}
            <div
              className={cn(
                "text-6xl sm:text-7xl font-black tabular-nums tracking-tight",
                isProfit ? "text-emerald-400" : "text-rose-400"
              )}
              style={{
                textShadow: isProfit
                  ? '0 0 40px rgba(52, 211, 153, 0.5), 0 0 80px rgba(52, 211, 153, 0.3)'
                  : '0 0 40px rgba(251, 113, 133, 0.5), 0 0 80px rgba(251, 113, 133, 0.3)',
              }}
            >
              {(trade.movePercent || 0) >= 0 ? '+' : ''}{formatPercent(trade.movePercent || 0)}
            </div>

            {/* Price change */}
            {priceGain !== 0 && (
              <div
                className={cn(
                  "text-xl font-bold mt-2 tabular-nums",
                  isProfit ? "text-emerald-300/80" : "text-rose-300/80"
                )}
              >
                {priceGain >= 0 ? '+' : ''}{formatPrice(priceGain)} per contract
              </div>
            )}
          </div>
        </div>

        {/* Trade Journey */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-white/50 text-micro uppercase tracking-wide">Entry</span>
              </div>
              <div className="text-white text-lg font-bold tabular-nums">
                ${formatPrice(trade.entryPrice || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isProfit ? "bg-emerald-400" : "bg-rose-400"
                  )}
                />
                <span className="text-white/50 text-micro uppercase tracking-wide">Exit</span>
              </div>
              <div className="text-white text-lg font-bold tabular-nums">
                ${formatPrice(trade.exitPrice || 0)}
              </div>
            </div>
          </div>

          {/* Target & Stop Loss */}
          {(trade.targetPrice || trade.stopLoss) && (
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
              {trade.targetPrice && (
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-emerald-400/70" />
                  <span className="text-white/50 text-micro">Target:</span>
                  <span className="text-emerald-300/80 text-sm tabular-nums">
                    ${formatPrice(trade.targetPrice)}
                  </span>
                </div>
              )}
              {trade.stopLoss && (
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-rose-400/70" />
                  <span className="text-white/50 text-micro">Stop:</span>
                  <span className="text-rose-300/80 text-sm tabular-nums">
                    ${formatPrice(trade.stopLoss)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Duration & Timestamp */}
        <div className="flex items-center justify-between text-white/40 text-xs">
          {duration && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Held {duration}</span>
            </div>
          )}
          {dateStr && timeStr && (
            <div>
              {dateStr} • {timeStr} EST
            </div>
          )}
        </div>
      </div>

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />
    </div>
  );
}

/**
 * Format duration between two dates
 */
function formatDuration(start: Date | string, end: Date | string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    if (minutes === 0) return '<1m';
    return `${minutes}m`;
  }

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  }

  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
