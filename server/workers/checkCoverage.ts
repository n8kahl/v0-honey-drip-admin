import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

async function checkCoverage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("historical_bars")
    .select("symbol, timeframe")
    .order("symbol");

  if (error) {
    console.error(error);
    return;
  }

  const coverage: Record<string, Set<string>> = {};
  for (const row of data) {
    if (!coverage[row.symbol]) coverage[row.symbol] = new Set();
    coverage[row.symbol].add(row.timeframe);
  }

  console.log("DATABASE COVERAGE BY SYMBOL/TIMEFRAME:");
  for (const [symbol, tfs] of Object.entries(coverage)) {
    console.log(`${symbol}: ${Array.from(tfs).join(", ")}`);
  }
}

checkCoverage();
