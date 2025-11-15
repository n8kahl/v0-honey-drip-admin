export function WireframeLiveCockpitWatching() {
  return (
    <div className="w-full h-screen bg-[#1a1a1a] flex flex-col overflow-hidden font-mono text-xs">
      {/* Frame Label */}
      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1.5 rounded text-[#888] border border-[#333] z-50">
        Frame: Desktop.LiveCockpit.Watching
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
            <span className="text-[#888]">Data as of 09:30:15 ET</span>
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
            HDPanelWatchlist (watchlist + loaded + active + challenges)
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Loaded Trades Section */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Loaded Trades (0)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="px-4 py-3 text-[#666] text-center italic">
                No loaded trades yet
              </div>
            </div>

            {/* Active Trades Section */}
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

              {/* Watchlist Rows (HDRowWatchlist) */}
              <div>
                {/* Active Row - SPX */}
                <div className="border-l-2 border-[#E2B714] bg-[#E2B714]/5 px-4 py-2.5 flex items-center justify-between hover:bg-[#E2B714]/10">
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

        {/* CENTER PANEL - Contract Grid (WATCHING with ticker selected) */}
        <div className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-blue-500/10 border-b border-blue-500 px-3 py-1 text-blue-400 text-[10px]">
            WATCHING state → HDContractGrid (if ticker selected) | HDPanelFocusedTrade placeholder (if no ticker)
          </div>

          <div className="flex-1 overflow-auto p-6">
            {/* Contract Grid Header */}
            <div className="mb-4">
              <h2 className="text-white text-lg mb-4">SPX Contracts</h2>
              
              {/* Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 border border-[#444] rounded text-[#888] hover:bg-[#1a1a1a]">
                    ITM
                  </button>
                  <button className="px-3 py-1.5 border-2 border-[#E2B714] bg-[#E2B714]/10 rounded text-[#E2B714]">
                    ATM
                  </button>
                  <button className="px-3 py-1.5 border border-[#444] rounded text-[#888] hover:bg-[#1a1a1a]">
                    OTM
                  </button>
                </div>
                <div className="h-4 w-px bg-[#444]"></div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 border-2 border-[#E2B714] bg-[#E2B714]/10 rounded text-[#E2B714]">
                    Calls
                  </button>
                  <button className="px-3 py-1.5 border border-[#444] rounded text-[#888] hover:bg-[#1a1a1a]">
                    Puts
                  </button>
                </div>
              </div>
            </div>

            {/* Contract Grid Table */}
            <div className="border border-[#333] rounded overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-11 gap-2 px-3 py-2 bg-[#1a1a1a] border-b border-[#333] text-[#888] uppercase text-[10px]">
                <div>Expiry</div>
                <div>Strike</div>
                <div>Type</div>
                <div className="text-right">Mid</div>
                <div className="text-right">Bid</div>
                <div className="text-right">Ask</div>
                <div className="text-right">Volume</div>
                <div className="text-right">OI</div>
                <div className="text-right">Delta</div>
                <div className="text-right">Gamma</div>
                <div className="text-right">Theta</div>
              </div>

              {/* Table Rows */}
              <div className="grid grid-cols-11 gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] cursor-pointer border-b border-[#333]">
                <div className="text-[#ccc]">12/20</div>
                <div className="text-white">5750</div>
                <div className="text-[#16A34A]">CALL</div>
                <div className="text-right text-white">42.50</div>
                <div className="text-right text-[#ccc]">42.30</div>
                <div className="text-right text-[#ccc]">42.70</div>
                <div className="text-right text-[#ccc]">1,234</div>
                <div className="text-right text-[#ccc]">8,567</div>
                <div className="text-right text-[#ccc]">0.52</div>
                <div className="text-right text-[#ccc]">0.003</div>
                <div className="text-right text-[#ccc]">-0.18</div>
              </div>

              <div className="grid grid-cols-11 gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] cursor-pointer border-b border-[#333]">
                <div className="text-[#ccc]">12/20</div>
                <div className="text-white">5775</div>
                <div className="text-[#16A34A]">CALL</div>
                <div className="text-right text-white">28.90</div>
                <div className="text-right text-[#ccc]">28.70</div>
                <div className="text-right text-[#ccc]">29.10</div>
                <div className="text-right text-[#ccc]">2,456</div>
                <div className="text-right text-[#ccc]">12,345</div>
                <div className="text-right text-[#ccc]">0.48</div>
                <div className="text-right text-[#ccc]">0.004</div>
                <div className="text-right text-[#ccc]">-0.21</div>
              </div>

              <div className="grid grid-cols-11 gap-2 px-3 py-2.5 bg-[#E2B714]/10 border-l-2 border-[#E2B714] cursor-pointer border-b border-[#333]">
                <div className="text-[#ccc]">12/20</div>
                <div className="text-white">5800</div>
                <div className="text-[#16A34A]">CALL</div>
                <div className="text-right text-white">18.25</div>
                <div className="text-right text-[#ccc]">18.10</div>
                <div className="text-right text-[#ccc]">18.40</div>
                <div className="text-right text-[#ccc]">5,678</div>
                <div className="text-right text-[#ccc]">23,456</div>
                <div className="text-right text-[#ccc]">0.50</div>
                <div className="text-right text-[#ccc]">0.005</div>
                <div className="text-right text-[#ccc]">-0.25</div>
              </div>

              <div className="grid grid-cols-11 gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] cursor-pointer border-b border-[#333]">
                <div className="text-[#ccc]">12/20</div>
                <div className="text-white">5825</div>
                <div className="text-[#16A34A]">CALL</div>
                <div className="text-right text-white">10.75</div>
                <div className="text-right text-[#ccc]">10.60</div>
                <div className="text-right text-[#ccc]">10.90</div>
                <div className="text-right text-[#ccc]">3,234</div>
                <div className="text-right text-[#ccc]">15,678</div>
                <div className="text-right text-[#ccc]">0.42</div>
                <div className="text-right text-[#ccc]">0.003</div>
                <div className="text-right text-[#ccc]">-0.19</div>
              </div>

              <div className="grid grid-cols-11 gap-2 px-3 py-2.5 hover:bg-[#1a1a1a] cursor-pointer">
                <div className="text-[#ccc]">12/20</div>
                <div className="text-white">5850</div>
                <div className="text-[#16A34A]">CALL</div>
                <div className="text-right text-white">5.50</div>
                <div className="text-right text-[#ccc]">5.40</div>
                <div className="text-right text-[#ccc]">5.60</div>
                <div className="text-right text-[#ccc]">1,890</div>
                <div className="text-right text-[#ccc]">9,876</div>
                <div className="text-right text-[#ccc]">0.35</div>
                <div className="text-right text-[#ccc]">0.002</div>
                <div className="text-right text-[#ccc]">-0.15</div>
              </div>
            </div>

            {/* Note about no ticker selected state */}
            <div className="mt-6 p-4 border border-dashed border-[#444] rounded text-[#666] text-center italic">
              <div className="mb-2">Alternative state when NO ticker selected:</div>
              <div className="p-6 bg-[#1a1a1a] rounded">
                "Select a ticker from the watchlist to start"
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Alert Placeholder */}
        <div className="w-80 border-l-2 border-[#444] bg-[#1a1a1a] flex flex-col">
          {/* Panel Annotation */}
          <div className="bg-purple-500/10 border-b border-purple-500 px-3 py-1 text-purple-400 text-[10px]">
            WATCHING state → Placeholder (no HDPanelDiscordAlert yet)
          </div>

          <div className="p-4">
            {/* Header */}
            <h3 className="text-white mb-4 uppercase tracking-wide">Alerts & Actions</h3>

            {/* Explanation */}
            <div className="mb-6 p-3 bg-[#0f0f0f] border border-[#333] rounded text-[#888] text-xs leading-relaxed">
              When you load or enter a trade, its Discord alert draft will appear here for review and editing.
            </div>

            {/* Disabled Button */}
            <button className="w-full px-4 py-3 bg-[#333] text-[#666] rounded border border-[#444] cursor-not-allowed mb-6">
              Load an idea to create an alert draft
            </button>

            {/* Preview Placeholder */}
            <div className="border border-dashed border-[#444] rounded p-4">
              <div className="text-[#666] text-xs mb-3 uppercase">Alert Preview (Inactive)</div>
              <div className="space-y-2">
                <div className="h-3 bg-[#333] rounded w-3/4"></div>
                <div className="h-3 bg-[#333] rounded w-full"></div>
                <div className="h-3 bg-[#333] rounded w-5/6"></div>
                <div className="mt-4 h-16 bg-[#333] rounded"></div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-8 bg-[#333] rounded"></div>
                  <div className="h-8 bg-[#333] rounded"></div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded text-blue-400/60 text-[10px]">
              💡 Select a contract to load a trade idea and compose your first alert
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="border-t-2 border-[#444] bg-black/40 px-6 py-2 flex items-center justify-between text-[10px] text-[#666]">
        <div>
          State: <span className="text-[#E2B714]">WATCHING</span> | activeTicker: <span className="text-white">SPX</span> | currentTrade: <span className="text-[#666]">null</span> | showAlert: <span className="text-[#666]">false</span>
        </div>
        <div>
          Frame: Desktop.LiveCockpit.Watching @ 1440px
        </div>
      </div>
    </div>
  );
}
