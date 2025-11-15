import { Settings, Mic, TrendingUp, Activity, Droplets, BarChart3, AlertCircle, X, ChevronDown } from 'lucide-react';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';

/**
 * DESKTOP.LIVECOCKPIT.ENTER-WITH-CONFLUENCE
 * 
 * Shows the screen an admin sees AFTER loading a trade and BEFORE sending the ENTER alert.
 * Features a data-rich Confluence Panel powered by Massive.com (Options + Indices REST + WebSockets).
 * 
 * Layout:
 * - Left: Watchlist / Loaded / Active / Challenges (context)
 * - Center: About to Enter + Confluence Panel (STAR of this frame)
 * - Right: Enter Alert Composer (draft-only)
 */

export function DesktopLiveCockpitEnterWithConfluence() {
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
            <span className="ml-2 text-[var(--positive)]\">● Live</span>
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

      {/* MAIN LAYOUT: 3 COLUMNS */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ========== LEFT PANEL: WATCHLIST / LOADED / ACTIVE / CHALLENGES ========== */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex flex-col overflow-hidden">
          
          {/* LOADED TRADES */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Loaded Trades</h3>
              <span className="text-xs text-[var(--text-muted)]">1</span>
            </div>
            <div className="space-y-2">
              {/* SELECTED LOADED TRADE */}
              <div className="p-3 bg-[var(--brand-primary)]/20 border border-[var(--brand-primary)] rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm text-[var(--text-high)] font-medium">SPX 0DTE 5800C</div>
                    <div className="text-xs text-[var(--text-muted)]">Scalp · Loaded 14:38 ET</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                    LOADED
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Challenge: Small Account
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE TRADES */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active Trades</h3>
              <span className="text-xs text-[var(--text-muted)]">0</span>
            </div>
            <div className="text-xs text-[var(--text-muted)] italic">
              No active trades
            </div>
          </div>

          {/* WATCHLIST */}
          <div className="flex-1 p-4 border-b border-[var(--border-hairline)] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Watchlist</h3>
              <span className="text-xs text-[var(--text-muted)]">4</span>
            </div>
            <div className="space-y-1">
              {/* SPX - SELECTED */}
              <div className="p-2 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-high)] font-medium">SPX</span>
                  <span className="text-xs text-[var(--positive)]">+0.78%</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">5,842.35</div>
              </div>
              <div className="p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-high)]">NDX</span>
                  <span className="text-xs text-[var(--positive)]">+1.12%</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">20,456.78</div>
              </div>
              <div className="p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-high)]">QQQ</span>
                  <span className="text-xs text-[var(--negative)]">-0.34%</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">498.23</div>
              </div>
              <div className="p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-high)]">SPY</span>
                  <span className="text-xs text-[var(--positive)]">+0.45%</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">584.67</div>
              </div>
            </div>
          </div>

          {/* CHALLENGES */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Challenges</h3>
              <span className="text-xs text-[var(--text-muted)]">3</span>
            </div>
            <div className="space-y-2">
              <div className="p-2 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded">
                <div className="text-sm text-[var(--text-high)]">Small Account</div>
                <div className="text-xs text-[var(--text-muted)]">4/10 trades</div>
              </div>
              <div className="p-2 bg-[var(--surface-2)] rounded">
                <div className="text-sm text-[var(--text-high)]">0DTE Master</div>
                <div className="text-xs text-[var(--text-muted)]">12/20 trades</div>
              </div>
              <div className="p-2 bg-[var(--surface-2)] rounded">
                <div className="text-sm text-[var(--text-high)]">High Win Rate</div>
                <div className="text-xs text-[var(--text-muted)]">18/25 trades</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== CENTER PANEL: ABOUT TO ENTER + CONFLUENCE ========== */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* 1) HEADER ROW */}
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-[var(--text-high)] text-2xl mb-1">About to enter this trade</h1>
                <p className="text-[var(--text-muted)] text-sm">Review confluence and levels before sending ENTER alert.</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/50 rounded-lg mb-1">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">Real-time data via Massive</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Data as of <span className="text-[var(--text-high)]">14:42:33 ET</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2) CONFLUENCE SUMMARY STRIP - 3 CHIPS */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-3 mb-2">
              
              {/* CHIP 1: TREND */}
              <div className="p-4 bg-[var(--positive)]/10 border border-[var(--positive)]/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[var(--positive)]" />
                  <span className="text-xs uppercase tracking-wide text-[var(--positive)] font-medium">Trend</span>
                </div>
                <div className="text-sm text-[var(--text-high)] font-medium mb-1">Bullish</div>
                <div className="text-xs text-[var(--text-muted)]">3/3 timeframes aligned</div>
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--positive)]"></div>
                  <div className="w-2 h-2 rounded-full bg-[var(--positive)]"></div>
                  <div className="w-2 h-2 rounded-full bg-[var(--positive)]"></div>
                </div>
              </div>

              {/* CHIP 2: VOLATILITY */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs uppercase tracking-wide text-yellow-500 font-medium">Volatility</span>
                </div>
                <div className="text-sm text-[var(--text-high)] font-medium mb-1">Elevated IV</div>
                <div className="text-xs text-[var(--text-muted)]">78th percentile</div>
                <div className="mt-2 flex items-center gap-1">
                  <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>
              </div>

              {/* CHIP 3: LIQUIDITY / FLOW */}
              <div className="p-4 bg-[var(--positive)]/10 border border-[var(--positive)]/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-[var(--positive)]" />
                  <span className="text-xs uppercase tracking-wide text-[var(--positive)] font-medium">Liquidity</span>
                </div>
                <div className="text-sm text-[var(--text-high)] font-medium mb-1">Good</div>
                <div className="text-xs text-[var(--text-muted)]">Tight spread · High volume</div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <span>Spread: 2.8%</span>
                  <span>·</span>
                  <span>Vol: 2.1× avg</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-[var(--text-muted)] italic">
              💡 Trend · Volatility · Liquidity are updated in real-time via Massive while you review this trade.
            </p>
          </div>

          {/* 3) INDEX CONTEXT CARD + 4) CONTRACT HEALTH CARD - SIDE BY SIDE */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            
            {/* 3) INDEX CONTEXT CARD */}
            <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm text-[var(--text-high)] font-medium">Market Context – SPX Index</h3>
                  <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--surface-2)] text-[var(--text-muted)]">
                    Index
                  </span>
                </div>
                <span className="text-sm text-[var(--positive)] font-medium">+0.78%</span>
              </div>

              {/* MINI SPARKLINE */}
              <div className="mb-3 h-16 bg-[var(--surface-2)] rounded border border-[var(--border-hairline)] relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    points="0,80 10,75 20,78 30,70 40,65 50,68 60,60 70,55 80,50 90,45 100,40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[var(--positive)]"
                  />
                </svg>
                <div className="absolute bottom-1 right-1 text-[9px] text-[var(--text-muted)]">
                  Last 30min
                </div>
              </div>

              {/* STATS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">RSI (5m)</span>
                  <span className="text-[var(--text-high)] font-medium">64 · <span className="text-[var(--positive)]">Bullish bias</span></span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">MACD (5m)</span>
                  <span className="text-[var(--positive)]">Trending up</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Above 5m EMA</span>
                  <span className="text-[var(--positive)]">Yes</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--positive)]">
                  ✓ Index momentum is currently aligned with call direction.
                </p>
              </div>
            </div>

            {/* 4) CONTRACT HEALTH CARD */}
            <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm text-[var(--text-high)] font-medium">Contract Health – SPX 0DTE 5800C</h3>
              </div>

              {/* PRICING & VOLATILITY */}
              <div className="mb-3 pb-3 border-b border-[var(--border-hairline)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Pricing & Volatility</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">IV</span>
                    <span className="text-[var(--text-high)] font-medium">22.4% <span className="text-yellow-500">(p75 · Elevated)</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">IV trend (15m)</span>
                    <span className="text-[var(--positive)]">Rising</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Expected move today</span>
                    <span className="text-[var(--text-high)]">$48</span>
                  </div>
                </div>
              </div>

              {/* LIQUIDITY */}
              <div className="mb-3 pb-3 border-b border-[var(--border-hairline)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Liquidity</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Spread</span>
                    <span className="text-[var(--text-high)] font-medium">$0.05 <span className="text-[var(--positive)]">(2.8%)</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Volume</span>
                    <span className="text-[var(--text-high)]">8,432 <span className="text-[var(--positive)]">(2.1× avg)</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Open Interest</span>
                    <span className="text-[var(--text-high)]">15,200</span>
                  </div>
                </div>
              </div>

              {/* GREEKS */}
              <div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Greeks</div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[var(--text-high)]">Δ <span className="font-medium">0.42</span></span>
                  <span className="text-[var(--text-high)]">Γ <span className="font-medium">0.18</span></span>
                  <span className="text-[var(--text-high)]">Θ <span className="font-medium text-[var(--negative)]">-0.09</span></span>
                  <span className="text-[var(--text-high)]">Vega <span className="font-medium">0.15</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* 5) FLOW STRIP */}
          <div className="mb-6 p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Options Flow (Last 60 seconds)</span>
              </div>
              <span className="text-xs text-[var(--text-high)]">Last 60s: <span className="font-medium">42 trades</span></span>
            </div>

            {/* FLOW BAR */}
            <div className="mb-2">
              <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden flex">
                <div className="bg-[var(--negative)]" style={{ width: '32%' }}></div>
                <div className="bg-[var(--positive)]" style={{ width: '68%' }}></div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--negative)]">32% at bid</span>
              <span className="text-[var(--text-high)]">Net volume: <span className="text-[var(--positive)] font-medium">+2,300 calls</span></span>
              <span className="text-[var(--positive)]">68% at ask</span>
            </div>
          </div>

          {/* 6) ENTRY / TP / SL BLOCK */}
          <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
            <h3 className="text-sm text-[var(--text-high)] font-medium mb-3">Entry & Risk Parameters</h3>
            
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Entry</label>
                <input
                  type="text"
                  defaultValue="$1.25"
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Target (TP1)</label>
                <input
                  type="text"
                  defaultValue="$1.80"
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Stop Loss</label>
                <input
                  type="text"
                  defaultValue="$0.90"
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Risk:Reward</label>
                <div className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--positive)] font-medium">
                  1 : 2.2
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] italic">
              💡 TP/SL seeded from your defaults and ATR/structure; adjust as needed before sending ENTER alert.
            </p>
          </div>

        </div>

        {/* ========== RIGHT PANEL: ENTER ALERT COMPOSER ========== */}
        <div className="w-[420px] bg-[var(--surface-1)] border-l border-[var(--border-hairline)] flex flex-col">
          
          {/* HEADER */}
          <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--text-high)] font-medium">Enter – Alert Preview</h3>
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                DRAFT
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
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--positive)]/50 rounded-lg">
                <div className="text-sm text-[var(--text-high)] space-y-2 leading-relaxed">
                  <div className="font-medium text-base">📍 <strong>ENTER</strong> – SPX $5800C 0DTE (Scalp)</div>
                  
                  <div className="pt-2 space-y-1 text-xs">
                    <div>Entry: <span className="text-[var(--text-high)] font-medium">$1.25</span></div>
                    <div>Current: <span className="text-[var(--text-high)] font-medium">$1.28</span></div>
                    <div>Target: <span className="text-[var(--positive)] font-medium">$1.80</span></div>
                    <div>Stop: <span className="text-[var(--negative)] font-medium">$0.90</span></div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-hairline)] text-xs">
                    <div className="font-medium text-[var(--text-muted)] mb-1">Confluence:</div>
                    <div className="space-y-0.5">
                      <div>• Trend: <span className="text-[var(--positive)]">Bullish 3/3</span></div>
                      <div>• IV: <span className="text-yellow-500">Elevated (p78)</span></div>
                      <div>• Liquidity: <span className="text-[var(--positive)]">Good</span></div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] text-xs italic">
                    Strong confluence + clean setup. Let's ride this momentum! 🚀
                  </div>
                </div>
              </div>
            </div>

            {/* INCLUDED FIELDS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Included Fields
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Entry Price</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Current Price</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Target (TP)</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Stop Loss</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Confluence Summary</span>
                </label>
              </div>
            </div>

            {/* DISCORD CHANNELS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Discord Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-high)]">#options-signals</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#spx-scalps</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#0dte-plays</span>
                </label>
              </div>
            </div>

            {/* CHALLENGES */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Challenges
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Small Account</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">0DTE Master</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">High Win Rate</span>
                </label>
              </div>
            </div>

            {/* COMMENT */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Comment (Optional)
              </label>
              <textarea
                defaultValue="Strong confluence + clean setup. Let's ride this momentum! 🚀"
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                rows={3}
                placeholder="Add a comment..."
              />
            </div>

            {/* INFO NOTE */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                💡 <strong>No auto-send:</strong> This alert will remain in DRAFT until you click "Send Alert". Review confluence and adjust levels as needed.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-[var(--border-hairline)] flex items-center gap-3 flex-shrink-0">
            <button className="flex-1 py-3 px-4 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-lg transition-colors text-center">
              Cancel
            </button>
            <button className="flex-1 py-3 px-4 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors text-center">
              Send Alert
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default DesktopLiveCockpitEnterWithConfluence;
