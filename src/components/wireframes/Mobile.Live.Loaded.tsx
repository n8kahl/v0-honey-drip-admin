import { useState } from 'react';
import { Settings, Mic, ChevronUp, X } from 'lucide-react';

export function MobileLiveLoaded() {
  const [nowPlayingExpanded, setNowPlayingExpanded] = useState(true);
  const [showEnterAlert, setShowEnterAlert] = useState(false);

  return (
    <div className="w-[390px] h-[844px] bg-[var(--bg-base)] flex flex-col mx-auto border-x border-[var(--border-hairline)] relative">
      
      {/* HEADER */}
      <header className="h-14 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-[var(--bg-base)] font-bold text-[10px]">HD</span>
          </div>
          <span className="text-[var(--text-high)] text-sm font-medium">HoneyDrip</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]">
            <Settings className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-[var(--bg-base)]">
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Market Status Bar */}
      <div className="bg-[var(--surface-2)] border-b border-[var(--border-hairline)] px-4 py-2 flex items-center justify-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
            <span className="text-[var(--positive)] text-[10px] font-medium uppercase tracking-wide">
              ● Open
            </span>
          </div>
          <span className="text-[var(--text-muted)] text-[10px]">
            Data as of <span className="text-[var(--text-high)]">14:33:12</span>
          </span>
        </div>
      </div>

      {/* MAIN CONTENT - Brief Context */}
      <div className="flex-1 overflow-y-auto pb-80">
        <div className="p-4">
          <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs leading-relaxed">
              💡 Trade idea <strong>loaded</strong>. Expand the panel below to enter this trade and send an alert.
            </p>
          </div>
        </div>
      </div>

      {/* NOW-PLAYING PANEL - COLLAPSED */}
      {!nowPlayingExpanded && (
        <button
          onClick={() => setNowPlayingExpanded(true)}
          className="absolute bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] p-4 flex items-center justify-between"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[var(--text-high)] text-sm font-medium">
                SPX 0DTE 5800C
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                Loaded
              </span>
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Scalp • Not entered yet
            </div>
          </div>
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      )}

      {/* NOW-PLAYING PANEL - EXPANDED (LOADED) */}
      {nowPlayingExpanded && (
        <div className="absolute bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] max-h-[70vh] flex flex-col">
          {/* Drag Handle */}
          <div className="flex items-center justify-center py-2 cursor-pointer" onClick={() => setNowPlayingExpanded(false)}>
            <div className="w-10 h-1 rounded-full bg-[var(--border-hairline)]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--text-high)] text-lg font-medium">SPX 0DTE 5800C</h3>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  📋 Loaded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                  Scalp
                </span>
                <span className="text-xs text-[var(--text-muted)]">Loaded at 14:32</span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Contract</div>
                <div className="text-[var(--text-high)]">$5800 Call • 0DTE (Today)</div>
              </div>

              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Current Mid</div>
                <div className="text-[var(--text-high)] font-medium">$22.50</div>
              </div>

              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Status</div>
                <div className="text-[var(--text-high)] text-sm">Not entered yet</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Entry, TP, SL will be set when entering
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowEnterAlert(true)}
                className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors"
              >
                Enter Now
              </button>
              <button className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors">
                Discard Idea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENTER ALERT BOTTOM SHEET */}
      {showEnterAlert && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end">
          <div className="w-full bg-[var(--surface-1)] rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
              <h3 className="text-[var(--text-high)] font-medium">Enter – Alert Preview</h3>
              <button
                onClick={() => setShowEnterAlert(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Alert Preview */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/50">
                <div className="text-xs uppercase tracking-wide text-[var(--brand-primary)] mb-2">
                  🎯 ENTERED
                </div>
                <div className="text-sm text-[var(--text-high)] space-y-1">
                  <div className="font-medium">**SPX $5800C 0DTE** (Scalp)</div>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                    <div>Entry: <span className="text-[var(--text-high)]">$22.50</span></div>
                    <div>Target: <span className="text-[var(--positive)]">$31.00 (+37.8%)</span></div>
                    <div>Stop: <span className="text-[var(--negative)]">$17.90 (-20.4%)</span></div>
                  </div>
                </div>
              </div>

              {/* Included Fields */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Included Fields
                </label>
                <div className="space-y-2">
                  {[
                    { label: 'Entry Price', value: '$22.50', checked: true },
                    { label: 'Current Price', value: '$22.50', checked: true },
                    { label: 'Target', value: '$31.00 (+37.8%)', checked: true },
                    { label: 'Stop Loss', value: '$17.90 (-20.4%)', checked: true },
                  ].map((field) => (
                    <label key={field.label} className="flex items-center gap-3 p-2 bg-[var(--surface-2)] rounded">
                      <input
                        type="checkbox"
                        defaultChecked={field.checked}
                        className="w-4 h-4 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-high)]">{field.label}</div>
                        <div className="text-xs text-[var(--text-muted)]">{field.value}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Discord Channels
                </label>
                <div className="space-y-2">
                  {[
                    { name: 'options-signals', checked: true },
                    { name: 'spx-room', checked: true },
                    { name: 'scalp-alerts', checked: false },
                  ].map((channel) => (
                    <label key={channel.name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={channel.checked}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-[var(--text-high)]">#{channel.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
              <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors">
                Send Alert
              </button>
              <button
                onClick={() => setShowEnterAlert(false)}
                className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="h-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around flex-shrink-0">
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
          </div>
          <span className="text-[10px] text-[var(--brand-primary)]">Live</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Active</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <Settings className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Settings</span>
        </button>
      </nav>
    </div>
  );
}
