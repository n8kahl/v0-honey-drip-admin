/**
 * NowPanelEmpty - Empty State for NowPanel
 *
 * Displayed when no focus target is selected.
 * Shows branding logo and helpful message.
 */

import React from "react";
import { branding } from "../../lib/config/branding";

interface NowPanelEmptyProps {
  message?: string;
}

export function NowPanelEmpty({ message }: NowPanelEmptyProps) {
  return (
    <div className="flex-1 relative flex items-center justify-center bg-[var(--bg-base)] animate-crossfade-scale">
      {/* Background logo - faded */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
        <img
          src={branding.logoUrl}
          alt={branding.appName}
          className="w-auto h-[45vh] max-w-[55vw] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-3 max-w-md px-6">
        <h3 className="text-lg font-semibold text-[var(--text-high)]">
          {branding.appName} Admin
        </h3>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">
          {message || "Select a ticker from the Watchlist or a trade to begin"}
        </p>

        {/* Subtle hint chips */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-faint)] text-xs">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-3)] text-[10px] font-mono">
              ←
            </kbd>
            Watchlist
          </span>
          <span className="text-[var(--text-faint)] text-xs">or</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-faint)] text-xs">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-3)] text-[10px] font-mono">
              →
            </kbd>
            Actions
          </span>
        </div>
      </div>
    </div>
  );
}

export default NowPanelEmpty;
