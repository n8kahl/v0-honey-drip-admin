import { Settings, Mic, Save, X } from 'lucide-react';

export function DesktopSettingsDefault() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      {/* HEADER */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-[var(--bg-base)] font-bold text-sm">HD</span>
          </div>
          <span className="text-[var(--text-high)] font-medium">Honey Drip Admin</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
            <span className="text-[var(--positive)] text-xs font-medium uppercase tracking-wide">
              ● Market Open
            </span>
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            Data as of <span className="text-[var(--text-high)]">14:42:18 ET</span>
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
      <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] px-6">
        <div className="flex gap-1">
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            Trade Management
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-high)]">
            History
          </button>
          <button className="px-4 py-3 text-sm border-b-2 border-[var(--brand-primary)] text-[var(--text-high)]">
            Settings
          </button>
        </div>
      </div>

      {/* SETTINGS CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <div>
            <h2 className="text-[var(--text-high)] text-2xl mb-1">Admin Settings</h2>
            <p className="text-[var(--text-muted)] text-sm">Configure global defaults and preferences</p>
          </div>

          {/* A) Discord & Webhooks */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <h3 className="text-[var(--text-high)] text-lg mb-4">Discord Integration</h3>
            
            <div className="space-y-4">
              {/* Default Webhook URL */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Default Discord Webhook URL
                </label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/..."
                  defaultValue="https://discord.com/api/webhooks/1234567890/abcdefghijk"
                  className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                />
              </div>

              {/* Default Alert Channels */}
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Default Alert Channels
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'ch1', name: 'options-signals', checked: true },
                    { id: 'ch2', name: 'spx-room', checked: false },
                    { id: 'ch3', name: 'scalp-alerts', checked: true },
                    { id: 'ch4', name: 'all-trades', checked: false },
                  ].map((channel) => (
                    <label key={channel.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        defaultChecked={channel.checked}
                        className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)]"
                      />
                      <span className="text-sm text-[var(--text-high)] group-hover:text-[var(--brand-primary)] transition-colors">
                        #{channel.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Require Channel Toggle */}
              <div className="flex items-center justify-between p-4 bg-[var(--surface-2)] rounded-lg">
                <div>
                  <div className="text-sm text-[var(--text-high)] mb-1">
                    Require at least one channel for every alert
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Prevents sending alerts without selecting a Discord channel
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-[var(--surface-1)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* B) TP & SL Defaults */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <h3 className="text-[var(--text-high)] text-lg mb-4">Take Profit & Stop Loss Defaults</h3>
            
            <div className="space-y-6">
              {/* TP Defaults */}
              <div>
                <h4 className="text-sm text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  TP Defaults
                </h4>
                
                {/* Strategy Selection */}
                <div className="flex gap-2 mb-4">
                  <button className="px-4 py-2 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] text-[var(--brand-primary)] text-sm">
                    % Move
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm">
                    ATR-based
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm">
                    ATR + MTF Structure
                  </button>
                </div>

                {/* Field for % Move */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-2">
                      Default TP1 %
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        defaultValue="37.8"
                        step="0.1"
                        className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-2">
                      Default TP2 % (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        defaultValue="60.0"
                        step="0.1"
                        className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SL Defaults */}
              <div>
                <h4 className="text-sm text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  SL Defaults
                </h4>
                
                {/* Strategy Selection */}
                <div className="flex gap-2 mb-4">
                  <button className="px-4 py-2 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] text-[var(--brand-primary)] text-sm">
                    % Move
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm">
                    ATR-based
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm">
                    ATR + Structure
                  </button>
                </div>

                {/* Field for % Move */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-2">
                      Default Stop Loss %
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        defaultValue="-20.4"
                        step="0.1"
                        className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* C) Trade Type Rules */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <h3 className="text-[var(--text-high)] text-lg mb-4">Trade Type Rules</h3>
            
            <div className="p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3">
                Trade type badges (<span className="text-[var(--brand-primary)]">Scalp</span>, <span className="text-[var(--brand-primary)]">Day</span>, <span className="text-[var(--brand-primary)]">Swing</span>, <span className="text-[var(--brand-primary)]">LEAP</span>) are automatically derived from the contract expiration relative to the current date.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Admins don't choose these manually. The system infers the trade type based on days to expiration (0DTE = Scalp, 1-3DTE = Day, 4-30DTE = Swing, 30+DTE = LEAP).
              </p>
            </div>
          </div>

          {/* D) Voice Commands */}
          <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
            <h3 className="text-[var(--text-high)] text-lg mb-4">Voice Commands</h3>
            
            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-[var(--surface-2)] rounded-lg">
                <div>
                  <div className="text-sm text-[var(--text-high)] mb-1">
                    Enable Voice Commands
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Use voice to control trade actions and navigate the app
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-[var(--surface-1)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                </label>
              </div>

              {/* Example Commands */}
              <div className="p-4 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Example Commands
                </div>
                <div className="space-y-1 text-sm text-[var(--text-high)]">
                  <div>• "Add TSLA to watchlist"</div>
                  <div>• "Enter SPX 0DTE 5800 call"</div>
                  <div>• "Update stop to breakeven"</div>
                  <div>• "Trim 50 percent"</div>
                  <div>• "Full exit"</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pb-8">
            <button className="px-6 py-2.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </button>
            <button className="px-6 py-2.5 rounded-lg bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
