import { Settings, Mic, ChevronDown, Share2, Calendar, X } from 'lucide-react';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';

/**
 * DESKTOP.HISTORY.DEFAULT
 * 
 * Trade History screen with:
 * - Filters (Date Range, Ticker, Type, Challenge)
 * - History table with exited trades
 * - Share icon per row for single-trade sharing
 * - Export button for filtered results summary
 * 
 * All alerts go through the global Alert Composer (never auto-send).
 */

export function DesktopHistoryWithFilters() {
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

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-6 flex flex-col gap-6 flex-1 overflow-hidden">
          
          {/* PAGE HEADER */}
          <div>
            <h1 className="text-[var(--text-high)] text-2xl mb-1">Trade History</h1>
            <p className="text-[var(--text-muted)] text-sm">Review past trades, filter results, and share summaries to Discord</p>
          </div>

          {/* FILTERS BAR */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
            <div className="flex items-end gap-4">
              
              {/* Date Range Filter */}
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Date Range
                </label>
                <div className="relative">
                  <select className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] text-sm appearance-none cursor-pointer focus:border-[var(--brand-primary)] focus:outline-none transition-colors">
                    <option>Today</option>
                    <option selected>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Custom...</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Ticker Filter */}
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Ticker
                </label>
                <input
                  type="text"
                  placeholder="SPX, TSLA..."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                />
              </div>

              {/* Trade Type Filter */}
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Type
                </label>
                <div className="flex gap-1.5">
                  {['All', 'Scalp', 'Day', 'Swing', 'LEAP'].map((type) => (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded text-xs transition-colors ${
                        type === 'All'
                          ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-high)] border border-[var(--border-hairline)]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Challenge Filter */}
              <div className="flex-1">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Challenge
                </label>
                <div className="relative">
                  <select className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] text-sm appearance-none cursor-pointer focus:border-[var(--brand-primary)] focus:outline-none transition-colors">
                    <option>All Challenges</option>
                    <option>Small Account Challenge</option>
                    <option>SPX Scalps</option>
                    <option>November Scalps</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Export Button */}
              <div className="flex-1">
                <button className="w-full py-2 px-4 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Export to Discord...
                </button>
              </div>
            </div>

            {/* Filter Summary */}
            <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
              <div className="text-xs text-[var(--text-muted)]">
                Showing <span className="text-[var(--text-high)] font-medium">12 trades</span> from Last 7 days
              </div>
              <button className="text-xs text-[var(--brand-primary)] hover:underline">
                Clear all filters
              </button>
            </div>
          </div>

          {/* HISTORY TABLE */}
          <div className="flex-1 overflow-hidden bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
            <div className="overflow-y-auto h-full">
              <table className="w-full">
                <thead className="bg-[var(--surface-2)] sticky top-0 z-10">
                  <tr className="border-b border-[var(--border-hairline)]">
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Share</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Ticker</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Type</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Contract</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Entry</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Exit</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">P&L %</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Entry Time</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Exit Time</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Challenge</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1 - Big Win */}
                  <tr className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors group">
                    <td className="px-4 py-3">
                      <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)] font-medium">SPX</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        Scalp
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)]">0DTE 5800C</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$1.00</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$1.85</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-[var(--positive)]">+85%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 13, 14:35</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 13, 14:52</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] bg-[var(--surface-2)] text-[var(--text-muted)]">
                        Small Account
                      </span>
                    </td>
                  </tr>

                  {/* Row 2 - Medium Win */}
                  <tr className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors group">
                    <td className="px-4 py-3">
                      <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)] font-medium">TSLA</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                        Day
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)]">12/20 250C</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$8.50</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$14.80</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-[var(--positive)]">+74%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 12, 10:15</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 12, 15:45</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    </td>
                  </tr>

                  {/* Row 3 - Small Win */}
                  <tr className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors group">
                    <td className="px-4 py-3">
                      <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)] font-medium">SPX</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        Scalp
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)]">0DTE 5790C</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$2.20</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$2.65</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-[var(--positive)]">+20%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 11, 13:20</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 11, 13:38</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] bg-[var(--surface-2)] text-[var(--text-muted)]">
                        SPX Scalps
                      </span>
                    </td>
                  </tr>

                  {/* Row 4 - Loss */}
                  <tr className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors group">
                    <td className="px-4 py-3">
                      <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)] font-medium">QQQ</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-purple-500/20 text-purple-400">
                        Swing
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-high)]">12/20 420P</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$12.00</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[var(--text-high)]">$9.36</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-[var(--negative)]">-22%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 10, 09:45</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">Nov 11, 10:20</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    </td>
                  </tr>

                  {/* Additional rows... */}
                  {[...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors group">
                      <td className="px-4 py-3">
                        <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--text-high)] font-medium">
                          {i % 2 === 0 ? 'SPX' : 'NVDA'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                          Scalp
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--text-high)]">0DTE 580{i}C</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[var(--text-high)]">$1.{i}0</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-[var(--text-high)]">$1.{i + 5}0</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-[var(--positive)]">+{12 + i * 3}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-muted)]">Nov {10 - i}, 14:{20 + i * 5}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-muted)]">Nov {10 - i}, 14:{30 + i * 5}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ANNOTATIONS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-xs leading-relaxed">
                💡 <strong>Export to Discord:</strong> Opens an Alert Composer with a summary of all filtered trades (Total, Wins, Avg P&L, Biggest Winner/Loser). Admin reviews, picks channels, adds comment, then sends.
              </p>
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-xs leading-relaxed">
                💡 <strong>Share Icon (per row):</strong> Opens Alert Composer with that single trade formatted for Discord (Entry, Exit, P&L, Duration). Perfect for "gainssssss 💰" posts to #gains channel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
