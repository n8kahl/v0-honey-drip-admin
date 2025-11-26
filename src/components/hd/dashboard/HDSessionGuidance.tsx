/**
 * HDSessionGuidance - Smart session-aware trading guidance
 *
 * Provides contextual trading advice based on:
 * - Current market session timing
 * - Trade type (Scalp/Day/Swing)
 * - DTE and theta considerations
 * - Direction (calls vs puts)
 * - Live market conditions
 */

import { cn } from "../../../lib/utils";
import {
  Lightbulb,
  Clock,
  Sun,
  Sunset,
  Moon,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Timer,
  Coffee,
} from "lucide-react";
import type { Contract } from "../../../types";

interface HDSessionGuidanceProps {
  ticker: string;
  direction: "call" | "put";
  contract?: Contract;
  tradeType?: "Scalp" | "Day" | "Swing";
  className?: string;
  compact?: boolean;
}

type MarketSession =
  | "pre_market"
  | "opening_drive"
  | "morning_momentum"
  | "lunch_chop"
  | "afternoon"
  | "power_hour"
  | "after_hours";

interface SessionInfo {
  session: MarketSession;
  label: string;
  icon: React.ReactNode;
  minutesToClose: number;
  timeDescription: string;
}

interface GuidanceItem {
  id: string;
  priority: "critical" | "warning" | "info" | "tip";
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: string;
}

function getCurrentSession(): SessionInfo {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM - 4:00 PM ET (in minutes: 570 - 960)
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const minutesToClose = Math.max(0, marketClose - totalMinutes);

  let session: MarketSession;
  let label: string;
  let icon: React.ReactNode;
  let timeDescription: string;

  if (totalMinutes < marketOpen) {
    session = "pre_market";
    label = "Pre-Market";
    icon = <Moon className="w-4 h-4" />;
    timeDescription = `${Math.floor((marketOpen - totalMinutes) / 60)}h ${(marketOpen - totalMinutes) % 60}m to open`;
  } else if (totalMinutes < marketOpen + 30) {
    session = "opening_drive";
    label = "Opening Drive";
    icon = <Zap className="w-4 h-4" />;
    timeDescription = "First 30 minutes of trading";
  } else if (totalMinutes < 11 * 60 + 30) {
    session = "morning_momentum";
    label = "Morning Momentum";
    icon = <Sun className="w-4 h-4" />;
    timeDescription = "Prime trend-following window";
  } else if (totalMinutes < 14 * 60) {
    session = "lunch_chop";
    label = "Lunch Chop";
    icon = <Coffee className="w-4 h-4" />;
    timeDescription = "Lower volume, choppy action";
  } else if (totalMinutes < 15 * 60) {
    session = "afternoon";
    label = "Afternoon Session";
    icon = <Timer className="w-4 h-4" />;
    timeDescription = "Volume returning";
  } else if (totalMinutes < marketClose) {
    session = "power_hour";
    label = "Power Hour";
    icon = <Sunset className="w-4 h-4" />;
    timeDescription = `${minutesToClose}m to close`;
  } else {
    session = "after_hours";
    label = "After Hours";
    icon = <Moon className="w-4 h-4" />;
    timeDescription = "Market closed";
  }

  return {
    session,
    label,
    icon,
    minutesToClose,
    timeDescription,
  };
}

function generateGuidance(
  ticker: string,
  direction: "call" | "put",
  contract: Contract | undefined,
  tradeType: "Scalp" | "Day" | "Swing",
  session: SessionInfo
): GuidanceItem[] {
  const guidance: GuidanceItem[] = [];
  const dte = contract?.daysToExpiry ?? 0;
  const isCall = direction === "call";

  // Session-specific guidance
  switch (session.session) {
    case "pre_market":
      guidance.push({
        id: "pre_market",
        priority: "info",
        icon: <Moon className="w-3.5 h-3.5" />,
        title: "Pre-Market Planning",
        message:
          "Set your levels, review news catalysts, and wait for the opening bell for better fills.",
        action: "Review key levels and plan entries",
      });
      break;

    case "opening_drive":
      guidance.push({
        id: "opening_drive",
        priority: "warning",
        icon: <Zap className="w-3.5 h-3.5" />,
        title: "High Volatility Window",
        message:
          "Spreads are widest and price action is fastest. Use smaller size and quick decisions.",
        action:
          tradeType === "Scalp" ? "Prime scalping window" : "Wait for first 15-20 min to stabilize",
      });
      break;

    case "morning_momentum":
      guidance.push({
        id: "morning_momentum",
        priority: "tip",
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        title: "Best Trading Window",
        message: "Liquidity is strong and trends tend to continue. Look for pullback entries.",
        action: "Follow the trend with proper stops",
      });
      break;

    case "lunch_chop":
      guidance.push({
        id: "lunch_chop",
        priority: "warning",
        icon: <Coffee className="w-3.5 h-3.5" />,
        title: "Caution: Choppy Session",
        message: "Volume drops and price action gets noisy. False breakouts are common.",
        action: tradeType === "Scalp" ? "Consider sitting out" : "Wide stops or wait for afternoon",
      });
      break;

    case "afternoon":
      guidance.push({
        id: "afternoon",
        priority: "info",
        icon: <Timer className="w-3.5 h-3.5" />,
        title: "Volume Returning",
        message: "Institutional traders are back. Watch for trend continuation from morning.",
        action: "Look for afternoon breakouts",
      });
      break;

    case "power_hour":
      guidance.push({
        id: "power_hour",
        priority: dte === 0 ? "critical" : "warning",
        icon: <Sunset className="w-3.5 h-3.5" />,
        title: "Power Hour Active",
        message: "Strong moves possible, but theta is accelerating for short-dated options.",
        action: dte === 0 ? "Close 0DTE positions soon" : "Take profits into close",
      });
      break;

    case "after_hours":
      guidance.push({
        id: "after_hours",
        priority: "info",
        icon: <Moon className="w-3.5 h-3.5" />,
        title: "Market Closed",
        message: "Options don't trade after hours. Review your positions and plan for tomorrow.",
        action: "Prepare overnight strategy",
      });
      break;
  }

  // DTE-specific guidance
  if (dte === 0) {
    guidance.push({
      id: "dte_0",
      priority: "critical",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: "0DTE: Rapid Decay",
      message: "Theta is eating premium every minute. Quick scalps only, don't hold losers.",
      action: "Take profits fast, cut losses faster",
    });
  } else if (dte === 1) {
    guidance.push({
      id: "dte_1",
      priority: "warning",
      icon: <Clock className="w-3.5 h-3.5" />,
      title: "1DTE: Elevated Theta",
      message:
        session.session === "afternoon" || session.session === "power_hour"
          ? "Consider closing before EOD to avoid overnight decay."
          : "Theta will accelerate into tomorrow. Plan your exit.",
      action: "Set clear exit rules",
    });
  }

  // Trade style guidance
  if (tradeType === "Scalp") {
    guidance.push({
      id: "scalp_style",
      priority: "tip",
      icon: <Zap className="w-3.5 h-3.5" />,
      title: "Scalp Style Active",
      message: "Focus on quick 10-20% gains. Cut losers at -30%. Don't let winners turn to losers.",
      action: "Quick in, quick out",
    });
  } else if (tradeType === "Swing") {
    if (dte < 7) {
      guidance.push({
        id: "swing_warning",
        priority: "warning",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        title: "Short DTE for Swing",
        message: "Swing trades need time. Consider longer-dated options (7+ DTE) for this style.",
        action: "Extend expiration or switch to day trade",
      });
    }
  }

  // Direction-specific guidance
  if (isCall && session.session === "power_hour") {
    guidance.push({
      id: "call_power_hour",
      priority: "info",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      title: "End-of-Day Call Setup",
      message: "Calls often benefit from EOD institutional buying and short covering.",
    });
  } else if (!isCall && session.session === "opening_drive") {
    guidance.push({
      id: "put_opening",
      priority: "info",
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      title: "Opening Put Play",
      message: "Morning gaps often fade. Puts can work on failed gap-up attempts.",
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, warning: 1, info: 2, tip: 3 };
  return guidance.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function HDSessionGuidance({
  ticker,
  direction,
  contract,
  tradeType = "Day",
  className,
  compact = false,
}: HDSessionGuidanceProps) {
  const session = getCurrentSession();
  const guidance = generateGuidance(ticker, direction, contract, tradeType, session);

  const getPriorityColor = (priority: GuidanceItem["priority"]) => {
    switch (priority) {
      case "critical":
        return "text-[var(--accent-negative)]";
      case "warning":
        return "text-amber-400";
      case "info":
        return "text-blue-400";
      case "tip":
        return "text-[var(--accent-positive)]";
    }
  };

  const getPriorityBg = (priority: GuidanceItem["priority"]) => {
    switch (priority) {
      case "critical":
        return "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30";
      case "warning":
        return "bg-amber-500/10 border-amber-500/30";
      case "info":
        return "bg-blue-500/10 border-blue-500/30";
      case "tip":
        return "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30";
    }
  };

  if (compact) {
    // Compact mode - just show session and top guidance
    const topGuidance = guidance[0];

    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            {session.icon}
            <span className="uppercase tracking-wide">{session.label}</span>
          </div>
          <span className="text-[var(--text-faint)]">{session.timeDescription}</span>
        </div>
        {topGuidance && (
          <div
            className={cn(
              "px-2 py-1.5 rounded-[var(--radius)] border text-[10px]",
              getPriorityBg(topGuidance.priority)
            )}
          >
            <div
              className={cn("flex items-center gap-1.5", getPriorityColor(topGuidance.priority))}
            >
              {topGuidance.icon}
              <span className="font-medium">{topGuidance.title}</span>
            </div>
            {topGuidance.action && (
              <p className="text-[var(--text-muted)] mt-0.5 pl-5">{topGuidance.action}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Session Guidance
        </h4>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-2)] text-[10px] text-[var(--text-med)]">
          {session.icon}
          <span className="font-medium">{session.label}</span>
          <span className="text-[var(--text-faint)]">• {session.timeDescription}</span>
        </div>
      </div>

      {/* Guidance Items */}
      <div className="space-y-2">
        {guidance.map((item) => (
          <div
            key={item.id}
            className={cn(
              "px-2.5 py-2 rounded-[var(--radius)] border",
              getPriorityBg(item.priority)
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                getPriorityColor(item.priority)
              )}
            >
              {item.icon}
              <span>{item.title}</span>
            </div>
            <p className="text-[10px] text-[var(--text-med)] mt-1 pl-5">{item.message}</p>
            {item.action && (
              <div className="mt-1.5 pl-5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-[9px] text-[var(--text-high)] font-medium">
                  {item.action}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-hairline)]">
        <div className="text-center">
          <div className="text-[9px] text-[var(--text-muted)] uppercase">Session</div>
          <div className="text-xs text-[var(--text-high)] font-medium">{session.label}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[var(--text-muted)] uppercase">Style</div>
          <div className="text-xs text-[var(--text-high)] font-medium">{tradeType}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[var(--text-muted)] uppercase">Direction</div>
          <div
            className={cn(
              "text-xs font-medium",
              direction === "call"
                ? "text-[var(--accent-positive)]"
                : "text-[var(--accent-negative)]"
            )}
          >
            {direction === "call" ? "Bullish" : "Bearish"}
          </div>
        </div>
      </div>
    </div>
  );
}
