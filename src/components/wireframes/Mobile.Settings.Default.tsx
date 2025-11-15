import { Settings, Mic, Save, ChevronRight } from 'lucide-react';

export function MobileSettingsDefault() {
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
            Data as of <span className="text-[var(--text-high)]">14:42:18</span>
          </span>
        </div>
      </div>

      {/* PAGE TITLE */}
      <div className="p-4 border-b border-[var(--border-hairline)] flex-shrink-0">
        <h1 className="text-[var(--text-high)] text-lg font-medium">Settings</h1>
        <p className="text-[var(--text-muted)] text-xs mt-1">Configure your admin preferences</p>
      </div>

      {/* SETTINGS CONTENT */}
      <div className="flex-1 overflow-y-auto pb-16">
        
        {/* Discord Integration */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Discord Integration
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Default Webhook URL
              </label>
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                defaultValue="https://discord.com/api/webhooks/1234567890/abc"
                className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Default Channels
              </label>
              <div className="space-y-2">
                {[
                  { name: 'options-signals', checked: true },
                  { name: 'spx-room', checked: false },
                  { name: 'scalp-alerts', checked: true },
                ].map((channel) => (
                  <label key={channel.name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={channel.checked}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-[var(--text-high)]">#{channel.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm text-[var(--text-high)] mb-0.5">
                  Require channel selection
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Always pick at least one channel
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* TP & SL Defaults */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            TP & SL Defaults
          </h2>
          
          <div className="space-y-4">
            {/* TP Strategy */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Take Profit Strategy
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 bg-[var(--surface-1)] rounded-lg cursor-pointer">
                  <input type="radio" name="tp-strategy" defaultChecked className="w-4 h-4" />
                  <span className="text-sm text-[var(--text-high)]">% Move</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-[var(--surface-1)] rounded-lg cursor-pointer">
                  <input type="radio" name="tp-strategy" className="w-4 h-4" />
                  <span className="text-sm text-[var(--text-high)]">ATR-based</span>
                </label>
              </div>
            </div>

            {/* TP Value */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Default TP1 %
              </label>
              <div className="relative">
                <input
                  type="number"
                  defaultValue="37.8"
                  step="0.1"
                  className="w-full px-3 py-2 pr-8 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
              </div>
            </div>

            {/* SL Strategy */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Stop Loss Strategy
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 bg-[var(--surface-1)] rounded-lg cursor-pointer">
                  <input type="radio" name="sl-strategy" defaultChecked className="w-4 h-4" />
                  <span className="text-sm text-[var(--text-high)]">% Move</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-[var(--surface-1)] rounded-lg cursor-pointer">
                  <input type="radio" name="sl-strategy" className="w-4 h-4" />
                  <span className="text-sm text-[var(--text-high)]">ATR-based</span>
                </label>
              </div>
            </div>

            {/* SL Value */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-2">
                Default Stop Loss %
              </label>
              <div className="relative">
                <input
                  type="number"
                  defaultValue="-20.4"
                  step="0.1"
                  className="w-full px-3 py-2 pr-8 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Challenges */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Challenges
          </h2>
          
          <button className="w-full flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            <div className="text-left">
              <div className="text-sm text-[var(--text-high)] mb-0.5">
                Manage Challenges
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                3 active challenges
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Voice Commands */}
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Voice Commands
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm text-[var(--text-high)] mb-0.5">
                  Enable Voice Commands
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Use voice to control actions
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
              </label>
            </div>

            <div className="p-3 bg-[var(--surface-1)] rounded-lg">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Example Commands
              </div>
              <div className="space-y-1 text-xs text-[var(--text-high)]">
                <div>• "Add TSLA to watchlist"</div>
                <div>• "Enter SPX 0DTE 5800 call"</div>
                <div>• "Update stop to breakeven"</div>
                <div>• "Trim 50 percent"</div>
                <div>• "Full exit"</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Type Rules */}
        <div className="p-4">
          <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Trade Type Rules
          </h2>
          
          <div className="p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Trade types (Scalp, Day, Swing, LEAP) are automatically derived from contract expiration. Admins don't choose these manually.
            </p>
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM ACTIONS */}
      <div className="border-t border-[var(--border-hairline)] bg-[var(--surface-1)] p-4 space-y-2 flex-shrink-0">
        <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
        <button className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors">
          Reset to Defaults
        </button>
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
            <Settings className="w-4 h-4 text-[var(--brand-primary)]" />
          </div>
          <span className="text-[10px] text-[var(--brand-primary)]">Settings</span>
        </button>
      </nav>
    </div>
  );
}
