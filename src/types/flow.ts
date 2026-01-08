/**
 * Options Flow Data Interfaces
 * Unified types for live streaming and historical analysis
 */

export type FlowSide = "BULLISH" | "BEARISH" | "NEUTRAL";
export type FlowClassification = "SWEEP" | "BLOCK" | "SPLIT" | "UNUSUAL";

export interface OptionsFlowRecord {
  id: string;
  symbol: string;
  timestamp: number;
  strike: number;
  expiration: string; // YYYY-MM-DD
  side: FlowSide;
  type: "CALL" | "PUT";
  classification: FlowClassification;
  premium: number;
  quantity: number;
  price: number;
  bid: number;
  ask: number;
  underlyingPrice: number;
  iv?: number;
  openInterest?: number;
  volume?: number;
}

export interface FlowSummary {
  symbol: string;
  periodMinutes: number;
  totalPremium: number;
  bullishPremium: number;
  bearishPremium: number;
  sweepCount: number;
  blockCount: number;
  bias: FlowSide;
  institutionalConviction: number; // 0-100 score based on premium concentration and sweep speed
}
