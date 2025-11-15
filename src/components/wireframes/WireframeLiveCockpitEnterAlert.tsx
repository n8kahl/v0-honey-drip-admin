export function WireframeLiveCockpitEnterAlert() {
  return (
    <div className="w-full h-screen bg-[#1a1a1a] flex flex-col overflow-hidden font-mono text-xs">
      {/* Frame Label */}
      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1.5 rounded text-[#888] border border-[#333] z-50">
        Frame: Desktop.LiveCockpit.EnterAlert
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
            <span className="text-[#888]">Data as of 10:32:15 ET</span>
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
            HDPanelWatchlist – Maps to {"<HDPanelWatchlist />"}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Loaded Trades Section */}
            <div className="border-b border-[#333]">
              <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] hover:bg-[#1a1a1a]">
                <span className="text-white uppercase tracking-wide">Loaded Trades (1)</span>
                <span className="text-[#888]">▼</span>
              </div>
              <div className="p-3">
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
                  <div className="text-white text-xs mb-1">Week 1 Challenge</div>
                  <div className="text-[#888] text-[10px]">Admin Specific</div>
                </div>
                <div className="px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded hover:bg-[#1a1a1a]">
                  <div className="text-white text-xs mb-1">December Sprint</div>
                  <div className="text-[#888] text-[10px]">HoneyDrip Wide</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL - HDPanelFocusedTrade (LOADED) */}
        <div className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-blue-500/10 border-b border-blue-500 px-3 py-1 text-blue-400 text-[10px]">
            HDPanelFocusedTrade (LOADED state) – Maps to {"<HDPanelFocusedTrade state='LOADED' />"}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {/* Loaded Trade Summary Card */}
            <div className="border-2 border-[#E2B714] bg-[#1a1a1a] rounded-lg p-6">
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
                <div className="text-blue-400 italic">To be set on entry</div>
              </div>

              {/* TP/SL Info */}
              <div className="p-4 bg-[#0f0f0f] border border-[#333] rounded">
                <div className="text-[#888] text-xs mb-2">TP / SL</div>
                <div className="text-[#ccc] text-xs">
                  Pending defaults (will be calculated on entry)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - HDPanelDiscordAlert (ENTER alert) */}
        <div className="w-96 border-l-2 border-[#444] bg-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Panel Annotation */}
          <div className="bg-purple-500/10 border-b border-purple-500 px-3 py-1 text-purple-400 text-[10px]">
            HDPanelDiscordAlert (alertType='enter', showAlert=true)
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Header */}
            <h3 className="text-white mb-4 uppercase tracking-wide">Alert Preview</h3>

            {/* Alert Preview Card */}
            <div className="border border-[#E2B714] rounded-lg overflow-hidden mb-4 bg-[#0f0f0f]">
              <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                <div className="text-[#E2B714] text-xs uppercase tracking-wide">🎯 ENTERED</div>
              </div>
              
              <div className="p-3 space-y-2">
                <div className="text-white text-sm">
                  <strong>SPX $5800C Dec 20</strong> (Scalp)
                </div>
                <div className="space-y-1 text-xs text-[#ccc]">
                  <div>Entry: <span className="text-white">$18.25</span></div>
                  <div>Target: <span className="text-[#16A34A]">$21.90</span></div>
                  <div>Stop: <span className="text-[#EF4444]">$16.40</span></div>
                </div>
                <div className="text-[#888] text-[10px] pt-2 border-t border-[#333]">
                  Data as of 10:32:15 ET
                </div>
              </div>
            </div>

            {/* Discord Channels */}
            <div className="mb-4">
              <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Discord Channels</div>
              <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                  <input type="checkbox" checked readOnly className="w-3 h-3" />
                  <span className="text-[#5865F2] text-xs">#options-signals</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                  <input type="checkbox" checked readOnly className="w-3 h-3" />
                  <span className="text-[#5865F2] text-xs">#scalps</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                  <input type="checkbox" readOnly className="w-3 h-3" />
                  <span className="text-[#888] text-xs">#general</span>
                </label>
              </div>
            </div>

            {/* Challenges */}
            <div className="mb-4">
              <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Challenges</div>
              <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                  <input type="checkbox" checked readOnly className="w-3 h-3" />
                  <div className="flex-1 flex items-center gap-2">
                    <div className="text-white text-xs">Week 1 Challenge</div>
                    <div className="text-[#888] text-[10px]">(Admin)</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded">
                  <input type="checkbox" readOnly className="w-3 h-3" />
                  <div className="flex-1 flex items-center gap-2">
                    <div className="text-[#888] text-xs">December Sprint</div>
                    <div className="px-1.5 py-0.5 bg-[#E2B714]/20 text-[#E2B714] text-[9px] rounded border border-[#E2B714]">HD</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Add Comment (Optional)</div>
              <textarea 
                className="w-full h-20 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                placeholder="Add context for your subscribers..."
              />
            </div>

            {/* Actions Footer */}
            <div className="space-y-2">
              <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                Send Alert
              </button>
              <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                Discard
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/30 rounded text-[#888] text-[10px] leading-relaxed">
              <strong className="text-blue-400">UX Flow:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Select channels & challenges</li>
                <li>Optionally add comment</li>
                <li>Click <strong className="text-white">Send Alert</strong></li>
                <li>Trade moves to ENTERED state</li>
                <li>Entry price, TP, SL calculated</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="border-t-2 border-[#444] bg-black/40 px-6 py-2 flex items-center justify-between text-[10px] text-[#666]">
        <div>
          State: <span className="text-blue-400">LOADED → ENTERING</span> | alertType: <span className="text-white">enter</span> | showAlert: <span className="text-white">true</span>
        </div>
        <div>
          Frame: Desktop.LiveCockpit.EnterAlert @ 1440px
        </div>
      </div>
    </div>
  );
}
