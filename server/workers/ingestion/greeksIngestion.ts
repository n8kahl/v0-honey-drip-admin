/**
 * Greeks Ingestion Module
 * Fetches options chain from Massive.com and stores Greeks time-series data
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOptionChain } from "../../massive/client.js";
import { calculateDTE } from "../../lib/marketCalendar.js";

export interface GreeksIngestionResult {
  success: boolean;
  symbol: string;
  contractsProcessed: number;
  contractsStored: number;
  timestamp: number;
  error?: string;
}

interface GreeksRecord {
  symbol: string;
  contract_ticker: string;
  strike: number;
  expiration: string;
  timestamp: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  implied_volatility: number | null;
  iv_rank: number | null;
  iv_percentile: number | null;
  underlying_price: number;
  dte: number;
  option_type: "call" | "put";
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid_price: number | null;
  volume: number | null;
  open_interest: number | null;
}

/**
 * Ingest historical Greeks for a symbol
 */
export async function ingestHistoricalGreeks(
  supabase: SupabaseClient,
  symbol: string
): Promise<GreeksIngestionResult> {
  const timestamp = Date.now();

  try {
    // Fetch options chain from Massive.com
    const chain = await getOptionChain(symbol);

    if (!chain || !chain.contracts || chain.contracts.length === 0) {
      return {
        success: false,
        symbol,
        contractsProcessed: 0,
        contractsStored: 0,
        timestamp,
        error: "No options chain data available",
      };
    }

    // Map contracts to Greeks records
    const records: GreeksRecord[] = chain.contracts.map((contract: any) => {
      const bid = contract.bid || null;
      const ask = contract.ask || null;
      const midPrice = bid && ask ? (bid + ask) / 2 : null;

      return {
        symbol,
        contract_ticker: contract.ticker,
        strike: contract.strike,
        expiration: contract.expiration,
        timestamp,
        delta: contract.greeks?.delta || null,
        gamma: contract.greeks?.gamma || null,
        theta: contract.greeks?.theta || null,
        vega: contract.greeks?.vega || null,
        rho: contract.greeks?.rho || null,
        implied_volatility: contract.implied_volatility || null,
        iv_rank: null, // Calculated separately
        iv_percentile: null, // Calculated separately
        underlying_price: chain.underlying_price,
        dte: calculateDTE(new Date(contract.expiration)),
        option_type: contract.option_type.toLowerCase() as "call" | "put",
        bid,
        ask,
        last: contract.last || null,
        mid_price: midPrice,
        volume: contract.volume || null,
        open_interest: contract.open_interest || null,
      };
    });

    // Store in database (upsert to handle duplicates)
    const { error } = await supabase.from("historical_greeks").upsert(records as any, {
      onConflict: "contract_ticker,timestamp",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`[GreeksIngestion] Database error for ${symbol}:`, error);
      return {
        success: false,
        symbol,
        contractsProcessed: records.length,
        contractsStored: 0,
        timestamp,
        error: error.message,
      };
    }

    return {
      success: true,
      symbol,
      contractsProcessed: records.length,
      contractsStored: records.length,
      timestamp,
    };
  } catch (error) {
    console.error(`[GreeksIngestion] Error for ${symbol}:`, error);
    return {
      success: false,
      symbol,
      contractsProcessed: 0,
      contractsStored: 0,
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
