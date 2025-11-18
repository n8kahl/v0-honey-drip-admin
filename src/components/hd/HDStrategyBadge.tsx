/**
 * HDStrategyBadge.tsx - Strategy signal badge with rich tooltip
 * 
 * Displays strategy name initials (ORB, VWR, EMA) in a pill badge.
 * On hover: Shows rich tooltip with full strategy rationale
 * On click: Navigates chart to the bar where signal triggered
 */

import { StrategySignal } from '../../types/strategy';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface HDStrategyBadgeProps {
  signal: StrategySignal;
  strategyName?: string;
  strategyShortName?: string; // Short name from database (e.g., "ORB", "VWR")
  strategyDescription?: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

/**
 * Get strategy name initials for badge display
 * Examples: "ORB", "VWR", "EMA", "FIB", "CLD"
 */
function getStrategyInitials(strategyId: string, shortName?: string, name?: string): string {
  // Priority 1: Use shortName from database if available
  if (shortName) {
    return shortName.toUpperCase();
  }
  
  // Priority 2: If we have the full name, extract intelligently
  if (name) {
    // Opening Range Breakout → ORB
    if (name.toLowerCase().includes('opening range')) return 'ORB';
    if (name.toLowerCase().includes('vwap')) return 'VWR';
    if (name.toLowerCase().includes('ema bounce') || name.toLowerCase().includes('ema rejection')) return 'EMA';
    if (name.toLowerCase().includes('cloud')) return 'CLD';
    if (name.toLowerCase().includes('fibonacci') || name.toLowerCase().includes('fib')) return 'FIB';
    if (name.toLowerCase().includes('range break')) return 'RNG';
    
    // Fallback: Take first letters of each word (up to 3)
    const words = name.split(' ').filter(w => w.length > 2); // Skip short words like "+"
    return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
  }
  
  // Priority 3: Fallback to slug analysis
  const slug = strategyId.toLowerCase();
  if (slug.includes('orb')) return 'ORB';
  if (slug.includes('vwap')) return 'VWR';
  if (slug.includes('ema')) return 'EMA';
  if (slug.includes('cloud')) return 'CLD';
  if (slug.includes('fib')) return 'FIB';
  
  // Last resort: first 3 chars of slug
  return strategyId.slice(0, 3).toUpperCase();
}

/**
 * Parse strategy conditions into human-readable bullets
 */
function getRationaleBullets(signal: StrategySignal, description?: string): string[] {
  const bullets: string[] = [];
  
  // Use description as first bullet if available
  if (description) {
    bullets.push(description);
  }
  
  // Parse payload for additional context
  const payload = signal.payload as any;
  if (payload) {
    if (payload.entryPrice) {
      bullets.push(`Entry: $${payload.entryPrice.toFixed(2)}`);
    }
    if (payload.stopLoss) {
      bullets.push(`Stop Loss: $${payload.stopLoss.toFixed(2)}`);
    }
    if (payload.targets && Array.isArray(payload.targets)) {
      bullets.push(`Targets: ${payload.targets.map((t: number) => `$${t.toFixed(2)}`).join(', ')}`);
    }
    if (payload.confluenceFactors && Array.isArray(payload.confluenceFactors)) {
      bullets.push(`Confluence: ${payload.confluenceFactors.join(', ')}`);
    }
    if (payload.side) {
      bullets.push(`Side: ${payload.side}`);
    }
  }
  
  // Add confidence
  bullets.push(`Confidence: ${signal.confidence}%`);
  
  // Add timestamp
  const createdAt = new Date(signal.createdAt);
  const timeStr = createdAt.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  bullets.push(`Triggered: ${timeStr}`);
  
  return bullets;
}

export function HDStrategyBadge({ 
  signal, 
  strategyName,
  strategyShortName,
  strategyDescription,
  onClick,
  size = 'sm'
}: HDStrategyBadgeProps) {
  const initials = getStrategyInitials(signal.strategyId, strategyShortName, strategyName);
  const bullets = getRationaleBullets(signal, strategyDescription);
  
  // Determine badge color based on signal side
  const side = (signal.payload as any)?.side || 'LONG';
  const colorClass = side === 'LONG' || side === 'bullish'
    ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
    : side === 'SHORT' || side === 'bearish'
    ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30';
  
  const sizeClasses = size === 'sm' 
    ? 'px-1.5 py-0.5 text-[9px]'
    : 'px-2 py-1 text-[10px]';
  
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className={cn(
              'inline-flex items-center justify-center rounded-full font-bold border transition-all',
              'cursor-pointer active:scale-95',
              colorClass,
              sizeClasses
            )}
            title={strategyName || signal.strategyId}
          >
            {initials}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm border-b border-[var(--border-hairline)] pb-1.5">
              {strategyName || signal.strategyId}
            </div>
            <ul className="text-xs space-y-1 text-[var(--text-muted)]">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[var(--accent-positive)] mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-[var(--text-faint)] pt-1 border-t border-[var(--border-hairline)]">
              Click badge to navigate chart to signal bar
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
