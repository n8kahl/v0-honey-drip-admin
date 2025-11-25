/**
 * HDRadarOffHours - Off-hours radar experience
 *
 * Comprehensive view for trading prep during off-hours:
 * - Market countdown with futures
 * - Key levels analysis
 * - Setup scenarios to watch
 * - Session tips and reminders
 */

import { useOffHoursData } from "../../../hooks/useOffHoursData";
import { HDMarketCountdown } from "./HDMarketCountdown";
import { HDKeyLevelsPanel } from "./HDKeyLevelsPanel";
import { HDSetupsToWatch } from "./HDSetupsToWatch";
import { cn } from "../../../lib/utils";
import {
  Calendar,
  AlertTriangle,
  Bookmark,
  Clock,
  TrendingUp,
  Activity,
  Target,
  Moon,
  Sun,
  Coffee,
} from "lucide-react";

interface HDRadarOffHoursProps {
  className?: string;
}

export function HDRadarOffHours({ className }: HDRadarOffHoursProps) {
  const { session, isOffHours, futures, setupScenarios, error, refresh } = useOffHoursData();

  // Session-specific header content
  const sessionConfig = {
    CLOSED: {
      icon: Moon,
      title: "Weekend Research Mode",
      subtitle: "Plan your setups for the week ahead",
      gradient: "from-purple-500/20 to-blue-500/20",
      accentColor: "text-purple-400",
    },
    PRE: {
      icon: Coffee,
      title: "Pre-Market Prep",
      subtitle: "Review overnight moves and finalize plans",
      gradient: "from-yellow-500/20 to-orange-500/20",
      accentColor: "text-yellow-400",
    },
    POST: {
      icon: Moon,
      title: "After-Hours Review",
      subtitle: "Analyze today's action, prep for tomorrow",
      gradient: "from-blue-500/20 to-indigo-500/20",
      accentColor: "text-blue-400",
    },
    OPEN: {
      icon: Sun,
      title: "Market Live",
      subtitle: "Switch to live radar for real-time signals",
      gradient: "from-green-500/20 to-emerald-500/20",
      accentColor: "text-green-400",
    },
  };

  const config = sessionConfig[session];
  const SessionIcon = config.icon;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Session Header */}
      <div
        className={cn("relative rounded-2xl overflow-hidden", "bg-gradient-to-r", config.gradient)}
      >
        <div className="absolute inset-0 bg-[var(--surface-1)] opacity-80" />
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  "bg-[var(--surface-2)] border border-[var(--border-hairline)]"
                )}
              >
                <SessionIcon className={cn("w-7 h-7", config.accentColor)} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-high)]">{config.title}</h1>
                <p className="text-[var(--text-muted)] mt-0.5">{config.subtitle}</p>
              </div>
            </div>

            {/* Quick Stats */}
            {isOffHours && setupScenarios.length > 0 && (
              <div className="flex items-center gap-4">
                <QuickStat icon={Target} value={setupScenarios.length} label="Setups" />
                <QuickStat
                  icon={TrendingUp}
                  value={setupScenarios.filter((s) => s.direction === "long").length}
                  label="Long"
                  color="text-green-400"
                />
                <QuickStat
                  icon={Activity}
                  value={setupScenarios.filter((s) => s.confidence === "high").length}
                  label="High Conf"
                  color="text-yellow-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
          <button onClick={refresh} className="ml-auto text-sm underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Countdown & Tips */}
        <div className="lg:col-span-4 space-y-6">
          <HDMarketCountdown />

          {/* Session Tips */}
          <SessionTips session={session} futures={futures} />

          {/* Checklist */}
          <PrepChecklist session={session} />
        </div>

        {/* Right Column - Analysis */}
        <div className="lg:col-span-8 space-y-6">
          <HDSetupsToWatch maxSetups={6} />
          <HDKeyLevelsPanel maxSymbols={5} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-[var(--border-hairline)]">
        <p className="text-sm text-[var(--text-muted)]">
          Data refreshes every 5 minutes during off-hours.{" "}
          <button onClick={refresh} className="text-[var(--brand-primary)] hover:underline">
            Refresh now
          </button>
        </p>
      </div>
    </div>
  );
}

// Quick stat badge
function QuickStat({
  icon: Icon,
  value,
  label,
  color = "text-[var(--text-high)]",
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={cn("flex items-center justify-center gap-1 text-2xl font-bold", color)}>
        <Icon className="w-5 h-5" />
        {value}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

// Session-specific tips
function SessionTips({
  session,
  futures,
}: {
  session: string;
  futures: ReturnType<typeof useOffHoursData>["futures"];
}) {
  const tips: { icon: React.ReactNode; text: string; highlight?: boolean }[] = [];

  if (session === "CLOSED") {
    tips.push({
      icon: <Calendar className="w-4 h-4 text-purple-400" />,
      text: "Review economic calendar for upcoming catalysts",
    });
    tips.push({
      icon: <Bookmark className="w-4 h-4 text-blue-400" />,
      text: "Note key earnings dates in your watchlist",
    });
    tips.push({
      icon: <Target className="w-4 h-4 text-green-400" />,
      text: "Identify 2-3 high-probability setups to focus on",
    });
  } else if (session === "PRE") {
    tips.push({
      icon: <Activity className="w-4 h-4 text-yellow-400" />,
      text: "Check overnight futures direction",
      highlight: true,
    });
    tips.push({
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      text: "Review any pre-market news or earnings",
    });
    tips.push({
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      text: "Set alerts for key levels before open",
    });
  } else if (session === "POST") {
    tips.push({
      icon: <Target className="w-4 h-4 text-green-400" />,
      text: "Journal your trades from today",
    });
    tips.push({
      icon: <Activity className="w-4 h-4 text-purple-400" />,
      text: "Check after-hours movers in your watchlist",
    });
    tips.push({
      icon: <Calendar className="w-4 h-4 text-blue-400" />,
      text: "Preview tomorrow's economic data",
    });
  }

  // Add VIX warning if elevated
  if (futures && futures.vix.level === "high") {
    tips.unshift({
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      text: `VIX at ${futures.vix.value.toFixed(1)} - High volatility expected. Consider reducing position sizes.`,
      highlight: true,
    });
  }

  return (
    <div className="rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <h3 className="font-semibold text-[var(--text-high)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--brand-primary)]" />
          Session Tips
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {tips.map((tip, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-3 p-2 rounded-lg",
              tip.highlight && "bg-[var(--surface-2)] border border-yellow-500/30"
            )}
          >
            {tip.icon}
            <span className="text-sm text-[var(--text-muted)]">{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pre-session checklist
function PrepChecklist({ session }: { session: string }) {
  const items =
    session === "PRE"
      ? [
          { id: "review", label: "Review overnight levels", done: false },
          { id: "alerts", label: "Set key level alerts", done: false },
          { id: "plan", label: "Confirm trade plan", done: false },
          { id: "size", label: "Check position sizing", done: false },
        ]
      : session === "CLOSED"
        ? [
            { id: "journal", label: "Review last week's trades", done: false },
            { id: "levels", label: "Mark key weekly levels", done: false },
            { id: "watchlist", label: "Update watchlist", done: false },
            { id: "calendar", label: "Check economic calendar", done: false },
          ]
        : [
            { id: "journal", label: "Journal today's trades", done: false },
            { id: "review", label: "Review what worked/didn't", done: false },
            { id: "prep", label: "Note levels for tomorrow", done: false },
          ];

  return (
    <div className="rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <h3 className="font-semibold text-[var(--text-high)] flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[var(--brand-primary)]" />
          Prep Checklist
        </h3>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-[var(--border-hairline)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            <span className="text-sm text-[var(--text-muted)]">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Export for use in Radar page
export default HDRadarOffHours;
