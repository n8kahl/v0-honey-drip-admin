import { Settings, Mic, ChevronDown, Share2, X } from 'lucide-react';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';

/**
 * DESKTOP.HISTORY.EXPORT-SUMMARY
 * 
 * Shows the History screen with the Alert Composer open in "Summary Export" mode.
 * Exports a multi-trade summary based on current filters.
 */

export function DesktopHistoryExportSummary() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      {/* GLOBAL HEADER */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={honeyDripLogo || "/placeholder.svg"} alt="Honey Drip" className="w-10 h-10 rounded" />
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
      <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] px-6 flex-shrink-0">
        <div className="flex gap-1">
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Trade Management
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-[var(--brand-primary)] text-[var(--text-high)]">
            History
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Settings
          </button>
        </div>
      </div>

      {/* MAIN CONTENT WITH ALERT COMPOSER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: HISTORY TABLE (Dimmed) */}
        <div className="flex-1 p-6 opacity-30 pointer-events-none">
          <div className="mb-6">
            <h1 className="text-[var(--text-high)] text-2xl mb-1">Trade History</h1>
            <p className="text-[var(--text-muted)] text-sm">Review past trades, filter results, and share summaries to Discord</p>
          </div>

          {/* Filters */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4 mb-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-[var(--surface-2)] rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: ALERT COMPOSER - SUMMARY MODE */}
        <div className="w-[500px] bg-[var(--surface-1)] border-l border-[var(--border-hairline)] flex flex-col">
          
          {/* HEADER */}
          <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--text-high)] font-medium">History Summary – Alert</h3>
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                SUMMARY
              </span>
            </div>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* PREVIEW CARD */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Message Preview
              </label>
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded-lg">
                <div className="text-sm text-[var(--text-high)] space-y-2 leading-relaxed">
                  <div className="font-medium text-base">📊 <strong>Trade Summary – Last 7 Days</strong></div>
                  
                  <div className="pt-2 space-y-1 text-xs">
                    <div>Total trades: <span className="text-[var(--text-high)] font-medium">12</span></div>
                    <div>Wins: <span className="text-[var(--positive)] font-medium">8 (66%)</span></div>
                    <div>Losses: <span className="text-[var(--negative)] font-medium">4 (34%)</span></div>
                  </div>

                  <div className="pt-2 space-y-1 text-xs">
                    <div>Average gain: <span className="text-[var(--positive)] font-medium">+18.4%</span></div>
                    <div>Total P&L: <span className="text-[var(--positive)] font-medium">+$2,840</span></div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1 text-xs">
                    <div>Biggest winner: <span className="text-[var(--text-high)] font-medium">SPX 0DTE 5800C +85%</span></div>
                    <div>Biggest loser: <span className="text-[var(--text-high)] font-medium">QQQ 12/20 420P -22%</span></div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] text-xs italic">
                    Weekly recap for the community. Solid win rate this week! 🚀
                  </div>
                </div>
              </div>
            </div>

            {/* SUMMARY STATS (Read-only info) */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Summary Stats
              </label>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Date Range</div>
                    <div className="text-[var(--text-high)] font-medium">Last 7 days</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Filters Applied</div>
                    <div className="text-[var(--text-high)] font-medium">All types, All challenges</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Total Trades</div>
                    <div className="text-[var(--text-high)] font-medium">12</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Win Rate</div>
                    <div className="text-[var(--positive)] font-medium">66%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* COMMENT */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Comment (Optional)
              </label>
              <textarea
                defaultValue="Weekly recap for the community. Solid win rate this week! 🚀"
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                rows={3}
              />
            </div>

            {/* CHANNELS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Discord Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#options-signals</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#weekly-recap</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#small-account-challenge</span>
                </label>
              </div>
            </div>

            {/* CHALLENGES (Optional) */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Link to Challenges (Optional)
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <div className="flex-1">
                    <div className="text-sm text-[var(--text-high)]">Small Account Challenge</div>
                    <div className="text-xs text-[var(--text-muted)]">5 of 12 trades</div>
                  </div>
                </label>
              </div>
            </div>

            {/* INFO NOTE */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                💡 This summary includes all 12 trades matching your current filters (Last 7 days, All types, All challenges). Edit the comment to add context before sending.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-[var(--border-hairline)] flex items-center gap-3 flex-shrink-0">
            <button className="flex-1 py-3 px-4 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-lg transition-colors">
              Discard
            </button>
            <button className="flex-1 py-3 px-4 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors">
              Send Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
