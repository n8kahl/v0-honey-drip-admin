import { useState } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

type TradeState = 'watching' | 'loaded' | 'enter-alert' | 'entered';

export function WireframeConsolidated() {
  const [currentState, setCurrentState] = useState<TradeState>('watching');

  const states = [
    { id: 'watching' as TradeState, label: 'WATCHING', description: 'Select contract' },
    { id: 'loaded' as TradeState, label: 'LOADED', description: 'Load alert preview' },
    { id: 'enter-alert' as TradeState, label: 'ENTER ALERT', description: 'Enter alert composer' },
    { id: 'entered' as TradeState, label: 'ENTERED', description: 'Live trade management' },
  ];

  const currentIndex = states.findIndex(s => s.id === currentState);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-[var(--bg-base)]">
      {/* Progress Stepper */}
      <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[var(--text-high)] text-sm uppercase tracking-wide mb-4">
            Complete Trade Lifecycle Wireframes
          </h2>
          
          <div className="flex items-center justify-between">
            {states.map((state, index) => (
              <div key={state.id} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentState(state.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    currentState === state.id
                      ? 'bg-[var(--brand-primary)]/10 border-2 border-[var(--brand-primary)]'
                      : index < currentIndex
                      ? 'bg-[var(--positive)]/10 border border-[var(--positive)]/30 hover:bg-[var(--positive)]/20'
                      : 'bg-[var(--surface-2)] border border-[var(--border-hairline)] hover:bg-[var(--surface-2)]/80'
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentState === state.id
                      ? 'bg-[var(--brand-primary)] text-[var(--bg-base)]'
                      : index < currentIndex
                      ? 'bg-[var(--positive)] text-white'
                      : 'bg-[var(--surface-1)] text-[var(--text-muted)]'
                  }`}>
                    {index < currentIndex ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className={`text-xs uppercase tracking-wide ${
                      currentState === state.id
                        ? 'text-[var(--brand-primary)]'
                        : index < currentIndex
                        ? 'text-[var(--positive)]'
                        : 'text-[var(--text-muted)]'
                    }`}>
                      {state.label}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {state.description}
                    </div>
                  </div>
                </button>
                
                {index < states.length - 1 && (
                  <ChevronRight className={`w-5 h-5 mx-2 flex-shrink-0 ${
                    index < currentIndex
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--border-hairline)]'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* State Content */}
      <div className="flex-1 overflow-hidden">
        {currentState === 'watching' && <WatchingState />}
        {currentState === 'loaded' && <LoadedState />}
        {currentState === 'enter-alert' && <EnterAlertState />}
        {currentState === 'entered' && <EnteredState />}
      </div>

      {/* Navigation Footer */}
      <div className="bg-[var(--surface-1)] border-t border-[var(--border-hairline)] px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              const prevIndex = Math.max(0, currentIndex - 1);
              setCurrentState(states[prevIndex].id);
            }}
            disabled={currentIndex === 0}
            className="px-4 py-2 rounded-lg border border-[var(--border-hairline)] text-[var(--text-med)] hover:bg-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          <div className="text-[var(--text-muted)] text-sm">
            Step {currentIndex + 1} of {states.length}
          </div>

          <button
            onClick={() => {
              const nextIndex = Math.min(states.length - 1, currentIndex + 1);
              setCurrentState(states[nextIndex].id);
            }}
            disabled={currentIndex === states.length - 1}
            className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// WATCHING STATE
function WatchingState() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[var(--text-high)] text-2xl mb-2">State 1: WATCHING</h1>
          <p className="text-[var(--text-muted)]">
            User selects ticker from watchlist, browses contracts in center panel
          </p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT: Watchlist */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">Watchlist</div>
              
              <div className="space-y-2">
                {['TSLA', 'SPY', 'AAPL', 'NVDA', 'QQQ'].map((ticker, i) => (
                  <div
                    key={ticker}
                    className={`p-3 rounded-lg ${
                      i === 0
                        ? 'bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]'
                        : 'bg-[var(--surface-2)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${i === 0 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-high)]'}`}>
                        {ticker}
                      </span>
                      <span className="text-[var(--positive)] text-sm">+2.4%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Contract Selection */}
          <div className="col-span-6">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                TSLA Contracts
              </div>

              <div className="space-y-3">
                {[
                  { strike: 350, type: 'C', expiry: '11/15', mid: 12.50, iv: 65 },
                  { strike: 355, type: 'C', expiry: '11/15', mid: 9.80, iv: 63 },
                  { strike: 360, type: 'C', expiry: '11/15', mid: 7.20, iv: 61 },
                  { strike: 345, type: 'P', expiry: '11/15', mid: 8.90, iv: 64 },
                ].map((contract, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${
                      i === 1
                        ? 'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]'
                        : 'bg-[var(--surface-2)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[var(--text-high)] font-medium">
                        ${contract.strike}{contract.type} {contract.expiry}
                      </span>
                      <span className="text-[var(--text-high)]">${contract.mid.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                      <span>IV: {contract.iv}%</span>
                      <span>Δ: 0.45</span>
                      <span>Vol: 2.4k</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg text-xs text-blue-400">
                💡 <strong>Workflow:</strong> Contract selection immediately shows Load Alert preview on the right (no "Load Trade Idea" button needed)
              </div>
            </div>
          </div>

          {/* RIGHT: Empty State */}
          <div className="col-span-3">
            <div className="bg-[var(--surface-1)] rounded-lg border border-dashed border-[var(--border-hairline)] p-6 text-center h-full flex flex-col items-center justify-center">
              <div className="text-[var(--text-muted)] text-sm mb-2">No contract selected</div>
              <div className="text-[var(--text-muted)] text-xs">
                Select a contract to see Load Alert preview
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// LOADED STATE
function LoadedState() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[var(--text-high)] text-2xl mb-2">State 2: LOADED</h1>
          <p className="text-[var(--text-muted)]">
            Contract selected → Load Alert composer auto-opens on right
          </p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT: Watchlist */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">Watchlist</div>
              
              <div className="space-y-2">
                {['TSLA', 'SPY', 'AAPL'].map((ticker, i) => (
                  <div
                    key={ticker}
                    className={`p-3 rounded-lg ${
                      i === 0
                        ? 'bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]'
                        : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${i === 0 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-high)]'}`}>
                        {ticker}
                      </span>
                      <span className="text-[var(--positive)] text-sm">+2.4%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Selected Contract */}
          <div className="col-span-6">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Selected Contract
              </div>

              <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--brand-primary)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[var(--text-high)] font-medium text-lg">
                    TSLA $355C 11/15
                  </span>
                  <span className="text-[var(--text-high)] text-lg">$9.80</span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-[var(--text-muted)]">IV</div>
                    <div className="text-[var(--text-high)]">63%</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Delta</div>
                    <div className="text-[var(--text-high)]">0.45</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">Volume</div>
                    <div className="text-[var(--text-high)]">2.4k</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-muted)]">OI</div>
                    <div className="text-[var(--text-high)]">12.1k</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg text-xs text-blue-400">
                ✅ <strong>Load Alert</strong> appears automatically on the right panel
              </div>
            </div>
          </div>

          {/* RIGHT: Load Alert Preview */}
          <div className="col-span-3">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--brand-primary)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--brand-primary)] mb-4">
                📋 Load Alert
              </div>

              <div className="space-y-4">
                {/* Alert Preview */}
                <div className="p-3 bg-[var(--surface-2)] rounded-lg text-xs">
                  <div className="text-[var(--text-high)] font-medium mb-1">
                    TSLA $355C 11/15
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Loaded for review
                  </div>
                </div>

                {/* Discord Channels */}
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">Discord Channels</div>
                  <div className="space-y-2">
                    {['scalps', 'day-trades', 'alerts'].map((channel, i) => (
                      <label key={channel} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          defaultChecked={i === 0}
                          className="rounded border-[var(--border-hairline)]"
                        />
                        <span className="text-[var(--text-high)]">#{channel}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Challenges */}
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">Challenges</div>
                  <div className="space-y-2">
                    {['November Scalps', 'TSLA Week'].map((challenge, i) => (
                      <label key={challenge} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          defaultChecked={i === 0}
                          className="rounded border-[var(--border-hairline)]"
                        />
                        <span className="text-[var(--text-high)]">{challenge}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Send Button */}
                <button className="w-full py-2 bg-[var(--brand-primary)] text-[var(--bg-base)] rounded-lg text-sm">
                  Load & Send Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ENTER ALERT STATE
function EnterAlertState() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[var(--text-high)] text-2xl mb-2">State 3: ENTER ALERT</h1>
          <p className="text-[var(--text-muted)]">
            After loading, user clicks "Enter" → Entry alert composer opens
          </p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT: Loaded Trades */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Loaded Trades
              </div>
              
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]">
                  <div className="text-[var(--brand-primary)] font-medium text-sm mb-1">
                    TSLA $355C
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">11/15 • $9.80</div>
                  <div className="mt-2 text-[10px] text-[var(--brand-primary)] uppercase">
                    📋 Loaded
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Entry Form */}
          <div className="col-span-6">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Enter Trade
              </div>

              <div className="space-y-4">
                {/* Contract Info */}
                <div className="p-4 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-[var(--text-high)] font-medium text-lg mb-2">
                    TSLA $355C 11/15
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    Current: $9.80
                  </div>
                </div>

                {/* Entry Price */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-2 block">Entry Price</label>
                  <input
                    type="text"
                    defaultValue="9.80"
                    className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)]"
                  />
                </div>

                {/* Target */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-2 block">Target Price</label>
                  <input
                    type="text"
                    defaultValue="13.50"
                    className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)]"
                  />
                  <div className="text-xs text-[var(--positive)] mt-1">+37.8%</div>
                </div>

                {/* Stop Loss */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-2 block">Stop Loss</label>
                  <input
                    type="text"
                    defaultValue="7.80"
                    className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-high)]"
                  />
                  <div className="text-xs text-[var(--negative)] mt-1">-20.4%</div>
                </div>

                <button className="w-full py-3 bg-[var(--brand-primary)] text-[var(--bg-base)] rounded-lg">
                  Preview Enter Alert →
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Enter Alert Preview */}
          <div className="col-span-3">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--brand-primary)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--brand-primary)] mb-4">
                🎯 Enter Alert
              </div>

              <div className="space-y-4">
                {/* Alert Preview */}
                <div className="p-3 bg-[var(--surface-2)] rounded-lg text-xs">
                  <div className="text-[var(--text-high)] font-medium mb-2">
                    TSLA $355C 11/15
                  </div>
                  <div className="space-y-1 text-[var(--text-muted)]">
                    <div>Entry: $9.80</div>
                    <div>Target: $13.50 (+37.8%)</div>
                    <div>Stop: $7.80 (-20.4%)</div>
                  </div>
                </div>

                {/* Collapsed Sections */}
                <div className="space-y-2 text-xs">
                  <button className="w-full flex items-center justify-between p-2 bg-[var(--surface-2)] rounded text-[var(--text-muted)] hover:text-[var(--text-high)]">
                    <span>Discord Channels (1)</span>
                    <span>▼</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-2 bg-[var(--surface-2)] rounded text-[var(--text-muted)] hover:text-[var(--text-high)]">
                    <span>Challenges (1)</span>
                    <span>▼</span>
                  </button>
                </div>

                {/* Comment */}
                <textarea
                  placeholder="Add comment..."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-high)] resize-none"
                  rows={3}
                />

                {/* Send Button */}
                <button className="w-full py-2 bg-[var(--brand-primary)] text-[var(--bg-base)] rounded-lg text-sm">
                  Enter & Send Alert
                </button>

                <div className="text-[10px] text-[var(--text-muted)] text-center">
                  Channels/Challenges collapsed by default
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ENTERED STATE
function EnteredState() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[var(--text-high)] text-2xl mb-2">State 4: ENTERED</h1>
          <p className="text-[var(--text-muted)]">
            Live trade with compact summary + configurable alert composers
          </p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT: Active Trades */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Active Trades
              </div>
              
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]">
                  <div className="text-[var(--brand-primary)] font-medium text-sm mb-1">
                    TSLA $355C
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">11/15 • Entry $9.80</div>
                  <div className="text-xs text-[var(--positive)]">+15.3%</div>
                </div>
                
                <div className="p-3 rounded-lg bg-[var(--surface-2)]">
                  <div className="text-[var(--text-high)] font-medium text-sm mb-1">
                    SPY $450P
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-2">11/17 • Entry $3.20</div>
                  <div className="text-xs text-[var(--negative)]">-5.2%</div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Trade Details */}
          <div className="col-span-6">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Live Trade
              </div>

              {/* Compact Summary Card */}
              <div className="p-5 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)] mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[var(--text-high)] text-xl font-medium mb-1">
                      TSLA $355C 11/15
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">Day Trade • Entered 9:45 AM</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl text-[var(--positive)]">+15.3%</div>
                    <div className="text-xs text-[var(--text-muted)]">$1.50 gain</div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Entry</div>
                    <div className="text-[var(--text-high)]">$9.80</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Current</div>
                    <div className="text-[var(--text-high)]">$11.30</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Target</div>
                    <div className="text-[var(--positive)]">$13.50</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Stop</div>
                    <div className="text-[var(--negative)]">$7.80</div>
                  </div>
                </div>

                {/* Collapsible Contract Details */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-high)]">
                    Contract Details & Greeks ▼
                  </summary>
                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-5 gap-3 text-xs">
                    <div>
                      <div className="text-[var(--text-muted)]">IV</div>
                      <div className="text-[var(--text-high)]">63%</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Delta</div>
                      <div className="text-[var(--text-high)]">0.52</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Gamma</div>
                      <div className="text-[var(--text-high)]">0.08</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Theta</div>
                      <div className="text-[var(--negative)]">-0.12</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Vega</div>
                      <div className="text-[var(--text-high)]">0.15</div>
                    </div>
                  </div>
                </details>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
                  Quick Actions
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button className="px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                    📊 Trim
                  </button>
                  <button className="px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                    🛡️ Update SL
                  </button>
                  <button className="px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                    🎯 Update Target
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button className="px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                    📝 Update
                  </button>
                  <button className="px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border border-[var(--border-hairline)] rounded-lg text-sm text-[var(--text-high)]">
                    ➕ Add Position
                  </button>
                  <button className="px-4 py-3 bg-[var(--negative)]/20 hover:bg-[var(--negative)]/30 border border-[var(--negative)] rounded-lg text-sm text-[var(--negative)]">
                    🏁 Full Exit
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Alert Composers */}
          <div className="col-span-3">
            <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
                Alert Composers
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg text-[10px] text-blue-400">
                  <p className="mb-2">
                    Each action opens a draft alert here. Configure fields, adjust prices, pick channels, add comment.
                  </p>
                  <p className="text-blue-300">
                    💡 Discord/Challenges collapsed by default (inherited from last alert)
                  </p>
                </div>

                {/* Example: Trim Alert */}
                <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                  <div className="text-xs text-[var(--text-high)] mb-2">📊 Trim Alert</div>
                  <div className="text-[10px] text-[var(--text-muted)] space-y-1">
                    <div>• Current price + P&L included</div>
                    <div>• Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                  <div className="text-xs text-[var(--text-high)] mb-2">🛡️ Update Stop Loss</div>
                  <div className="text-[10px] text-[var(--text-muted)] space-y-1">
                    <div>• Breakeven / Fixed / Trailing</div>
                    <div>• Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                  <div className="text-xs text-[var(--text-high)] mb-2">🏁 Full Exit</div>
                  <div className="text-[10px] text-[var(--text-muted)] space-y-1">
                    <div>• Final P&L calculation</div>
                    <div>• Channels/Challenges: collapsed ✓</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
