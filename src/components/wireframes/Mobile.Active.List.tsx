import { Settings, Mic, TrendingUp, TrendingDown } from 'lucide-react';

export function MobileActiveList() {
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
          <div className="px-2 py-0.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
            <span className="text-[var(--positive)] text-[10px] font-medium uppercase tracking-wide">
              ● Open
            </span>
          </div>
          <span className="text-[var(--text-muted)] text-[10px]">
            Data as of <span className="text-[var(--text-high)]">14:42:33</span>
          </span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto pb-16">
        
        {/* Page Title */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h1 className="text-[var(--text-high)] text-lg font-medium">Active & Loaded Trades</h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">Tap any trade to manage it</p>
        </div>

        {/* Loaded Trades Section */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Loaded Trades (1)
          </h2>
          
          <div className="space-y-2">
            <button className="w-full p-3 bg-[var(--surface-1)] border border-blue-500/30 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-high)] font-medium text-sm">TSLA</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Day
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">12/27 250C</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  Loaded
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Not entered yet
              </div>
            </button>
          </div>
        </div>

        {/* Active Trades Section */}
        <div className="p-4">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Active Trades (3)
          </h2>
          
          <div className="space-y-2">
            {/* Trade 1 - Positive */}
            <button className="w-full p-3 bg-[var(--surface-1)] border border-[var(--positive)]/30 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-high)] font-medium text-sm">SPX</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Scalp
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">0DTE 5800C</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[var(--positive)] font-medium text-sm">
                    <TrendingUp className="w-3 h-3" />
                    +21.3%
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)] mt-1 inline-block">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Entry: $22.50</span>
                <span className="text-[var(--text-muted)]">Current: $27.30</span>
              </div>
            </button>

            {/* Trade 2 - Positive */}
            <button className="w-full p-3 bg-[var(--surface-1)] border border-[var(--positive)]/30 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-high)] font-medium text-sm">AAPL</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Scalp
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">0DTE 190C</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[var(--positive)] font-medium text-sm">
                    <TrendingUp className="w-3 h-3" />
                    +14.8%
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)] mt-1 inline-block">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Entry: $3.80</span>
                <span className="text-[var(--text-muted)]">Current: $4.36</span>
              </div>
            </button>

            {/* Trade 3 - Negative */}
            <button className="w-full p-3 bg-[var(--surface-1)] border border-[var(--negative)]/30 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-high)] font-medium text-sm">QQQ</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Day
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">1DTE 400P</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[var(--negative)] font-medium text-sm">
                    <TrendingDown className="w-3 h-3" />
                    -8.2%
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)] mt-1 inline-block">
                    Active
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Entry: $6.80</span>
                <span className="text-[var(--text-muted)]">Current: $6.24</span>
              </div>
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4">
          <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs leading-relaxed">
              💡 Tap any trade to switch to the <strong>Live</strong> tab and expand its Now-Playing panel for management.
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
            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
          </div>
          <span className="text-[10px] text-[var(--brand-primary)]">Active</span>
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
