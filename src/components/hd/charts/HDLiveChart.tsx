import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  LineData,
} from "lightweight-charts";
import { massive } from "../../../lib/massive";
import {
  MassiveError,
  getIndexBars,
  getOptionBars,
  getTradierStockBars,
} from "../../../lib/massive/proxy";
import {
  calculateEMA,
  calculateVWAP,
  calculateBollingerBands,
  Bar,
  IndicatorConfig,
} from "../../../lib/indicators";
import { Wifi, WifiOff, Activity, ChevronDown } from "lucide-react";
import { ChartLevel } from "../../../types/tradeLevels";
import {
  getSessionMarkersForBars,
  calculateKeyLevels,
  detectOrderFlowClusters,
  calculateVolumeProfile,
  getClusterColor,
} from "../../../lib/chartEnhancements";

const formatIsoDate = (date: Date) => date.toISOString().split("T")[0];
const getMostRecentTradingDay = (reference: Date, holidays: Set<string>) => {
  const day = new Date(reference);
  day.setHours(0, 0, 0, 0);
  while (day.getDay() === 0 || day.getDay() === 6 || holidays.has(formatIsoDate(day))) {
    day.setDate(day.getDate() - 1);
  }
  return day;
};

// Validate that a bar has all required OHLC values as non-null finite numbers
const isValidBar = (bar: Partial<Bar>): bar is Bar => {
  return (
    typeof bar.time === "number" &&
    bar.time > 0 &&
    !isNaN(bar.time) &&
    isFinite(bar.time) &&
    typeof bar.open === "number" &&
    !isNaN(bar.open) &&
    isFinite(bar.open) &&
    typeof bar.high === "number" &&
    !isNaN(bar.high) &&
    isFinite(bar.high) &&
    typeof bar.low === "number" &&
    !isNaN(bar.low) &&
    isFinite(bar.low) &&
    typeof bar.close === "number" &&
    !isNaN(bar.close) &&
    isFinite(bar.close)
  );
};

const INDEX_TICKERS = new Set(["SPX", "NDX", "VIX", "RUT"]);
type TfKey = "1" | "5" | "15" | "60" | "1D";

const TIMEFRAME_LOOKBACK_DAYS: Record<TfKey, number> = {
  "1": 2,
  "5": 5,
  "15": 10,
  "60": 30,
  "1D": 365,
};

type IndicatorState = {
  ema9: boolean;
  ema21: boolean;
  vwap: boolean;
  // TODO: rsi: boolean; // Requires secondary pane; defer for focused follow-up
  bb: boolean;
};

export interface TradeEvent {
  type: "load" | "enter" | "trim" | "update" | "exit";
  timestamp: number;
  price: number;
  label: string;
  color?: string;
}

interface HDLiveChartProps {
  ticker: string;
  timeframe?: "1" | "5" | "15" | "60"; // minutes (legacy prop)
  initialTimeframe?: TfKey; // preferred; supports '1D'
  indicators?: IndicatorConfig;
  events?: TradeEvent[];
  levels?: ChartLevel[]; // Added levels prop
  marketHours?: { open: string; close: string; preMarket: string; afterHours: string };
  orbWindow?: number;
  height?: number;
  className?: string;
  showControls?: boolean; // timeframe + indicators toggles
  showHeader?: boolean; // whether to show header at all (default true)
  onTimeframeChange?: (tf: TfKey) => void;
  stickyHeader?: boolean;
}

export function HDLiveChart({
  ticker,
  timeframe = "1",
  initialTimeframe,
  indicators = { ema: { periods: [8, 21, 50, 200] }, vwap: { enabled: true, bands: false } },
  events = [],
  levels = [], // Added default empty array for levels
  marketHours = { open: "09:30", close: "16:00", preMarket: "04:00", afterHours: "20:00" },
  orbWindow = 5,
  height = 400,
  className = "",
  showControls = true,
  showHeader = true,
  onTimeframeChange,
  stickyHeader = false,
}: HDLiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaSeriesRefs = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerRefs = useRef<{
    upper: ISeriesApi<"Line">;
    middle: ISeriesApi<"Line">;
    lower: ISeriesApi<"Line">;
  } | null>(null);
  const levelSeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  // Zoom preservation on refresh
  const zoomStateRef = useRef<{ from: number; to: number } | null>(null);

  // Minute boundary detection for smart refresh
  const lastMinuteBoundaryRef = useRef<number>(Math.floor(Date.now() / 60000));
  const minuteRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [bars, setBars] = useState<Bar[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [dataSource, setDataSource] = useState<"websocket" | "rest">("rest");
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [fps, setFps] = useState<number>(60);
  const [ready, setReady] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const waitingForChartRef = useRef(false);
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const holidaysSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const [currentTf, setCurrentTf] = useState<TfKey>(() => {
    // If initialTimeframe is explicitly provided, use it (takes precedence)
    if (initialTimeframe) {
      return initialTimeframe;
    }
    // Otherwise, try to load from localStorage
    try {
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem("hdchart.timeframe") : null;
      if (stored === "1" || stored === "5" || stored === "15" || stored === "60" || stored === "1D")
        return stored;
    } catch {
      // localStorage not available or parse failed, use fallback
    }
    return ["1", "5", "15", "60"].includes(timeframe) ? (timeframe as TfKey) : "1";
  });
  const timeframeRef = useRef<TfKey>(currentTf);
  const tickerRef = useRef<string>(ticker);

  // Timeframe-specific initial zoom levels
  const lastNBarsAuto = currentTf === "1" ? 30 : currentTf === "5" ? 20 : 100;

  const [opacity, setOpacity] = useState<number>(1);

  const [indState, setIndState] = useState<IndicatorState>(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem("hdchart.indicators") : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ema9: Boolean(parsed.ema9),
          ema21: Boolean(parsed.ema21),
          vwap: Boolean(parsed.vwap),
          bb: Boolean(parsed.bb),
        } as IndicatorState;
      }
    } catch {
      // localStorage not available or JSON parse failed, use defaults
    }
    return {
      ema9: indicators?.ema?.periods?.includes(9) ?? true,
      ema21: indicators?.ema?.periods?.includes(21) ?? true,
      vwap: Boolean(indicators?.vwap?.enabled ?? true),
      bb: Boolean(indicators?.bollinger),
    } as IndicatorState;
  });

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem("hdchart.headerCollapsed")
          : null;
      return stored === "true";
    } catch {
      return false;
    }
  });

  const lastRenderTimeRef = useRef<number>(0);
  const barsCacheRef = useRef<Map<string, Bar[]>>(new Map());
  const inflightFetchesRef = useRef<Map<string, Promise<Bar[]>>>(new Map());
  const hasAutoFitRef = useRef<boolean>(false);
  const failedFetchesRef = useRef<Map<string, number>>(new Map()); // Track failed fetches to prevent infinite retries

  useEffect(() => {
    if (bars.length > 0 && !ready) {
      setReady(true);
    }
  }, [bars.length, ready]);

  const ensurePriceSeries = useCallback(() => {
    if (!chartReady || !chartRef.current) return null;
    // Series is created during chart initialization, just return it
    return candleSeriesRef.current;
  }, [chartReady]);

  useEffect(() => {
    // Market holidays endpoint is unreliable; skip it entirely. Charts render fine without explicit gaps.
    console.debug("[HDLiveChart] Skipping market holidays fetch (endpoint unreliable)");
    setHolidayDates([]);
  }, []);

  // Subtle fade transition on ticker/timeframe changes
  useEffect(() => {
    setOpacity(0);
    const id = setTimeout(() => setOpacity(1), 160);
    return () => clearTimeout(id);
  }, [ticker, currentTf]);

  // Reset auto-fit flag when ticker/timeframe changes
  useEffect(() => {
    hasAutoFitRef.current = false;
  }, [ticker, currentTf]);

  const loadHistoricalBars = useCallback(async () => {
    console.log(
      `[HDLiveChart] loadHistoricalBars called for ticker=${ticker}, timeframe=${currentTf}`
    );

    if (rateLimited) {
      console.warn("[HDLiveChart] Skipping historical fetch while rate limited:", rateLimitMessage);
      return;
    }

    const isOption = ticker.startsWith("O:");
    const isIndex = ticker.startsWith("I:") || INDEX_TICKERS.has(ticker);
    const symbolParam = isIndex ? (ticker.startsWith("I:") ? ticker : `I:${ticker}`) : ticker;
    console.log(
      `[HDLiveChart] Symbol type - isOption: ${isOption}, isIndex: ${isIndex}, symbolParam: ${symbolParam}`
    );
    const useDay = currentTf === "1D";
    const multiplier = useDay ? 1 : Number(currentTf) || 1;
    const timespan = useDay ? "day" : "minute";
    const lookbackDays = TIMEFRAME_LOOKBACK_DAYS[currentTf] ?? 5;
    const lastTradingDay = getMostRecentTradingDay(new Date(), holidaysSet);
    const toDate = formatIsoDate(lastTradingDay);
    const fromDate = formatIsoDate(
      new Date(lastTradingDay.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
    );
    const cacheKey = `${symbolParam}:${currentTf}:${fromDate}:${toDate}`;

    // Check if this fetch has failed recently (within 5 minutes)
    const lastFailedTime = failedFetchesRef.current.get(cacheKey);
    if (lastFailedTime && Date.now() - lastFailedTime < 300000) {
      console.warn(
        `[HDLiveChart] Skipping fetch for ${ticker} - failed recently (${Math.floor((Date.now() - lastFailedTime) / 1000)}s ago)`
      );
      return;
    }

    if (barsCacheRef.current.has(cacheKey)) {
      const cachedBars = barsCacheRef.current.get(cacheKey)!;
      // Filter cached bars to ensure they're valid (cache might have old data with nulls)
      const validCachedBars = cachedBars.filter((bar) => isValidBar(bar));

      if (validCachedBars.length !== cachedBars.length) {
        console.warn(
          `[HDLiveChart] Filtered ${cachedBars.length - validCachedBars.length} invalid bars from cache for ${ticker}`
        );
        // Update cache with filtered data
        barsCacheRef.current.set(cacheKey, validCachedBars);
      }

      setBars(validCachedBars);
      setDataSource("rest");
      return;
    }

    if (inflightFetchesRef.current.has(cacheKey)) {
      try {
        const cached = await inflightFetchesRef.current.get(cacheKey)!;
        // Filter inflight fetch results to ensure they're valid
        const validCached = cached.filter((bar) => isValidBar(bar));
        if (validCached.length !== cached.length) {
          console.warn(
            `[HDLiveChart] Filtered ${cached.length - validCached.length} invalid bars from inflight fetch for ${ticker}`
          );
        }
        setBars(validCached);
        setDataSource("rest");
      } catch (error) {
        console.error("[HDLiveChart] Cached historical fetch failed:", error);
      }
      return;
    }

    // Stock symbols (not option, not index) use Tradier fallback
    const isStock = !isOption && !isIndex;

    const fetcher = isOption ? getOptionBars : isIndex ? getIndexBars : null; // Stock will use Tradier below
    const limit = Math.min(5000, Math.ceil((lookbackDays * 24 * 60) / multiplier) + 50);

    const fetchPromise = (async () => {
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          let response;

          // Use Tradier for stocks, Massive for indices/options
          if (isStock) {
            // Map timeframe to Tradier interval format
            const tradierInterval =
              currentTf === "1"
                ? "1min"
                : currentTf === "5"
                  ? "5min"
                  : currentTf === "15"
                    ? "15min"
                    : currentTf === "60"
                      ? "15min" // Tradier doesn't have 60min, use 15min
                      : "daily";

            response = await getTradierStockBars(ticker, tradierInterval, fromDate, toDate);
          } else {
            response = await fetcher!(symbolParam, multiplier, timespan, fromDate, toDate, limit);
          }

          const results = Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response)
              ? response
              : [];

          if (!Array.isArray(results) || results.length === 0) {
            // Mark as failed to prevent infinite retries
            failedFetchesRef.current.set(cacheKey, Date.now());
            console.warn(
              `[HDLiveChart] No historical data returned for ${ticker}, marking as failed`
            );
            throw new Error("No historical data returned");
          }

          const preFiltered = results.filter((r: any) => {
            // Pre-filter: ensure raw data has valid timestamp and OHLC values before mapping
            return (
              r.t != null &&
              typeof r.t === "number" &&
              !isNaN(r.t) &&
              r.t > 0 &&
              r.o != null &&
              typeof r.o === "number" &&
              !isNaN(r.o) &&
              r.h != null &&
              typeof r.h === "number" &&
              !isNaN(r.h) &&
              r.l != null &&
              typeof r.l === "number" &&
              !isNaN(r.l) &&
              r.c != null &&
              typeof r.c === "number" &&
              !isNaN(r.c)
            );
          });

          const mapped = preFiltered.map((r: any) => ({
            time: Math.floor(r.t / 1000), // API proxy returns milliseconds, convert to seconds for lightweight-charts
            open: r.o,
            high: r.h,
            low: r.l,
            close: r.c,
            volume: r.v,
            vwap: r.vw,
          }));

          const parsed: Bar[] = mapped.filter((bar: Bar) => {
            // Post-filter: double-check mapped data for lightweight-charts compatibility
            return (
              bar.time > 0 &&
              typeof bar.open === "number" &&
              !isNaN(bar.open) &&
              isFinite(bar.open) &&
              typeof bar.high === "number" &&
              !isNaN(bar.high) &&
              isFinite(bar.high) &&
              typeof bar.low === "number" &&
              !isNaN(bar.low) &&
              isFinite(bar.low) &&
              typeof bar.close === "number" &&
              !isNaN(bar.close) &&
              isFinite(bar.close)
            );
          });

          // Deduplicate by timestamp (lightweight-charts requires unique, ascending timestamps)
          const deduplicated: Bar[] = [];
          const seenTimes = new Set<number>();

          for (const bar of parsed) {
            if (!seenTimes.has(bar.time)) {
              seenTimes.add(bar.time);
              deduplicated.push(bar);
            }
          }

          if (deduplicated.length < parsed.length) {
            console.debug(
              `[HDLiveChart] Deduped ${parsed.length - deduplicated.length}/${parsed.length} bars for ${ticker}`
            );
          }

          // Sort by time ascending (required by lightweight-charts)
          deduplicated.sort((a, b) => a.time - b.time);

          barsCacheRef.current.set(cacheKey, deduplicated);
          // Clear failed fetch marker on success
          failedFetchesRef.current.delete(cacheKey);
          return deduplicated;
        } catch (error: any) {
          if (error instanceof MassiveError && error.code === "RATE_LIMIT") {
            retries++;
            const backoffMs = Math.min(1000 * Math.pow(2, retries), 10000); // 2s, 4s, 8s cap at 10s
            console.warn(
              `[HDLiveChart] Rate limited (attempt ${retries}/${maxRetries}), retrying in ${backoffMs}ms...`
            );

            if (retries >= maxRetries) {
              setRateLimited(true);
              setRateLimitMessage(error.message);
              console.error("[HDLiveChart] Rate limit exceeded after retries, giving up");
              throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw error;
        }
      }
      throw new Error("Failed after max retries");
    })();

    inflightFetchesRef.current.set(cacheKey, fetchPromise);
    try {
      const parsedBars = await fetchPromise;
      // Ignore stale responses if inputs changed
      if (tickerRef.current !== ticker || timeframeRef.current !== currentTf) return;
      console.log(`[HDLiveChart] Successfully loaded ${parsedBars.length} bars for ${ticker}`);
      setBars(parsedBars);
      setRateLimited(false);
      setRateLimitMessage(null);
      setDataSource("rest");
    } catch (error) {
      // Mark as failed to prevent immediate retry
      failedFetchesRef.current.set(cacheKey, Date.now());
      if (!(error instanceof MassiveError && error.code === "RATE_LIMIT")) {
        console.error("[HDLiveChart] Failed to load historical bars:", error);
      }
    } finally {
      inflightFetchesRef.current.delete(cacheKey);
    }
  }, [ticker, currentTf, rateLimited, rateLimitMessage, holidaysSet]);

  // Cleanup minute refresh timeout on unmount
  useEffect(() => {
    return () => {
      if (minuteRefreshTimeoutRef.current) {
        clearTimeout(minuteRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Callback ref to initialize chart as soon as container is mounted
  const setChartContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      chartContainerRef.current = node;

      if (!node) {
        console.warn("[HDLiveChart] Chart container unmounted");
        return;
      }

      // Only initialize if we don't have a chart yet
      if (chartRef.current) {
        console.log("[HDLiveChart] Chart already exists, skipping initialization");
        return;
      }

      console.log("[HDLiveChart] Chart container mounted, initializing chart...");

      const chart = createChart(node, {
        width: node.clientWidth,
        height,
        layout: {
          background: { color: "#0a0a0a" },
          textColor: "#9CA3AF",
        },
        grid: {
          vertLines: { color: "#1F2937" },
          horzLines: { color: "#1F2937" },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: "#374151",
        },
        timeScale: {
          borderColor: "#374151",
          timeVisible: true,
          secondsVisible: false,
          // Enable natural interactions
          rightOffset: 0,
        },
      });

      // Do not abort on missing methods immediately; attempt to recover with retries.
      chartRef.current = chart;

      const createLineSeries = (opts: any, label?: string) => {
        if (!chartRef.current || typeof (chartRef.current as any).addLineSeries !== "function") {
          if (label) {
            console.warn(`[HDLiveChart] Line series API unavailable, skipping ${label} for now`);
          }
          return null;
        }
        return (chartRef.current as any).addLineSeries(opts);
      };

      // Create all series immediately - chart is synchronously ready
      waitingForChartRef.current = false;

      // Create candlestick series using v4-style API (v5 uses different API but v4 still works)
      try {
        const candleOptions = {
          upColor: "#16A34A",
          downColor: "#EF4444",
          borderUpColor: "#16A34A",
          borderDownColor: "#EF4444",
          wickUpColor: "#16A34A",
          wickDownColor: "#EF4444",
        };
        candleSeriesRef.current = (chartRef.current as any).addCandlestickSeries(candleOptions);
      } catch (err) {
        console.error("[HDLiveChart] Failed to create candlestick series:", err);
      }

      // Create volume histogram series for volume visualization
      try {
        const volumeOptions = {
          priceFormat: {
            type: "volume" as const,
          },
          priceScaleId: "",
          lastValueVisible: false,
          priceLineVisible: false,
        };
        volumeSeriesRef.current = (chartRef.current as any).addHistogramSeries(volumeOptions);
      } catch (err) {
        console.debug(
          "[HDLiveChart] Volume histogram series not available (paid tier may be required)"
        );
      }

      // Create EMA series
      if (indicators?.ema?.periods) {
        const colors = ["#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899"];
        indicators.ema.periods.forEach((period, i) => {
          const emaSeries = createLineSeries(
            {
              color: colors[i % colors.length],
              lineWidth: 1,
              title: `EMA${period}`,
            },
            `EMA${period}`
          );
          if (emaSeries) {
            emaSeriesRefs.current.set(period, emaSeries);
          }
        });
      }

      // Create VWAP series
      if (indicators?.vwap?.enabled) {
        const vwapSeries = createLineSeries(
          {
            color: "#10B981",
            lineWidth: 2,
            lineStyle: 2,
            title: "VWAP",
          },
          "VWAP"
        );
        if (vwapSeries) {
          vwapSeriesRef.current = vwapSeries;
        }
      }

      // Create Bollinger Bands
      if (indicators?.bollinger) {
        const upperSeries = createLineSeries(
          { color: "#6366F1", lineWidth: 1, title: "BB Upper" },
          "BB Upper"
        );
        const middleSeries = createLineSeries(
          { color: "#6366F1", lineWidth: 1, lineStyle: 2, title: "BB Middle" },
          "BB Middle"
        );
        const lowerSeries = createLineSeries(
          { color: "#6366F1", lineWidth: 1, title: "BB Lower" },
          "BB Lower"
        );
        if (upperSeries && middleSeries && lowerSeries) {
          bollingerRefs.current = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
        }
      }

      // No viewport subscription needed - let users control pan/zoom freely
      console.log("[HDLiveChart] Chart initialization complete, setting chartReady=true");
      setChartReady(true);
    },
    [height]
  ); // Only depend on height to avoid re-creating chart unnecessarily

  // Separate effect to handle resize
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup chart when ticker changes or component unmounts
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        console.log("[HDLiveChart] Cleaning up chart for ticker change");
        levelSeriesRefs.current.forEach((series) => {
          try {
            chartRef.current?.removeSeries(series);
          } catch (e) {
            // Series might already be removed
          }
        });
        levelSeriesRefs.current.clear();
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        emaSeriesRefs.current.clear();
        vwapSeriesRef.current = null;
        bollingerRefs.current = null;
        chartRef.current.remove();
        chartRef.current = null;
        setChartReady(false);
      }
    };
  }, [ticker]); // Cleanup when ticker changes

  useEffect(() => {
    // Reset auto-fit flag when ticker changes so new chart gets fitted
    hasAutoFitRef.current = false;
    tickerRef.current = ticker;
    loadHistoricalBars();
  }, [ticker, currentTf, loadHistoricalBars]); // Only reload when ticker or timeframe changes

  // Separate effect: ONLY set initial viewport once, never runs again
  useEffect(() => {
    if (!chartRef.current || !chartReady || hasAutoFitRef.current || bars.length === 0) return;

    // Safety check: ensure candleSeries exists and has data
    if (!candleSeriesRef.current) return;

    const ts = chartRef.current.timeScale();
    const barsToUse = bars.length;
    if (barsToUse > 1) {
      // Wait a tick to ensure chart data is loaded before setting viewport
      requestAnimationFrame(() => {
        if (!chartRef.current || hasAutoFitRef.current) return;

        try {
          // Initial view: show bars positioned at 75% from left (most recent at 3/4)
          const visibleBars = Math.min(lastNBarsAuto, barsToUse);
          const fromIdx = Math.max(0, barsToUse - visibleBars);
          const from = bars[fromIdx].time as number;

          // Position last bar at 75% by extending range to create empty space on right
          const totalRangeNeeded = visibleBars / 0.75;
          const extraBars = Math.ceil(totalRangeNeeded - visibleBars);

          // Calculate time per bar (average interval)
          const lastBar = bars[barsToUse - 1].time as number;
          const firstVisibleBar = bars[fromIdx].time as number;
          const timePerBar = visibleBars > 1 ? (lastBar - firstVisibleBar) / (visibleBars - 1) : 60;

          // Extend 'to' time to create empty space on the right
          const to = lastBar + extraBars * timePerBar;

          ts.setVisibleRange({ from: from as any, to: to as any });
          hasAutoFitRef.current = true;
        } catch (error) {
          console.error("[HDLiveChart] Error setting initial viewport:", error);
          // Don't set hasAutoFitRef so it can retry
        }
      });
    }
  }, [chartReady, bars.length]); // Only depends on chartReady and bars.length, NOT the bars array itself

  // Separate effect: Update chart data and indicators (NO viewport changes)
  useEffect(() => {
    console.log(
      `[HDLiveChart] Rendering effect triggered - chartReady: ${chartReady}, bars.length: ${bars.length}`
    );

    const priceSeries = ensurePriceSeries();
    if (!priceSeries) {
      if (!chartReady && !waitingForChartRef.current) {
        console.debug("[HDLiveChart] Waiting for chart API before creating series");
        waitingForChartRef.current = true;
      }
      console.warn("[HDLiveChart] No price series available, early return");
      return;
    }
    waitingForChartRef.current = false;

    if (bars.length === 0) {
      console.warn("[HDLiveChart] No bars to render, clearing chart");
      // Clear chart data when no bars available
      try {
        priceSeries.setData([]);
      } catch (e) {
        console.error("[HDLiveChart] Error clearing chart:", e);
      }
      return;
    }

    console.log(`[HDLiveChart] About to render ${bars.length} bars to chart`);

    const renderUpdate = () => {
      const now = performance.now();
      const delta = now - lastRenderTimeRef.current;

      // Calculate FPS (stored in ref to avoid re-render loop)
      if (delta > 0) {
        const currentFps = Math.round(1000 / delta);
        // Only update FPS state if it changed significantly (>5 fps difference)
        if (Math.abs(currentFps - fps) > 5) {
          setTimeout(() => setFps(currentFps), 0);
        }
      }

      // Always render all bars (remove FPS-based downsampling to avoid dependency)
      const barsToRender = bars;

      // Preserve zoom state before updating data
      const timeScale = chartRef.current?.timeScale();
      const previousZoomRange = timeScale?.getVisibleLogicalRange();

      // Update candlestick data - filter out any bars with null OHLC values as a final safety check
      const candleData: CandlestickData[] = barsToRender
        .filter((bar) => isValidBar(bar))
        .map((bar) => ({
          time: bar.time as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));

      if (candleData.length === 0) {
        console.warn("[HDLiveChart] All bars filtered out (invalid OHLC), cannot render");
        return;
      }

      priceSeries.setData(candleData);

      // Restore zoom state after updating data
      if (previousZoomRange && timeScale) {
        try {
          timeScale.setVisibleLogicalRange(previousZoomRange);
        } catch (e) {
          console.debug("[HDLiveChart] Could not restore zoom range:", e);
        }
      }

      // Update volume histogram
      if (volumeSeriesRef.current && barsToRender.length > 0) {
        const volumeData = barsToRender
          .filter(
            (bar) => bar.volume != null && typeof bar.volume === "number" && !isNaN(bar.volume)
          )
          .map((bar) => ({
            time: bar.time as Time,
            value: bar.volume as number,
            color: bar.close >= bar.open ? "rgba(22, 163, 74, 0.3)" : "rgba(239, 68, 68, 0.3)",
          }));

        if (volumeData.length > 0) {
          volumeSeriesRef.current.setData(volumeData);
        }
      }

      // Update indicators
      if (indicators?.ema?.periods) {
        const closes = barsToRender.map((b) => b.close);
        indicators.ema.periods.forEach((period) => {
          const emaValues = calculateEMA(closes, period);
          const emaData: LineData[] = emaValues
            .map((value, i) => ({
              time: barsToRender[i].time as Time,
              value: isNaN(value) ? null : value,
            }))
            .filter((d) => d.value !== null) as LineData[];

          // Respect indicator visibility
          const s = emaSeriesRefs.current.get(period);
          if (s) {
            const isOn = period === 9 ? indState.ema9 : period === 21 ? indState.ema21 : true;
            s.applyOptions({ visible: isOn });
            s.setData(emaData);
          }
        });
      }

      if (indState.vwap && vwapSeriesRef.current) {
        const vwapValues = calculateVWAP(barsToRender);
        const vwapData: LineData[] = vwapValues.map((value, i) => ({
          time: barsToRender[i].time as Time,
          value,
        }));
        vwapSeriesRef.current.setData(vwapData);
        vwapSeriesRef.current.applyOptions({ visible: indState.vwap });
      }

      if (indState.bb && indicators?.bollinger && bollingerRefs.current) {
        const closes = barsToRender.map((b) => b.close);
        const { upper, middle, lower } = calculateBollingerBands(
          closes,
          indicators.bollinger.period,
          indicators.bollinger.stdDev
        );

        const createBBData = (values: number[]): LineData[] =>
          values
            .map((value, i) => ({
              time: barsToRender[i].time as Time,
              value: isNaN(value) ? null : value,
            }))
            .filter((d) => d.value !== null) as LineData[];

        bollingerRefs.current.upper.setData(createBBData(upper));
        bollingerRefs.current.middle.setData(createBBData(middle));
        bollingerRefs.current.lower.setData(createBBData(lower));
        bollingerRefs.current.upper.applyOptions({ visible: indState.bb });
        bollingerRefs.current.middle.applyOptions({ visible: indState.bb });
        bollingerRefs.current.lower.applyOptions({ visible: indState.bb });
      }

      // Add trade event markers
      if (events.length > 0 && candleSeriesRef.current) {
        const markers = events.map((event) => ({
          time: Math.floor(event.timestamp / 1000) as Time,
          position:
            event.type === "enter" || event.type === "load"
              ? ("belowBar" as const)
              : ("aboveBar" as const),
          color: event.color || (event.type === "exit" ? "#EF4444" : "#16A34A"),
          shape: "circle" as const,
          text: event.label,
        }));
        priceSeries.setMarkers(markers);
      }

      // NO viewport changes here - viewport is set once in separate effect above

      lastRenderTimeRef.current = now;
    };

    renderUpdate();
  }, [bars, indicators, events, ensurePriceSeries, indState]);

  // Real-time WebSocket subscription for live aggregate updates (paid tier)
  useEffect(() => {
    const isOption = ticker.startsWith("O:");

    // Stream only for 1m; other timeframes use REST
    if (currentTf !== "1") {
      return () => {};
    }

    const unsubscribe = isOption
      ? massive.subscribeOptionAggregates([ticker], (message) => {
          // Skip updates when tab is hidden for battery efficiency
          if (document.hidden) return;

          if (message.type === "aggregate" && message.data.ticker === ticker) {
            const agg = message.data;
            const newBar: Partial<Bar> = {
              time: Math.floor(agg.timestamp / 1000000000), // Massive WebSocket returns nanoseconds, convert to seconds
              open: agg.open,
              high: agg.high,
              low: agg.low,
              close: agg.close,
              volume: agg.volume,
              vwap: agg.vwap,
            };

            // Validate bar has all required OHLC values before adding
            if (!isValidBar(newBar)) {
              console.warn(
                "[HDLiveChart] Skipping invalid bar from WebSocket (null OHLC values):",
                newBar
              );
              return;
            }

            setBars((prev) => {
              const updated = [...prev];
              const existingIndex = updated.findIndex((b) => b.time === newBar.time);
              if (existingIndex >= 0) {
                // Update existing bar
                updated[existingIndex] = newBar;
              } else {
                // Add new bar
                updated.push(newBar);
              }
              return updated.sort((a, b) => (a.time as number) - (b.time as number));
            });

            setIsConnected(true);
            setDataSource("websocket");
            setLastUpdate(Date.now());
          }
        })
      : massive.subscribeAggregates([ticker], (message) => {
          // Skip updates when tab is hidden for battery efficiency
          if (document.hidden) return;

          if (message.type === "aggregate") {
            const agg = message.data;
            const newBar: Partial<Bar> = {
              time: Math.floor(agg.timestamp / 1000000000), // Massive WebSocket returns nanoseconds, convert to seconds
              open: agg.open,
              high: agg.high,
              low: agg.low,
              close: agg.close,
              volume: agg.volume,
            };

            // Validate bar has all required OHLC values before adding
            if (!isValidBar(newBar)) {
              console.warn(
                "[HDLiveChart] Skipping invalid bar from WebSocket (null OHLC values):",
                newBar
              );
              return;
            }

            setBars((prev) => {
              const updated = [...prev];
              const existingIndex = updated.findIndex((b) => b.time === newBar.time);
              if (existingIndex >= 0) {
                updated[existingIndex] = newBar;
              } else {
                updated.push(newBar);
              }
              return updated.sort((a, b) => (a.time as number) - (b.time as number));
            });

            setIsConnected(true);
            setDataSource("websocket");
            setLastUpdate(Date.now());
          }
        });

    // REST fallback: if no data for 30 seconds, fetch historical
    // Only check once per minute to avoid excessive polling
    const fallbackInterval = setInterval(() => {
      if (Date.now() - lastUpdate > 30000 && !document.hidden && bars.length === 0) {
        setIsConnected(false);
        setDataSource("rest");
        loadHistoricalBars();
      }
    }, 60000); // Changed from 30s to 60s and only runs if no bars exist

    return () => {
      unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [ticker, lastUpdate, loadHistoricalBars, currentTf]);

  useEffect(() => {
    if (!chartRef.current || levels.length === 0) return;

    // Clear existing level series
    levelSeriesRefs.current.forEach((series, key) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {
        // Series might already be removed
      }
    });
    levelSeriesRefs.current.clear();

    // Helper to get color and style for level type
    const getLevelStyle = (type: ChartLevel["type"]) => {
      switch (type) {
        case "ENTRY":
          return { color: "#9CA3AF", width: 2, style: 0, title: "Entry" }; // Solid gray
        case "TP":
          return { color: "#16A34A", width: 2, style: 0, title: "TP" }; // Solid green
        case "SL":
          return { color: "#EF4444", width: 2, style: 0, title: "SL" }; // Solid red
        case "PREMARKET_HIGH":
        case "PREMARKET_LOW":
          return { color: "#8B5CF6", width: 1, style: 2, title: "PM" }; // Dashed purple
        case "ORB_HIGH":
        case "ORB_LOW":
          return { color: "#F59E0B", width: 1, style: 2, title: "ORB" }; // Dashed orange
        case "PREV_DAY_HIGH":
        case "PREV_DAY_LOW":
          return { color: "#3B82F6", width: 1, style: 2, title: "PDH/L" }; // Dashed blue
        case "VWAP":
          return { color: "#10B981", width: 1, style: 2, title: "VWAP" }; // Dashed green
        case "VWAP_BAND":
          return { color: "#10B981", width: 1, style: 3, title: "VWAP Band" }; // Dotted green
        case "BOLLINGER":
          return { color: "#6366F1", width: 1, style: 3, title: "BB" }; // Dotted indigo
        default:
          return { color: "#6B7280", width: 1, style: 2, title: "Level" }; // Dashed gray
      }
    };

    // Sort levels by importance (entry/TP/SL first, then key levels)
    const sortedLevels = [...levels].sort((a, b) => {
      const importance: Record<string, number> = { ENTRY: 0, TP: 1, SL: 2 };
      const aImportance = importance[String(a.type)] ?? 10;
      const bImportance = importance[String(b.type)] ?? 10;
      return aImportance - bImportance;
    });

    // Create price line for each level
    sortedLevels.forEach((level, index) => {
      const style = getLevelStyle(level.type);
      const key = `${level.type}-${level.label}-${index}`;

      try {
        const lineSeries = chartRef.current!.addLineSeries({
          color: style.color,
          lineWidth: style.width as any,
          lineStyle: style.style as any,
          title: `${level.label}`,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        // Create a horizontal line by setting same price for all time points
        // We'll use a single data point and rely on price line feature
        const priceLineOptions = {
          price: level.price,
          color: style.color,
          lineWidth: style.width as any,
          lineStyle: style.style as any,
          axisLabelVisible: true,
          title: level.label,
        };

        lineSeries.createPriceLine(priceLineOptions);

        levelSeriesRefs.current.set(key, lineSeries);
      } catch (error) {
        console.error(`[HDLiveChart] Failed to create level line for ${level.label}:`, error);
      }
    });
  }, [levels, ticker]);

  // Effect: Render session markers (pre-market, regular, after-hours background zones)
  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return;

    try {
      // Get session markers for the bar times
      const barTimes = bars.map((b) => b.time as number);
      const sessionMarkers = getSessionMarkersForBars(barTimes);

      if (sessionMarkers.length > 0 && chartRef.current.timeScale()) {
        // Get price scale for zones
        const priceScale = chartRef.current.priceScale("right");
        if (priceScale) {
          // Get price range from bars
          const prices = bars.flatMap((b) => [b.high, b.low]);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          // Create zones for session markers
          sessionMarkers.forEach((marker) => {
            try {
              const zoneOptions = {
                startPrice: minPrice,
                endPrice: maxPrice,
                backgroundColor: marker.color,
              };

              // Use time-based zones if available
              if ((chartRef.current as any).createSolidBackgroundZone) {
                (chartRef.current as any).createSolidBackgroundZone({
                  startTime: marker.startTime,
                  endTime: marker.endTime,
                  backgroundColor: marker.color,
                  zOrder: "bottom" as any,
                });
              }
            } catch (e) {
              // Zones might not be supported in this version
              console.debug("[HDLiveChart] Session zone creation not available");
            }
          });
        }
      }
    } catch (e) {
      console.debug("[HDLiveChart] Error rendering session markers:", e);
    }
  }, [bars]);

  // Effect: Add auto-calculated key levels (previous day/week high/low)
  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return;

    try {
      const keyLevels = calculateKeyLevels(bars);

      if (keyLevels.length > 0) {
        // Add key levels as price lines to the first series
        const priceSeries = candleSeriesRef.current;
        if (priceSeries) {
          keyLevels.forEach((level) => {
            try {
              priceSeries.createPriceLine({
                price: level.price,
                color: level.color,
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: level.label,
              });
            } catch (e) {
              console.debug(`[HDLiveChart] Could not add key level ${level.label}:`, e);
            }
          });
        }
      }
    } catch (e) {
      console.debug("[HDLiveChart] Error calculating key levels:", e);
    }
  }, [bars.length]);

  const getAsOfText = () => {
    const secondsAgo = Math.floor((Date.now() - lastUpdate) / 1000);
    if (secondsAgo < 5) return "Live";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  const handleResetView = () => {
    // Reset to initial view: show last 100 bars at 75% position
    if (!chartRef.current || bars.length === 0) return;

    const ts = chartRef.current.timeScale();
    const barsToUse = bars.length;
    const visibleBars = Math.min(lastNBarsAuto, barsToUse);
    const fromIdx = Math.max(0, barsToUse - visibleBars);
    const from = bars[fromIdx].time as number;

    const totalRangeNeeded = visibleBars / 0.75;
    const extraBars = Math.ceil(totalRangeNeeded - visibleBars);

    const lastBar = bars[barsToUse - 1].time as number;
    const firstVisibleBar = bars[fromIdx].time as number;
    const timePerBar = visibleBars > 1 ? (lastBar - firstVisibleBar) / (visibleBars - 1) : 60;
    const to = lastBar + extraBars * timePerBar;

    ts.setVisibleRange({ from: from as any, to: to as any });
  };

  const handleToggle = (key: keyof IndicatorState) => {
    setIndState((prev) => {
      const newState = { ...prev, [key]: !prev[key] };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("hdchart.indicators", JSON.stringify(newState));
        }
      } catch {
        // localStorage not available, ignore silently
      }
      return newState;
    });
  };

  const handleToggleHeaderCollapse = () => {
    setIsHeaderCollapsed((prev) => {
      const newValue = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("hdchart.headerCollapsed", String(newValue));
        }
      } catch {
        // localStorage not available, ignore silently
      }
      return newValue;
    });
  };

  const tfOptions: { key: TfKey; label: string }[] = [
    { key: "1", label: "1m" },
    { key: "5", label: "5m" },
    { key: "15", label: "15m" },
    { key: "60", label: "60m" },
    { key: "1D", label: "1D" },
  ];

  const selectTimeframe = (tf: TfKey) => {
    if (tf === currentTf) return;
    hasAutoFitRef.current = false; // Reset auto-fit for new timeframe
    setBars([]);
    setIsConnected(false);
    setDataSource("rest");
    setCurrentTf(tf);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("hdchart.timeframe", tf);
    } catch {
      // localStorage not available, ignore silently
    }
    timeframeRef.current = tf;
    onTimeframeChange?.(tf);
  };

  if (!ready) {
    const hasFailures = failedFetchesRef.current.size > 0;
    return (
      <div className="h-[var(--chart-height,400px)] flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] rounded-[var(--radius)] border border-dashed border-[var(--border-hairline)] text-[var(--text-muted)] text-xs px-4 text-center">
        {!hasFailures && <span>Loading market data…</span>}
        {hasFailures && (
          <>
            <span className="text-[var(--text-high)]">No historical bars available.</span>
            <span className="opacity-80">
              Configure MASSIVE_API_KEY in .env.local to enable chart history.
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] overflow-hidden ${className}`}
      style={{ opacity, transition: "opacity 160ms ease" }}
    >
      {/* Header - only show if showHeader is true */}
      {showHeader && (
        <div
          className={`${stickyHeader ? "sticky top-0 z-10 bg-[var(--surface-2)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-2)]/80" : ""} px-3 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between`}
        >
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={handleToggleHeaderCollapse}
              className="p-0.5 hover:bg-[var(--surface-3)] rounded transition-colors flex-shrink-0"
              title={isHeaderCollapsed ? "Expand chart controls" : "Collapse chart controls"}
            >
              <ChevronDown
                className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isHeaderCollapsed ? "-rotate-90" : ""}`}
              />
            </button>
            <h3 className="text-[var(--text-high)] text-xs font-medium uppercase tracking-wide">
              Live Chart ({currentTf})
            </h3>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
              )}
              <span className="text-micro text-[var(--text-muted)]">
                {dataSource === "websocket" ? "Streaming" : "REST"} • {getAsOfText()}
              </span>
              {rateLimited && (
                <span className="text-micro text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                  Limited
                </span>
              )}
              <button
                className="text-micro px-2 py-0.5 rounded border border-[var(--border-hairline)] hover:bg-[var(--surface-3)] transition-colors"
                onClick={handleResetView}
                title="Reset chart view to show latest bars"
              >
                Reset View
              </button>
            </div>
            {fps < 30 && (
              <span className="text-micro text-yellow-500 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Downsampled ({fps} fps)
              </span>
            )}
          </div>
          {!isHeaderCollapsed && showControls && (
            <div className="flex items-center gap-3">
              {/* Timeframe */}
              <div className="flex items-center gap-1 text-micro">
                {tfOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => selectTimeframe(opt.key)}
                    className={`px-2 py-0.5 rounded border ${currentTf === opt.key ? "bg-[var(--surface-3)] border-[var(--border-strong)] text-[var(--text-high)]" : "border-[var(--border-hairline)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Indicators */}
              <div className="flex items-center gap-1 text-micro">
                <button
                  onClick={() => handleToggle("ema9")}
                  className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.ema9 ? "text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm" : "text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300"}`}
                >
                  EMA9
                </button>
                <button
                  onClick={() => handleToggle("ema21")}
                  className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.ema21 ? "text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm" : "text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300"}`}
                >
                  EMA21
                </button>
                <button
                  onClick={() => handleToggle("vwap")}
                  className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.vwap ? "text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm" : "text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300"}`}
                >
                  VWAP
                </button>
                <button
                  onClick={() => handleToggle("bb")}
                  className={`min-h-[32px] px-3 py-1 rounded border transition-all duration-150 ease-out touch-manipulation active:scale-95 ${indState.bb ? "text-[var(--text-high)] border-[var(--border-strong)] bg-[var(--surface-2)] shadow-sm" : "text-zinc-400 border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:text-zinc-300"}`}
                >
                  BB
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div
        ref={setChartContainerRef}
        style={{ position: "relative", width: "100%", height: `${height}px` }}
      />
    </div>
  );
}
