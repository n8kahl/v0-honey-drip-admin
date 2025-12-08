/**
 * Historical Warehouse Data Hooks
 *
 * Query helpers for accessing Greeks, flow, gamma, and IV data
 * from the historical data warehouse.
 */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// ============================================================================
// Smart Money Flow
// ============================================================================

export interface FlowSummary {
  symbol: string;
  total_sweeps: number;
  bullish_sweeps: number;
  bearish_sweeps: number;
  total_premium: number;
  smart_money_bias: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export function useFlowSummary(symbol: string, minutes: number = 60) {
  const [data, setData] = useState<FlowSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: result, error } = await supabase.rpc("get_flow_summary", {
          p_symbol: symbol,
          p_minutes: minutes,
        });

        if (!mounted) return;

        if (error || !result || result.length === 0) {
          setData(null);
        } else {
          setData(result[0]);
        }
      } catch (error) {
        console.warn(`[v0] Flow query error for ${symbol}:`, error);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol, minutes]);

  return { data, isLoading };
}

// ============================================================================
// Gamma Exposure
// ============================================================================

export interface GammaExposure {
  symbol: string;
  dealer_positioning: "SHORT_GAMMA" | "LONG_GAMMA" | "NEUTRAL";
  gamma_wall_resistance: number | null;
  gamma_wall_support: number | null;
  expected_behavior: "PINNING" | "TRENDING" | "VOLATILE" | "RANGE_BOUND";
}

export function useGammaExposure(symbol: string) {
  const [data, setData] = useState<GammaExposure | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: result, error } = await supabase.rpc("get_latest_gamma_exposure", {
          p_symbol: symbol,
        });

        if (!mounted) return;

        if (error || !result || result.length === 0) {
          setData(null);
        } else {
          setData(result[0]);
        }
      } catch (error) {
        console.warn(`[v0] Gamma query error for ${symbol}:`, error);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, isLoading };
}

// ============================================================================
// IV Percentile
// ============================================================================

export interface IVPercentile {
  symbol: string;
  current_iv: number;
  iv_rank: number;
  iv_percentile: number;
  iv_regime: "EXTREMELY_LOW" | "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREMELY_HIGH";
}

export function useIVPercentile(symbol: string) {
  const [data, setData] = useState<IVPercentile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: result, error } = await supabase.rpc("get_latest_iv_percentile", {
          p_symbol: symbol,
        });

        if (!mounted) return;

        if (error || !result || result.length === 0) {
          setData(null);
        } else {
          setData(result[0]);
        }
      } catch (error) {
        console.warn(`[v0] IV query error for ${symbol}:`, error);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, isLoading };
}

// ============================================================================
// Combined Warehouse Data
// ============================================================================

export interface WarehouseData {
  flow: FlowSummary | null;
  gamma: GammaExposure | null;
  iv: IVPercentile | null;
  isLoading: boolean;
  hasData: boolean;
}

/**
 * Convenience hook to fetch all warehouse data for a symbol
 */
export function useWarehouseData(symbol: string): WarehouseData {
  const { data: flow, isLoading: flowLoading } = useFlowSummary(symbol);
  const { data: gamma, isLoading: gammaLoading } = useGammaExposure(symbol);
  const { data: iv, isLoading: ivLoading } = useIVPercentile(symbol);

  return {
    flow,
    gamma,
    iv,
    isLoading: flowLoading || gammaLoading || ivLoading,
    hasData: !!(flow || gamma || iv),
  };
}

// ============================================================================
// Scanner Health Check
// ============================================================================

export interface ScannerHealth {
  id: string;
  last_scan: string;
  signals_detected: number;
  status: string;
  isHealthy: boolean;
  ageMinutes: number;
}

export function useScannerHealth() {
  const [data, setData] = useState<ScannerHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: result, error } = await supabase
          .from("scanner_heartbeat")
          .select("*")
          .eq("id", "composite_scanner")
          .maybeSingle();

        if (!mounted) return;

        if (error || !result) {
          setData(null);
        } else {
          const lastScan = new Date(result.last_scan).getTime();
          const ageMinutes = (Date.now() - lastScan) / 60000;
          const isHealthy = ageMinutes < 2;

          setData({
            id: result.id,
            last_scan: result.last_scan,
            signals_detected: result.signals_detected,
            status: result.status,
            isHealthy,
            ageMinutes,
          });
        }
      } catch (error) {
        console.warn("[v0] Scanner health query error:", error);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { data, isLoading };
}

// ============================================================================
// Market Regime
// ============================================================================

export interface MarketRegime {
  date: string;
  vix_level: number;
  vix_regime: string;
  breadth_regime: string;
  market_regime: string;
  confidence_score: number;
}

export function useMarketRegime() {
  const [data, setData] = useState<MarketRegime | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: result, error } = await supabase.rpc("get_current_market_regime");

        if (!mounted) return;

        if (error || !result || result.length === 0) {
          setData(null);
        } else {
          setData(result[0]);
        }
      } catch (error) {
        console.warn("[v0] Market regime query error:", error);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000); // Refresh every hour

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { data, isLoading };
}
