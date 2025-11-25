/**
 * Diagnostic script to check what's in historical_bars table
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  console.log("🔍 Checking historical_bars table...\n");

  // Get unique symbols
  const { data: symbols, error: symbolsError } = await supabase
    .from("historical_bars")
    .select("symbol")
    .order("symbol");

  if (symbolsError) {
    console.error("Error fetching symbols:", symbolsError);
    return;
  }

  const uniqueSymbols = [...new Set(symbols?.map((s) => s.symbol) || [])];
  console.log(`📊 Symbols in database: ${uniqueSymbols.join(", ")}`);
  console.log(`   Total unique symbols: ${uniqueSymbols.length}\n`);

  // Check each symbol
  for (const symbol of uniqueSymbols) {
    console.log(`\n📈 ${symbol}:`);

    // Get timeframes for this symbol
    const { data: timeframes } = await supabase
      .from("historical_bars")
      .select("timeframe")
      .eq("symbol", symbol);

    const uniqueTimeframes = [...new Set(timeframes?.map((t) => t.timeframe) || [])];
    console.log(`   Timeframes: ${uniqueTimeframes.join(", ")}`);

    // Get bar count per timeframe
    for (const tf of uniqueTimeframes) {
      const { count } = await supabase
        .from("historical_bars")
        .select("*", { count: "exact", head: true })
        .eq("symbol", symbol)
        .eq("timeframe", tf);

      // Get date range
      const { data: range } = await supabase
        .from("historical_bars")
        .select("timestamp")
        .eq("symbol", symbol)
        .eq("timeframe", tf)
        .order("timestamp", { ascending: true })
        .limit(1);

      const { data: rangeEnd } = await supabase
        .from("historical_bars")
        .select("timestamp")
        .eq("symbol", symbol)
        .eq("timeframe", tf)
        .order("timestamp", { ascending: false })
        .limit(1);

      const startDate = range?.[0]
        ? new Date(range[0].timestamp).toISOString().split("T")[0]
        : "N/A";
      const endDate = rangeEnd?.[0]
        ? new Date(rangeEnd[0].timestamp).toISOString().split("T")[0]
        : "N/A";

      console.log(`      ${tf}: ${count} bars (${startDate} to ${endDate})`);
    }
  }

  // Check for BacktestEngine's expected symbols
  console.log("\n\n🎯 BacktestEngine Requirements:");
  const expectedSymbols = ["SPY", "SPX", "NDX"];
  const expectedTimeframe = "15m";

  for (const symbol of expectedSymbols) {
    const { count } = await supabase
      .from("historical_bars")
      .select("*", { count: "exact", head: true })
      .eq("symbol", symbol)
      .eq("timeframe", expectedTimeframe);

    const status = (count || 0) > 0 ? "✅" : "❌";
    console.log(`   ${status} ${symbol} ${expectedTimeframe}: ${count || 0} bars`);
  }

  // Get total row count
  const { count: totalCount } = await supabase
    .from("historical_bars")
    .select("*", { count: "exact", head: true });

  console.log(`\n💾 Total rows in database: ${totalCount?.toLocaleString()}\n`);
}

checkData().then(() => {
  console.log("✅ Check complete");
  process.exit(0);
});
