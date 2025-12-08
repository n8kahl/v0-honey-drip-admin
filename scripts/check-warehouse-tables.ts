/**
 * Check if warehouse tables exist and have data
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[v0] ❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  console.log("[v0] Checking warehouse tables...\n");

  const tables = [
    "historical_greeks",
    "gamma_exposure_snapshots",
    "iv_percentile_cache",
    "options_flow_history",
    "market_regime_history",
  ];

  let allExist = true;

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`❌ ${table}: Not found`);
        allExist = false;
      } else {
        console.log(`✅ ${table}: ${count} rows`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: Error - ${err.message}`);
      allExist = false;
    }
  }

  console.log("\n" + "=".repeat(60));

  if (allExist) {
    console.log("✅ All warehouse tables exist!");
    console.log("\nNext steps:");
    console.log("1. Start gamma worker: pnpm run dev:gamma");
    console.log("2. Data will accumulate every 15 minutes during market hours");
    console.log("3. Check back in 7-30 days for meaningful metrics");
  } else {
    console.log("❌ Some tables are missing");
    console.log("\nRun this migration in Supabase SQL Editor:");
    console.log("scripts/012_add_historical_data_warehouse.sql");
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[v0] Error:", err);
    process.exit(1);
  });
