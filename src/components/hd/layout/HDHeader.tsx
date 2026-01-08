import { SessionStatus } from "../../../types";
import { HDPill } from "../common/HDPill";
import { Settings, User, LogOut, WifiOff, Wifi } from "lucide-react";
import { cn } from "../../../lib/utils";
import { branding } from "../../../lib/config/branding";
import { useAuth } from "../../../contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useMarketDataConnection } from "../../../hooks/useMassiveData";
import { massive } from "../../../lib/massive";
import { useStreamingIndex } from "../../../hooks/useIndicesAdvanced";
import { useMarketSession } from "../../../hooks/useMarketSession";
import { getSessionColor } from "../../../lib/marketSession";

interface HDHeaderProps {
  sessionStatus: SessionStatus;
  onSettingsClick?: () => void;
  className?: string;
}

export function HDHeader({ sessionStatus, onSettingsClick, className }: HDHeaderProps) {
  const { signOut, user } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { quote: spxQuote } = useStreamingIndex("SPX");
  const { quote: vixQuote } = useStreamingIndex("VIX");

  const { session, sessionState } = useMarketSession();

  const { isConnected, hasApiKey, lastError } = useMarketDataConnection();

  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        label: "DISCONNECTED",
        tooltip: lastError || "Unable to connect to market data API",
        color: "red",
        icon: WifiOff,
      };
    }
    return {
      label: "LIVE DATA",
      tooltip: "Connected to live market data",
      color: "green",
      icon: Wifi,
    };
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  const getMarketStatusDisplay = () => {
    if (!sessionState) return null;

    const colorClass = getSessionColor(session);

    const time = new Date(sessionState.asOf).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      label: sessionState.label,
      time: `${time} ET`,
      color: colorClass,
    };
  };

  const marketDisplay = getMarketStatusDisplay();

  return (
    <header
      className={cn(
        "flex items-center justify-between px-3 lg:px-6 h-16 lg:h-14 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]",
        className
      )}
    >
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        <img
          src={branding.logoUrl || "/placeholder.svg"}
          alt={branding.appName}
          className="w-9 h-9 lg:w-8 lg:h-8 rounded flex-shrink-0"
        />
        <h1 className="text-[var(--text-high)] font-semibold tracking-tight text-sm lg:text-base truncate">
          <span className="hidden lg:inline">{branding.appName} Admin</span>
          <span className="lg:hidden">{branding.appName}</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 flex-shrink min-w-0 mx-2">
        {spxQuote && (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)] flex-shrink-0">
            <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
              SPX
            </span>
            <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
              {spxQuote.value.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                spxQuote.changePercent > 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              {spxQuote.changePercent > 0 ? "+" : ""}
              {spxQuote.changePercent.toFixed(2)}%
            </span>
          </div>
        )}

        {vixQuote && (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)] flex-shrink-0">
            <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
              VIX
            </span>
            <span className="text-xs font-medium text-[var(--text-high)] tabular-nums">
              {vixQuote.value.toFixed(2)}
            </span>
          </div>
        )}

        {marketDisplay && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)] flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", marketDisplay.color)} />
              <span className={cn("text-xs font-medium whitespace-nowrap", marketDisplay.color)}>
                {marketDisplay.label}
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {marketDisplay.time}
            </span>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full border flex-shrink-0",
            connectionStatus.color === "yellow" && "bg-yellow-500/10 border-yellow-500/20",
            connectionStatus.color === "red" &&
              "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20",
            connectionStatus.color === "green" &&
              "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/20"
          )}
          title={connectionStatus.tooltip}
        >
          <StatusIcon
            className={cn(
              "w-3 h-3 flex-shrink-0",
              connectionStatus.color === "yellow" && "text-yellow-500",
              connectionStatus.color === "red" && "text-[var(--accent-negative)]",
              connectionStatus.color === "green" && "text-[var(--accent-positive)]"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium hidden lg:inline whitespace-nowrap",
              connectionStatus.color === "yellow" && "text-yellow-500",
              connectionStatus.color === "red" && "text-[var(--accent-negative)]",
              connectionStatus.color === "green" && "text-[var(--accent-positive)]"
            )}
          >
            {connectionStatus.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-[var(--brand-primary)] text-white font-medium text-xs hover:opacity-90 transition-opacity"
            aria-label="Profile menu"
          >
            {user?.email?.substring(0, 2).toUpperCase()}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] shadow-xl py-1 z-50">
              <div className="px-3 py-2 border-b border-[var(--border-hairline)]">
                <div className="text-[var(--text-high)] text-sm font-medium truncate">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onSettingsClick?.();
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-med)] hover:bg-[var(--surface-2)] hover:text-[var(--text-high)] transition-colors flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Profile & Settings
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  signOut();
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-med)] hover:bg-[var(--surface-2)] hover:text-[var(--text-high)] transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
