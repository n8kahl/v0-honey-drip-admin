import { Settings, Mic, ChevronDown, Filter } from 'lucide-react';

export function MobileHistoryDefault() {
  return (
    <div className="w-[390px] h-[844px] bg-[var(--bg-base)] flex flex-col mx-auto border-x border-[var(--border-hairline)]">
      
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
          <div className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <span className="text-[var(--text-muted)] text-[10px] font-medium uppercase tracking-wide">
              ● Closed
            </span>
          </div>
          <span className="text-[var(--text-muted)] text-[10px]">
            Data as of <span className="text-[var(--text-high)]">16:00:00</span>
          </span>
        </div>
      </div>

      {/* PAGE TITLE */}
      <div className="p-4 border-b border-[var(--border-hairline)] flex-shrink-0">
        <h1 className="text-[var(--text-high)] text-lg font-medium">Trade History</h1>
        <p className="text-[var(--text-muted)] text-xs mt-1">Past exited trades</p>
      </div>

      {/* FILTERS */}
      <div className="p-4 border-b border-[var(--border-hairline)] space-y-3 flex-shrink-0">
        {/* Date Range */}
        <button className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
          <span className="text-sm text-[var(--text-high)]">Last 30 days</span>
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Ticker Search */}
        <input
          type="text"
          placeholder="Filter by ticker..."
          className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
        />

        {/* Trade Type Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          <button className="px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] text-[var(--brand-primary)] text-xs whitespace-nowrap">
            All
          </button>
          <button className="px-3 py-1 rounded-full bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs whitespace-nowrap">
            Scalp
          </button>
          <button className="px-3 py-1 rounded-full bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs whitespace-nowrap">
            Day
          </button>
          <button className="px-3 py-1 rounded-full bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs whitespace-nowrap">
            Swing
          </button>
          <button className="px-3 py-1 rounded-full bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs whitespace-nowrap">
            LEAP
          </button>
        </div>
      </div>

      {/* HISTORY LIST */}
      <div className="flex-1 overflow-y-auto pb-16">
        <div className="p-4 space-y-3">
          {[
            { ticker: 'SPX', type: 'Scalp', contract: '0DTE 5800C', entry: 22.50, exit: 27.30, pl: 21.3, exitTime: 'Nov 13, 15:42', positive: true },
            { ticker: 'TSLA', type: 'Day', contract: '1DTE 245P', entry: 8.20, exit: 6.50, pl: -20.7, exitTime: 'Nov 13, 14:20', positive: false },
            { ticker: 'AAPL', type: 'Scalp', contract: '0DTE 190C', entry: 3.80, exit: 5.20, pl: 36.8, exitTime: 'Nov 12, 15:10', positive: true },
            { ticker: 'SPY', type: 'Swing', contract: '7DTE 455C', entry: 12.50, exit: 18.20, pl: 45.6, exitTime: 'Nov 12, 11:45', positive: true },
            { ticker: 'QQQ', type: 'Day', contract: '2DTE 400P', entry: 6.80, exit: 7.90, pl: 16.2, exitTime: 'Nov 11, 13:25', positive: true },
            { ticker: 'NVDA', type: 'Scalp', contract: '0DTE 485C', entry: 15.20, exit: 12.40, pl: -18.4, exitTime: 'Nov 10, 11:50', positive: false },
            { ticker: 'SPX', type: 'Day', contract: '1DTE 5750P', entry: 45.30, exit: 52.10, pl: 15.0, exitTime: 'Nov 10, 10:30', positive: true },
          ].map((trade, i) => (
            <button
              key={i}
              className="w-full p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      {trade.type}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{trade.contract}</div>
                </div>
                <div className={`font-medium ${trade.positive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                  {trade.positive ? '+' : ''}{trade.pl.toFixed(1)}%
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                <div>
                  <span className="text-[var(--text-muted)]">Entry: </span>
                  <span className="text-[var(--text-high)]">${trade.entry.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Exit: </span>
                  <span className="text-[var(--text-high)]">${trade.exit.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="text-[10px] text-[var(--text-muted)]">
                Exited {trade.exitTime}
              </div>
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="p-4">
          <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs leading-relaxed">
              💡 Tap any trade to view full details: timeline of alerts, channels used, and complete trade history.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="h-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around flex-shrink-0">
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Live</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Active</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
          </div>
          <span className="text-[10px] text-[var(--brand-primary)]">History</span>
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
