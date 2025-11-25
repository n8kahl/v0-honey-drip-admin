"use client";

import { Suspense, useState } from "react";
import { AppLayout } from "../components/layouts/AppLayout";
import { HDRadarScanner } from "../components/hd/dashboard/HDRadarScanner";
import { HDRadarOffHours } from "../components/hd/dashboard/HDRadarOffHours";
import { useAuth } from "../contexts/AuthContext";
import { useMarketSession } from "../hooks/useMarketSession";
import { cn } from "../lib/utils";
import { Radio, Moon, Sun, Activity } from "lucide-react";

type RadarMode = "auto" | "live" | "prep";

/**
 * RadarPage - Symbol radar scanner page
 *
 * This is the /radar route which shows the strategy scanner UI.
 * Automatically switches between:
 * - Live mode (market hours): Real-time composite signals
 * - Prep mode (off-hours): Session preparation with key levels & setups
 */
export default function RadarPage() {
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";
  const { session, loading: sessionLoading } = useMarketSession();
  const [mode, setMode] = useState<RadarMode>("auto");

  // Determine effective mode
  const isOffHours = session === "CLOSED" || session === "PRE" || session === "POST";
  const effectiveMode = mode === "auto" ? (isOffHours ? "prep" : "live") : mode;

  return (
    <AppLayout>
      <Suspense fallback={<RadarLoading />}>
        <div className="p-4 max-w-7xl mx-auto space-y-4">
          {/* Mode Toggle Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-[var(--brand-primary)]" />
              <div>
                <h1 className="text-xl font-bold text-[var(--text-high)]">Signal Radar</h1>
                <p className="text-sm text-[var(--text-muted)]">
                  {effectiveMode === "live"
                    ? "Real-time composite signals"
                    : "Session prep & key levels"}
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <ModeToggle mode={mode} setMode={setMode} isOffHours={isOffHours} session={session} />
          </div>

          {/* Content */}
          {sessionLoading ? (
            <RadarLoading />
          ) : effectiveMode === "live" ? (
            <HDRadarScanner userId={userId} />
          ) : (
            <HDRadarOffHours />
          )}
        </div>
      </Suspense>
    </AppLayout>
  );
}

// Mode toggle component
function ModeToggle({
  mode,
  setMode,
  isOffHours,
  session,
}: {
  mode: RadarMode;
  setMode: (mode: RadarMode) => void;
  isOffHours: boolean;
  session: string;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
      <button
        onClick={() => setMode("auto")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "auto"
            ? "bg-[var(--brand-primary)] text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Auto-switch based on market hours"
      >
        <Activity className="w-4 h-4" />
        Auto
      </button>
      <button
        onClick={() => setMode("live")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "live"
            ? "bg-green-500 text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Live signals view"
      >
        <Sun className="w-4 h-4" />
        Live
      </button>
      <button
        onClick={() => setMode("prep")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors",
          mode === "prep"
            ? "bg-purple-500 text-white"
            : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
        )}
        title="Session prep view"
      >
        <Moon className="w-4 h-4" />
        Prep
      </button>

      {/* Session indicator */}
      <div
        className={cn(
          "ml-2 px-2 py-1 rounded text-xs font-bold",
          session === "OPEN" && "bg-green-500/20 text-green-400",
          session === "PRE" && "bg-yellow-500/20 text-yellow-400",
          session === "POST" && "bg-blue-500/20 text-blue-400",
          session === "CLOSED" && "bg-red-500/20 text-red-400"
        )}
      >
        {session}
      </div>
    </div>
  );
}

// Loading state
function RadarLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-muted)]">Loading radar...</p>
      </div>
    </div>
  );
}
