
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Bar {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;
    trades?: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "60m" | "1D";

/**
 * Multi-Timeframe Data Loader
 *
 * Responsibilities:
 * 1. Fetching historical data for multiple timeframes efficiently
 * 2. Caching data in-memory to speed up optimizer runs
 * 3. synchronizing data access for the backtest engine
 */
export class MultiTimeframeLoader {
    private supabase: SupabaseClient;
    // Cache structure: Symbol -> Timeframe -> Bars[]
    private cache: Map<string, Map<Timeframe, Bar[]>> = new Map();

    constructor(supabaseUrl?: string, supabaseKey?: string) {
        const url = supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key =
            supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error(
                "MultiTimeframeLoader: Missing Supabase credentials. Ensure .env is loaded."
            );
        }

        this.supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    /**
     * Load data for a symbol across multiple timeframes
     */
    async load(
        symbol: string,
        startDate: string,
        endDate: string,
        timeframes: Timeframe[]
    ): Promise<Map<Timeframe, Bar[]>> {
        const result = new Map<Timeframe, Bar[]>();
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).getTime();

        // Check cache first
        let missingTimeframes: Timeframe[] = [];

        if (!this.cache.has(symbol)) {
            this.cache.set(symbol, new Map());
        }

        const symbolCache = this.cache.get(symbol)!;

        for (const tf of timeframes) {
            if (symbolCache.has(tf)) {
                // We have cached data, but check coverage?
                // For simplicity in optimization loop, assume cache is sufficient if present
                // In production, might want to verify date range coverage
                console.log(`[MTFLoader] Cache hit for ${symbol} ${tf}`);
                result.set(tf, symbolCache.get(tf)!);
            } else {
                missingTimeframes.push(tf);
            }
        }

        if (missingTimeframes.length === 0) {
            return result;
        }

        // Fetch missing data
        console.log(
            `[MTFLoader] Fetching missing data for ${symbol}: ${missingTimeframes.join(", ")}`
        );

        // Parallel fetch for speed
        const fetchPromises = missingTimeframes.map((tf) =>
            this.fetchData(symbol, tf, startTs, endTs).then((bars) => {
                // Update cache
                symbolCache.set(tf, bars);
                result.set(tf, bars);
                return { tf, count: bars.length };
            })
        );

        await Promise.all(fetchPromises);

        return result;
    }

    /**
     * Clear cache (useful to free memory between different large batches)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Fetch data from DB (with fallback to be implemented if needed)
     */
    private async fetchData(
        symbol: string,
        timeframe: Timeframe,
        startTs: number,
        endTs: number
    ): Promise<Bar[]> {
        try {
            // 1. Try Database
            const { data, error } = await this.supabase
                .from("historical_bars")
                .select("*")
                .eq("symbol", symbol)
                .eq("timeframe", timeframe)
                .gte("timestamp", startTs)
                .lte("timestamp", endTs)
                .order("timestamp", { ascending: true });

            if (!error && data && data.length > 0) {
                // Map to Bar interface
                return data.map((d: any) => ({
                    timestamp: d.timestamp,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volume,
                    vwap: d.vwap,
                    trades: d.trades,
                }));
            }

            // 2. Fallback (Massive API) - Logic copied/simplified from BacktestEngine
            // For now, returning empty array if DB misses to fail fast,
            // expecting user to have pre-warmed DB or we can add API fallback here later.
            console.warn(`[MTFLoader] No data found in DB for ${symbol} ${timeframe}`);
            return [];
        } catch (e) {
            console.error(`[MTFLoader] Error fetching ${symbol} ${timeframe}:`, e);
            return [];
        }
    }

    /**
     * Fetch historical flow data (Sweeps/Blocks)
     */
    async loadFlow(symbol: string, startDate: string, endDate: string): Promise<any[]> {
        try {
            const startTs = new Date(startDate).getTime();
            const endTs = new Date(endDate).getTime();

            // Check cache (memory optimization: implementing basic caching for flow too could be good)
            // For now, direct fetch as flow data volume is manageable per symbol
            const { data, error } = await this.supabase
                .from("options_flow_history")
                .select("*")
                .eq("symbol", symbol)
                .gte("timestamp", startTs)
                .lte("timestamp", endTs)
                .order("timestamp", { ascending: true });

            if (error) {
                console.error(`[MTFLoader] Error fetching flow for ${symbol}:`, error.message);
                return [];
            }

            return data || [];
        } catch (e) {
            console.error(`[MTFLoader] Error loading flow for ${symbol}:`, e);
            return [];
        }
    }
}
