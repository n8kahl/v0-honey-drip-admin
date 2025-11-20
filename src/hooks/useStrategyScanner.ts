/**
 * Strategy Scanner Hook
 * 
 * Integrates strategy library with real-time market data:
 * 1. Fetches enabled strategies for current user
 * 2. Subscribes to realtime signals from Supabase
 * 3. When bars update, builds features and scans strategies
 * 4. Inserts new signals to database
 * 5. Returns signal data for UI badges/indicators
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../lib/supabase/client';
import { massive } from '../lib/massive';
import { buildSymbolFeatures, scanStrategiesForUser } from '../lib/strategy/esm';
import { Bar } from '../lib/indicators';
import { RealtimeChannel } from '@supabase/supabase-js';
import { processAlertBehavior, shouldProcessAlert, type AlertProcessorContext } from '../lib/strategy/alertProcessor';
import type { StrategyDefinition, StrategySignal } from '../types/strategy';
import { getAggregateUnderlyingFlow, type AggregatedFlowMetrics } from '../lib/massive/aggregate-flow';

// Extended signal with enriched strategy info for UI display
export interface EnrichedStrategySignal extends StrategySignal {
  strategy_name?: string;
  strategy_slug?: string;
}

export interface SymbolSignals {
  symbol: string;
  signals: EnrichedStrategySignal[];
  latestConfidence: number;
  setupCount: number; // 50-79% confidence
  readyCount: number; // 80%+ confidence
  lastUpdate: number;
}

interface UseStrategyScannerOptions {
  symbols?: string[]; // Symbols to scan (e.g., watchlist)
  enabled?: boolean; // Enable/disable scanning
  scanInterval?: number; // Milliseconds between scans (default: 60000 = 1 min)
  // Alert behavior callbacks
  onFlashWatchlist?: (symbol: string, durationMs?: number) => void;
  onShowNowPlaying?: (symbol: string, signal: EnrichedStrategySignal, strategy: StrategyDefinition) => void;
  onOpenTradePlanner?: (symbol: string, signal: EnrichedStrategySignal, strategy: StrategyDefinition) => void;
  discordChannels?: Array<{ id: string; name: string; webhookUrl: string }>;
}

export function useStrategyScanner(options: UseStrategyScannerOptions = {}) {
  const {
    symbols = [],
    enabled = true,
    scanInterval = 60000, // 1 minute default
    onFlashWatchlist,
    onShowNowPlaying,
    onOpenTradePlanner,
    discordChannels = [],
  } = options;

  const [signalsBySymbol, setSignalsBySymbol] = useState<Map<string, SymbolSignals>>(new Map());
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const scanTimerRef = useRef<any>(null);

  /**
   * Fetch enabled strategies for current user
   */
  const fetchEnabledStrategies = useCallback(async () => {
    try {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[useStrategyScanner] No authenticated user, skipping strategy fetch');
        return [];
      }

      const { data, error: fetchError } = await supabase
        .from('strategy_definitions')
        .select('*')
        .eq('enabled', true)
        .order('name', { ascending: true });

      if (fetchError) {
        console.error('[useStrategyScanner] Error fetching strategies:', fetchError);
        setError(fetchError.message);
        return [];
      }

      console.log(`[useStrategyScanner] ✅ Loaded ${data?.length || 0} enabled strategies`);
      return data || [];
    } catch (err: any) {
      console.error('[useStrategyScanner] Exception fetching strategies:', err);
      setError(err.message);
      return [];
    }
  }, []);

  /**
   * Fetch existing signals for symbols
   */
  const fetchSignalsForSymbols = useCallback(async (symbolList: string[]) => {
    if (symbolList.length === 0) return;

    try {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('strategy_signals')
        .select(`
          *,
          strategy:strategy_definitions!inner(name, slug)
        `)
        .in('symbol', symbolList)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        console.error('[useStrategyScanner] Error fetching signals:', fetchError);
        return;
      }

      // Group signals by symbol
      const grouped = new Map<string, SymbolSignals>();
      symbolList.forEach(symbol => {
        const symbolSignals = (data || [])
          .filter(sig => sig.symbol === symbol)
          .map(sig => ({
            ...sig,
            strategy_name: sig.strategy?.name,
            strategy_slug: sig.strategy?.slug,
          }));

        const confidences = symbolSignals.map(s => s.confidence || 0);
        const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
        const setupCount = symbolSignals.filter(s => (s.confidence || 0) >= 50 && (s.confidence || 0) < 80).length;
        const readyCount = symbolSignals.filter(s => (s.confidence || 0) >= 80).length;

        grouped.set(symbol, {
          symbol,
          signals: symbolSignals,
          latestConfidence: maxConfidence,
          setupCount,
          readyCount,
          lastUpdate: Date.now(),
        });
      });

      setSignalsBySymbol(grouped);
      console.log(`[useStrategyScanner] 📊 Loaded signals for ${grouped.size} symbols`);
    } catch (err: any) {
      console.error('[useStrategyScanner] Exception fetching signals:', err);
    }
  }, []);

  /**
   * Scan strategies for a single symbol
   */
  const scanSymbol = useCallback(async (symbol: string, strategyList: any[]) => {
    if (strategyList.length === 0) {
      console.log(`[useStrategyScanner] No enabled strategies, skipping scan for ${symbol}`);
      return;
    }

    try {
      setScanning(true);

      // Detect symbol type
      const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);
      const isOption = symbol.startsWith('O:');
      const isStock = !isIndex && !isOption;
      const normalizedSymbol = isIndex ? (symbol.startsWith('I:') ? symbol : `I:${symbol}`) : symbol;

      // Fetch 5-minute bars (last 200 bars = ~16 hours)
      let bars: any[];

      if (isStock) {
        // Use Tradier for stocks (user has indices+options plans, not stocks)
        console.log(`[useStrategyScanner] Fetching stock ${symbol} from Tradier (5min bars)`);
        try {
          // Calculate date range (last 5 days should cover 200 5-minute bars)
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 5 * 24 * 60 * 60 * 1000);
          const formatDate = (d: Date) => d.toISOString().split('T')[0];

          const response = await fetch(
            `/api/massive/tradier/stocks/bars?symbol=${encodeURIComponent(symbol)}&interval=5min&start=${formatDate(startDate)}&end=${formatDate(endDate)}`,
            {
              headers: {
                'x-massive-proxy-token': import.meta.env.VITE_MASSIVE_PROXY_TOKEN || '',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Tradier API error: ${response.status}`);
          }

          const data = await response.json();
          bars = data.results || [];
          console.log(`[useStrategyScanner] Fetched ${bars.length} bars from Tradier for ${symbol}`);
        } catch (err: any) {
          console.error(`[useStrategyScanner] Failed to fetch Tradier data for ${symbol}:`, err);
          return;
        }
      } else {
        // Use Massive for indices and options
        bars = await massive.getAggregates(normalizedSymbol, '5', 200);
      }
      if (bars.length < 20) {
        console.warn(`[useStrategyScanner] Insufficient bars for ${symbol} (${bars.length} bars), skipping`);
        return;
      }

      // Convert to Bar[] format expected by feature builder
      const formattedBars: Bar[] = bars.map(b => ({
        time: Math.floor(b.t / 1000), // Convert ms to seconds
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v || 0,
      }));

      // Fetch options flow data (if available)
      let flowMetrics: AggregatedFlowMetrics | null = null;
      try {
        // Try to fetch options chain for flow analysis
        // Only fetch for stocks and major indices (SPX, NDX, SPY, QQQ)
        const shouldFetchFlow = isStock || ['SPX', 'NDX', 'I:SPX', 'I:NDX'].includes(symbol);

        if (shouldFetchFlow) {
          console.log(`[useStrategyScanner] 📊 Fetching options flow for ${symbol}...`);

          // Fetch options chain (top contracts by volume)
          // We'll use the options API endpoint - this is a placeholder, adjust based on your API
          try {
            const flowSymbol = isIndex ? symbol.replace('I:', '') : symbol;
            const response = await fetch(
              `/api/massive/options/chain?symbol=${encodeURIComponent(flowSymbol)}&limit=20`,
              {
                headers: {
                  'x-massive-proxy-token': import.meta.env.VITE_MASSIVE_PROXY_TOKEN || '',
                },
              }
            );

            if (response.ok) {
              const chainData = await response.json();
              const contracts = chainData.results || [];

              // Aggregate flow metrics across the chain
              flowMetrics = await getAggregateUnderlyingFlow(symbol, contracts);

              if (flowMetrics) {
                console.log(`[useStrategyScanner] ✅ Flow metrics for ${symbol}:`, {
                  flowScore: flowMetrics.flowScore,
                  flowBias: flowMetrics.flowBias,
                  sweeps: flowMetrics.sweepCount,
                  blocks: flowMetrics.blockCount,
                });
              }
            }
          } catch (flowErr: any) {
            console.log(`[useStrategyScanner] ℹ️ Flow data not available for ${symbol}:`, flowErr.message);
          }
        }
      } catch (err: any) {
        console.log(`[useStrategyScanner] ℹ️ Skipping flow aggregation for ${symbol}:`, err.message);
      }

      // Build features from bars
      console.log(`[useStrategyScanner] 🔍 Building features for ${symbol} from ${formattedBars.length} bars...`);
      const currentTime = new Date().toISOString();
      const features = buildSymbolFeatures({
        symbol,
        timeISO: currentTime,
        primaryTf: '5m',
        mtf: {
          '5m': {
            price: {
              current: formattedBars[formattedBars.length - 1]?.close,
              open: formattedBars[formattedBars.length - 1]?.open,
              high: formattedBars[formattedBars.length - 1]?.high,
              low: formattedBars[formattedBars.length - 1]?.low,
            },
          },
        },
        bars: formattedBars,
        timezone: 'America/New_York',
        flow: flowMetrics,
      });

      // Get current user for scanner
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[useStrategyScanner] No user found, skipping signal insertion');
        return;
      }

      // Scan strategies against features
      console.log(`[useStrategyScanner] 🎯 Scanning ${strategyList.length} strategies for ${symbol}...`);
      const signals = await scanStrategiesForUser({
        owner: user.id,
        symbols: [symbol],
        features: {
          [symbol]: features,
        },
        supabaseClient: supabaseRef.current,
      });

      if (signals.length > 0) {
        console.log(`[useStrategyScanner] ✨ Found ${signals.length} signals for ${symbol}:`, signals);
        // Signals are automatically inserted to database by scanner
        // Realtime subscription will pick them up and update UI
      } else {
        console.log(`[useStrategyScanner] No signals found for ${symbol}`);
      }
    } catch (err: any) {
      console.error(`[useStrategyScanner] Error scanning ${symbol}:`, err);
    } finally {
      setScanning(false);
    }
  }, []);

  /**
   * Scan all watchlist symbols
   */
  const scanAll = useCallback(async () => {
    if (!enabled || symbols.length === 0) return;
    if (strategies.length === 0) {
      console.log('[useStrategyScanner] No strategies loaded yet, skipping scan');
      return;
    }

    console.log(`[useStrategyScanner] 🔄 Starting full scan for ${symbols.length} symbols...`);
    
    // Scan symbols sequentially to avoid rate limiting
    for (const symbol of symbols) {
      await scanSymbol(symbol, strategies);
      // Small delay between symbols
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[useStrategyScanner] ✅ Full scan complete');
  }, [enabled, symbols, strategies, scanSymbol]);

  /**
   * Setup realtime subscription for signals
   */
  useEffect(() => {
    if (!enabled) return;

    const supabase = supabaseRef.current;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to new signals
      const channel = supabase
        .channel('strategy_signals_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'strategy_signals',
            filter: `owner=eq.${user.id}`,
          },
          async (payload) => {
            console.log('[useStrategyScanner] 🔔 New signal received:', payload.new);
            
            // Fetch full strategy definition for alert processing
            const { data: strategyData } = await supabase
              .from('strategy_definitions')
              .select('*')
              .eq('id', (payload.new as any).strategy_id)
              .single();

            // Map DB row to proper StrategySignal type, then enrich
            const rawSignal = payload.new as any;
            const enrichedSignal: EnrichedStrategySignal = {
              id: rawSignal.id,
              createdAt: rawSignal.created_at,
              symbol: rawSignal.symbol,
              strategyId: rawSignal.strategy_id,
              owner: rawSignal.owner,
              confidence: rawSignal.confidence ?? 0,
              payload: rawSignal.payload,
              status: rawSignal.status,
              barTimeKey: rawSignal.bar_time_key,
              strategy_name: strategyData?.name,
              strategy_slug: strategyData?.slug,
            };

            // Update local state first
            setSignalsBySymbol(prev => {
              const next = new Map(prev);
              const symbol = enrichedSignal.symbol;
              const existing = next.get(symbol) || {
                symbol,
                signals: [],
                latestConfidence: 0,
                setupCount: 0,
                readyCount: 0,
                lastUpdate: Date.now(),
              };

              const updatedSignals = [enrichedSignal, ...existing.signals];
              const confidences = updatedSignals.map(s => s.confidence || 0);
              const maxConfidence = Math.max(...confidences);
              const setupCount = updatedSignals.filter(s => (s.confidence || 0) >= 50 && (s.confidence || 0) < 80).length;
              const readyCount = updatedSignals.filter(s => (s.confidence || 0) >= 80).length;

              next.set(symbol, {
                symbol,
                signals: updatedSignals,
                latestConfidence: maxConfidence,
                setupCount,
                readyCount,
                lastUpdate: Date.now(),
              });

              return next;
            });

            // Process alert behaviors if strategy definition available
            if (strategyData) {
              try {
                // Map DB row to StrategyDefinition type
                const strategy: StrategyDefinition = {
                  id: strategyData.id,
                  createdAt: strategyData.created_at,
                  updatedAt: strategyData.updated_at,
                  owner: strategyData.owner,
                  name: strategyData.name,
                  slug: strategyData.slug,
                  description: strategyData.description,
                  category: strategyData.category,
                  underlyingScope: strategyData.underlying_scope,
                  timeWindow: strategyData.time_window,
                  barTimeframe: strategyData.bar_timeframe,
                  entrySide: strategyData.entry_side,
                  optionsPlayType: strategyData.options_play_type,
                  conditions: strategyData.conditions,
                  alertBehavior: strategyData.alert_behavior,
                  cooldownMinutes: strategyData.cooldown_minutes ?? 5,
                  oncePerSession: strategyData.once_per_session,
                  lastFiredAt: strategyData.last_fired_at,
                  isCoreLibrary: strategyData.is_core_library,
                  enabled: strategyData.enabled,
                };

                // Check if we should process this alert (rate limiting)
                const recentSignals = Array.from(signalsBySymbol.values())
                  .flatMap(s => s.signals);
                
                if (shouldProcessAlert(enrichedSignal, strategy, recentSignals)) {
                  // Build alert processor context with wrapped callbacks
                  const context: AlertProcessorContext = {
                    flashWatchlist: onFlashWatchlist,
                    showNowPlaying: onShowNowPlaying ? (symbol, signal, strategy) => {
                      onShowNowPlaying(symbol, { ...signal, strategy_name: strategyData.name, strategy_slug: strategyData.slug } as EnrichedStrategySignal, strategy);
                    } : undefined,
                    openTradePlanner: onOpenTradePlanner ? (symbol, signal, strategy) => {
                      onOpenTradePlanner(symbol, { ...signal, strategy_name: strategyData.name, strategy_slug: strategyData.slug } as EnrichedStrategySignal, strategy);
                    } : undefined,
                    discordChannels,
                    userId: user.id,
                  };

                  // Process alert behaviors
                  const result = await processAlertBehavior(enrichedSignal, strategy, context);
                  
                  if (result.errors.length > 0) {
                    console.warn('[useStrategyScanner] Alert processing had errors:', result.errors);
                  }
                }
              } catch (err) {
                console.error('[useStrategyScanner] Error processing alert behavior:', err);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('[useStrategyScanner] 📡 Realtime subscription active');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[useStrategyScanner] ❌ Realtime channel error:', err);

            // Attempt reconnection after 5 seconds
            setTimeout(() => {
              console.log('[useStrategyScanner] 🔄 Attempting to reconnect realtime subscription...');

              if (realtimeChannelRef.current) {
                realtimeChannelRef.current.unsubscribe();
              }

              // Re-trigger subscription by updating a local state
              // This is a simplified approach - in production, you might want a more robust retry mechanism
            }, 5000);
          } else if (status === 'TIMED_OUT') {
            console.error('[useStrategyScanner] ⏱️ Realtime subscription timed out');

            // Attempt reconnection
            setTimeout(() => {
              console.log('[useStrategyScanner] 🔄 Reconnecting after timeout...');

              if (realtimeChannelRef.current) {
                realtimeChannelRef.current.unsubscribe();
              }
            }, 3000);
          } else if (status === 'CLOSED') {
            console.log('[useStrategyScanner] 📴 Realtime subscription closed');
          } else {
            console.log(`[useStrategyScanner] Realtime subscription status: ${status}`);
          }
        });

      realtimeChannelRef.current = channel;
    })();

    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
        console.log('[useStrategyScanner] 📴 Realtime subscription cleaned up');
      }
    };
  }, [enabled]);

  /**
   * Initial load: fetch strategies and existing signals
   */
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const strategyList = await fetchEnabledStrategies();
      setStrategies(strategyList);
      await fetchSignalsForSymbols(symbols);
      setLoading(false);
    })();
  }, [enabled, symbols.join(','), fetchEnabledStrategies, fetchSignalsForSymbols]);

  /**
   * Periodic scanning
   */
  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    // Initial scan after strategies load
    if (strategies.length > 0) {
      scanAll();
    }

    // Setup interval for periodic scanning
    const intervalId = setInterval(() => {
      scanAll();
    }, scanInterval);

    // Store in ref for manual cancellation
    scanTimerRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      console.log('[useStrategyScanner] 🛑 Cleared scan interval');
    };
    // Only re-run when enabled, symbols list, or interval changes
    // Do NOT include scanAll or strategies.length to avoid stacking intervals!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbols.join(','), scanInterval]);

  /**
   * Manual trigger for scanning
   */
  const triggerScan = useCallback(() => {
    scanAll();
  }, [scanAll]);

  /**
   * Dismiss a signal (mark as DISMISSED)
   */
  const dismissSignal = useCallback(async (signalId: string) => {
    try {
      const supabase = supabaseRef.current;
      const { error: updateError } = await supabase
        .from('strategy_signals')
        .update({ status: 'DISMISSED' })
        .eq('id', signalId);

      if (updateError) {
        console.error('[useStrategyScanner] Error dismissing signal:', updateError);
        return;
      }

      // Remove from local state
      setSignalsBySymbol(prev => {
        const next = new Map(prev);
        for (const [symbol, symbolSignals] of next.entries()) {
          const filtered = symbolSignals.signals.filter(s => s.id !== signalId);
          if (filtered.length !== symbolSignals.signals.length) {
            const confidences = filtered.map(s => s.confidence || 0);
            const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
            const setupCount = filtered.filter(s => (s.confidence || 0) >= 50 && (s.confidence || 0) < 80).length;
            const readyCount = filtered.filter(s => (s.confidence || 0) >= 80).length;

            next.set(symbol, {
              symbol,
              signals: filtered,
              latestConfidence: maxConfidence,
              setupCount,
              readyCount,
              lastUpdate: Date.now(),
            });
          }
        }
        return next;
      });

      console.log(`[useStrategyScanner] Signal ${signalId} dismissed`);
    } catch (err: any) {
      console.error('[useStrategyScanner] Exception dismissing signal:', err);
    }
  }, []);

  return {
    signalsBySymbol,
    strategies,
    loading,
    scanning,
    error,
    triggerScan,
    dismissSignal,
  };
}
