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

    // Extract underlying price from first contract's underlying_asset (Massive.com API format)
    // Per Massive docs: underlying_asset object contains market data for the underlying
    const firstContract = chain.contracts[0];
    
    // Try multiple fields based on Massive API response structure
    const underlyingPrice =
      firstContract?.underlying_asset?.price ??
      firstContract?.underlying_asset?.last_updated_price ??
      firstContract?.underlying_asset?.last?.price ??
      firstContract?.underlying_asset?.prevDay?.c ??
      null;

    if (underlyingPrice === null) {
      console.warn(`[v0] Could not extract underlying price for ${symbol}. First contract underlying_asset:`, 
        JSON.stringify(firstContract?.underlying_asset, null, 2));
      return {
        success: false,
        symbol,
        contractsProcessed: 0,
        contractsStored: 0,
        timestamp,
        error: `Could not determine underlying price from options chain. Checked fields: underlying_asset.price, .last_updated_price, .last.price, .prevDay.c`,
      };
    }
    
    console.log(`[v0] ✅ Extracted underlying price for ${symbol}: $${underlyingPrice}`);

    // Map contracts to Greeks records (filter out invalid contracts)
    // Massive.com API structure: contract.details contains ticker, strike_price, expiration_date, contract_type
    const records: GreeksRecord[] = chain.contracts
      .filter((contract: any) => {
        // Extract fields from nested details object (Massive.com API format)
        const details = contract.details || {};
        const ticker = details.ticker || contract.ticker;
        const strike = details.strike_price ?? contract.strike_price ?? contract.strike;
        const expiration =
          details.expiration_date || contract.expiration_date || contract.expiration;
        const contractType =
          details.contract_type || contract.contract_type || contract.option_type;

        // Must have required fields
        return ticker && strike !== undefined && expiration && contractType;
      })
      .map((contract: any) => {
        // Extract fields from nested details object (Massive.com API format)
        const details = contract.details || {};
        const ticker = details.ticker || contract.ticker;
        const strike = details.strike_price ?? contract.strike_price ?? contract.strike;
        const expiration =
          details.expiration_date || contract.expiration_date || contract.expiration;
        const contractType =
          details.contract_type || contract.contract_type || contract.option_type || "";

        // Extract quote data from nested last_quote object
        const lastQuote = contract.last_quote || {};
        const bid = lastQuote.bid ?? lastQuote.bp ?? contract.bid ?? null;
        const ask = lastQuote.ask ?? lastQuote.ap ?? contract.ask ?? null;
        const midPrice = bid && ask ? (bid + ask) / 2 : null;

        // Extract trade data from nested last_trade object
        const lastTrade = contract.last_trade || {};
        const last = lastTrade.price ?? lastTrade.p ?? contract.last ?? null;

        // Normalize contract type to call/put
        const optionType = contractType.toString().toUpperCase().startsWith("C") ? "call" : "put";

        return {
          symbol,
          contract_ticker: ticker,
          strike: Number(strike) || 0,
          expiration,
          timestamp,
          delta: contract.greeks?.delta ?? null,
          gamma: contract.greeks?.gamma ?? null,
          theta: contract.greeks?.theta ?? null,
          vega: contract.greeks?.vega ?? null,
          rho: contract.greeks?.rho ?? null,
          implied_volatility: contract.implied_volatility ?? null,
          iv_rank: null, // Calculated separately
          iv_percentile: null, // Calculated separately
          underlying_price: underlyingPrice,
          dte: calculateDTE(new Date(expiration)),
          option_type: optionType as "call" | "put",
          bid,
          ask,
          last,
          mid_price: midPrice,
          volume: contract.volume ?? contract.day?.volume ?? null,
          open_interest: contract.open_interest ?? null,
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
