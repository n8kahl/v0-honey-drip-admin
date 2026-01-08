import { cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface HDFlowAlignmentBadgeProps {
  signalDirection: "LONG" | "SHORT";
  flowSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  recommendation?: string;
  institutionalScore?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Visual indicator showing flow alignment with signal direction
 *
 * ALIGNED: Flow supports the signal direction
 * - Bullish flow + LONG signal = aligned
 * - Bearish flow + SHORT signal = aligned
 *
 * OPPOSED: Flow contradicts the signal direction
 * - Bullish flow + SHORT signal = opposed
 * - Bearish flow + LONG signal = opposed
 */
export function HDFlowAlignmentBadge({
  signalDirection,
  flowSentiment,
  recommendation,
  institutionalScore,
  compact = false,
  className,
}: HDFlowAlignmentBadgeProps) {
  // Determine alignment
  let alignment: "ALIGNED" | "OPPOSED" | "NEUTRAL" = "NEUTRAL";

  if (
    (flowSentiment === "BULLISH" && signalDirection === "LONG") ||
    (flowSentiment === "BEARISH" && signalDirection === "SHORT")
  ) {
    alignment = "ALIGNED";
  } else if (
    (flowSentiment === "BULLISH" && signalDirection === "SHORT") ||
    (flowSentiment === "BEARISH" && signalDirection === "LONG")
  ) {
    alignment = "OPPOSED";
  }

  // Get display properties
  const getAlignmentDisplay = () => {
    switch (alignment) {
      case "ALIGNED":
        return {
          icon: <CheckCircle2 className={cn("w-3.5 h-3.5", compact && "w-3 h-3")} />,
          label: "Flow Aligned",
          description: recommendation || "FOLLOW_FLOW",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          textColor: "text-emerald-400",
        };
      case "OPPOSED":
        return {
          icon: <XCircle className={cn("w-3.5 h-3.5", compact && "w-3 h-3")} />,
          label: "Flow Opposed",
          description: recommendation || "FADE_FLOW",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          textColor: "text-red-400",
        };
      default:
        return {
          icon: <AlertTriangle className={cn("w-3.5 h-3.5", compact && "w-3 h-3")} />,
          label: "Flow Neutral",
          description: recommendation || "NEUTRAL",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/30",
          textColor: "text-amber-400",
        };
    }
  };

  const display = getAlignmentDisplay();

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
          display.bgColor,
          display.borderColor,
          display.textColor,
          className
        )}
      >
        {display.icon}
        <span>
          {alignment === "ALIGNED" ? "Aligned" : alignment === "OPPOSED" ? "Opposed" : "Neutral"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        display.bgColor,
        display.borderColor,
        className
      )}
    >
      <div className={cn("flex-shrink-0", display.textColor)}>{display.icon}</div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-xs font-medium", display.textColor)}>{display.label}</div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">{display.description}</div>
      </div>
      {institutionalScore !== undefined && (
        <div className="flex-shrink-0 text-right">
          <div className="text-xs font-mono font-medium text-[var(--text-high)]">
            {institutionalScore.toFixed(0)}
          </div>
          <div className="text-[9px] text-[var(--text-muted)]">Inst</div>
        </div>
      )}
    </div>
  );
}

/**
 * Small inline version for use in signal badges
 */
export function HDFlowAlignmentDot({
  signalDirection,
  flowSentiment,
}: Pick<HDFlowAlignmentBadgeProps, "signalDirection" | "flowSentiment">) {
  let alignment: "ALIGNED" | "OPPOSED" | "NEUTRAL" = "NEUTRAL";

  if (
    (flowSentiment === "BULLISH" && signalDirection === "LONG") ||
    (flowSentiment === "BEARISH" && signalDirection === "SHORT")
  ) {
    alignment = "ALIGNED";
  } else if (
    (flowSentiment === "BULLISH" && signalDirection === "SHORT") ||
    (flowSentiment === "BEARISH" && signalDirection === "LONG")
  ) {
    alignment = "OPPOSED";
  }

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full",
        alignment === "ALIGNED" && "bg-emerald-400",
        alignment === "OPPOSED" && "bg-red-400",
        alignment === "NEUTRAL" && "bg-amber-400"
      )}
      title={`Flow ${alignment.toLowerCase()}`}
    />
  );
}
