import { X } from 'lucide-react';

/**
 * ALERT COMPOSER - Mobile Variant (Bottom Sheet)
 * 
 * Reference implementation of the Global Alert System spec
 * showing the UPDATE (Stop Loss - Trailing) alert type.
 * 
 * See: /docs/ALERT_SYSTEM_SPEC.md Section 2.3
 */

export function AlertComposerMobile() {
  return (
    <div className="w-[390px] h-[844px] bg-[var(--bg-base)] flex flex-col mx-auto border-x border-[var(--border-hairline)] relative">
      {/* DIMMED BACKGROUND CONTENT */}
      <div className="flex-1 bg-black/60 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] text-sm mb-2">Background content (dimmed)</p>
          <p className="text-blue-400 text-xs">Alert Composer opens as bottom sheet ↓</p>
        </div>
      </div>

      {/* BOTTOM SHEET - ALERT COMPOSER */}
      <div className="bg-[var(--surface-1)] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* DRAG HANDLE */}
        <div className="flex items-center justify-center py-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border-hairline)]" />
        </div>

        {/* A) HEADER */}
        <div className="px-4 pb-3 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[var(--text-high)] font-medium">Update SL – Alert</h3>
            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
              UPDATE
            </span>
          </div>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)]">
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
            <div className="p-3 bg-[var(--surface-2)] border border-[var(--brand-primary)]/50 rounded-lg">
              <div className="text-sm text-[var(--text-high)] space-y-1.5 leading-relaxed">
                <div className="font-medium">📊 <strong>UPDATE</strong></div>
                <div className="font-medium"><strong>SPX $5800C 0DTE</strong> (Scalp)</div>
                <div className="text-xs text-[var(--text-muted)] space-y-0.5 mt-2">
                  <div>Stop: <span className="text-[var(--text-high)]">Trailing 0.50 pts from current ($26.80)</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] text-xs italic">
                  Setting a trailing stop: 0.50 points from current.
                </div>
              </div>
            </div>
          </div>

          {/* D) STOP LOSS CONTROL - TRAILING MODE */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
              New Stop Loss
            </label>
            <div className="space-y-2">
              {/* Breakeven */}
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer">
                <input type="radio" name="sl-mode" className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-high)]">Breakeven</div>
                  <div className="text-xs text-[var(--text-muted)]">Move to entry price ($22.50)</div>
                </div>
              </label>

              {/* Fixed Price */}
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg cursor-pointer">
                <input type="radio" name="sl-mode" className="w-4 h-4" />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-high)]">Fixed Price</div>
                  <div className="text-xs text-[var(--text-muted)]">Set specific price</div>
                </div>
              </label>

              {/* Trailing Stop - SELECTED */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/50">
                <label className="flex items-center gap-3 mb-3 cursor-pointer">
                  <input type="radio" name="sl-mode" defaultChecked className="w-4 h-4" />
                  <div className="flex-1">
                    <div className="text-sm text-[var(--text-high)]">Trailing Stop</div>
                    <div className="text-xs text-[var(--text-muted)]">Follow price movement</div>
                  </div>
                </label>

                {/* Trailing Controls */}
                <div className="space-y-3 ml-7">
                  {/* Distance */}
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Trailing distance</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue="0.50"
                        step="0.01"
                        className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]"
                      />
                      <select className="px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                        <option>points</option>
                        <option>%</option>
                      </select>
                    </div>
                  </div>

                  {/* Trail From */}
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Trail from</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="trail-from" defaultChecked className="w-4 h-4" />
                        <span className="text-[var(--text-high)]">Current price</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="trail-from" className="w-4 h-4" />
                        <span className="text-[var(--text-high)]">Entry price</span>
                      </label>
                    </div>
                  </div>

                  {/* Effective Stop Preview */}
                  <div className="p-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded">
                    <div className="text-xs text-[var(--text-muted)]">Effective stop:</div>
                    <div className="text-sm text-[var(--text-high)] font-medium">$26.80</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* C) INCLUDED FIELDS - Minimal for SL update */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Included Fields
            </label>
            <div className="space-y-2">
              {/* Stop - auto-checked for SL update */}
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/30">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-high)]">Stop Loss</div>
                  <div className="text-xs text-[var(--text-muted)]">Trailing 0.50 pts ($26.80)</div>
                </div>
              </label>

              {/* Current - unchecked */}
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-muted)]">Current Price</div>
                  <div className="text-xs text-[var(--text-muted)]">$27.30</div>
                </div>
              </label>

              {/* P&L - unchecked */}
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text-muted)]">P&L</div>
                  <div className="text-xs text-[var(--text-muted)]">+21.3%</div>
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
              defaultValue="Setting a trailing stop: 0.50 points from current."
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
              <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[var(--text-high)]">#options-signals</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[var(--text-high)]">#spx-room</span>
              </label>
            </div>
          </div>
        </div>

        {/* G) FOOTER - STACKED BUTTONS */}
        <div className="p-4 border-t border-[var(--border-hairline)] space-y-2 flex-shrink-0">
          <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors">
            Send Alert
          </button>
          <button className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors">
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
