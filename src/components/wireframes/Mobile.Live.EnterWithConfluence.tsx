import { Settings, Mic, ChevronDown, ChevronUp, TrendingUp, Activity, Droplets, X, Check } from 'lucide-react';
import { useState } from 'react';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';

/**
 * MOBILE.LIVE.ENTER-WITH-CONFLUENCE
 * 
 * Mobile screen showing the moment BEFORE sending an ENTER alert.
 * Features a compact Confluence Panel powered by Massive.com (Options + Indices APIs).
 * 
 * Layout:
 * - Top: Mobile header
 * - Body (scrollable):
 *   - Trade context header
 *   - Collapsible Confluence Panel (3 chips: Trend, Volatility, Liquidity)
 *   - Entry / TP / SL levels card
 * - Bottom: Now-Playing panel (collapsible)
 * - Bottom Nav: Fixed tabs (Live, Active, History, Settings)
 * - Enter Alert Composer: Bottom sheet (slides up)
 */

export function MobileLiveEnterWithConfluence() {
  const [confluenceExpanded, setConfluenceExpanded] = useState(false);
  const [nowPlayingExpanded, setNowPlayingExpanded] = useState(false);
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState(['options-signals', 'spx-scalps']);
  const [selectedChallenges, setSelectedChallenges] = useState(['small-account']);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges(prev =>
      prev.includes(challengeId)
        ? prev.filter(id => id !== challengeId)
        : [...prev, challengeId]
    );
  };

  const handleSendAlert = () => {
    // Close the composer
    setShowAlertComposer(false);
    setNowPlayingExpanded(false);
    
    // Show toast (would be actual toast in real app)
    // Trade state changes to ENTERED
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] max-w-[390px] mx-auto">
      
      {/* ========== MOBILE HEADER ========== */}
      <header className="h-14 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src={honeyDripLogo || "/placeholder.svg"} alt="Honey Drip" className="w-8 h-8 rounded" />
          <span className="text-[var(--text-high)] font-medium text-sm">Honey Drip</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="px-2 py-0.5 rounded-full bg-[var(--positive)]/20 border border-[var(--positive)]/50">
              <span className="text-[var(--positive)] text-[9px] font-medium uppercase tracking-wide">
                ● Open
              </span>
            </div>
            <span className="text-[var(--text-muted)] text-[8px]">14:42:33 ET</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]">
            <Settings className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-[var(--bg-base)]">
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========== SCROLLABLE BODY ========== */}
      <div className="flex-1 overflow-y-auto pb-32">
        
        {/* TRADE CONTEXT HEADER */}
        <div className="p-4 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-lg text-[var(--text-high)] font-medium mb-1">SPX 0DTE 5800C</h1>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                  Scalp
                </span>
                <span className="text-xs text-[var(--text-muted)]">Call</span>
              </div>
            </div>
            <div className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/50">
              <span className="text-[10px] text-blue-400 uppercase tracking-wide">LOADED → ENTER</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Review confluence and levels before sending ENTER alert to Discord.
          </p>
        </div>

        {/* ========== CONFLUENCE PANEL (COLLAPSIBLE) ========== */}
        <div className="m-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg overflow-hidden">
          
          {/* HEADER (always visible) */}
          <button
            onClick={() => setConfluenceExpanded(!confluenceExpanded)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-[var(--text-high)] font-medium">Confluence (Massive Data)</span>
            </div>
            {confluenceExpanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>

          {/* COLLAPSED STATE - 3 CHIPS */}
          {!confluenceExpanded && (
            <div className="px-4 pb-4">
              <div className="space-y-2 mb-3">
                
                {/* TREND CHIP */}
                <div className="p-3 bg-[var(--positive)]/10 border border-[var(--positive)]/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span className="text-xs text-[var(--text-muted)]">Trend</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-high)] font-medium">Bullish</div>
                    <div className="text-[10px] text-[var(--text-muted)]">3/3 timeframes</div>
                  </div>
                </div>

                {/* VOLATILITY CHIP */}
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs text-[var(--text-muted)]">Volatility</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-high)] font-medium">Elevated IV</div>
                    <div className="text-[10px] text-[var(--text-muted)]">78th percentile</div>
                  </div>
                </div>

                {/* LIQUIDITY CHIP */}
                <div className="p-3 bg-[var(--positive)]/10 border border-[var(--positive)]/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span className="text-xs text-[var(--text-muted)]">Liquidity</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-high)] font-medium">Good</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Tight spread · High vol</div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] italic">
                💡 Live view from Massive (indices + options APIs)
              </p>
            </div>
          )}

          {/* EXPANDED STATE - DETAILED SECTIONS */}
          {confluenceExpanded && (
            <div className="px-4 pb-4 space-y-4">
              
              {/* A) INDEX CONTEXT */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-[var(--text-high)] font-medium">SPX Index Context</h3>
                  <span className="text-xs text-[var(--positive)]">+0.78%</span>
                </div>
                
                {/* Micro sparkline */}
                <div className="h-12 bg-[var(--bg-base)] rounded border border-[var(--border-hairline)] mb-2 relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline
                      points="0,80 10,75 20,78 30,70 40,65 50,68 60,60 70,55 80,50 90,45 100,40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-[var(--positive)]"
                    />
                  </svg>
                  <div className="absolute bottom-1 right-1 text-[8px] text-[var(--text-muted)]">
                    Last 30min
                  </div>
                </div>

                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">RSI (5m)</span>
                    <span className="text-[var(--text-high)]">64 · <span className="text-[var(--positive)]">bullish</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">MACD (5m)</span>
                    <span className="text-[var(--positive)]">above signal</span>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--positive)] mt-2">
                  ✓ Index momentum supports call direction
                </p>
              </div>

              {/* B) CONTRACT HEALTH */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <h3 className="text-xs text-[var(--text-high)] font-medium mb-2">Contract Health – SPX 0DTE 5800C</h3>
                
                {/* Pricing & Volatility */}
                <div className="mb-3 pb-3 border-b border-[var(--border-hairline)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Pricing & Volatility</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">IV</span>
                      <span className="text-[var(--text-high)]">22.4% <span className="text-yellow-500">(p75 · elevated)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">IV trend</span>
                      <span className="text-[var(--positive)]">rising</span>
                    </div>
                  </div>
                </div>

                {/* Liquidity */}
                <div className="mb-3 pb-3 border-b border-[var(--border-hairline)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Liquidity</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Spread</span>
                      <span className="text-[var(--text-high)]">$0.05 <span className="text-[var(--positive)]">(2.8%)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Volume</span>
                      <span className="text-[var(--text-high)]">8,432 <span className="text-[var(--positive)]">(2.1× avg)</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">OI</span>
                      <span className="text-[var(--text-high)]">15,200</span>
                    </div>
                  </div>
                </div>

                {/* Greeks */}
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Greeks</div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-[var(--text-high)]">Δ <span className="font-medium">0.42</span></span>
                    <span className="text-[var(--text-high)]">Γ <span className="font-medium">0.18</span></span>
                    <span className="text-[var(--text-high)]">Θ <span className="font-medium text-[var(--negative)]">-0.09</span></span>
                  </div>
                </div>
              </div>

              {/* C) FLOW STRIP */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <h3 className="text-xs text-[var(--text-high)] font-medium mb-2">Flow (last 60s)</h3>
                
                {/* Flow bar */}
                <div className="mb-2">
                  <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden flex">
                    <div className="bg-[var(--negative)]" style={{ width: '32%' }}></div>
                    <div className="bg-[var(--positive)]" style={{ width: '68%' }}></div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">42 trades</span>
                  <span className="text-[var(--text-high)]">68% at ask</span>
                  <span className="text-[var(--positive)]">+2,300 calls</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========== ENTRY / TP / SL LEVELS CARD ========== */}
        <div className="mx-4 mb-4 p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
          <h3 className="text-sm text-[var(--text-high)] font-medium mb-3">Entry & Levels</h3>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Entry</div>
              <div className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] font-medium">
                $1.25
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Target (TP1)</div>
              <div className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] font-medium">
                $1.80
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Stop Loss</div>
              <div className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--text-high)] font-medium">
                $0.90
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">R:R</div>
              <div className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-sm text-[var(--positive)] font-medium">
                1 : 2.2
              </div>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] italic">
            💡 TP/SL seeded from your Massive-powered defaults (ATR/MTF) and can be adjusted before sending.
          </p>
        </div>
      </div>

      {/* ========== NOW-PLAYING PANEL ========== */}
      <div 
        className={`fixed bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] transition-all duration-300 max-w-[390px] mx-auto ${
          nowPlayingExpanded ? 'h-64' : 'h-14'
        }`}
      >
        
        {/* COLLAPSED STATE */}
        {!nowPlayingExpanded && (
          <button
            onClick={() => setNowPlayingExpanded(true)}
            className="w-full h-14 px-4 flex items-center justify-between"
          >
            <div className="flex-1 text-left">
              <div className="text-sm text-[var(--text-high)] font-medium mb-1">SPX 0DTE 5800C (Scalp)</div>
              <div className="text-xs text-[var(--text-muted)]">About to ENTER</div>
            </div>
            <div className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/50">
              <span className="text-[10px] text-blue-400 uppercase">LOADED</span>
            </div>
          </button>
        )}

        {/* EXPANDED STATE */}
        {nowPlayingExpanded && (
          <div className="h-full flex flex-col p-4">
            <button
              onClick={() => setNowPlayingExpanded(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-base text-[var(--text-high)] font-medium mb-1">SPX 0DTE 5800C</h3>
                  <div className="text-xs text-[var(--text-muted)]">
                    Entry: $1.25 · TP1: $1.80 · SL: $0.90
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-[var(--brand-primary)]/20 text-[10px] text-[var(--brand-primary)] uppercase tracking-wide">
                  ENTER PREVIEW
                </span>
              </div>

              <div className="mt-4 p-3 bg-[var(--surface-2)] rounded-lg">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Confirm confluence and levels, then send ENTER alert to Discord.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setNowPlayingExpanded(false)}
                className="flex-1 py-3 px-4 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAlertComposer(true)}
                className="flex-1 py-3 px-4 bg-[var(--brand-primary)] text-[var(--bg-base)] font-medium rounded-lg text-sm"
              >
                Open ENTER Alert
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========== BOTTOM NAV ========== */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around max-w-[390px] mx-auto">
        <button className="flex flex-col items-center gap-1 text-[var(--brand-primary)]">
          <div className="w-5 h-5 rounded bg-[var(--brand-primary)]/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]"></div>
          </div>
          <span className="text-[10px]">Live</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
          <div className="w-5 h-5 flex items-center justify-center">
            <div className="w-4 h-4 rounded border border-current"></div>
          </div>
          <span className="text-[10px]">Active</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
          <div className="w-5 h-5 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px]">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
          <Settings className="w-4 h-4" />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>

      {/* ========== ENTER ALERT COMPOSER (BOTTOM SHEET) ========== */}
      {showAlertComposer && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowAlertComposer(false)}
          />

          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface-1)] rounded-t-2xl z-50 max-w-[390px] mx-auto max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base text-[var(--text-high)] font-medium">Enter – Alert Preview</h3>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--positive)]/20 text-[var(--positive)]">
                  DRAFT
                </span>
              </div>
              <button
                onClick={() => setShowAlertComposer(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* 1) PREVIEW TEXT BLOCK */}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Message Preview
                </label>
                <div className="p-3 bg-[var(--surface-2)] border border-[var(--positive)]/50 rounded-lg">
                  <div className="text-xs text-[var(--text-high)] space-y-2 leading-relaxed">
                    <div className="font-medium">📍 <strong>ENTER</strong> – SPX $5800C 0DTE (Scalp)</div>
                    
                    <div className="space-y-0.5 text-[10px]">
                      <div>Entry: <span className="text-[var(--text-high)] font-medium">$1.25</span></div>
                      <div>Target: <span className="text-[var(--positive)] font-medium">$1.80</span></div>
                      <div>Stop: <span className="text-[var(--negative)] font-medium">$0.90</span></div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-hairline)] text-[10px]">
                      <div className="font-medium text-[var(--text-muted)] mb-1">Confluence:</div>
                      <div>Trend: <span className="text-[var(--positive)]">Bullish</span> · IV: <span className="text-yellow-500">Elevated</span> · Liquidity: <span className="text-[var(--positive)]">Good</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2) INCLUDED FIELDS */}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Included Fields
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-xs text-[var(--text-high)]">Entry ($1.25)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-xs text-[var(--text-high)]">Target ($1.80)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-xs text-[var(--text-high)]">Stop ($0.90)</span>
                  </label>
                </div>
              </div>

              {/* 3) DISCORD CHANNELS */}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Discord Channels
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => toggleChannel('options-signals')}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedChannels.includes('options-signals') 
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                        : 'border-[var(--border-hairline)]'
                    }`}>
                      {selectedChannels.includes('options-signals') && (
                        <Check className="w-3 h-3 text-[var(--bg-base)]" />
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-high)]">#options-signals</span>
                  </button>
                  <button
                    onClick={() => toggleChannel('spx-scalps')}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedChannels.includes('spx-scalps') 
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                        : 'border-[var(--border-hairline)]'
                    }`}>
                      {selectedChannels.includes('spx-scalps') && (
                        <Check className="w-3 h-3 text-[var(--bg-base)]" />
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-high)]">#spx-scalps</span>
                  </button>
                  <button
                    onClick={() => toggleChannel('0dte-plays')}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedChannels.includes('0dte-plays') 
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                        : 'border-[var(--border-hairline)]'
                    }`}>
                      {selectedChannels.includes('0dte-plays') && (
                        <Check className="w-3 h-3 text-[var(--bg-base)]" />
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-high)]">#0dte-plays</span>
                  </button>
                </div>
              </div>

              {/* 4) CHALLENGES */}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Challenges
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => toggleChallenge('small-account')}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedChallenges.includes('small-account') 
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                        : 'border-[var(--border-hairline)]'
                    }`}>
                      {selectedChallenges.includes('small-account') && (
                        <Check className="w-3 h-3 text-[var(--bg-base)]" />
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-high)]">Small Account</span>
                  </button>
                  <button
                    onClick={() => toggleChallenge('0dte-master')}
                    className="w-full flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedChallenges.includes('0dte-master') 
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' 
                        : 'border-[var(--border-hairline)]'
                    }`}>
                      {selectedChallenges.includes('0dte-master') && (
                        <Check className="w-3 h-3 text-[var(--bg-base)]" />
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-high)]">0DTE Master</span>
                  </button>
                </div>
              </div>

              {/* 5) COMMENT */}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  defaultValue="Entering this trade here with defined TP/SL."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-high)] placeholder:text-[var(--text-muted)] resize-none"
                  rows={3}
                  placeholder="Add a comment..."
                />
              </div>

              {/* INFO NOTE */}
              <div className="p-3 bg-blue-500/5 border border-blue-500/30 rounded-lg">
                <p className="text-[10px] text-blue-400 leading-relaxed">
                  💡 <strong>No auto-send:</strong> This alert will remain in DRAFT until you tap "Send Alert". Review confluence and adjust as needed.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-[var(--border-hairline)] flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowAlertComposer(false)}
                className="flex-1 py-3 px-4 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] rounded-lg text-sm"
              >
                Discard
              </button>
              <button
                onClick={handleSendAlert}
                disabled={selectedChannels.length === 0}
                className="flex-1 py-3 px-4 bg-[var(--brand-primary)] text-[var(--bg-base)] font-medium rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Alert
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MobileLiveEnterWithConfluence;
