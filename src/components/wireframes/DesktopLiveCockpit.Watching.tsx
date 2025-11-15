import { useState } from 'react';
import { Plus, X, Settings, Mic, ChevronDown, ChevronRight } from 'lucide-react';

export function DesktopLiveCockpitWatching() {
  const [optionType, setOptionType] = useState<'C' | 'P'>('C');
  const [expandedDate, setExpandedDate] = useState<string>('0DTE');

  // SPX current price
  const currentPrice = 5845.50;

  // Mock contracts grouped by date
  const contractsByDate = {
    '0DTE': [
      { strike: 5750, bid: 98.50, ask: 99.20, last: 98.80, oi: 1250, iv: 18.5, status: 'itm' },
      { strike: 5775, bid: 75.30, ask: 76.00, last: 75.60, oi: 2180, iv: 19.2, status: 'itm' },
      { strike: 5800, bid: 53.80, ask: 54.50, last: 54.10, oi: 8240, iv: 21.8, status: 'atm' },
      { strike: 5825, bid: 35.20, ask: 35.90, last: 35.50, oi: 12450, iv: 22.4, status: 'atm' },
      { strike: 5850, bid: 20.40, ask: 21.10, last: 20.70, oi: 15820, iv: 23.1, status: 'otm' },
      { strike: 5875, bid: 10.80, ask: 11.50, last: 11.10, oi: 9850, iv: 24.5, status: 'otm' },
      { strike: 5900, bid: 5.20, ask: 5.90, last: 5.50, oi: 6240, iv: 26.2, status: 'otm' },
    ],
    '1DTE': [
      { strike: 5750, bid: 105.20, ask: 106.00, last: 105.60, oi: 850, iv: 17.2, status: 'itm' },
      { strike: 5775, bid: 83.50, ask: 84.30, last: 83.90, oi: 1420, iv: 18.1, status: 'itm' },
      { strike: 5800, bid: 63.40, ask: 64.20, last: 63.80, oi: 4280, iv: 19.5, status: 'atm' },
      { strike: 5825, bid: 45.80, ask: 46.60, last: 46.20, oi: 8150, iv: 20.8, status: 'atm' },
      { strike: 5850, bid: 31.20, ask: 32.00, last: 31.60, oi: 11240, iv: 21.4, status: 'otm' },
      { strike: 5875, bid: 20.10, ask: 20.90, last: 20.50, oi: 7820, iv: 22.9, status: 'otm' },
    ],
    '2DTE': [
      { strike: 5750, bid: 112.80, ask: 113.60, last: 113.20, oi: 620, iv: 16.8, status: 'itm' },
      { strike: 5775, bid: 92.20, ask: 93.00, last: 92.60, oi: 980, iv: 17.5, status: 'itm' },
      { strike: 5800, bid: 73.50, ask: 74.30, last: 73.90, oi: 2850, iv: 18.2, status: 'atm' },
      { strike: 5825, bid: 56.40, ask: 57.20, last: 56.80, oi: 6120, iv: 19.1, status: 'atm' },
      { strike: 5850, bid: 41.80, ask: 42.60, last: 42.20, oi: 8940, iv: 19.8, status: 'otm' },
    ],
  };

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
            Data as of <span className="text-[var(--text-high)]">14:32:45 ET</span>
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
        
        {/* LEFT PANEL - Watchlist & Sections */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex flex-col overflow-y-auto">
          
          {/* Loaded Trades - Empty */}
          <div className="border-b border-[var(--border-hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Loaded Trades (0)
              </h3>
            </div>
            <div className="text-center py-6 text-[var(--text-muted)] text-xs">
              No loaded trades yet
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
              {/* Active ticker - SPX */}
              <div className="relative pl-2">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--brand-primary)]" />
                <div className="bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-lg p-3 cursor-pointer">
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
              </div>

              {/* Other tickers */}
              {[
                { symbol: 'AAPL', name: 'Apple Inc.', price: '189.25', change: '+2.4%', positive: true },
                { symbol: 'TSLA', name: 'Tesla Inc.', price: '242.80', change: '-1.8%', positive: false },
                { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: '398.45', change: '+0.9%', positive: true },
                { symbol: 'NVDA', name: 'NVIDIA Corp.', price: '485.20', change: '+3.1%', positive: true },
              ].map((ticker) => (
                <div key={ticker.symbol} className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-transparent hover:border-[var(--border-hairline)] rounded-lg p-3 cursor-pointer transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="text-[var(--text-high)] font-medium">{ticker.symbol}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{ticker.name}</div>
                    </div>
                    <button className="text-[var(--text-muted)] hover:text-[var(--negative)] transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[var(--text-high)] text-sm">${ticker.price}</div>
                    <div className={`text-xs ${ticker.positive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                      {ticker.change}
                    </div>
                  </div>
                </div>
              ))}
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

        {/* CENTER PANEL - Options Chain (Same as Trade Management) */}
        <div className="flex-1 overflow-hidden bg-[var(--bg-base)] flex flex-col">
          
          {/* Header */}
          <div className="p-6 pb-4">
            <h2 className="text-[var(--text-high)] text-xl mb-1">SPX Contracts</h2>
            <p className="text-[var(--text-muted)] text-sm">Select a contract to load as a trade idea</p>
          </div>

          {/* Options Chain Component */}
          <div className="flex-1 flex flex-col bg-[var(--surface-1)] mx-6 mb-6 rounded-lg border border-[var(--border-hairline)] overflow-hidden">
            
            {/* Calls/Puts Toggle */}
            <div className="flex gap-2 p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
              <button
                onClick={() => setOptionType('C')}
                className={`flex-1 px-4 py-2 text-sm rounded transition-colors ${
                  optionType === 'C'
                    ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                    : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)]'
                }`}
              >
                Calls
              </button>
              <button
                onClick={() => setOptionType('P')}
                className={`flex-1 px-4 py-2 text-sm rounded transition-colors ${
                  optionType === 'P'
                    ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                    : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)]'
                }`}
              >
                Puts
              </button>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-[80px_70px_70px_70px_90px_90px] gap-2 px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              <div>Strike</div>
              <div>Bid</div>
              <div>Ask</div>
              <div>Last</div>
              <div>Open Int</div>
              <div>Impl. Vol.</div>
            </div>

            {/* Scrollable Contracts by Date */}
            <div className="flex-1 overflow-y-auto">
              {Object.entries(contractsByDate).map(([dateKey, contracts]) => {
                const isExpanded = expandedDate === dateKey;
                const daysToExpiry = dateKey === '0DTE' ? 0 : dateKey === '1DTE' ? 1 : 2;

                // Split by status
                const itmContracts = contracts.filter(c => c.status === 'itm');
                const atmContracts = contracts.filter(c => c.status === 'atm');
                const otmContracts = contracts.filter(c => c.status === 'otm');

                let rowIndex = 0;

                return (
                  <div key={dateKey}>
                    {/* Date Header */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)] text-xs text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors"
                      onClick={() => setExpandedDate(isExpanded ? '' : dateKey)}
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight size={14} className="text-[var(--text-muted)]" />
                      )}
                      <span>{dateKey}</span>
                      <span className="text-[var(--text-muted)]">({daysToExpiry}D)</span>
                    </button>

                    {isExpanded && (
                      <>
                        {/* OTM Contracts */}
                        {otmContracts.map((contract) => {
                          const zebra = rowIndex++ % 2 === 1;
                          return (
                            <button
                              key={contract.strike}
                              className={`w-full grid grid-cols-[80px_70px_70px_70px_90px_90px] gap-2 px-3 py-2 text-xs text-left border-b border-[var(--border-hairline)] transition-colors hover:bg-[var(--surface-3)] ${
                                zebra ? 'bg-[rgba(255,255,255,0.02)]' : ''
                              }`}
                            >
                              <div className="text-[var(--text-high)]">${contract.strike}</div>
                              <div className="text-[var(--positive)]">{contract.bid.toFixed(2)}</div>
                              <div className="text-[var(--negative)]">{contract.ask.toFixed(2)}</div>
                              <div className="text-[var(--text-high)]">{contract.last.toFixed(2)}</div>
                              <div className="text-[var(--text-muted)]">{contract.oi.toLocaleString()}</div>
                              <div className="text-[var(--text-muted)]">{contract.iv.toFixed(1)}%</div>
                            </button>
                          );
                        })}

                        {/* ATM Indicator */}
                        {atmContracts.length > 0 && (
                          <>
                            <div className="flex items-center justify-center py-1.5 bg-[var(--surface-2)] border-y border-[var(--border-hairline)]">
                              <div className="flex items-center gap-2 px-3 py-0.5 bg-[var(--surface-1)] rounded-sm">
                                <span className="text-[10px] text-[var(--text-muted)]">▼</span>
                                <span className="text-xs">SPX</span>
                                <span className="text-xs text-[var(--positive)]">
                                  {currentPrice.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)]">▼</span>
                              </div>
                            </div>
                            {atmContracts.map((contract) => {
                              const zebra = rowIndex++ % 2 === 1;
                              return (
                                <button
                                  key={contract.strike}
                                  className={`w-full grid grid-cols-[80px_70px_70px_70px_90px_90px] gap-2 px-3 py-2 text-xs text-left border-b border-[var(--border-hairline)] transition-colors hover:bg-[var(--surface-3)] bg-[var(--surface-2)]`}
                                >
                                  <div className="text-[var(--text-high)]">${contract.strike}</div>
                                  <div className="text-[var(--positive)]">{contract.bid.toFixed(2)}</div>
                                  <div className="text-[var(--negative)]">{contract.ask.toFixed(2)}</div>
                                  <div className="text-[var(--text-high)]">{contract.last.toFixed(2)}</div>
                                  <div className="text-[var(--text-muted)]">{contract.oi.toLocaleString()}</div>
                                  <div className="text-[var(--text-muted)]">{contract.iv.toFixed(1)}%</div>
                                </button>
                              );
                            })}
                          </>
                        )}

                        {/* ITM Label */}
                        {itmContracts.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--surface-1)] border-t border-[var(--border-hairline)]">
                            <span className="text-[10px] text-[var(--text-muted)]">▼ ITM</span>
                          </div>
                        )}

                        {/* ITM Contracts */}
                        {itmContracts.map((contract) => {
                          const zebra = rowIndex++ % 2 === 1;
                          return (
                            <button
                              key={contract.strike}
                              className={`w-full grid grid-cols-[80px_70px_70px_70px_90px_90px] gap-2 px-3 py-2 text-xs text-left border-b border-[var(--border-hairline)] transition-colors hover:bg-[var(--surface-3)] bg-[#0a1929]`}
                            >
                              <div className="text-[var(--text-high)]">${contract.strike}</div>
                              <div className="text-[var(--positive)]">{contract.bid.toFixed(2)}</div>
                              <div className="text-[var(--negative)]">{contract.ask.toFixed(2)}</div>
                              <div className="text-[var(--text-high)]">{contract.last.toFixed(2)}</div>
                              <div className="text-[var(--text-muted)]">{contract.oi.toLocaleString()}</div>
                              <div className="text-[var(--text-muted)]">{contract.iv.toFixed(1)}%</div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annotation */}
          <div className="px-6 pb-6">
            <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-xs">
                💡 <strong>Click any row</strong> to load that contract as a trade idea. This will open the Load Alert composer on the right panel.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Alerts & Actions (Inactive) */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] p-4">
          <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
            Alerts & Actions
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
              <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                When you load or enter a trade, its Discord alert draft will appear here for review and editing.
              </p>
            </div>

            <button
              disabled
              className="w-full py-2.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] text-sm opacity-50 cursor-not-allowed"
            >
              Load an idea to create alert draft
            </button>

            {/* Faded preview */}
            <div className="p-4 bg-[var(--surface-2)]/50 rounded-lg border border-dashed border-[var(--border-hairline)] opacity-30">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
                Alert Preview (Inactive)
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[var(--bg-base)]/50 rounded w-3/4" />
                <div className="h-3 bg-[var(--bg-base)]/50 rounded w-full" />
                <div className="h-3 bg-[var(--bg-base)]/50 rounded w-2/3" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
