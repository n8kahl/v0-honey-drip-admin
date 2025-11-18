# Strategy Library Implementation Summary

## ✅ What's Been Implemented

### 1. **11 Day Trading Strategies Extracted** (`scripts/extracted-strategy-seeds.json`)

All strategies are real-world proven patterns from your existing logic:

**Opening Range Breakout (ORB)**

- **Long**: Break above 15m ORB high with patient candle + volume spike (once per session, 15m cooldown)
- **Short**: Break below 15m ORB low with patient candle + volume spike (once per session, 15m cooldown)

**EMA Bounce/Rejection**

- **Long**: Wick into EMA21, reclaim above with 60m bullish trend (10m cooldown)
- **Short**: Wick into EMA21, reject below with 60m bearish trend (10m cooldown)

**VWAP Strategy**

- **Long**: Price reclaims VWAP within 0.3% distance (10m cooldown)
- **Short**: Price rejects VWAP within 0.3% distance (10m cooldown)

**EMA Cloud Strategy**

- **Long**: Price above EMA9 > EMA21 cloud (15m cooldown)
- **Short**: Price below EMA9 < EMA21 cloud (15m cooldown)

**Fibonacci Pullback**

- **Long**: Price near 50% or 61.8% Fib retracement of recent swing (15m cooldown)

**Range Breakout/Breakdown**

- **Long**: Breakout above 20-bar consolidation high with volume spike (15m cooldown)
- **Short**: Breakdown below 20-bar consolidation low with volume spike (15m cooldown)

### 2. **Pattern Detection Engine** (`src/lib/strategy/patternDetection.ts`)

Complete pattern library:

- `isPatientCandle()` - Small body candles (≤30% of ATR)
- `computeORBLevels()` - Opening range from first 15m bars
- `getMinutesSinceOpen()` - Session time tracking
- `computeSwingLevels()` - Recent high/low from last N bars
- `computeFibLevels()` - 23.6%, 38.2%, 50%, 61.8%, 78.6% retracements
- `isNearFibLevel()` - Price proximity to Fib levels (0.5% tolerance)
- `computeConsolidationRange()` - Range tightness detection
- `isConsolidation()` - Range ≤ 2.0 \* ATR
- `isBreakout()` - Bullish/bearish breakout detection
- `isVolumeSpike()` - Current volume > 1.5x average
- `computeAvgVolume()` - Rolling average calculator

### 3. **Enhanced Features Builder** (`src/lib/strategy/featuresBuilder.ts`)

Extended `buildSymbolFeatures()` to auto-compute:

- **Session fields**: `session.minutesSinceOpen`, `session.isRegularHours`
- **Pattern fields**: `pattern.isPatientCandle`, `pattern.orbHigh`, `pattern.orbLow`, `pattern.swingHigh`, `pattern.swingLow`, `pattern.fib618`, `pattern.fib500`, `pattern.nearFib618`, `pattern.nearFib500`, `pattern.consolidationHigh`, `pattern.consolidationLow`, `pattern.isConsolidation`, `pattern.breakoutBullish`, `pattern.breakoutBearish`, `pattern.volumeSpike`
- **Volume fields**: `volume.current`, `volume.avg`, `volume.prev`
- **MTF bucket**: Nested timeframe indicators (1m, 5m, 15m, 60m, 1d)

### 4. **Dynamic Field Resolution** (`src/lib/strategy/engine.ts`)

Rule engine now supports **field-to-field comparisons**:

```json
{
  "field": "price.current",
  "op": ">",
  "value": "pattern.orbHigh" // ✅ Resolves pattern.orbHigh dynamically
}
```

Before: Only static values (numbers, booleans).  
After: String values starting with letters treated as field paths.

### 5. **Admin CRUD API** (`src/lib/strategy/admin.ts`)

Complete management interface:

- `listAllStrategies()` - Get all strategies (filter by category, enabled state)
- `getStrategyById()` - Fetch single strategy
- `createStrategy()` - Add new custom strategy
- `updateStrategy()` - Modify existing strategy
- `toggleStrategyEnabled()` - Quick enable/disable
- `deleteStrategy()` - Remove user-defined strategies (blocks core library deletion)
- `duplicateStrategy()` - Clone strategy with new slug
- `bulkToggleByCategory()` - Enable/disable entire categories
- `getStrategyStats()` - Dashboard metrics (total, enabled, by category)

## 🔧 How to Use

### Step 1: Seed Strategies into Database

1. **Get your user UUID** from Supabase auth:

   ```sql
   SELECT id FROM auth.users WHERE email = 'your-email@example.com';
   ```

2. **Update seed script** (`src/lib/strategy/seedStrategies.ts`):

   ```typescript
   import seeds from "../../scripts/extracted-strategy-seeds.json";
   // Update seedCoreStrategies() to use seeds instead of core-strategy-seeds.json
   ```

3. **Run seeding** (create a script or component that calls):
   ```typescript
   import { seedCoreStrategies } from "./lib/strategy/seedStrategies";
   await seedCoreStrategies("your-core-owner-uuid");
   ```

### Step 2: Wire Pattern Detection into Market Data Pipeline

Find where you compute bars/indicators (likely in `useMassiveData.ts` or a market data store):

```typescript
import { buildSymbolFeatures } from "./lib/strategy/featuresBuilder";
import type { Bar } from "./lib/strategy/patternDetection";

// When you have new 5m bar + indicators:
const features = buildSymbolFeatures({
  symbol: "SPY",
  timeISO: new Date().toISOString(),
  primaryTf: "5m",
  bars: bars5m as Bar[], // Your historical 5m bars array
  mtf: {
    "5m": {
      price: {
        current: lastBar.close,
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
      },
      vwap: {
        value: indicators5m.vwap,
        distancePct: computeVwapDistancePct(lastBar.close, indicators5m.vwap),
      },
      ema: { "9": indicators5m.ema9, "21": indicators5m.ema21 },
      rsi: { "14": indicators5m.rsi14 },
      atr: indicators5m.atr,
    },
    "60m": {
      ema: { "9": indicators60m.ema9, "21": indicators60m.ema21 },
    },
  },
});
```

### Step 3: Run Scanner on Market Data Updates

```typescript
import { scanStrategiesForUser } from "./lib/strategy/scanner";

// On every 5m bar close:
const signals = await scanStrategiesForUser({
  owner: userId,
  symbols: ["SPY", "SPX", "QQQ"], // Watchlist symbols
  features: {
    SPY: spyFeatures,
    SPX: spxFeatures,
    QQQ: qqqFeatures,
  },
  supabaseClient: supabase,
});
```

### Step 4: Subscribe to Signals in UI

```typescript
import { useStrategySignals } from "./hooks/useStrategySignals";

function WatchlistRow({ symbol, owner }) {
  const signals = useStrategySignals(owner);
  const symbolSignals = signals[symbol] || [];

  return (
    <div>
      {symbol}
      {symbolSignals.length > 0 && (
        <Badge pulse>{symbolSignals.length} signals</Badge>
      )}
    </div>
  );
}
```

## 📊 Admin UI (Next Step)

Create `src/pages/SettingsStrategyLibrary.tsx`:

```typescript
import {
  listAllStrategies,
  toggleStrategyEnabled,
  getStrategyStats,
} from "./lib/strategy/admin";

export function StrategyLibrarySettings() {
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [strats, statsData] = await Promise.all([
      listAllStrategies(),
      getStrategyStats(),
    ]);
    setStrategies(strats);
    setStats(statsData);
  }

  async function handleToggle(id: string, enabled: boolean) {
    await toggleStrategyEnabled(id, enabled);
    loadData();
  }

  return (
    <div>
      <h2>Strategy Library</h2>
      <div>
        Total: {stats?.total} | Enabled: {stats?.enabled} | Core:{" "}
        {stats?.coreLibrary}
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Side</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.category}</td>
              <td>{s.entrySide}</td>
              <td>
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(checked) => handleToggle(s.id, checked)}
                />
              </td>
              <td>
                <Button onClick={() => openEditModal(s)}>Edit</Button>
                {!s.isCoreLibrary && (
                  <Button
                    variant="destructive"
                    onClick={() => deleteStrategy(s.id)}
                  >
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 🔐 Security Notes

- All strategy CRUD operations go through Supabase RLS policies
- Core library strategies (`is_core_library = true`) cannot be deleted, only disabled
- Only authenticated users with proper permissions can modify strategies
- Signal insertion uses owner-scoped RLS (users only see their own signals)

## 📈 Testing Flow

1. **Manual scan endpoint** (create in `server/routes/strategies.ts`):

   ```typescript
   router.post("/scan", async (req, res) => {
     const { owner, symbols } = req.body;
     // Build features from market data
     const signals = await scanStrategiesForUser({
       owner,
       symbols,
       features,
       supabaseClient,
     });
     res.json({ signals });
   });
   ```

2. **Call from Postman/curl**:

   ```bash
   curl -X POST http://localhost:3000/api/strategies/scan \
     -H "Content-Type: application/json" \
     -d '{"owner":"uuid","symbols":["SPY"]}'
   ```

3. **Check signals in Supabase**:
   ```sql
   SELECT * FROM strategy_signals WHERE owner = 'uuid' ORDER BY created_at DESC LIMIT 10;
   ```

## 🎯 Next Steps Priority

1. **P0**: Update `seedStrategies.ts` to use `extracted-strategy-seeds.json` and replace UUID → Execute seeding
2. **P1**: Wire `buildSymbolFeatures` into market data hooks (find bar computation locations)
3. **P2**: Create scanner scheduler (on 5m bar close or 1-minute interval)
4. **P3**: Add manual scan endpoint (`POST /api/strategies/scan`)
5. **P4**: Implement watchlist badge UI (flash on signal arrival)
6. **P5**: Create Settings > Strategy Library admin panel

## 📝 Files Changed

- ✅ `src/lib/strategy/patternDetection.ts` - Pattern detection library (NEW)
- ✅ `src/lib/strategy/featuresBuilder.ts` - Extended with pattern computation
- ✅ `src/lib/strategy/engine.ts` - Dynamic field resolution
- ✅ `src/lib/strategy/admin.ts` - Admin CRUD operations (NEW)
- ✅ `scripts/extracted-strategy-seeds.json` - 11 realistic strategies (NEW)

Build status: ✅ Clean (no errors)
