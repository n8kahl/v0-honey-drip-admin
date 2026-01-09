import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";
import { AppSheet } from "../../ui/AppSheet";
import { cn } from "@/lib/utils";
import { useCandles, type Candle } from "../../../stores/marketDataStore";

interface HDMobileChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  currentPrice: number;
  dailyChange?: number;
}

/**
 * Transform raw candles into chart data format
 * Calculates EMAs from real price data
 */
function transformCandlesToChartData(candles: Candle[]) {
  if (!candles || candles.length === 0) return [];

  // Calculate EMAs
  const ema9Values: number[] = [];
  const ema21Values: number[] = [];
  const ema9Multiplier = 2 / (9 + 1);
  const ema21Multiplier = 2 / (21 + 1);

  return candles.map((candle, i) => {
    const price = candle.close;

    // Calculate EMA 9
    if (i === 0) {
      ema9Values.push(price);
    } else {
      const prevEma9 = ema9Values[i - 1];
      ema9Values.push((price - prevEma9) * ema9Multiplier + prevEma9);
    }

    // Calculate EMA 21
    if (i === 0) {
      ema21Values.push(price);
    } else {
      const prevEma21 = ema21Values[i - 1];
      ema21Values.push((price - prevEma21) * ema21Multiplier + prevEma21);
    }

    const time = new Date(candle.time);
    return {
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      price: parseFloat(price.toFixed(2)),
      ema9: parseFloat(ema9Values[i].toFixed(2)),
      ema21: parseFloat(ema21Values[i].toFixed(2)),
    };
  });
}

export function HDMobileChartModal({
  isOpen,
  onClose,
  ticker,
  currentPrice,
  dailyChange = 0,
}: HDMobileChartModalProps) {
  // Get real 5m candles from marketDataStore
  const candles5m = useCandles(ticker, "5m");
  // Fallback to 1m candles if 5m not available
  const candles1m = useCandles(ticker, "1m");

  // Use 5m candles if available, otherwise 1m (take last 35 bars)
  const data = useMemo(() => {
    const rawCandles = candles5m?.length > 0 ? candles5m : candles1m;
    if (!rawCandles || rawCandles.length === 0) return [];
    const recentCandles = rawCandles.slice(-35);
    return transformCandlesToChartData(recentCandles);
  }, [candles5m, candles1m]);

  const hasData = data.length > 0;

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!hasData) return { minPrice: 0, maxPrice: 0, priceRange: 1 };
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { minPrice: min, maxPrice: max, priceRange: max - min || 1 };
  }, [data, hasData]);

  const isPositive = dailyChange >= 0;

  // Get CSS variable colors
  const positiveColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-positive").trim() ||
    "#16A34A";
  const negativeColor =
    getComputedStyle(document.documentElement).getPropertyValue("--accent-negative").trim() ||
    "#EF4444";
  const emaPrimaryColor =
    getComputedStyle(document.documentElement).getPropertyValue("--chart-ema-primary").trim() ||
    "#9CA3AF";
  const emaSecondaryColor =
    getComputedStyle(document.documentElement).getPropertyValue("--chart-ema-secondary").trim() ||
    "#6B7280";
  const priceColor = isPositive ? positiveColor : negativeColor;

  if (!isOpen) return null;

  return (
    <AppSheet
      open={isOpen}
      onOpenChange={onClose}
      title={`${ticker} - 5-Minute Chart`}
      snapPoint="full"
    >
      <div className="p-4 space-y-4">
        {/* Price Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[var(--text-high)] tabular-nums font-medium text-2xl">
              ${currentPrice.toFixed(2)}
            </div>
            <div
              className={cn(
                "text-sm tabular-nums",
                isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {isPositive ? "+" : ""}
              {dailyChange.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ height: "320px" }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="mobilePriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={priceColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={priceColor} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="time"
                  stroke="var(--text-faint)"
                  fontSize={9}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--text-faint)" }}
                />

                <YAxis
                  domain={[minPrice - priceRange * 0.1, maxPrice + priceRange * 0.1]}
                  stroke="var(--text-faint)"
                  fontSize={9}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tick={{ fill: "var(--text-faint)" }}
                  width={35}
                />

                {/* Reference line at current price */}
                <ReferenceLine
                  y={currentPrice}
                  stroke="var(--brand-primary)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />

                {/* EMAs - very subtle */}
                <Area
                  type="monotone"
                  dataKey="ema21"
                  stroke={emaSecondaryColor}
                  strokeWidth={0.5}
                  fill="none"
                  dot={false}
                  strokeOpacity={0.3}
                />

                <Area
                  type="monotone"
                  dataKey="ema9"
                  stroke={emaPrimaryColor}
                  strokeWidth={0.5}
                  fill="none"
                  dot={false}
                  strokeOpacity={0.4}
                />

                {/* Main price line */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={priceColor}
                  strokeWidth={2}
                  fill="url(#mobilePriceGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            // Loading skeleton
            <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] rounded-lg animate-pulse">
              <span className="text-[var(--text-faint)] text-sm">Loading chart data...</span>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)] text-center">
          <p className="text-[var(--text-faint)] text-xs">
            {hasData ? "Showing last ~3 hours of 5-minute candles" : "Waiting for market data..."}
          </p>
        </div>
      </div>
    </AppSheet>
  );
}
