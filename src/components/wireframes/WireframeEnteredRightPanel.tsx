export function WireframeEnteredRightPanel() {
  return (
    <div className="w-full min-h-screen bg-[#0f0f0f] p-8 font-mono text-xs">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Frame Header */}
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl mb-2">Desktop.LiveCockpit.Entered.ActionsAndComposer</h1>
          <p className="text-[#888]">Right Panel - ENTERED Trade State Workflows</p>
        </div>

        {/* STATE 1: QUICK ACTIONS (steady state, showAlert = false) */}
        <div className="border-2 border-[#E2B714] rounded-lg overflow-hidden">
          <div className="bg-[#E2B714]/10 px-4 py-2 border-b border-[#E2B714]">
            <h2 className="text-[#E2B714] uppercase tracking-wide">State 1: Quick Actions (Steady State)</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = false, tradeState = ENTERED</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-80 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4">
                <h3 className="text-white mb-4 uppercase tracking-wide">Trade Actions</h3>

                {/* Quick Actions */}
                <div className="space-y-3">
                  {/* Position Management Group */}
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

                  {/* Position Adjustment */}
                  <div>
                    <div className="text-[#888] text-[10px] mb-2 uppercase tracking-wide">Position Adjustment</div>
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

                {/* Info Box */}
                <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/30 rounded text-blue-400 text-[10px] leading-relaxed">
                  ⚠️ Clicking any action opens a draft alert. Nothing is sent automatically.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 2: TRIM COMPOSER */}
        <div className="border-2 border-purple-500 rounded-lg overflow-hidden">
          <div className="bg-purple-500/10 px-4 py-2 border-b border-purple-500">
            <h2 className="text-purple-400 uppercase tracking-wide">State 2: Trim Alert Composer</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = true, alertType = 'update'</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-96 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4 space-y-4">
                <h3 className="text-white uppercase tracking-wide">Alert Composer</h3>

                {/* Alert Preview */}
                <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                    <div className="text-[#E2B714] text-xs uppercase tracking-wide">📊 UPDATE</div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="text-white">
                      <strong>SPX $5800C Dec 20</strong> (Scalp)
                    </div>
                    <div className="text-[#ccc] space-y-1">
                      <div>Current: <span className="text-white">$19.75</span></div>
                      <div>P&L: <span className="text-[#16A34A]">+8.2%</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#333] text-[#888] italic">
                      [Comment will appear here]
                    </div>
                  </div>
                </div>

                {/* Included Fields */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Included Fields</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-2 mb-2">
                      <span className="text-[#888] text-xs w-20">Entry</span>
                      <input 
                        type="text" 
                        defaultValue="$18.25" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-xs"
                        disabled
                      />
                    </label>
                    
                    <label className="flex items-center gap-2 mb-2">
                      <span className="text-[#888] text-xs w-20">Current</span>
                      <input 
                        type="text" 
                        defaultValue="$19.75" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#E2B714] rounded text-white text-xs"
                      />
                    </label>
                    
                    <label className="flex items-center gap-2 mb-2">
                      <span className="text-[#888] text-xs w-20">Target</span>
                      <input 
                        type="text" 
                        defaultValue="$21.90" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-xs"
                        disabled
                      />
                    </label>
                    
                    <label className="flex items-center gap-2 mb-2">
                      <span className="text-[#888] text-xs w-20">Stop</span>
                      <input 
                        type="text" 
                        defaultValue="$16.40" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-xs"
                        disabled
                      />
                    </label>
                    
                    <label className="flex items-center gap-2 mb-2">
                      <span className="text-[#888] text-xs w-20">P&amp;L %</span>
                      <input 
                        type="text" 
                        defaultValue="+8.2" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#E2B714] rounded text-[#16A34A] text-xs"
                      />
                    </label>
                  </div>
                  <div className="text-[#666] text-[10px] mt-1 leading-relaxed">
                    💡 Toggle fields on/off. Edit values to override live data.
                  </div>
                </div>

                {/* Channels */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Discord Channels</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-1">
                    <label className="flex items-center gap-2 p-1.5 hover:bg-[#1a1a1a] rounded cursor-pointer">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-[#5865F2] text-xs">#options-signals</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 hover:bg-[#1a1a1a] rounded cursor-pointer">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs">#scalps</span>
                    </label>
                  </div>
                </div>

                {/* Challenges */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Challenges</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-1">
                    <label className="flex items-center gap-2 p-1.5 hover:bg-[#1a1a1a] rounded cursor-pointer">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <div className="flex-1 text-white text-xs">Week 1 Challenge</div>
                    </label>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Comment</div>
                  <textarea 
                    className="w-full h-20 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                    placeholder="Trim here to lock partial profit."
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                    Send Alert
                  </button>
                  <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 3A: UPDATE STOP LOSS - BREAKEVEN */}
        <div className="border-2 border-[#16A34A] rounded-lg overflow-hidden">
          <div className="bg-[#16A34A]/10 px-4 py-2 border-b border-[#16A34A]">
            <h2 className="text-[#16A34A] uppercase tracking-wide">State 3A: Update Stop Loss - Breakeven</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = true, alertType = 'update', mode = 'breakeven'</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-96 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4 space-y-4">
                <h3 className="text-white uppercase tracking-wide">Alert Composer</h3>

                {/* Alert Preview */}
                <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                    <div className="text-[#E2B714] text-xs uppercase tracking-wide">📊 UPDATE</div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="text-white">
                      <strong>SPX $5800C Dec 20</strong> (Scalp)
                    </div>
                    <div className="text-[#ccc] space-y-1">
                      <div>Stop: <span className="text-white">$18.25</span> <span className="text-[#888] text-[10px]">(Breakeven)</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#333] text-[#888] italic">
                      [Comment will appear here]
                    </div>
                  </div>
                </div>

                {/* New Stop Loss Controls */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">New Stop Loss</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-3">
                    {/* Mode Selector */}
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-[#16A34A]/20 border-2 border-[#16A34A] rounded text-[#16A34A] text-xs">
                        Breakeven
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Fixed Price
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Trailing
                      </button>
                    </div>

                    {/* Breakeven Info */}
                    <div className="p-2 bg-[#16A34A]/5 border border-[#16A34A]/30 rounded">
                      <div className="text-[#16A34A] text-[10px] leading-relaxed">
                        ℹ️ Stop loss will be moved to breakeven (entry price: $18.25)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Included Fields */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Included Fields</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs flex-shrink-0 w-12">Current</span>
                      <input 
                        type="text" 
                        value="$19.75" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-xs"
                        disabled
                      />
                    </label>

                    <label className="flex items-center gap-3 p-2 bg-[#16A34A]/5 hover:bg-[#16A34A]/10 rounded">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-white text-xs flex-shrink-0 w-12">Stop</span>
                      <input 
                        type="text" 
                        value="$18.25" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#16A34A] rounded text-white text-xs"
                      />
                      <span className="px-1.5 py-0.5 bg-[#16A34A]/20 text-[#16A34A] text-[9px] rounded">BE</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs flex-shrink-0 w-12">P&L %</span>
                      <input 
                        type="text" 
                        value="+8.2" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[#16A34A] text-xs"
                        disabled
                      />
                    </label>
                  </div>
                </div>

                {/* Channels */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Discord Channels</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-1">
                    <label className="flex items-center gap-2 p-1.5 hover:bg-[#1a1a1a] rounded cursor-pointer">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-[#5865F2] text-xs">#options-signals</span>
                    </label>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Comment</div>
                  <textarea 
                    className="w-full h-16 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                    defaultValue="Moving stop loss to breakeven."
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                    Send Alert
                  </button>
                  <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 3B: UPDATE STOP LOSS - FIXED PRICE */}
        <div className="border-2 border-[#16A34A] rounded-lg overflow-hidden">
          <div className="bg-[#16A34A]/10 px-4 py-2 border-b border-[#16A34A]">
            <h2 className="text-[#16A34A] uppercase tracking-wide">State 3B: Update Stop Loss - Fixed Price</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = true, alertType = 'update', mode = 'fixed'</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-96 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4 space-y-4">
                <h3 className="text-white uppercase tracking-wide">Alert Composer</h3>

                {/* Alert Preview */}
                <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                    <div className="text-[#E2B714] text-xs uppercase tracking-wide">📊 UPDATE</div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="text-white">
                      <strong>SPX $5800C Dec 20</strong> (Scalp)
                    </div>
                    <div className="text-[#ccc] space-y-1">
                      <div>Stop: <span className="text-white">$19.00</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#333] text-[#888] italic">
                      [Comment will appear here]
                    </div>
                  </div>
                </div>

                {/* New Stop Loss Controls */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">New Stop Loss</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-3">
                    {/* Mode Selector */}
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Breakeven
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#16A34A]/20 border-2 border-[#16A34A] rounded text-[#16A34A] text-xs">
                        Fixed Price
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Trailing
                      </button>
                    </div>

                    {/* Fixed Price Input */}
                    <div>
                      <div className="text-[#888] text-[10px] mb-1">Custom stop price</div>
                      <input 
                        type="text" 
                        value="19.00" 
                        className="w-full px-3 py-2 bg-[#1a1a1a] border-2 border-[#16A34A] rounded text-white text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Included Fields */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Included Fields</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-3 p-2 bg-[#16A34A]/5 hover:bg-[#16A34A]/10 rounded">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-white text-xs flex-shrink-0 w-12">Stop</span>
                      <input 
                        type="text" 
                        value="$19.00" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#16A34A] rounded text-white text-xs"
                      />
                      <span className="text-[#16A34A] text-[10px]">custom</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs flex-shrink-0 w-12">P&L %</span>
                      <input 
                        type="text" 
                        value="+8.2" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[#16A34A] text-xs"
                        disabled
                      />
                    </label>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Comment</div>
                  <textarea 
                    className="w-full h-16 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                    defaultValue="Adjusting stop loss to $19.00."
                  />
                </div>

                {/* Channels (collapsed for brevity) */}
                <div className="text-[#666] text-[10px]">
                  [Discord Channels & Challenges sections same as above...]
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                    Send Alert
                  </button>
                  <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 3C: UPDATE STOP LOSS - TRAILING STOP */}
        <div className="border-2 border-[#16A34A] rounded-lg overflow-hidden">
          <div className="bg-[#16A34A]/10 px-4 py-2 border-b border-[#16A34A]">
            <h2 className="text-[#16A34A] uppercase tracking-wide">State 3C: Update Stop Loss - Trailing Stop</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = true, alertType = 'update', mode = 'trailing'</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-96 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4 space-y-4">
                <h3 className="text-white uppercase tracking-wide">Alert Composer</h3>

                {/* Alert Preview */}
                <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                    <div className="text-[#E2B714] text-xs uppercase tracking-wide">📊 UPDATE</div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="text-white">
                      <strong>SPX $5800C Dec 20</strong> (Scalp)
                    </div>
                    <div className="text-[#ccc] space-y-1">
                      <div>Stop: <span className="text-white">Trailing Stop</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#333] text-[#888] italic">
                      [Comment will appear here]
                    </div>
                  </div>
                </div>

                {/* New Stop Loss Controls */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">New Stop Loss</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-3">
                    {/* Mode Selector */}
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Breakeven
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-xs hover:border-[#666]">
                        Fixed Price
                      </button>
                      <button className="flex-1 px-3 py-2 bg-[#16A34A]/20 border-2 border-[#16A34A] rounded text-[#16A34A] text-xs">
                        Trailing
                      </button>
                    </div>

                    {/* Trailing Info */}
                    <div className="p-2 bg-[#16A34A]/5 border border-[#16A34A]/30 rounded">
                      <div className="text-[#16A34A] text-[10px] leading-relaxed">
                        ℹ️ Stop loss will use a trailing stop strategy
                      </div>
                    </div>
                  </div>
                </div>

                {/* Included Fields */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Included Fields</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-3 p-2 bg-[#16A34A]/5 hover:bg-[#16A34A]/10 rounded">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-white text-xs flex-shrink-0 w-12">Stop</span>
                      <div className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#16A34A] rounded text-white text-[10px]">
                        Trailing Stop
                      </div>
                      <span className="px-1.5 py-0.5 bg-[#16A34A]/20 text-[#16A34A] text-[9px] rounded">TRAIL</span>
                    </label>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Comment</div>
                  <textarea 
                    className="w-full h-16 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                    defaultValue="Setting a trailing stop."
                  />
                </div>

                {/* Channels (collapsed) */}
                <div className="text-[#666] text-[10px]">
                  [Discord Channels & Challenges sections same as above...]
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                    Send Alert
                  </button>
                  <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 3D: UPDATE TARGET */}
        <div className="border-2 border-[#16A34A] rounded-lg overflow-hidden">
          <div className="bg-[#16A34A]/10 px-4 py-2 border-b border-[#16A34A]">
            <h2 className="text-[#16A34A] uppercase tracking-wide">State 3D: Update Target</h2>
            <p className="text-[#888] text-[10px] mt-1">showAlert = true, alertType = 'update', action = 'target'</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            <div className="w-96 bg-[#1a1a1a] border border-[#444] rounded-lg">
              <div className="p-4 space-y-4">
                <h3 className="text-white uppercase tracking-wide">Alert Composer</h3>

                {/* Alert Preview */}
                <div className="border border-[#E2B714] rounded-lg overflow-hidden bg-[#0f0f0f]">
                  <div className="px-3 py-2 bg-[#E2B714]/10 border-b border-[#E2B714]">
                    <div className="text-[#E2B714] text-xs uppercase tracking-wide">📊 UPDATE</div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="text-white">
                      <strong>SPX $5800C Dec 20</strong> (Scalp)
                    </div>
                    <div className="text-[#ccc] space-y-1">
                      <div>Target: <span className="text-[#16A34A]">$23.50</span></div>
                      <div className="text-[#888] text-[10px]">(Updated from $21.90)</div>
                    </div>
                    <div className="pt-2 border-t border-[#333] text-[#888] italic">
                      [Comment will appear here]
                    </div>
                  </div>
                </div>

                {/* New Target Controls */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">New Target</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-3">
                    {/* Current vs New */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[#888] text-[10px] mb-1">Current Target</div>
                        <div className="px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-sm">
                          $21.90
                        </div>
                      </div>
                      <div>
                        <div className="text-[#888] text-[10px] mb-1">New Target</div>
                        <input 
                          type="text" 
                          value="23.50" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border-2 border-[#16A34A] rounded text-white text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Quick Adjustments */}
                    <div>
                      <div className="text-[#888] text-[10px] mb-2">Quick Adjustments</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button className="px-2 py-1.5 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-[10px] hover:border-[#16A34A] hover:text-white">
                          +5%
                        </button>
                        <button className="px-2 py-1.5 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-[10px] hover:border-[#16A34A] hover:text-white">
                          +10%
                        </button>
                        <button className="px-2 py-1.5 bg-[#1a1a1a] border border-[#444] rounded text-[#888] text-[10px] hover:border-[#16A34A] hover:text-white">
                          +15%
                        </button>
                      </div>
                      <div className="text-[#666] text-[9px] mt-1">
                        Adjust target relative to current price ($19.75)
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2 bg-blue-500/5 border border-blue-500/30 rounded">
                      <div className="text-blue-400 text-[10px] leading-relaxed">
                        ℹ️ Moving target from $21.90 → $23.50 (+7.3% from current)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Included Fields */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Included Fields</div>
                  <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded space-y-2">
                    <label className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs flex-shrink-0 w-12">Current</span>
                      <input 
                        type="text" 
                        value="$19.75" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-white text-xs"
                        disabled
                      />
                    </label>

                    <label className="flex items-center gap-3 p-2 bg-[#16A34A]/5 hover:bg-[#16A34A]/10 rounded">
                      <input type="checkbox" checked readOnly className="w-3 h-3" />
                      <span className="text-white text-xs flex-shrink-0 w-12">Target</span>
                      <input 
                        type="text" 
                        value="$23.50" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#16A34A] rounded text-[#16A34A] text-xs"
                      />
                      <span className="px-1.5 py-0.5 bg-[#16A34A]/20 text-[#16A34A] text-[9px] rounded">NEW</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded">
                      <input type="checkbox" className="w-3 h-3" />
                      <span className="text-[#888] text-xs flex-shrink-0 w-12">P&L %</span>
                      <input 
                        type="text" 
                        value="+8.2" 
                        className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[#16A34A] text-xs"
                        disabled
                      />
                    </label>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <div className="text-[#888] text-xs mb-2 uppercase tracking-wide">Comment</div>
                  <textarea 
                    className="w-full h-16 px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded text-[#ccc] text-xs resize-none"
                    defaultValue="Raising target to $23.50 based on momentum."
                  />
                </div>

                {/* Channels (collapsed) */}
                <div className="text-[#666] text-[10px]">
                  [Discord Channels & Challenges sections same as above...]
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full px-4 py-3 bg-[#E2B714] text-black rounded hover:bg-[#E2B714]/90 transition-colors">
                    Send Alert
                  </button>
                  <button className="w-full px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors border border-[#444]">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATE 4: TOAST NOTIFICATION */}
        <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
          <div className="bg-blue-500/10 px-4 py-2 border-b border-blue-500">
            <h2 className="text-blue-400 uppercase tracking-wide">State 4: Toast After Send</h2>
            <p className="text-[#888] text-[10px] mt-1">Alert sent successfully - composer closes, toast appears</p>
          </div>
          
          <div className="bg-[#1a1a1a] p-6">
            {/* Screen Context */}
            <div className="w-full h-64 bg-[#0f0f0f] border border-[#444] rounded-lg relative">
              <div className="absolute inset-0 flex items-center justify-center text-[#666]">
                [Full Desktop.LiveCockpit view - Back to Quick Actions]
              </div>

              {/* Toast in bottom-right */}
              <div className="absolute bottom-4 right-4 w-80 bg-[#1a1a1a] border-2 border-[#16A34A] rounded-lg shadow-2xl overflow-hidden animate-in">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#16A34A]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#16A34A]">✓</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm mb-1">Alert sent</div>
                      <div className="text-[#888] text-xs leading-relaxed">
                        UPDATE alert sent to <span className="text-[#5865F2]">#options-signals</span>
                      </div>
                    </div>
                    <button className="text-[#666] hover:text-white text-xs">×</button>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="h-1 bg-[#0f0f0f]">
                  <div className="h-full bg-[#16A34A] w-3/4 transition-all duration-3000"></div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/30 rounded text-blue-400 text-xs leading-relaxed">
              ✓ After Send: showAlert = false, right panel returns to Quick Actions, toast confirms delivery
            </div>
          </div>
        </div>

        {/* IMPLEMENTATION NOTES */}
        <div className="border-2 border-[#888] rounded-lg overflow-hidden">
          <div className="bg-[#888]/10 px-4 py-2 border-b border-[#888]">
            <h2 className="text-[#888] uppercase tracking-wide">Implementation Notes</h2>
          </div>
          
          <div className="bg-[#1a1a1a] p-6 space-y-3 text-xs text-[#ccc] leading-relaxed">
            <div>
              <strong className="text-white">Quick Actions Mapping:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                <li><strong className="text-white">Trim</strong> → alertType='update', default fields: Current + P&L</li>
                <li><strong className="text-white">Update Stop Loss</strong> → alertType='update', default fields: Stop (with mode selector)</li>
                <li><strong className="text-white">Update</strong> → alertType='update', default fields: Current only</li>
                <li><strong className="text-white">Add to Position</strong> → alertType='add', default fields: Current + P&L</li>
                <li><strong className="text-white">Full Exit</strong> → alertType='exit', default fields: Current + P&L</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">Field Override Behavior:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                <li>Checked fields appear in alert message</li>
                <li>Unchecked fields are hidden from message</li>
                <li>Admin can edit any field value before sending (overrides live data)</li>
                <li>"live" indicator shows when using real-time data</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">Trail Stop Calculation:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                <li><strong>Points mode:</strong> Stop = Reference Price - Distance</li>
                <li><strong>% mode:</strong> Stop = Reference Price × (1 - Distance%)</li>
                <li><strong>Trail from Current:</strong> Reference = currentPrice (dynamic)</li>
                <li><strong>Trail from Entry:</strong> Reference = entryPrice (static)</li>
                <li>Show calculated effective stop in real-time preview</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">Toast Behavior:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                <li>Appears bottom-right after successful send</li>
                <li>Shows alert type and channel(s) sent to</li>
                <li>Auto-dismiss after 4-5 seconds with progress bar</li>
                <li>Applies to all alert types (Load, Enter, Update, Add, Exit)</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">Component Mapping:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                <li>Quick Actions → new component or state in HDPanelDiscordAlert</li>
                <li>Composer → existing HDPanelDiscordAlert with new "Included Fields" section</li>
                <li>Trail Stop controls → new sub-component in composer</li>
                <li>Toast → new HDToast component (bottom-right positioned)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
