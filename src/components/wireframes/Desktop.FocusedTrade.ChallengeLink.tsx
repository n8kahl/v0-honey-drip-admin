import { Settings, Mic, TrendingUp, ChevronDown } from 'lucide-react';

export function DesktopFocusedTradeChallengeLink() {
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
            Data as of <span className="text-[var(--text-high)]">14:42:33 ET</span>
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

      {/* MAIN CONTENT - FOCUSED ON CENTER/RIGHT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL - Simplified */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)] text-sm px-4">
            Left panel (watchlist/trades) would be here
          </div>
        </div>

        {/* CENTER PANEL - Focused Trade with Challenge Selector */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-6">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[var(--text-high)] text-xl">Active Trade</h2>
                <div className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                  ● Live
                </div>
              </div>
              <p className="text-[var(--text-muted)] text-sm">
                Monitor position and manage challenge assignment
              </p>
            </div>

            {/* Trade Summary Card with Challenge Assignment */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--positive)] p-6">
              
              {/* Top Row - Title & P&L */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Scalp
                    </span>
                    <span className="px-2 py-1 rounded text-xs uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                      🎯 Entered
                    </span>
                  </div>
                  <h3 className="text-2xl text-[var(--text-high)] font-medium mb-1">
                    SPX
                  </h3>
                  <div className="text-[var(--text-muted)]">
                    0DTE 5800 Call
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    Entered at 14:35:08 ET
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-medium text-[var(--positive)] flex items-center gap-2">
                    <TrendingUp className="w-6 h-6" />
                    +21.3%
                  </div>
                  <div className="text-sm text-[var(--text-muted)] mt-1">
                    +$4.80 per contract
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-4 gap-6 pb-6 mb-6 border-b border-[var(--border-hairline)]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Entry Price
                  </div>
                  <div className="text-[var(--text-high)] font-medium text-lg">
                    $22.50
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Current Price
                  </div>
                  <div className="text-[var(--text-high)] font-medium text-lg">
                    $27.30
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Target (TP)
                  </div>
                  <div className="text-[var(--positive)] font-medium text-lg">
                    $31.00
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)]">+37.8% target</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Stop Loss
                  </div>
                  <div className="text-[var(--negative)] font-medium text-lg">
                    $17.90
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)]">-20.4% risk</div>
                </div>
              </div>

              {/* CHALLENGE ASSIGNMENT - HIGHLIGHTED */}
              <div className="p-4 bg-[var(--brand-primary)]/5 border-2 border-[var(--brand-primary)]/30 rounded-lg">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  Challenge Assignment
                </label>
                
                <div className="relative">
                  <select className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] appearance-none cursor-pointer focus:border-[var(--brand-primary)] focus:outline-none transition-colors">
                    <option value="">None (No Challenge)</option>
                    <option value="sac" selected>Small Account Challenge</option>
                    <option value="nov-scalps">November Scalps</option>
                    <option value="spx-master">SPX Master Class</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Current Selection Display */}
                <div className="mt-3 pt-3 border-t border-[var(--border-hairline)]">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-[var(--text-muted)] mb-1">
                        Currently assigned to:
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-high)] font-medium">
                          Small Account Challenge
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                          Honey Drip Wide
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        Default channels: #small-account-challenge
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Note */}
                <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
                  <p className="text-[10px] text-blue-400 leading-relaxed">
                    💡 Challenge assignment affects default Discord channels for alerts, but you can always override channels in the alert composer when sending updates.
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Context */}
            <div className="mt-6 p-4 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
              <h4 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
                How Challenge Assignment Works
              </h4>
              <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-primary)] mt-0.5">•</span>
                  <span>Changing the challenge reassigns this trade to the selected challenge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-primary)] mt-0.5">•</span>
                  <span>Future alerts for this trade will default to the challenge's Discord channels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-primary)] mt-0.5">•</span>
                  <span>You can still manually select different channels when composing each alert</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-primary)] mt-0.5">•</span>
                  <span>A trade can belong to multiple challenges (edit from the Challenges screen)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Quick Actions */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] overflow-y-auto p-4">
          <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
            Trade Actions
          </h3>

          <div className="space-y-6">
            
            {/* Position Management */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Position Management
              </div>
              <div className="space-y-2">
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">📊</span>
                  <span>Trim (capture P&L)</span>
                </button>
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span>Update Stop Loss</span>
                </button>
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">🎯</span>
                  <span>Update Target</span>
                </button>
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">📝</span>
                  <span>Update (price + message)</span>
                </button>
              </div>
            </div>

            {/* Position Adjustment */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Position Adjustment
              </div>
              <div className="space-y-2">
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] hover:border-[var(--brand-primary)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">➕</span>
                  <span>Add to Position</span>
                </button>
              </div>
            </div>

            {/* Exit */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Exit
              </div>
              <div className="space-y-2">
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--negative)]/10 hover:bg-[var(--negative)]/20 border border-[var(--negative)] text-[var(--negative)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">🏁</span>
                  <span>Full Exit</span>
                </button>
              </div>
            </div>

            {/* Helper Text */}
            <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                All actions open draft alerts. The selected challenge's channels will be pre-selected, but you can change them before sending.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
