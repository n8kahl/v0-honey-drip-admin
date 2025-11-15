import { Settings, Mic, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';

export function DesktopChallengesDefault() {
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
            Data as of <span className="text-[var(--text-high)]">14:45:32 ET</span>
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
            Challenges
          </button>
        </div>
      </div>

      {/* THREE COLUMN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN - Challenge List */}
        <div className="w-80 bg-[var(--surface-1)] border-r border-[var(--border-hairline)] flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Challenges (3)
              </h3>
              <button className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] text-xs flex items-center gap-1.5 transition-colors">
                <Plus className="w-3 h-3" />
                New Challenge
              </button>
            </div>
          </div>

          {/* Challenge List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            
            {/* Selected Challenge */}
            <div className="relative pl-2">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--brand-primary)]" />
              <div className="bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-lg p-3 cursor-pointer">
                <div className="mb-2">
                  <div className="text-[var(--text-high)] font-medium text-sm mb-1">
                    Small Account Challenge
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Honey Drip Wide
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">3 active trades</span>
                  <span className="text-[var(--positive)] font-medium">+24.8%</span>
                </div>
              </div>
            </div>

            {/* Other Challenges */}
            <div className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-transparent hover:border-[var(--border-hairline)] rounded-lg p-3 cursor-pointer transition-colors">
              <div className="mb-2">
                <div className="text-[var(--text-high)] font-medium text-sm mb-1">
                  November Scalps
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--surface-1)] text-[var(--text-muted)]">
                    Admin Specific
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">8 active trades</span>
                <span className="text-[var(--positive)] font-medium">+18.2%</span>
              </div>
            </div>

            <div className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-transparent hover:border-[var(--border-hairline)] rounded-lg p-3 cursor-pointer transition-colors">
              <div className="mb-2">
                <div className="text-[var(--text-high)] font-medium text-sm mb-1">
                  SPX Master Class
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                    Honey Drip Wide
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">5 active trades</span>
                <span className="text-[var(--negative)] font-medium">-3.4%</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN - Challenge Details */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-[var(--text-high)] text-2xl mb-1">Small Account Challenge</h2>
              <p className="text-[var(--text-muted)] text-sm">Manage challenge details and associated trades</p>
            </div>

            {/* Challenge Info */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6 mb-6">
              <div className="space-y-4">
                
                {/* Name */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Challenge Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Small Account Challenge"
                    disabled
                    className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] disabled:opacity-60"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Description
                  </label>
                  <textarea
                    defaultValue="Growing a small account with disciplined risk management. Focus on high-probability setups with defined risk/reward."
                    disabled
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)] resize-none disabled:opacity-60"
                  />
                </div>

                {/* Scope */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Scope
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="admin"
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[var(--text-high)]">Admin Specific</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="hd"
                        defaultChecked
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[var(--text-high)]">Honey Drip Wide</span>
                    </label>
                  </div>
                </div>

                {/* Default Channels */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Default Discord Channels
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'ch1', name: 'small-account-challenge', checked: true },
                      { id: 'ch2', name: 'all-trades', checked: false },
                      { id: 'ch3', name: 'scalp-alerts', checked: false },
                    ].map((channel) => (
                      <label key={channel.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          defaultChecked={channel.checked}
                          disabled
                          className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] disabled:opacity-60"
                        />
                        <span className="text-sm text-[var(--text-high)]">
                          #{channel.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Trades */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6 mb-6">
              <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wide mb-4">
                Active Trades in This Challenge (3)
              </h3>
              
              <div className="space-y-2">
                {[
                  { ticker: 'SPX', contract: '0DTE 5800C', type: 'Scalp', pl: 21.3, positive: true },
                  { ticker: 'TSLA', contract: '1DTE 245P', type: 'Day', pl: 14.8, positive: true },
                  { ticker: 'AAPL', contract: '0DTE 190C', type: 'Scalp', pl: 8.2, positive: true },
                ].map((trade, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] hover:border-[var(--brand-primary)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
                          <span className="text-sm text-[var(--text-muted)]">{trade.contract}</span>
                        </div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                          {trade.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[var(--positive)]" />
                      <span className="font-medium text-[var(--positive)]">
                        +{trade.pl.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Exited */}
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
              <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wide mb-4">
                Recently Exited Trades (2)
              </h3>
              
              <div className="space-y-2">
                {[
                  { ticker: 'SPY', contract: '2DTE 455C', type: 'Day', pl: 32.5, exitTime: 'Nov 12, 15:30', positive: true },
                  { ticker: 'QQQ', contract: '1DTE 400P', type: 'Day', pl: -8.2, exitTime: 'Nov 11, 14:20', positive: false },
                ].map((trade, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
                          <span className="text-sm text-[var(--text-muted)]">{trade.contract}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                            {trade.type}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">Exited {trade.exitTime}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`font-medium ${trade.positive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                      {trade.positive ? '+' : ''}{trade.pl.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Challenge Actions */}
        <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-hairline)] p-4">
          <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
            Challenge Actions
          </h3>

          <div className="space-y-4">
            
            {/* Edit/Delete Buttons */}
            <div className="space-y-2">
              <button className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-high)] transition-colors flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Challenge
              </button>
              <button className="w-full px-4 py-2.5 rounded-lg bg-[var(--negative)]/10 hover:bg-[var(--negative)]/20 border border-[var(--negative)] text-[var(--negative)] transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Challenge
              </button>
            </div>

            {/* Trade Linking */}
            <div className="pt-4 border-t border-[var(--border-hairline)]">
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Assign Trades to This Challenge
              </label>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[
                  { ticker: 'SPX', contract: '0DTE 5800C', assigned: true },
                  { ticker: 'TSLA', contract: '1DTE 245P', assigned: true },
                  { ticker: 'AAPL', contract: '0DTE 190C', assigned: true },
                  { ticker: 'NVDA', contract: '2DTE 485C', assigned: false },
                  { ticker: 'QQQ', contract: '1DTE 400C', assigned: false },
                ].map((trade, i) => (
                  <label key={i} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      defaultChecked={trade.assigned}
                      className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)]"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-[var(--text-high)]">{trade.ticker}</div>
                      <div className="text-xs text-[var(--text-muted)]">{trade.contract}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Info Note */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <p className="text-[10px] text-blue-400 leading-relaxed">
                💡 Trades in this challenge will default to this challenge's channels when drafting alerts, but admins can still override channels per alert.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
