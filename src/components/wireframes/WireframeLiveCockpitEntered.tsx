export function WireframeLiveCockpitEntered() {
  return (
    <div className="w-full h-screen bg-[#1a1a1a] flex flex-col overflow-hidden font-mono text-xs">
      {/* Frame Label */}
      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1.5 rounded text-[#888] border border-[#333] z-50">
        Frame: Desktop.LiveCockpit.Entered
      </div>

      {/* HEADER - HDHeader */}
      <div className="border-b-2 border-[#444] bg-[#0f0f0f]">
        <div className="h-14 px-6 flex items-center justify-between">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#E2B714] rounded flex items-center justify-center">
              <div className="text-black text-lg">HD</div>
            </div>
            <span className="text-white">HoneyDrip Admin</span>
          </div>

          {/* Center: Session + Data timestamp */}
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-[#16A34A]/20 border border-[#16A34A] rounded-full text-[#16A34A]">
              Open
            </div>
            <span className="text-[#888]">Data as of 10:33:42 ET</span>
          </div>

          {/* Right: Settings + Mic */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#444] rounded flex items-center justify-center text-[#888]">
              ⚙
            </div>
            <div className="w-8 h-8 border border-[#444] rounded flex items-center justify-center text-[#888]">
              🎤
            </div>
          </div>
        </div>

        {/* Tab Row */}
        <div className="h-10 px-6 flex items-center gap-6 border-t border-[#333]">
          <div className="px-3 py-1.5 border-b-2 border-[#E2B714] text-[#E2B714]">
            Trade Management
          </div>
          <div className="px-3 py-1.5 text-[#888] hover:text-white cursor-pointer">
            History
          </div>
        </div>
      </div>

      {/* THREE-PANEL LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL - HDPanelWatchlist */}
        <div className="w-80 border-r-2 border-[#444] bg-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-[#E2B714]/10 border-b border-[#E2B714] px-3 py-1 text-[#E2B714] text-[10px]">
            HDPanelWatchlist – Loaded vs Active split
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Loaded Trades Section - NOW EMPTY */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Loaded Trades (0)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="px-4 py-3 text-[#666] text-center italic">
                No loaded trades
              </div>
            </div>

            {/* Active Trades Section - NOW HAS SPX */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Active Trades (1)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="p-3">
                {/* FOCUSED ACTIVE TRADE */}
                <div className="border-l-2 border-[#16A34A] bg-[#16A34A]/10 px-3 py-2.5 rounded hover:bg-[#16A34A]/15 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white">SPX</span>
                        <span className="px-1.5 py-0.5 bg-[#E2B714] text-black text-[10px] rounded">Scalp</span>
                      </div>
                      <span className="text-[#ccc] text-[11px]">5800C • 0DTE</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-[#16A34A]/20 text-[#16A34A] text-[10px] rounded border border-[#16A34A]">
                        ENTERED
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[#16A34A] text-sm">↑</span>
                        <span className="text-[#16A34A]">+2.4%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Watchlist Section */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f]">
                <div className="flex items-center gap-2">
                  <span className="text-white uppercase tracking-wide">Watchlist (5)</span>
                  <span className="text-[#888]">▼</span>
                </div>
                <button className="w-6 h-6 border border-[#E2B714] rounded text-[#E2B714] flex items-center justify-center hover:bg-[#E2B714]/10">
                  +
                </button>
              </div>

              <div>
                <div className="border-l-2 border-[#E2B714]/30 bg-[#E2B714]/5 px-4 py-2.5 flex items-center justify-between hover:bg-[#E2B714]/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-white">SPX</span>
                    <span className="text-[10px] text-[#888]">S&P 500 Index</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-white">5,782.50</span>
                    <span className="text-[#16A34A] text-[10px]">+0.42%</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] border-l-2 border-transparent">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#ccc]">AAPL</span>
                    <span className="text-[10px] text-[#888]">Apple Inc.</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[#ccc]">182.34</span>
                    <span className="text-[#EF4444] text-[10px]">-0.18%</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] border-l-2 border-transparent">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#ccc]">TSLA</span>
                    <span className="text-[10px] text-[#888]">Tesla Inc.</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[#ccc]">248.92</span>
                    <span className="text-[#16A34A] text-[10px]">+1.23%</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] border-l-2 border-transparent">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#ccc]">NVDA</span>
                    <span className="text-[10px] text-[#888]">NVIDIA Corp.</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[#ccc]">495.67</span>
                    <span className="text-[#16A34A] text-[10px]">+2.15%</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] border-l-2 border-transparent">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#ccc]">META</span>
                    <span className="text-[10px] text-[#888]">Meta Platforms</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[#ccc]">512.89</span>
                    <span className="text-[#EF4444] text-[10px]">-0.56%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Challenges Section */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f]">
                <div className="flex items-center gap-2">
                  <span className="text-white uppercase tracking-wide">Challenges (2)</span>
                  <span className="text-[#888]">▼</span>
                </div>
                <button className="w-6 h-6 border border-[#E2B714] rounded text-[#E2B714] flex items-center justify-center hover:bg-[#E2B714]/10">
                  +
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div className="px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded hover:bg-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-white text-xs">Week 1 Challenge</div>
                    <div className="text-[#16A34A] text-xs">+2.4%</div>
                  </div>
                  <div className="text-[#888] text-[10px]">Admin Specific • 1 trade</div>
                </div>
                <div className="px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded hover:bg-[#1a1a1a]">
                  <div className="text-white text-xs mb-1">December Sprint</div>
                  <div className="text-[#888] text-[10px]">HoneyDrip Wide • 0 trades</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL - HDPanelFocusedTrade (ENTERED) */}
        <div className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-blue-500/10 border-b border-blue-500 px-3 py-1 text-blue-400 text-[10px]">
            HDPanelFocusedTrade (ENTERED state) – Maps to {"<HDPanelFocusedTrade state='ENTERED' />"}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {/* Entered Trade Summary Card */}
            <div className="border-2 border-[#16A34A] bg-[#1a1a1a] rounded-lg p-6 mb-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-white text-2xl">SPX</h2>
                  <span className="px-2 py-1 bg-[#E2B714] text-black rounded">Scalp</span>
                  <span className="px-2 py-1 bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A] rounded text-xs">
                    ENTERED
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <span className="text-[#16A34A] text-xl">↑</span>
                    <span className="text-[#16A34A] text-xl">+2.4%</span>
                  </div>
                  <div className="text-[#888] text-xs">P&L</div>
                </div>
              </div>

              {/* Contract Info */}
              <div className="mb-4">
                <div className="text-[#ccc] text-sm">0DTE 5800 Call • Expires Dec 20, 2024</div>
              </div>

              {/* Price Grid - 4 Column (ESSENTIAL) */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-[#0f0f0f] rounded border border-[#333] mb-4">
                <div>
                  <div className="text-[#888] text-[10px] mb-1">Entry</div>
                  <div className="text-white text-sm">$18.25</div>
                </div>
                <div>
                  <div className="text-[#888] text-[10px] mb-1">Current</div>
                  <div className="text-[#16A34A] text-sm">$18.69</div>
                </div>
                <div>
                  <div className="text-[#888] text-[10px] mb-1">Target</div>
                  <div className="text-[#16A34A] text-sm">$21.90</div>
                </div>
                <div>
                  <div className="text-[#888] text-[10px] mb-1">Stop</div>
                  <div className="text-[#EF4444] text-sm">$16.40</div>
                </div>
              </div>

              {/* Compact Contract Details - Collapsible */}
              <details className="group">
                <summary className="cursor-pointer p-3 bg-[#0f0f0f] rounded border border-[#333] hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs">Contract Details</span>
                    <span className="text-[#888] text-xs group-open:rotate-180 transition-transform">▼</span>
                  </div>
                </summary>
                
                <div className="mt-2 p-3 bg-[#0f0f0f] rounded border border-[#333] space-y-2">
                  {/* Mid/Bid/Ask in compact row */}
                  <div className="grid grid-cols-6 gap-2 text-[10px]">
                    <div className="text-[#888]">Mid</div>
                    <div className="text-white">$18.65</div>
                    <div className="text-[#888]">Bid</div>
                    <div className="text-white">$18.60</div>
                    <div className="text-[#888]">Ask</div>
                    <div className="text-white">$18.70</div>
                  </div>

                  {/* Greeks in compact rows */}
                  <div className="grid grid-cols-8 gap-2 text-[10px]">
                    <div className="text-[#888]">Δ</div>
                    <div className="text-white">0.52</div>
                    <div className="text-[#888]">Γ</div>
                    <div className="text-white">0.03</div>
                    <div className="text-[#888]">Θ</div>
                    <div className="text-white">-0.25</div>
                    <div className="text-[#888]">V</div>
                    <div className="text-white">0.08</div>
                  </div>

                  {/* Volume/OI/IV in compact row */}
                  <div className="grid grid-cols-6 gap-2 text-[10px]">
                    <div className="text-[#888]">Vol</div>
                    <div className="text-white">5.6K</div>
                    <div className="text-[#888]">OI</div>
                    <div className="text-white">12.3K</div>
                    <div className="text-[#888]">IV</div>
                    <div className="text-white">24.5%</div>
                  </div>
                </div>
              </details>
            </div>

            {/* Updates Section */}
            <div className="border border-[#333] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#1a1a1a] border-b border-[#333]">
                <h3 className="text-white text-sm uppercase tracking-wide">Trade Updates</h3>
              </div>
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="text-[#888] text-xs">10:32:15</div>
                  <div className="flex-1">
                    <div className="text-white text-xs mb-1">🎯 ENTERED</div>
                    <div className="text-[#888] text-xs">Entry: $18.25 • Target: $21.90 • Stop: $16.40</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Quick Actions */}
        <div className="w-80 border-l-2 border-[#444] bg-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-purple-500/10 border-b border-purple-500 px-3 py-1 text-purple-400 text-[10px]">
            ENTERED state → Quick Actions open HDPanelDiscordAlert (no auto-send)
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Header */}
            <h3 className="text-white mb-4 uppercase tracking-wide">Trade Actions</h3>

            {/* Quick Actions Buttons */}
            <div className="space-y-3 mb-6">
              {/* Position Management */}
              <div>
                <div className="text-[#888] text-[10px] mb-2 uppercase tracking-wide">Position Management</div>
                <div className="space-y-2">
                  <button className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#444] rounded text-white text-xs hover:bg-[#1a1a1a] hover:border-[#E2B714] transition-colors text-left flex items-center gap-2">
                    <span>📊</span> Trim (capture P&L)
                  </button>
                  <button className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#444] rounded text-white text-xs hover:bg-[#1a1a1a] hover:border-[#E2B714] transition-colors text-left flex items-center gap-2">
                    <span>🛡️</span> Update Stop Loss
                  </button>
                  <button className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#444] rounded text-white text-xs hover:bg-[#1a1a1a] hover:border-[#E2B714] transition-colors text-left flex items-center gap-2">
                    <span>🎯</span> Update Target
                  </button>
                  <button className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#444] rounded text-white text-xs hover:bg-[#1a1a1a] hover:border-[#E2B714] transition-colors text-left flex items-center gap-2">
                    <span>📝</span> Update (price + message)
                  </button>
                </div>
              </div>

              {/* Position Changes */}
              <div>
                <div className="text-[#888] text-[10px] mb-2 uppercase tracking-wide">Position Changes</div>
                <button className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#444] rounded text-white text-xs hover:bg-[#1a1a1a] hover:border-[#16A34A] transition-colors text-left flex items-center gap-2">
                  <span>➕</span> Add to Position
                </button>
              </div>

              {/* Exit */}
              <div>
                <div className="text-[#888] text-[10px] mb-2 uppercase tracking-wide">Exit Trade</div>
                <button className="w-full px-3 py-2.5 bg-[#EF4444]/10 border border-[#EF4444] rounded text-[#EF4444] text-xs hover:bg-[#EF4444]/20 transition-colors text-left flex items-center gap-2">
                  <span>🏁</span> Full Exit
                </button>
              </div>
            </div>

            {/* Helper Text */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded text-blue-400 text-[10px] leading-relaxed mb-4">
              Each action opens a draft alert on the right. You can configure which fields are included, adjust prices, pick channels, and add a comment before sending. <strong>Nothing is auto-sent.</strong>
              <div className="mt-2 pt-2 border-t border-blue-500/30">
                💡 <strong>Discord channels &amp; Challenges</strong> are collapsed by default (inherited from last alert). Expand if you need to change them.
              </div>
            </div>

            {/* Preview Ghost Box */}
            <div className="border border-[#333] rounded-lg overflow-hidden bg-[#0f0f0f]">
              <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#333]">
                <div className="text-[#888] text-[10px] uppercase tracking-wide">Preview: Alert Composers</div>
              </div>
              <div className="p-3 space-y-2 text-[10px] text-[#666]">
                <div className="flex items-start gap-2">
                  <span>📊</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Trim</div>
                    <div>Opens UPDATE alert with Current + P&L included</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span>🛡️</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Update Stop Loss</div>
                    <div>Breakeven / Fixed / Trailing options</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span>🎯</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Update Target</div>
                    <div>Set new target with quick % adjustments</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span>📝</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Update</div>
                    <div>Generic update: Current price + message</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span>➕</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Add to Position</div>
                    <div>ADDED alert with Current + P&L</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span>🏁</span>
                  <div className="flex-1">
                    <div className="text-white mb-1">Full Exit</div>
                    <div>EXITED alert with final P&L</div>
                    <div className="mt-1 text-[#888]">Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Toast Note */}
            <div className="mt-4 p-3 bg-[#0f0f0f] border border-[#333] rounded text-[#888] text-[10px] leading-relaxed">
              <div className="mb-2 text-white uppercase tracking-wide">After Send:</div>
              <div>Composer closes, returns to Quick Actions panel, and shows toast:</div>
              <div className="mt-2 px-2 py-1 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded text-[#16A34A]">
                ✓ Alert sent to #channel1, #channel2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="border-t-2 border-[#444] bg-black/40 px-6 py-2 flex items-center justify-between text-[10px] text-[#666]">
        <div>
          State: <span className="text-[#16A34A]">ENTERED</span> | tradeState: <span className="text-white">ENTERED</span> | showAlert: <span className="text-white">false</span>
        </div>
        <div>
          Frame: Desktop.LiveCockpit.Entered @ 1440px
        </div>
      </div>
    </div>
  );
}
