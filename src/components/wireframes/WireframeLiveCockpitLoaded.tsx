export function WireframeLiveCockpitLoaded() {
  return (
    <div className="w-full h-screen bg-[#1a1a1a] flex flex-col overflow-hidden font-mono text-xs">
      {/* Frame Label */}
      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1.5 rounded text-[#888] border border-[#333] z-50">
        Frame: Desktop.LiveCockpit.Loaded
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
            <span className="text-[#888]">Data as of 10:31:07 ET</span>
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
            HDPanelWatchlist – Clicking Loaded trade row sets focused trade
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Loaded Trades Section - NOW POPULATED */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Loaded Trades (1)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="p-3">
                {/* FOCUSED LOADED TRADE */}
                <div className="border-l-2 border-[#E2B714] bg-[#E2B714]/10 px-3 py-2.5 rounded hover:bg-[#E2B714]/15 cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white">SPX</span>
                        <span className="px-1.5 py-0.5 bg-[#E2B714] text-black text-[10px] rounded">Scalp</span>
                      </div>
                      <span className="text-[#ccc] text-[11px]">0DTE 5800C</span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded border border-blue-500">
                      LOADED
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Trades Section - STILL EMPTY */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Active Trades (0)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="px-4 py-3 text-[#666] text-center italic">
                No active trades yet
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

              {/* Watchlist Rows */}
              <div>
                {/* SPX Row - underlying ticker */}
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

                {/* Other Rows */}
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
                  <span className="text-white uppercase tracking-wide">Challenges (0)</span>
                  <span className="text-[#888]">▼</span>
                </div>
                <button className="w-6 h-6 border border-[#E2B714] rounded text-[#E2B714] flex items-center justify-center hover:bg-[#E2B714]/10">
                  +
                </button>
              </div>
              <div className="px-4 py-6 text-[#666] text-center italic">
                No challenges yet
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL - Loaded Trade Summary */}
        <div className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-blue-500/10 border-b border-blue-500 px-3 py-1 text-blue-400 text-[10px]">
            Loaded Trade Summary – read-only trade type, no entry price until Enter now
          </div>

          <div className="flex-1 overflow-auto p-6">
            {/* Loaded Trade Summary Card */}
            <div className="border-2 border-[#E2B714] bg-[#1a1a1a] rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-white text-2xl">SPX</h2>
                    <span className="px-2 py-1 bg-[#E2B714] text-black rounded">Scalp</span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500 rounded text-xs">
                      LOADED
                    </span>
                  </div>
                  <div className="text-[#ccc]">0DTE 5800 Call</div>
                </div>
                <div className="text-right">
                  <div className="text-[#888] text-xs mb-1">Loaded at</div>
                  <div className="text-white">10:31:07 ET</div>
                </div>
              </div>

              {/* Contract Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#0f0f0f] rounded border border-[#333] mb-4">
                <div>
                  <div className="text-[#888] text-xs mb-1">Strike</div>
                  <div className="text-white">5800</div>
                </div>
                <div>
                  <div className="text-[#888] text-xs mb-1">Type</div>
                  <div className="text-[#16A34A]">CALL</div>
                </div>
                <div>
                  <div className="text-[#888] text-xs mb-1">Expiration</div>
                  <div className="text-white">Dec 20, 2024 (0DTE)</div>
                </div>
                <div>
                  <div className="text-[#888] text-xs mb-1">Trade Type</div>
                  <div className="text-[#E2B714]">Scalp (auto-inferred)</div>
                </div>
              </div>

              {/* Entry Status */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded mb-4">
                <div className="text-[#888] text-xs mb-1">Entry Price</div>
                <div className="text-blue-400 italic">Not entered yet</div>
              </div>

              {/* TP/SL Info */}
              <div className="p-4 bg-[#0f0f0f] border border-[#333] rounded">
                <div className="text-[#888] text-xs mb-2">TP / SL</div>
                <div className="text-[#ccc] text-xs">
                  TP and SL will be set using admin defaults when entering
                </div>
              </div>
            </div>

            {/* PRIMARY ACTIONS - CENTERED AND PROMINENT */}
            <div className="mb-6">
              <div className="text-center mb-4">
                <h3 className="text-white text-lg mb-2">Ready to Enter Trade</h3>
                <p className="text-[#888] text-sm">
                  Review the trade details above, then enter or discard this idea
                </p>
              </div>
              
              <div className="max-w-md mx-auto space-y-3">
                <button className="w-full px-6 py-4 bg-[#E2B714] text-black rounded-lg hover:bg-[#E2B714]/90 transition-colors text-base">
                  Enter Trade
                </button>
                <button className="w-full px-6 py-3 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors border border-[#444] text-base">
                  Discard
                </button>
              </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-blue-500/10 border border-blue-500 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <div className="text-blue-400 text-lg">ℹ</div>
                <div className="text-blue-400 text-xs leading-relaxed">
                  Clicking <strong>Enter Trade</strong> will open the alert composer where you can select Discord channels, challenges, and add a comment before sending.
                </div>
              </div>
            </div>

            {/* Condensed Contract Grid (Optional - Secondary) */}
            <div className="border border-[#333] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#1a1a1a] border-b border-[#333]">
                <h3 className="text-white text-sm">Other SPX Contracts</h3>
              </div>
              
              {/* Mini Contract Grid */}
              <div className="p-3">
                <div className="grid grid-cols-8 gap-2 px-3 py-2 bg-[#1a1a1a] border-b border-[#333] text-[#888] uppercase text-[10px]">
                  <div>Strike</div>
                  <div>Type</div>
                  <div className="text-right">Mid</div>
                  <div className="text-right">Bid</div>
                  <div className="text-right">Ask</div>
                  <div className="text-right">Volume</div>
                  <div className="text-right">Delta</div>
                  <div className="text-right">Theta</div>
                </div>

                <div className="grid grid-cols-8 gap-2 px-3 py-2 hover:bg-[#1a1a1a] cursor-pointer text-xs border-b border-[#333]">
                  <div className="text-white">5775</div>
                  <div className="text-[#16A34A]">C</div>
                  <div className="text-right text-[#ccc]">28.90</div>
                  <div className="text-right text-[#ccc]">28.70</div>
                  <div className="text-right text-[#ccc]">29.10</div>
                  <div className="text-right text-[#ccc]">2,456</div>
                  <div className="text-right text-[#ccc]">0.48</div>
                  <div className="text-right text-[#ccc]">-0.21</div>
                </div>

                <div className="grid grid-cols-8 gap-2 px-3 py-2 bg-[#E2B714]/10 border-l-2 border-[#E2B714] text-xs border-b border-[#333]">
                  <div className="text-white">5800</div>
                  <div className="text-[#16A34A]">C</div>
                  <div className="text-right text-white">18.25</div>
                  <div className="text-right text-[#ccc]">18.10</div>
                  <div className="text-right text-[#ccc]">18.40</div>
                  <div className="text-right text-[#ccc]">5,678</div>
                  <div className="text-right text-[#ccc]">0.50</div>
                  <div className="text-right text-[#ccc]">-0.25</div>
                </div>

                <div className="grid grid-cols-8 gap-2 px-3 py-2 hover:bg-[#1a1a1a] cursor-pointer text-xs">
                  <div className="text-white">5825</div>
                  <div className="text-[#16A34A]">C</div>
                  <div className="text-right text-[#ccc]">10.75</div>
                  <div className="text-right text-[#ccc]">10.60</div>
                  <div className="text-right text-[#ccc]">10.90</div>
                  <div className="text-right text-[#ccc]">3,234</div>
                  <div className="text-right text-[#ccc]">0.42</div>
                  <div className="text-right text-[#ccc]">-0.19</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - LOADED Actions + Alert Draft */}
        <div className="w-80 border-l-2 border-[#444] bg-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-purple-500/10 border-b border-purple-500 px-3 py-1 text-purple-400 text-[10px]">
            Trade status indicator - actions moved to center panel
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Header */}
            <h3 className="text-white mb-4 uppercase tracking-wide">Trade Loaded</h3>

            {/* Trade Ready Card */}
            <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
              <div className="p-4 text-center">
                <div className="text-white mb-2">SPX 423P</div>
                <div className="text-[#888] text-xs">Ready to enter</div>
              </div>
            </div>

            {/* Alert Draft Preview */}
            <div className="border border-[#333] rounded-lg overflow-hidden mt-6 mb-4">
              <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#333]">
                <div className="text-white text-xs uppercase tracking-wide">Alert Draft Preview</div>
              </div>
              
              <div className="p-3 space-y-3">
                {/* Message Preview */}
                <div>
                  <div className="text-[#888] text-xs mb-1">Message</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs leading-relaxed">
                    Ready to enter <strong className="text-white">SPX 0DTE 5800C</strong> (Scalp).
                    <br /><br />
                    Entry price and TP/SL will be set using your default settings.
                    <br /><br />
                    <span className="text-[#888]">Data as of 10:31:07 ET</span>
                  </div>
                </div>

                {/* Channels */}
                <div>
                  <div className="text-[#888] text-xs mb-2">Discord Channels</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                      <input type="checkbox" defaultChecked readOnly className="w-3 h-3" />
                      <span className="text-[#5865F2] text-xs">#options-signals</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                      <input type="checkbox" defaultChecked readOnly className="w-3 h-3" />
                      <span className="text-[#5865F2] text-xs">#scalps</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs">#general</span>
                    </label>
                  </div>
                </div>

                {/* Challenges */}
                <div>
                  <div className="text-[#888] text-xs mb-2">Challenges</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                      <input type="checkbox" defaultChecked readOnly className="w-3 h-3" />
                      <div className="flex-1">
                        <div className="text-white text-xs">Week 1 Challenge</div>
                        <div className="text-[#888] text-[10px]">Admin Specific</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <div className="flex-1">
                        <div className="text-[#888] text-xs">December Sprint</div>
                        <div className="text-[#666] text-[10px]">HoneyDrip Wide</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Info Note */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded">
                  <div className="text-blue-400/80 text-[10px] leading-relaxed">
                    💡 This draft will be used when you click <strong>Enter Trade</strong> in the center panel.
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Explanation */}
            <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded text-[#888] text-[10px] leading-relaxed">
              <div className="mb-2 text-white uppercase tracking-wide">When you enter:</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Entry price and TP/SL calculated</li>
                <li>Alert composer opens for final review</li>
                <li>You can edit before sending</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="border-t-2 border-[#444] bg-black/40 px-6 py-2 flex items-center justify-between text-[10px] text-[#666]">
        <div>
          State: <span className="text-blue-400">LOADED</span> | focusedTrade: <span className="text-white">SPX 0DTE 5800C</span> | showAlert: <span className="text-white">true (draft)</span>
        </div>
        <div>
          Frame: Desktop.LiveCockpit.Loaded @ 1440px
        </div>
      </div>
    </div>
  );
}
