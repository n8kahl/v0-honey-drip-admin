import { useState } from 'react';
import { Settings, Mic, X, ChevronUp } from 'lucide-react';

export function MobileLiveWatching() {
  const [nowPlayingExpanded, setNowPlayingExpanded] = useState(false);

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
            Data as of <span className="text-[var(--text-high)]">14:32:45</span>
          </span>
        </div>
      </div>

      {/* MAIN CONTENT - Watchlist */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-4">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Watchlist (5)
          </h2>
          
          <div className="space-y-2">
            {/* Selected ticker - SPX */}
            <button className="w-full p-3 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] rounded-lg text-left">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-[var(--text-high)] font-medium">SPX</div>
                  <div className="text-[10px] text-[var(--text-muted)]">S&P 500 Index</div>
                </div>
                <button className="text-[var(--text-muted)] hover:text-[var(--negative)]">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[var(--text-high)] text-sm">5,845.50</div>
                <div className="text-[var(--positive)] text-xs">+1.2%</div>
              </div>
            </button>

            {/* Other tickers */}
            {[
              { symbol: 'AAPL', name: 'Apple Inc.', price: '189.25', change: '+2.4%', positive: true },
              { symbol: 'TSLA', name: 'Tesla Inc.', price: '242.80', change: '-1.8%', positive: false },
              { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: '398.45', change: '+0.9%', positive: true },
              { symbol: 'NVDA', name: 'NVIDIA Corp.', price: '485.20', change: '+3.1%', positive: true },
            ].map((ticker) => (
              <button key={ticker.symbol} className="w-full p-3 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg hover:bg-[var(--surface-2)] text-left transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-[var(--text-high)] font-medium">{ticker.symbol}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{ticker.name}</div>
                  </div>
                  <button className="text-[var(--text-muted)] hover:text-[var(--negative)]">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[var(--text-high)] text-sm">${ticker.price}</div>
                  <div className={`text-xs ${ticker.positive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                    {ticker.change}
                  </div>
                </div>
              </button>
            ))}
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
            <div className="text-[var(--text-high)] text-sm font-medium mb-0.5">
              Watching SPX
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Tap to select a contract
            </div>
          </div>
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      )}

      {/* NOW-PLAYING PANEL - EXPANDED */}
      {nowPlayingExpanded && (
        <div className="absolute bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] max-h-[60vh] flex flex-col">
          {/* Drag Handle */}
          <div className="flex items-center justify-center py-2 cursor-pointer" onClick={() => setNowPlayingExpanded(false)}>
            <div className="w-10 h-1 rounded-full bg-[var(--border-hairline)]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--text-high)] text-lg font-medium">SPX</h3>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  Watching
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-sm">S&P 500 Index</p>
            </div>

            <div className="mb-4 p-3 bg-[var(--surface-2)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-muted)]">Current Price</span>
                <span className="text-[var(--text-high)] font-medium">5,845.50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Change</span>
                <span className="text-[var(--positive)] text-sm">+1.2%</span>
              </div>
            </div>

            <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors">
              Select Contract
            </button>

            <p className="text-center text-xs text-[var(--text-muted)] mt-3">
              Browse contracts to load a trade idea
            </p>
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
