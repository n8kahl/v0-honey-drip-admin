import { Settings, Mic, ChevronDown, Calendar, X, Filter } from 'lucide-react';

export function DesktopHistoryDefault() {
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
          <div className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">
              ● Market Closed
            </span>
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            Data as of <span className="text-[var(--text-high)]">16:00:00 ET</span>
            <span className="ml-2 text-[var(--text-muted)]">● Cached</span>
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

      {/* FILTERS BAR */}
      <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] p-4">
        <div className="flex items-center gap-4">
          
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm hover:bg-[var(--surface-2)]/80 transition-colors flex items-center gap-2">
              <span>Last 30 days</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Ticker Filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by ticker..."
              className="w-40 px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
            />
          </div>

          {/* Trade Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] text-[var(--brand-primary)] text-xs">
                All
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-xs">
                Scalp
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-xs">
                Day
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-xs">
                Swing
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-xs">
                LEAP
              </button>
            </div>
          </div>

          {/* Challenge Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Challenge:</span>
            <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-high)] text-sm hover:bg-[var(--surface-2)]/80 transition-colors flex items-center gap-2">
              <span>All Challenges</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Clear Filters */}
          <button className="ml-auto px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm transition-colors flex items-center gap-2">
            <X className="w-4 h-4" />
            Clear filters
          </button>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Table Header */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[var(--text-high)] text-xl">Trade History</h2>
            <div className="text-sm text-[var(--text-muted)]">
              Showing <span className="text-[var(--text-high)]">24</span> trades
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Ticker</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Contract</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Entry</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Exit</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">P&L %</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Entry Time</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Exit Time</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { ticker: 'SPX', type: 'Scalp', contract: '0DTE 5800C', entry: 22.50, exit: 27.30, pl: 21.3, entryTime: 'Nov 13, 14:35', exitTime: 'Nov 13, 15:42', positive: true },
                  { ticker: 'TSLA', type: 'Day', contract: '1DTE 245P', entry: 8.20, exit: 6.50, pl: -20.7, entryTime: 'Nov 13, 10:15', exitTime: 'Nov 13, 14:20', positive: false },
                  { ticker: 'AAPL', type: 'Scalp', contract: '0DTE 190C', entry: 3.80, exit: 5.20, pl: 36.8, entryTime: 'Nov 12, 13:20', exitTime: 'Nov 12, 15:10', positive: true },
                  { ticker: 'SPY', type: 'Swing', contract: '7DTE 455C', entry: 12.50, exit: 18.20, pl: 45.6, entryTime: 'Nov 11, 09:35', exitTime: 'Nov 12, 11:45', positive: true },
                  { ticker: 'QQQ', type: 'Day', contract: '2DTE 400P', entry: 6.80, exit: 7.90, pl: 16.2, entryTime: 'Nov 10, 11:40', exitTime: 'Nov 11, 13:25', positive: true },
                  { ticker: 'NVDA', type: 'Scalp', contract: '0DTE 485C', entry: 15.20, exit: 12.40, pl: -18.4, entryTime: 'Nov 10, 10:05', exitTime: 'Nov 10, 11:50', positive: false },
                  { ticker: 'SPX', type: 'Day', contract: '1DTE 5750P', entry: 45.30, exit: 52.10, pl: 15.0, entryTime: 'Nov 9, 14:20', exitTime: 'Nov 10, 10:30', positive: true },
                  { ticker: 'TSLA', type: 'Scalp', contract: '0DTE 240C', entry: 4.50, exit: 5.80, pl: 28.9, entryTime: 'Nov 8, 12:15', exitTime: 'Nov 8, 14:45', positive: true },
                ].map((trade, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border-hairline)] hover:bg-[var(--surface-2)]/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-high)] text-sm">{trade.contract}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[var(--text-high)] text-sm">${trade.entry.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[var(--text-high)] text-sm">${trade.exit.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${trade.positive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                        {trade.positive ? '+' : ''}{trade.pl.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-muted)] text-sm">{trade.entryTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-muted)] text-sm">{trade.exitTime}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Annotation */}
          <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs leading-relaxed">
              💡 <strong>Click any row</strong> to open a right-side drawer with full trade details: timeline of alerts (enter, trims, updates, exit), channels used, and challenge associations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
