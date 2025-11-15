import { Plus, X, Settings, Mic, ChevronDown } from 'lucide-react';

export function DesktopLiveCockpitEnterAlert() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      {/* HEADER */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-[var(--bg-base)] font-bold text-sm">HD</span>
          </div>
          <span className="text-[var(--text-high)] font-medium">Honey Drip Admin</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
            <span className="text-[var(--positive)] text-xs font-medium uppercase tracking-wide">
              ● Market Open
            </span>
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            Data as of <span className="text-[var(--text-high)]">14:35:08 ET</span>
            <span className="ml-2 text-[var(--positive)]">● Live</span>
          </div>
        </div>

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
          
          {/* Loaded Trades - Has 1 (preparing to enter) */}
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
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-orange-500/20 text-orange-400 animate-pulse">
                        Entering...
                      </span>
                    </div>
                    <div className="text-[var(--text-high)] font-medium text-sm">
                      SPX 0DTE 5800C
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

          {/* Watchlist - Collapsed */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Watchlist (5)
              </h3>
            </div>
            <div className="text-center py-2 text-[var(--text-muted)] text-[10px]">
              SPX + 4 more
            </div>
          </div>

          {/* Challenges */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Challenges (0)
              </h3>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No challenges yet
            </div>
          </div>
        </div>

        {/* CENTER PANEL - Pre-Entry Summary with Note */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Header with Status */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[var(--text-high)] text-xl">Preparing to Enter</h2>
                <div className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-orange-500/20 text-orange-400 animate-pulse">
                  Entry Alert Draft Active
                </div>
              </div>
              <p className="text-[var(--text-muted)] text-sm">
                Review entry details and alert on the right, then send to move this trade to Active
              </p>
            </div>

            {/* Trade Card (Still in LOADED state) */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--brand-primary)] p-6 mb-6">
              
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

              <div className="grid grid-cols-4 gap-6">
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
                    Entry (Proposed)
                  </div>
                  <div className="text-[var(--brand-primary)] font-medium">
                    $22.50
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Target (Calc'd)
                  </div>
                  <div className="text-[var(--positive)] font-medium">
                    $31.00
                  </div>
                  <div className="text-[9px] text-[var(--positive)]">+37.8%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Stop Loss (Calc'd)
                  </div>
                  <div className="text-[var(--negative)] font-medium">
                    $17.90
                  </div>
                  <div className="text-[9px] text-[var(--negative)]">-20.4%</div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <div className="text-orange-400 text-lg">🎯</div>
                <div>
                  <div className="text-orange-400 text-sm font-medium mb-1">
                    You are about to enter this trade
                  </div>
                  <p className="text-orange-300/80 text-xs leading-relaxed">
                    The <strong>ENTER alert</strong> is ready on the right panel. Review the entry price, TP, SL, channels, and comment. When you click <strong>"Send Alert"</strong>, this trade will move from Loaded to Active and followers will be notified.
                  </p>
                </div>
              </div>
            </div>

            {/* Calculation Details */}
            <details className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <summary className="cursor-pointer text-sm text-[var(--text-high)] flex items-center justify-between">
                <span>TP/SL Calculation Details</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </summary>
              <div className="mt-4 pt-4 border-t border-[var(--border-hairline)] space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">TP Strategy</span>
                  <span className="text-[var(--text-high)]">Percent-based (+37.8%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">SL Strategy</span>
                  <span className="text-[var(--text-high)]">Percent-based (-20.4%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Based On</span>
                  <span className="text-[var(--text-high)]">Admin Defaults (Settings)</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  You can adjust these values in the alert composer on the right before sending.
                </p>
              </div>
            </details>
          </div>
        </div>

        {/* RIGHT PANEL - Enter Alert Composer */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] overflow-y-auto">
          
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Enter Trade Alert
            </h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Preview alert before entering
            </p>
          </div>

          <div className="p-4 space-y-4">
            
            {/* Alert Preview Card */}
            <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/50 p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--brand-primary)] mb-3">
                🎯 ENTERED
              </div>
              <div className="text-sm text-[var(--text-high)] space-y-2">
                <div className="font-medium">**SPX $5800C 0DTE** (Scalp)</div>
                <div className="text-xs space-y-1 text-[var(--text-muted)]">
                  <div>Entry: <span className="text-[var(--text-high)]">$22.50</span></div>
                  <div>Target: <span className="text-[var(--positive)]">$31.00 (+37.8%)</span></div>
                  <div>Stop: <span className="text-[var(--negative)]">$17.90 (-20.4%)</span></div>
                </div>
              </div>
            </div>

            {/* Editable Entry Values (Optional Enhancement) */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-[10px] leading-relaxed">
                💡 In a full implementation, you could add input fields here to adjust Entry/TP/SL before sending. For now, these are auto-calculated from defaults.
              </p>
            </div>

            {/* Discord Channels - Collapsed by Default */}
            <details>
              <summary className="cursor-pointer flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg text-sm text-[var(--text-high)] hover:bg-[var(--surface-2)]/80 transition-colors">
                <span>Discord Channels (2)</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </summary>
              <div className="mt-2 space-y-2 pl-3">
                {[
                  { id: 'ch1', name: 'options-signals', checked: true },
                  { id: 'ch2', name: 'spx-room', checked: true },
                  { id: 'ch3', name: 'scalp-alerts', checked: false },
                ].map((channel) => (
                  <label key={channel.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked={channel.checked}
                      className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)]"
                    />
                    <span className="text-sm text-[var(--text-high)] group-hover:text-[var(--brand-primary)] transition-colors">
                      #{channel.name}
                    </span>
                  </label>
                ))}
              </div>
            </details>

            {/* Challenges - Collapsed by Default */}
            <details>
              <summary className="cursor-pointer flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg text-sm text-[var(--text-high)] hover:bg-[var(--surface-2)]/80 transition-colors">
                <span>Challenges (1)</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </summary>
              <div className="mt-2 space-y-2 pl-3">
                {[
                  { id: 'chal1', name: 'Week 1 Challenge', scope: 'HD', checked: true },
                  { id: 'chal2', name: 'SPX Master', scope: 'Admin', checked: false },
                ].map((challenge) => (
                  <label key={challenge.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked={challenge.checked}
                      className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)]"
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
            </details>

            <div className="p-3 bg-[var(--surface-2)] rounded-lg text-[10px] text-[var(--text-muted)]">
              Channels & Challenges inherited from Load Alert (collapsed by default)
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
                Comment (Optional)
              </label>
              <textarea
                placeholder="Entering this trade with defined TP/SL..."
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button className="w-full py-2.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium transition-colors">
                Enter & Send Alert
              </button>
              <button className="w-full py-2.5 rounded-lg bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors">
                Cancel Entry
              </button>
            </div>

            {/* Helper Text */}
            <div className="p-3 bg-orange-500/5 border border-orange-500/30 rounded-lg">
              <p className="text-[10px] text-orange-400 leading-relaxed">
                On send: Trade moves to <strong>Active</strong>, alert sent to channels, toast confirms. Nothing auto-sends—you control everything.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
