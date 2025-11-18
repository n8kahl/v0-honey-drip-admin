# HDLiveChart Refactor Plan

## Current Issues

- Component uses REST polling (`loadHistoricalBars`) and separate WebSocket subscriptions
- Chart recreates series when indicators toggle
- No centralized viewport management
- Duplicates data fetching logic

## Target Architecture

### Data Flow

```
marketDataStore (WebSocket) → useCandles(symbol, timeframe) → HDLiveChart
                            → useIndicators(symbol) → Overlay series
```

### Key Changes

1. **Remove REST fetching entirely**

   - Delete `loadHistoricalBars()` function
   - Delete rate limit state
   - Delete bar caching logic

2. **Use marketDataStore hooks**

   ```tsx
   const candles = useMarketDataStore(
     (state) =>
       state.symbols[ticker.toUpperCase()]?.candles[TF_MAP[currentTf]] || []
   );
   const indicators = useMarketDataStore(
     (state) => state.symbols[ticker.toUpperCase()]?.indicators
   );
   const isConnected = useMarketDataStore((state) => state.isConnected);
   ```

3. **Update series without recreation**

   ```tsx
   useEffect(() => {
     if (!candleSeriesRef.current || candles.length === 0) return;

     // Use setData() for full replacement, update() for incremental
     const chartData = candles.map((c) => ({
       time: c.time as Time,
       open: c.open,
       high: c.high,
       low: c.low,
       close: c.close,
     }));

     candleSeriesRef.current.setData(chartData);
   }, [candles]);
   ```

4. **Viewport management with uiStore**

   ```tsx
   const chartViewportMode = useUIStore((state) => state.chartViewportMode);
   const saveChartRange = useUIStore((state) => state.saveChartRange);
   const getChartRange = useUIStore((state) => state.getChartRange);

   // On bar close in AUTO mode
   if (chartViewportMode === "AUTO" && newBarDetected) {
     chart.timeScale().fitContent();
   }

   // On user pan/zoom
   chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
     if (range) {
       saveChartRange(`${ticker}:${currentTf}`, {
         from: range.from,
         to: range.to,
       });
       if (chartViewportMode === "AUTO") {
         setChartViewportMode("MANUAL");
       }
     }
   });

   // Restore range in MANUAL mode
   useEffect(() => {
     if (chartViewportMode === "MANUAL") {
       const savedRange = getChartRange(`${ticker}:${currentTf}`);
       if (savedRange) {
         chart.timeScale().setVisibleLogicalRange(savedRange);
       }
     }
   }, [chartViewportMode, ticker, currentTf]);
   ```

5. **Toggle indicators without destroying chart**
   ```tsx
   useEffect(() => {
     if (!indState.ema9 && emaSeriesRefs.current.has(9)) {
       // Hide series instead of destroying
       const series = emaSeriesRefs.current.get(9);
       series?.applyOptions({ visible: false });
     } else if (indState.ema9 && emaSeriesRefs.current.has(9)) {
       const series = emaSeriesRefs.current.get(9);
       series?.applyOptions({ visible: true });
       // Update data if needed
       const emaData = calculateEMA(...);
       series?.setData(emaData);
     }
   }, [indState.ema9, indicators]);
   ```

## Implementation Steps

1. Add viewport management to uiStore ✅
2. Replace data fetching with marketDataStore subscriptions
3. Update chart series using setData/update instead of recreation
4. Implement AUTO/MANUAL viewport modes
5. Fix indicator toggling to use visibility instead of recreation
6. Remove all REST/WebSocket code
7. Test real-time updates
8. Test viewport persistence

## Files to Update

- [x] `src/stores/uiStore.ts` - Add viewport management
- [ ] `src/components/hd/HDLiveChart.tsx` - Complete refactor
- [ ] Test with real WebSocket data from marketDataStore

## Benefits

- ✅ Single source of truth (marketDataStore)
- ✅ No duplicate data fetching
- ✅ Consistent calculations across UI
- ✅ Smooth indicator toggles
- ✅ Proper viewport management
- ✅ Better performance (no series recreation)
