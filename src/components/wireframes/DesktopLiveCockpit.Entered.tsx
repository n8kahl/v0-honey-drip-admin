import { Plus, X, Settings, Mic, ChevronDown, TrendingUp } from 'lucide-react';

export function DesktopLiveCockpitEntered() {
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

      {/* THREE PANEL LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex flex-col overflow-y-auto">
          
          {/* Loaded Trades - Empty now */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Loaded Trades (0)
              </h3>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No loaded trades
            </div>
          </div>

          {/* Active Trades - Has 1 */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Active Trades (1)
              </h3>
            </div>
            
            <div className="relative pl-2">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--positive)]" />
              <div className="bg-[var(--positive)]/10 border border-[var(--positive)]/30 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        Scalp
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                        ✓ Entered
                      </span>
                    </div>
                    <div className="text-[var(--text-high)] font-medium text-sm">
                      SPX 0DTE 5800C
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      Entry: $22.50
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--positive)]/20">
                  <div className="text-xs text-[var(--text-muted)]">P&L</div>
                  <div className="flex items-center gap-1 text-[var(--positive)] font-medium">
                    <TrendingUp className="w-3 h-3" />
                    <span>+21.3%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Watchlist - Collapsed */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Watchlist (5)
              </h3>
              <button className="w-6 h-6 rounded bg-[var(--surface-2)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
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
              <button className="w-6 h-6 rounded bg-[var(--surface-2)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No challenges yet
            </div>
          </div>
        </div>

        {/* CENTER PANEL - Entered Trade (Focused) */}
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
                Monitor position and use quick actions on the right to manage
              </p>
            </div>

            {/* Compact Trade Summary Card */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--positive)] p-6 mb-6">
              
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

              {/* Liquidity & Greeks - Collapsible */}
              <details>
                <summary className="cursor-pointer text-sm text-[var(--text-high)] hover:text-[var(--brand-primary)] flex items-center justify-between transition-colors">
                  <span>Contract Details & Greeks</span>
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                </summary>
                <div className="mt-4 pt-4 border-t border-[var(--border-hairline)]">
                  
                  {/* Liquidity */}
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                      Liquidity
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Volume</div>
                        <div className="text-[var(--text-high)]">8.2k</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Open Interest</div>
                        <div className="text-[var(--text-high)]">12.5k</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">IV</div>
                        <div className="text-[var(--text-high)]">42.8%</div>
                      </div>
                    </div>
                  </div>

                  {/* Greeks */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                      Greeks
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Delta (Δ)</div>
                        <div className="text-[var(--text-high)]">0.58</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Gamma (Γ)</div>
                        <div className="text-[var(--text-high)]">0.012</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Theta (Θ)</div>
                        <div className="text-[var(--negative)]">-0.85</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)]">Vega (V)</div>
                        <div className="text-[var(--text-high)]">0.42</div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Trade History / Updates */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4 mb-6">
              <h4 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Trade History
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm">
                  <div className="text-[var(--text-muted)] text-xs font-mono">14:35:08</div>
                  <div className="flex-1">
                    <span className="text-[var(--positive)]">🎯 Entered</span>
                    <span className="text-[var(--text-muted)] ml-2">at $22.50</span>
                  </div>
                </div>
                {/* Future updates will appear here */}
              </div>
            </div>

            {/* Annotation */}
            <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-xs leading-relaxed">
                💡 Trade is now <strong>ACTIVE</strong>. Use the <strong>Quick Actions</strong> on the right panel to trim, update stop loss, add to position, or exit. Each action opens a draft alert composer—nothing auto-sends.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Trade Actions */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] overflow-y-auto">
          
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Trade Actions
            </h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Each action opens a draft alert
            </p>
          </div>

          <div className="p-4 space-y-6">
            
            {/* Position Management Section */}
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

            {/* Position Adjustment Section */}
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

            {/* Exit Section */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Exit
              </div>
              <div className="space-y-2">
                <button className="w-full py-2.5 px-4 rounded-lg bg-[var(--negative)]/10 hover:bg-[var(--negative)]/20 border border-[var(--negative)] text-[var(--negative)] hover:border-[var(--negative)] transition-colors text-sm flex items-center justify-center gap-2">
                  <span className="text-base">🏁</span>
                  <span>Full Exit</span>
                </button>
              </div>
            </div>

            {/* Helper Text */}
            <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Each action opens a configurable draft alert. You can:
              </p>
              <ul className="mt-2 space-y-1 text-[10px] text-[var(--text-muted)] list-disc list-inside">
                <li>Adjust which fields to include</li>
                <li>Modify prices and values</li>
                <li>Select Discord channels</li>
                <li>Add comments</li>
              </ul>
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                <strong className="text-[var(--text-high)]">Nothing auto-sends.</strong> You review and click Send.
              </p>
            </div>

            {/* Alert Composer Examples (Collapsed) */}
            <details className="bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
              <summary className="cursor-pointer p-3 text-xs text-[var(--text-high)] hover:text-[var(--brand-primary)] flex items-center justify-between transition-colors">
                <span>Alert Composer Examples</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </summary>
              <div className="p-3 pt-0 space-y-3 text-[10px] text-[var(--text-muted)]">
                <div className="p-2 bg-[var(--bg-base)] rounded">
                  <div className="text-[var(--text-high)] mb-1">📊 Trim Alert</div>
                  <div>• Current price + P&L included</div>
                  <div>• Channels/Challenges: collapsed ✓</div>
                </div>
                <div className="p-2 bg-[var(--bg-base)] rounded">
                  <div className="text-[var(--text-high)] mb-1">🛡️ Update Stop Loss</div>
                  <div>• Breakeven / Fixed / Trailing</div>
                  <div>• Channels/Challenges: collapsed ✓</div>
                </div>
                <div className="p-2 bg-[var(--bg-base)] rounded">
                  <div className="text-[var(--text-high)] mb-1">🏁 Full Exit</div>
                  <div>• Final P&L calculation</div>
                  <div>• Channels/Challenges: collapsed ✓</div>
                </div>
              </div>
            </details>

          </div>
        </div>

      </div>
    </div>
  );
}
