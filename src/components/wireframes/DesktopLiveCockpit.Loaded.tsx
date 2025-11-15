import { Plus, X, Settings, Mic, ChevronDown } from 'lucide-react';

export function DesktopLiveCockpitLoaded() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      {/* HEADER */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-[var(--bg-base)] font-bold text-sm">HD</span>
          </div>
          <span className="text-[var(--text-high)] font-medium">HoneyDrip Admin</span>
        </div>

        {/* Center: Market Status & Data Freshness */}
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
            <span className="text-[var(--positive)] text-xs font-medium uppercase tracking-wide">
              ● Market Open
            </span>
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            Data as of <span className="text-[var(--text-high)]">14:33:12 ET</span>
            <span className="ml-2 text-[var(--positive)]">● Live</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="w-9 h-9 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 flex items-center justify-center text-[var(--bg-base)] transition-colors">
            <Mic className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] px-6">
        <div className="flex gap-1">
          <button className="px-4 py-3 text-sm border-b-2 border-[var(--brand-primary)] text-[var(--text-high)]">
            Trade Management
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            History
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Settings
          </button>
        </div>
      </div>

      {/* THREE PANEL LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex flex-col overflow-y-auto">
          
          {/* Loaded Trades - Has 1 */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Loaded Trades (1)
              </h3>
            </div>
            
            <div className="relative pl-2">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--brand-primary)]" />
              <div className="bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        Scalp
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                        Loaded
                      </span>
                    </div>
                    <div className="text-[var(--text-high)] font-medium text-sm">
                      SPX 0DTE 5800C
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      Loaded at 14:32
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Trades - Empty */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Active Trades (0)
              </h3>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No active trades yet
            </div>
          </div>

          {/* Watchlist */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Watchlist (5)
              </h3>
              <button className="w-6 h-6 rounded bg-[var(--surface-2)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {/* SPX still visible */}
              <div className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg p-3 cursor-pointer transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-[var(--text-high)] font-medium">SPX</div>
                    <div className="text-[10px] text-[var(--text-muted)]">S&P 500 Index</div>
                  </div>
                  <button className="text-[var(--text-muted)] hover:text-[var(--negative)] transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[var(--text-high)] text-sm">5,845.50</div>
                  <div className="text-[var(--positive)] text-xs">+1.2%</div>
                </div>
              </div>

              {/* Other tickers collapsed for brevity */}
              <div className="text-center py-2 text-[var(--text-muted)] text-[10px]">
                + 4 more tickers
              </div>
            </div>
          </div>

          {/* Challenges */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Challenges (0)
              </h3>
              <button className="w-6 h-6 rounded bg-[var(--surface-2)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No challenges yet
            </div>
          </div>
        </div>

        {/* CENTER PANEL - Loaded Trade Summary */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-[var(--text-high)] text-xl mb-1">Loaded Trade Summary</h2>
              <p className="text-[var(--text-muted)] text-sm">Review the loaded idea before entering</p>
            </div>

            {/* Loaded Trade Card */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--brand-primary)] p-6 mb-6">
              
              {/* Top Row */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Scalp
                    </span>
                    <span className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-blue-500/20 text-blue-400">
                      📋 Loaded
                    </span>
                  </div>
                  <h3 className="text-2xl text-[var(--text-high)] font-medium mb-1">
                    SPX
                  </h3>
                  <div className="text-[var(--text-muted)]">
                    0DTE 5800 Call
                  </div>
                </div>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-4 gap-6 mb-6 pb-6 border-b border-[var(--border-hairline)]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Contract
                  </div>
                  <div className="text-[var(--text-high)] font-medium">
                    $5800C
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Expiry
                  </div>
                  <div className="text-[var(--text-high)] font-medium">
                    0DTE (Today)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Current Mid
                  </div>
                  <div className="text-[var(--text-high)] font-medium">
                    $22.50
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Trade Type
                  </div>
                  <div className="text-[var(--brand-primary)] font-medium">
                    Scalp
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
                    Auto-derived from 0DTE
                  </div>
                </div>
              </div>

              {/* Entry Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-sm text-[var(--text-muted)]">Entry Price</div>
                  <div className="text-sm text-[var(--text-high)]">To be set on entry</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-sm text-[var(--text-muted)]">Target Price (TP)</div>
                  <div className="text-sm text-[var(--text-high)]">Will be calculated using admin defaults</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-sm text-[var(--text-muted)]">Stop Loss (SL)</div>
                  <div className="text-sm text-[var(--text-high)]">Will be calculated using admin defaults</div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-6">
                <button className="w-full py-3 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium transition-colors">
                  Enter Trade →
                </button>
                <p className="text-center text-xs text-[var(--text-muted)] mt-2">
                  This will open the Enter Alert composer
                </p>
              </div>
            </div>

            {/* Contract Context (Optional) */}
            <details className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <summary className="cursor-pointer text-sm text-[var(--text-high)] flex items-center justify-between">
                <span>Contract Details & Greeks</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </summary>
              <div className="mt-4 pt-4 border-t border-[var(--border-hairline)] grid grid-cols-6 gap-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Mid</div>
                  <div className="text-[var(--text-high)]">$22.50</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Bid</div>
                  <div className="text-[var(--text-high)]">$22.30</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Ask</div>
                  <div className="text-[var(--text-high)]">$22.70</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Delta</div>
                  <div className="text-[var(--text-high)]">0.58</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Gamma</div>
                  <div className="text-[var(--text-high)]">0.012</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Theta</div>
                  <div className="text-[var(--negative)]">-0.85</div>
                </div>
              </div>
            </details>

            {/* Annotation */}
            <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-xs leading-relaxed">
                💡 A <strong>LOADED</strong> alert has been composed on the right panel. Review it, select Discord channels and challenges, add a comment if needed, then click <strong>"Load and Alert"</strong> to notify your followers. The trade will remain in LOADED state until you enter it.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Load Alert Composer */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] overflow-y-auto">
          
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Loaded Trade Alert
            </h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Draft alert before notifying followers
            </p>
          </div>

          <div className="p-4 space-y-4">
            
            {/* Alert Preview Card */}
            <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/50 p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--brand-primary)] mb-3">
                📋 LOADED
              </div>
              <div className="text-sm text-[var(--text-high)] space-y-1">
                <div className="font-medium">**SPX $5800C 0DTE** (Scalp)</div>
                <div className="text-[var(--text-muted)] text-xs mt-2">
                  Idea loaded and being monitored. Entry, TP, SL will be set when the trade is entered.
                </div>
              </div>
            </div>

            {/* Discord Channels */}
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
                Discord Channels
              </label>
              <div className="space-y-2">
                {[
                  { id: 'ch1', name: 'options-signals', checked: true },
                  { id: 'ch2', name: 'spx-room', checked: true },
                  { id: 'ch3', name: 'scalp-alerts', checked: false },
                  { id: 'ch4', name: 'all-trades', checked: false },
                ].map((channel) => (
                  <label key={channel.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked={channel.checked}
                      className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-[var(--text-high)] group-hover:text-[var(--brand-primary)] transition-colors">
                      #{channel.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
                Challenges
              </label>
              <div className="space-y-2">
                {[
                  { id: 'chal1', name: 'Week 1 Challenge', scope: 'HD' },
                  { id: 'chal2', name: 'SPX Master', scope: 'Admin' },
                ].map((challenge, i) => (
                  <label key={challenge.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked={i === 0}
                      className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-[var(--text-high)] group-hover:text-[var(--brand-primary)] transition-colors">
                      {challenge.name}
                      {challenge.scope === 'HD' && (
                        <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                          HD
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
                Comment (Optional)
              </label>
              <textarea
                placeholder="Watching this contract for a potential entry..."
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button className="w-full py-2.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium transition-colors">
                Load and Alert
              </button>
              <button className="w-full py-2.5 rounded-lg bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors">
                Discard Idea
              </button>
            </div>

            {/* Helper Text */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                On send: Alert goes to selected channels, toast confirms delivery, trade stays LOADED. You can enter it later.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
