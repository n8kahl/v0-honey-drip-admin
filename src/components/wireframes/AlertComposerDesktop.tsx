import { X, TrendingUp } from 'lucide-react';

/**
 * ALERT COMPOSER - Desktop Variant
 * 
 * Reference implementation of the Global Alert System spec
 * showing the UPDATE (Trim) alert type with all standard sections.
 * 
 * See: /docs/ALERT_SYSTEM_SPEC.md
 */

export function AlertComposerDesktop() {
  return (
    <div className="w-full max-w-6xl mx-auto p-8 bg-[var(--bg-base)]">
      <div className="grid grid-cols-3 gap-6">
        {/* LEFT: Simulated Trades List */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-[var(--text-high)] font-medium mb-4">Active Trades</h2>
          
          {/* Active Trade Card */}
          <div className="p-4 bg-[var(--surface-1)] border border-[var(--positive)]/30 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--text-high)] font-medium">SPX $5800C 0DTE</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                    Scalp
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                    ✓ Entered
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">Entry: $22.50 → Target: $31.00</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-medium text-[var(--positive)] flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +21.3%
                </div>
                <div className="text-xs text-[var(--text-muted)]">+$4.80</div>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
              <div>
                <span className="text-[var(--text-muted)]">Entry:</span>{' '}
                <span className="text-[var(--text-high)]">$22.50</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Current:</span>{' '}
                <span className="text-[var(--text-high)]">$27.30</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Target:</span>{' '}
                <span className="text-[var(--positive)]">$31.00</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Stop:</span>{' '}
                <span className="text-[var(--negative)]">$17.90</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Quick Actions:</span>
              <button className="px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--brand-primary)]/20 border border-[var(--brand-primary)] text-[var(--brand-primary)] text-xs rounded transition-colors">
                📊 Trim (Active →)
              </button>
              <button className="px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs rounded transition-colors">
                🛡️ Update SL
              </button>
              <button className="px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs rounded transition-colors">
                📝 Update
              </button>
            </div>
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              ← Click "Trim" to see the Alert Composer in the right panel
            </p>
          </div>
        </div>

        {/* RIGHT: Alert Composer */}
        <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg flex flex-col h-[800px]">
          {/* A) HEADER */}
          <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--text-high)] font-medium">Trim – Alert Preview</h3>
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                UPDATE
              </span>
            </div>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* B) PREVIEW CARD */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Message Preview
              </label>
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded-lg">
                <div className="text-sm text-[var(--text-high)] space-y-1.5 leading-relaxed">
                  <div className="font-medium">📊 <strong>UPDATE</strong></div>
                  <div className="font-medium"><strong>SPX $5800C 0DTE</strong> (Scalp)</div>
                  <div className="text-xs text-[var(--text-muted)] space-y-0.5 mt-2">
                    <div>Current: <span className="text-[var(--text-high)]">$27.30</span></div>
                    <div>P&L: <span className="text-[var(--positive)]">+21.3%</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] text-xs italic">
                    Trimming 50% here to lock partial profit.
                  </div>
                </div>
              </div>
            </div>

            {/* C) INCLUDED FIELDS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Included Fields
              </label>
              <div className="space-y-2">
                {/* Entry - unchecked */}
                <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Entry</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue="22.50"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                        Live
                      </label>
                    </div>
                  </div>
                </label>

                {/* Current - checked */}
                <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors border border-[var(--brand-primary)]/30">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-high)]">Current</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue="27.30"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-high)]">
                        <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                        Live
                      </label>
                    </div>
                  </div>
                </label>

                {/* Target - unchecked */}
                <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Target</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue="31.00"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded" />
                        Live
                      </label>
                    </div>
                  </div>
                </label>

                {/* Stop - unchecked */}
                <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Stop</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue="17.90"
                        step="0.01"
                        className="w-20 px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                        Live
                      </label>
                    </div>
                  </div>
                </label>

                {/* P&L - checked */}
                <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors border border-[var(--brand-primary)]/30">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-high)]">P&L</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue="+21.3%"
                        className="w-20 px-2 py-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded text-sm text-[var(--positive)] text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-high)]">
                        <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                        Live
                      </label>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* E) COMMENT */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Comment (Optional)
              </label>
              <textarea
                defaultValue="Trimming 50% here to lock partial profit."
                className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                rows={3}
              />
            </div>

            {/* F) CHANNELS */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Discord Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-[var(--text-high)]">#options-signals</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-[var(--text-high)]">#spx-room</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-[var(--text-muted)]">#scalp-alerts</span>
                </label>
              </div>
            </div>

            {/* F) CHALLENGES */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Link to Challenges (Optional)
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded cursor-pointer hover:bg-[var(--surface-2)]/80 transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-[var(--text-high)]">November Scalp Challenge</div>
                    <div className="text-xs text-[var(--text-muted)]">SPX only</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* G) FOOTER */}
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
