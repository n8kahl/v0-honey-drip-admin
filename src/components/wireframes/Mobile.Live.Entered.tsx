import { useState } from 'react';
import { Settings, Mic, ChevronUp, X, TrendingUp } from 'lucide-react';

export function MobileLiveEntered() {
  const [nowPlayingExpanded, setNowPlayingExpanded] = useState(true);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionType, setActionType] = useState<'trim' | 'update-sl' | 'update' | 'add' | 'exit'>('trim');

  const openActionSheet = (action: typeof actionType) => {
    setActionType(action);
    setShowActionSheet(true);
  };

  return (
    <div className="w-[390px] h-[844px] bg-[var(--bg-base)] flex flex-col mx-auto border-x border-[var(--border-hairline)] relative">
      
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
            Data as of <span className="text-[var(--text-high)]">14:42:33</span>
          </span>
        </div>
      </div>

      {/* MAIN CONTENT - Minimal */}
      <div className="flex-1 overflow-y-auto pb-96">
        <div className="p-4">
          <div className="p-3 bg-[var(--positive)]/5 border border-[var(--positive)]/30 rounded-lg">
            <p className="text-[var(--positive)] text-xs leading-relaxed">
              ✅ Trade is <strong>ACTIVE</strong>. Use the panel below to manage your position.
            </p>
          </div>
        </div>
      </div>

      {/* NOW-PLAYING PANEL - COLLAPSED */}
      {!nowPlayingExpanded && (
        <button
          onClick={() => setNowPlayingExpanded(true)}
          className="absolute bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--positive)] p-4 flex items-center justify-between"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[var(--text-high)] text-sm font-medium">
                SPX 0DTE 5800C
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                Scalp
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-[var(--positive)]" />
              <span className="text-[var(--positive)] text-sm font-medium">+21.3%</span>
            </div>
          </div>
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      )}

      {/* NOW-PLAYING PANEL - EXPANDED (ENTERED) */}
      {nowPlayingExpanded && (
        <div className="absolute bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t-2 border-[var(--positive)] max-h-[75vh] flex flex-col">
          {/* Drag Handle */}
          <div className="flex items-center justify-center py-2 cursor-pointer" onClick={() => setNowPlayingExpanded(false)}>
            <div className="w-10 h-1 rounded-full bg-[var(--border-hairline)]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Header with P&L */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[var(--text-high)] text-lg font-medium mb-1">SPX 0DTE 5800C</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                      Scalp
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                      ✓ Entered
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-medium text-[var(--positive)] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +21.3%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">+$4.80</div>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Entry</div>
                <div className="text-[var(--text-high)] font-medium">$22.50</div>
              </div>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Current</div>
                <div className="text-[var(--text-high)] font-medium">$27.30</div>
              </div>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Target</div>
                <div className="text-[var(--positive)] font-medium">$31.00</div>
                <div className="text-[9px] text-[var(--text-muted)]">+37.8%</div>
              </div>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Stop</div>
                <div className="text-[var(--negative)] font-medium">$17.90</div>
                <div className="text-[9px] text-[var(--text-muted)]">-20.4%</div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Position Management
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openActionSheet('trim')}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">📊</div>
                  <div className="text-xs text-[var(--text-high)]">Trim</div>
                </button>
                
                <button
                  onClick={() => openActionSheet('update-sl')}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">🛡️</div>
                  <div className="text-xs text-[var(--text-high)]">Update SL</div>
                </button>

                <button
                  onClick={() => openActionSheet('update')}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">📝</div>
                  <div className="text-xs text-[var(--text-high)]">Update</div>
                </button>

                <button
                  onClick={() => openActionSheet('add')}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">➕</div>
                  <div className="text-xs text-[var(--text-high)]">Add Position</div>
                </button>
              </div>

              <button
                onClick={() => openActionSheet('exit')}
                className="w-full p-3 bg-[var(--negative)]/10 hover:bg-[var(--negative)]/20 border border-[var(--negative)] rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="text-lg">🏁</div>
                  <div className="text-sm text-[var(--negative)] font-medium">Full Exit</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION BOTTOM SHEET */}
      {showActionSheet && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end">
          <div className="w-full bg-[var(--surface-1)] rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
              <h3 className="text-[var(--text-high)] font-medium">
                {actionType === 'trim' && '📊 Trim – Alert Preview'}
                {actionType === 'update-sl' && '🛡️ Update Stop Loss – Alert'}
                {actionType === 'update' && '📝 Update – Alert Preview'}
                {actionType === 'add' && '➕ Add Position – Alert'}
                {actionType === 'exit' && '🏁 Full Exit – Alert Preview'}
              </h3>
              <button
                onClick={() => setShowActionSheet(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Alert Preview */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/50">
                <div className="text-sm text-[var(--text-high)] space-y-1">
                  <div className="font-medium">**SPX $5800C 0DTE** (Scalp)</div>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                    <div>Current: <span className="text-[var(--text-high)]">$27.30</span></div>
                    <div>P&L: <span className="text-[var(--positive)]">+21.3%</span></div>
                    {actionType === 'update-sl' && (
                      <div>New Stop: <span className="text-[var(--negative)]">Breakeven ($22.50)</span></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Update Stop Loss - Special Controls */}
              {actionType === 'update-sl' && (
                <div>
                  <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Stop Loss Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer">
                      <input type="radio" name="sl-type" defaultChecked className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-high)]">Breakeven</div>
                        <div className="text-xs text-[var(--text-muted)]">Move to entry price</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer">
                      <input type="radio" name="sl-type" className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-high)]">Fixed Price</div>
                        <div className="text-xs text-[var(--text-muted)]">Set specific price</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer">
                      <input type="radio" name="sl-type" className="w-4 h-4" />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-high)]">Trailing Stop</div>
                        <div className="text-xs text-[var(--text-muted)]">Follow price movement</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Included Fields */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Included Fields
                </label>
                <div className="space-y-2">
                  {[
                    { label: 'Current Price', value: '$27.30', checked: true },
                    { label: 'P&L %', value: '+21.3%', checked: true },
                    { label: 'Target', value: '$31.00', checked: false },
                    { label: 'Stop Loss', value: '$17.90', checked: actionType === 'update-sl' },
                  ].map((field) => (
                    <label key={field.label} className="flex items-center gap-3 p-2 bg-[var(--surface-2)] rounded">
                      <input
                        type="checkbox"
                        defaultChecked={field.checked}
                        className="w-4 h-4 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-[var(--text-high)]">{field.label}</div>
                        <div className="text-xs text-[var(--text-muted)]">{field.value}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Discord Channels
                </label>
                <div className="space-y-2">
                  {[
                    { name: 'options-signals', checked: true },
                    { name: 'spx-room', checked: true },
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

              {/* Comment */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  placeholder={
                    actionType === 'trim' ? 'Trimming 50% here...' :
                    actionType === 'update-sl' ? 'Moving stop to breakeven...' :
                    'Add a comment...'
                  }
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
              <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors">
                Send Alert
              </button>
              <button
                onClick={() => setShowActionSheet(false)}
                className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="h-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around flex-shrink-0">
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
          </div>
          <span className="text-[10px] text-[var(--brand-primary)]">Live</span>
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
            <Settings className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Settings</span>
        </button>
      </nav>
    </div>
  );
}
