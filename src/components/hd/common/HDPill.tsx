import { SessionStatus } from "../../../types";
import { cn } from "../../../lib/utils";
import { isProductionEnv } from "../../../lib/env";

interface HDPillProps {
  status: SessionStatus;
  className?: string;
}

const sessionConfig = {
  premarket: {
    label: "Pre-Market",
    color: "var(--session-premarket)",
  },
  open: {
    label: "Open",
    color: "var(--session-open)",
  },
  afterhours: {
    label: "After Hours",
    color: "var(--session-afterhours)",
  },
  closed: {
    label: "Closed",
    color: "var(--session-closed)",
  },
};

let hasWarned = false;

export function HDPill({ status, className }: HDPillProps) {
  const fallback = {
    label: status || "Unknown",
    color: "var(--session-closed)",
  };
  const config = sessionConfig[status] ?? fallback;

  if (config === fallback && !isProductionEnv() && !hasWarned) {
    console.warn("[HDPill] Unknown session status, defaulting to closed", status);
    hasWarned = true;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 h-7 rounded-[var(--radius)]",
        "border border-[var(--border-hairline)] bg-[var(--surface-1)]",
        className
      )}
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
      <span className="text-[var(--text-high)]">{config.label}</span>
    </div>
  );
}
