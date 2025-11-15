import { Settings, Mic, ChevronDown, Share2, X } from 'lucide-react';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';
import exampleScreenshot from '../../assets/afca8c0935f1f42b558e4c773db458cfeade0d1a.png';
import percentageGraphic from 'https://images.unsplash.com/photo-1642734985159-70a6ab9bb15f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzZCUyMHBlcmNlbnRhZ2UlMjBzeW1ib2wlMjBjb2luc3xlbnwxfHx8fDE3NjMwNzUwNDF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';

/**
 * DESKTOP.HISTORY.SHARE-TRADE
 * 
 * Shows the History screen with the Alert Composer open in "Share Single Trade" mode.
 * Perfect for sharing big wins (or losses) to Discord #gains channel.
 */

export function DesktopHistoryShareTrade() {
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
            <span className="ml-2 text-[var(--positive)]">● Live</span>
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
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Trade Management
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-[var(--brand-primary)] text-[var(--text-high)]">
            History
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Settings
          </button>
        </div>
      </div>

      {/* MAIN CONTENT WITH ALERT COMPOSER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: HISTORY TABLE (Dimmed) */}
        <div className="flex-1 p-6 opacity-30 pointer-events-none">
          <div className="mb-6">
            <h1 className="text-[var(--text-high)] text-2xl mb-1">Trade History</h1>
            <p className="text-[var(--text-muted)] text-sm">Review past trades, filter results, and share summaries to Discord</p>
          </div>

          {/* Filters */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4 mb-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
              <div className="flex-1 h-16 bg-[var(--surface-2)] rounded" />
            </div>
          </div>

          {/* Table with highlighted row */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <div className="space-y-2">
              {/* Highlighted row - the one being shared */}
              <div className="h-12 bg-[var(--brand-primary)]/20 border border-[var(--brand-primary)] rounded" />
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-12 bg-[var(--surface-2)] rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: ALERT COMPOSER - SHARE TRADE MODE */}
        <div className="w-[500px] bg-[var(--surface-1)] border-l border-[var(--border-hairline)] flex flex-col">
          
          {/* HEADER */}
          <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--text-high)] font-medium">Share Trade – Alert</h3>
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                SHARE
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
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded-lg">
                <div className="text-sm text-[var(--text-high)] space-y-2 leading-relaxed">
                  <div className="font-medium text-base">🏆 <strong>Trade Highlight</strong></div>
                  
                  <div className="pt-2">
                    <div className="font-medium mb-1">SPX 0DTE 5800C (Scalp)</div>
                  </div>

                  <div className="pt-2 space-y-1 text-xs">
                    <div>Entry: <span className="text-[var(--text-high)] font-medium">$1.00</span></div>
                    <div>Exit: <span className="text-[var(--text-high)] font-medium">$1.85</span></div>
                    <div>P&L: <span className="text-[var(--positive)] font-medium text-base">+85%</span></div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1 text-xs">
                    <div>Duration: <span className="text-[var(--text-high)]">17 minutes</span></div>
                    <div>Entry time: <span className="text-[var(--text-muted)]">Nov 13, 14:35 ET</span></div>
                    <div>Exit time: <span className="text-[var(--text-muted)]">Nov 13, 14:52 ET</span></div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] text-xs italic">
                    Gainssssss 💰 Quick scalp on the 0DTE – in and out clean!
                  </div>
                </div>
              </div>
            </div>

            {/* TRADE DETAILS (Read-only info) */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Trade Details
              </label>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Ticker</div>
                    <div className="text-[var(--text-high)] font-medium">SPX</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Type</div>
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                        Scalp
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Contract</div>
                    <div className="text-[var(--text-high)] font-medium">0DTE 5800C</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)] mb-1">Challenge</div>
                    <div className="text-[var(--text-high)] font-medium">Small Account</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SCREENSHOT OPTION (Future) */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Branded Screenshot
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-2 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">Include Honey Drip branded trade card</span>
                </label>

                {/* Screenshot Preview */}
                <div className="relative rounded-xl overflow-hidden">
                  {/* Honey Drip Yellow Background */}
                  <div className="relative aspect-[9/16] bg-[#E2B714] p-8 flex flex-col">
                    
                    {/* Logo & Title at Top */}
                    <div className="text-center mb-4">
                      <div className="text-black text-lg font-medium mb-1">
                        SPX $5800
                      </div>
                      <div className="text-black/70 text-sm">
                        13 Nov 25 (0DTE) Call 5800
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1 h-px bg-black/20"></div>
                      <div className="text-black/60 text-xs uppercase tracking-wider">Open P&L%</div>
                      <div className="flex-1 h-px bg-black/20"></div>
                    </div>

                    {/* CENTER: BIG HONEY DRIP LOGO */}
                    <div className="flex-1 flex flex-col items-center justify-center mb-6">
                      {/* HUGE Logo - Much Bigger! */}
                      <div className="mb-8">
                        <img src={honeyDripLogo || "/placeholder.svg"} alt="Honey Drip" className="w-48 h-48 rounded-3xl shadow-2xl" />
                      </div>
                      
                      {/* HUGE P&L */}
                      <div className="text-black text-8xl font-bold tracking-tight mb-6">
                        +85%
                      </div>
                      
                      {/* Floating emojis - BIGGER */}
                      <div className="relative flex items-center justify-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-black/10 backdrop-blur-sm border-2 border-black/20 flex items-center justify-center text-3xl animate-pulse">
                          💰
                        </div>
                        <div className="w-20 h-20 rounded-full bg-black/15 backdrop-blur-sm border-2 border-black/20 flex items-center justify-center text-4xl">
                          🚀
                        </div>
                        <div className="w-16 h-16 rounded-full bg-black/10 backdrop-blur-sm border-2 border-black/20 flex items-center justify-center text-3xl animate-pulse">
                          💸
                        </div>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-auto space-y-2">
                      <div className="text-black/70 text-xs">
                        Admin: HoneyDripTrader
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-black/70 text-xs">
                          Shared: 11/13/2025 14:52
                        </div>
                        <div className="text-black text-xs font-medium">
                          honeydripnetwork.com
                        </div>
                      </div>
                    </div>

                    {/* Honey Drip watermark */}
                    <div className="absolute top-4 right-4 text-black/40 text-xs font-medium uppercase tracking-wider">
                      Honey Drip
                    </div>
                  </div>

                  {/* Export Button Overlay */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <button className="px-4 py-2 bg-black/95 hover:bg-black text-[#E2B714] text-xs font-medium rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-105">
                      <Share2 className="w-4 h-4" />
                      Export Image
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  💡 Click "Export Image" to download the screenshot. Perfect for sharing to Discord, Twitter, or texting to friends!
                </p>
              </div>
            </div>

            {/* COMMENT */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Comment (Optional)
              </label>
              <textarea
                defaultValue="Gainssssss 💰 Quick scalp on the 0DTE – in and out clean!"
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                rows={3}
                placeholder="Add some hype text..."
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                💡 Pro tip: Use emojis like 🚀 💰 🔥 ⚡ for maximum engagement
              </p>
            </div>

            {/* CHANNELS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Discord Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-high)]">#gains</span>
                    <span className="text-[10px] text-[var(--brand-primary)]">Recommended</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#options-signals</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#spx-highlights</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-[var(--text-high)]">#small-account-challenge</span>
                </label>
              </div>
            </div>

            {/* INFO NOTE */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                💡 <strong>Share to #gains:</strong> Perfect for showcasing big winners (or lessons from losses). Edit the comment to add personality before sending!
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-[var(--border-hairline)] flex items-center gap-3 flex-shrink-0">
            <button className="flex-1 py-3 px-4 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-lg transition-colors">
              Discard
            </button>
            <button className="flex-1 py-3 px-4 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors">
              Send Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
