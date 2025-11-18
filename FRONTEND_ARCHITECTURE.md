# Frontend Architecture

## Overview

The Honey Drip Admin frontend is a **real-time options trading dashboard** built with **React 18** + **TypeScript** + **Vite**. The architecture prioritizes **state management simplicity**, **real-time data synchronization**, and **mobile-first responsive design**.

### Core Technology Stack

- **Framework**: React 18.3 with TypeScript 5.7
- **Build Tool**: Vite 6.3
- **State Management**: Zustand 4.5 (global stores)
- **UI Components**: Radix UI + Tailwind CSS 3.4
- **Real-time Data**: WebSocket-first with REST fallback
- **Market Data**: Massive.com API (proxied through Express backend)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Charts**: TradingView Lightweight Charts v4

---

## State Management Architecture

The application uses **Zustand** for global state management, organized into **four domain-specific stores**.

### 1. Trade Store (`src/stores/tradeStore.ts`)

Manages all trade lifecycle state and operations.

**State:**

```typescript
{
  activeTrades: Trade[];        // WATCHING, LOADED, or ENTERED trades
  historyTrades: Trade[];       // EXITED trades
  currentTrade: Trade | null;   // Trade being actively managed
  tradeState: TradeState;       // Current state in lifecycle
  contracts: Contract[];        // Available options contracts
  updatedTradeIds: Set<string>; // Trades with recent updates (for flash effects)
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions:**

- `createTrade()`, `updateTrade()`, `deleteTrade()` — CRUD operations with Supabase sync
- `loadTrades(userId)` — Load all user trades from database
- `transitionToLoaded(contract)` — Move from WATCHING → LOADED
- `transitionToEntered(entryPrice, quantity)` — Move from LOADED → ENTERED
- `transitionToExited(exitPrice)` — Move from ENTERED → EXITED
- `addTradeUpdate(tradeId, update)` — Append update to trade history
- `markTradeAsUpdated(tradeId)` — Flag trade for UI flash effect

**Trade State Machine:**

```
WATCHING → (select contract) → LOADED → (enter position) → ENTERED → (exit position) → EXITED
```

### 2. Market Store (`src/stores/marketStore.ts`)

Manages watchlist and real-time market quotes.

**State:**

```typescript
{
  watchlist: Ticker[];                    // User's watched symbols
  quotes: Map<string, MarketQuote>;       // Real-time quote data
  selectedTicker: Ticker | null;          // Currently selected ticker
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions:**

- `addTicker(userId, ticker)`, `removeTicker(tickerId)` — Watchlist CRUD
- `loadWatchlist(userId)` — Load from Supabase
- `updateQuotes(quotes)` — Sync streaming quotes to watchlist
- `updateQuote(symbol, quote)` — Update single symbol quote
- `getWatchlistSymbols()` — Extract array of symbols for subscription

**Quote Flow:**

```
useQuotes hook → WebSocket/REST → App.tsx → marketStore.updateQuotes() → watchlist state updated
```

### 3. UI Store (`src/stores/uiStore.ts`)

Manages all UI state (tabs, dialogs, voice, focus).

**State:**

```typescript
{
  activeTab: "live" | "active" | "history" | "settings";
  showDiscordDialog: boolean;
  showAddTickerDialog: boolean;
  showAddChallengeDialog: boolean;
  voiceActive: boolean;
  voiceState: "idle" | "listening" | "processing";
  focusedTrade: Trade | null; // Trade to focus when navigating
  flashTradeTab: boolean; // Flash active trades tab
}
```

**Key Actions:**

- `setActiveTab(tab)` — Switch main navigation tab
- `toggleVoice()` — Toggle voice command mode
- `openDiscordSettings()`, `closeAllDialogs()` — Dialog management
- `navigateToLive()`, `navigateToActive()`, `navigateToHistory()` — Navigation helpers
- `focusTradeInLive(trade)` — Focus specific trade in Live tab

### 4. Settings Store (`src/stores/settingsStore.ts`)

Manages Discord channels and challenges.

**State:**

```typescript
{
  discordChannels: DiscordChannel[];
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions:**

- `createDiscordChannel(userId, name, webhookUrl)` — Add Discord webhook
- `removeDiscordChannel(channelId)` — Delete webhook
- `updateDiscordChannelSettings(channelId, updates)` — Update flags (isDefaultLoad, etc.)
- `createChallenge(userId, challenge)` — Create trading challenge
- `getDefaultChannels(type)` — Get channels for alert type (load/enter/exit/update)
- `getActiveChallenges()` — Filter active challenges

---

## Component Hierarchy

### App Structure

```
App.tsx (270 lines, down from 502 lines)
├── HDHeader (session status, voice, settings)
├── TabNavigation (Watch, Trade, Review)
├── Main Content
│   ├── DesktopLiveCockpit (live + active tabs)
│   │   ├── HDPanelWatchlist (sidebar)
│   │   ├── HDLiveChart (main chart)
│   │   ├── HDContractGrid (options chain)
│   │   ├── HDLoadedTradeCard (loaded trades)
│   │   ├── HDEnteredTradeCard (active positions)
│   │   ├── HDPanelFocusedTrade (trade detail)
│   │   └── HDMacroPanel (market overview)
│   ├── MobileActive (mobile active trades view)
│   ├── DesktopHistory (trade history)
│   └── DesktopSettings (app settings)
├── Dialogs
│   ├── HDDialogDiscordSettings
│   ├── HDDialogAddTicker
│   └── HDDialogAddChallenge
└── MobileBottomNav (mobile tabs)
```

### Key Component Responsibilities

#### `App.tsx` (REFACTORED)

- **Before**: 502 lines, 15+ useState, complex prop drilling
- **After**: 270 lines, 0 useState, all state in Zustand stores
- **Role**: App shell, data loading orchestration, routing logic

#### `DesktopLiveCockpit.tsx` (1173 lines — NEEDS DECOMPOSITION)

- **Current**: Monolithic orchestrator for entire trading workflow
- **Contains**: State machine logic, API calls, chart integration, trade management
- **Next Steps**: Split into TradingWorkspace (layout), TradeOrchestrator (state machine), ContractSelector, RiskManager

#### `HDLiveChart.tsx` (704 lines — NEEDS DECOMPOSITION)

- **Current**: Chart rendering + data fetching + indicators + levels
- **Next Steps**: Split into ChartContainer, ChartRenderer, DataFetcher, IndicatorLayer, LevelLayer

#### `HDPanelWatchlist.tsx` (540 lines)

- Displays watchlist, loaded trades, active trades, challenges
- Uses Radix UI Accordion for collapsible sections
- Integrates with `useMarketStore` and `useTradeStore`

#### `HDContractGrid.tsx` (520 lines)

- Options chain grid with call/put toggle
- Virtualized list (react-window) for performance
- Expiry date selector, strike filtering
- Uses `useTradeStore` for contract selection

---

## Data Flow Patterns

### 1. Real-Time Quote Streaming

```
App.tsx
  → useQuotes(['SPY', 'SPX']) // useMassiveData.ts
    → createTransport() per symbol // transport-policy.ts
      → WebSocket: massiveWS.subscribe() // streaming
      → REST Fallback: 3s polling if disconnected
      → callback(quote, source, timestamp)
    → quotes Map returned
  → marketStore.updateQuotes(quotes)
    → Updates watchlist tickers with latest prices
    → Components re-render with fresh data
```

**Stale Detection:**

- WebSocket quotes: stale if > 5 seconds old
- REST quotes: stale if > 6 seconds old
- Source tracked in `quote.source` ('websocket' | 'rest')

### 2. Trade Lifecycle Flow

```
1. WATCHING (watchlist ticker clicked)
   → HDPanelWatchlist onClick
   → tradeStore.setCurrentTrade(new Trade)
   → tradeStore.setTradeState('WATCHING')

2. LOADED (contract selected)
   → HDContractGrid onContractSelect
   → tradeStore.transitionToLoaded(contract)
   → Risk calculator runs (TP/SL computed)
   → HDAlertComposer opens with "LOAD" alert

3. ENTERED (position entered)
   → HDLoadedTradeCard "Enter" button
   → tradeStore.transitionToEntered(entryPrice, quantity)
   → Trade moves to activeTrades array
   → Real-time P&L tracking begins
   → HDAlertComposer opens with "ENTER" alert

4. EXITED (position closed)
   → HDEnteredTradeCard "Exit" button
   → tradeStore.transitionToExited(exitPrice)
   → Trade moves to historyTrades array
   → Navigate to History tab
   → HDAlertComposer opens with "EXIT" alert
```

### 3. Options Chain Loading

```
DesktopLiveCockpit
  → User clicks ticker in watchlist
  → useMassiveData().fetchOptionsChain(symbol)
    → GET /api/options/chain?symbol=SPX&window=10
      → Server normalizes Massive API response
      → Applies dynamic strike banding (20%-50%)
      → Calculates trading-day DTE
      → Returns NormalizedChain
    → Maps to Contract[] type
  → tradeStore.setContracts(contracts)
  → HDContractGrid displays contracts
```

### 4. Risk Calculation Flow

```
DesktopLiveCockpit
  → Contract selected (LOADED state)
  → useRiskEngine(trade, confluence, keyLevels)
    → Infers trade type by DTE (Scalp/Day/Swing/LEAP)
    → Loads RISK_PROFILES[tradeType]
    → Applies confluence adjustments (ATR, VWAP, support/resistance)
    → calculateRisk() returns {targetPrice, stopLoss, R:R}
  → Updates currentTrade with TP/SL
  → Displays in HDPanelFocusedTrade
```

---

## Performance Optimization Patterns

### Completed Optimizations

1. **Zustand Store Selectors** (reduces re-renders)

   ```typescript
   const activeTrades = useTradeStore((state) => state.activeTrades);
   const enteredCount = useTradeStore(
     (state) => state.activeTrades.filter((t) => t.state === "ENTERED").length
   );
   ```

2. **Quote Map for O(1) Lookup**

   ```typescript
   const quote = marketStore.getQuote(symbol); // O(1) vs O(n) array search
   ```

3. **Memoized Computed Values** (watchlistSymbols)
   ```typescript
   const watchlistSymbols = marketStore.getWatchlistSymbols(); // cached
   ```

### Pending Optimizations

4. **React.memo for Pure Components** (trade cards, contract rows)

   ```typescript
   export const HDLoadedTradeCard = React.memo<Props>(({ trade }) => {
     // Only re-renders if trade object changes
   });
   ```

5. **useCallback for Event Handlers**

   ```typescript
   const handleContractSelect = useCallback((contract: Contract) => {
     tradeStore.transitionToLoaded(contract);
   }, []); // Stable function reference
   ```

6. **Virtualization for Long Lists**

   - HDContractGrid: Already uses react-window ✅
   - DesktopHistory: Needs react-window for 1000+ trades
   - HDPanelWatchlist: Consider virtualization if > 50 tickers

7. **Code Splitting**
   ```typescript
   const DesktopHistory = lazy(() => import("./components/DesktopHistory"));
   const DesktopSettings = lazy(() => import("./components/DesktopSettings"));
   ```

---

## Mobile-First Responsive Design

### Breakpoint Strategy

- **Mobile**: < 1024px (lg breakpoint)
- **Desktop**: ≥ 1024px

### Key Responsive Components

1. **MobileBottomNav** (< 1024px only)

   - Fixed bottom navigation with 4 tabs
   - Live, Trade, Review, Settings
   - Flash effect on new active trades

2. **DesktopLiveCockpit Layout**

   - Desktop: Sidebar (watchlist) + Main (chart + contracts) + Right panel (focused trade)
   - Mobile: Full-width chart, swipe-up sheet for contracts

3. **MobileNowPlayingSheet** (< 1024px)

   - Drag-up sheet for active trade details
   - Replaces desktop HDPanelFocusedTrade
   - Compact P&L display, quick actions

4. **Conditional Rendering**

   ```typescript
   const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

   {
     isMobile ? (
       <MobileNowPlayingSheet trade={currentTrade} />
     ) : (
       <HDPanelFocusedTrade trade={currentTrade} />
     );
   }
   ```

---

## Error Handling & Boundaries

### Error Boundary Pattern (TO BE IMPLEMENTED)

```typescript
<StoreErrorBoundary storeName="TradeStore" onReset={() => tradeStore.reset()}>
  <DesktopLiveCockpit />
</StoreErrorBoundary>
```

**Features:**

- Catch errors in store actions
- Display user-friendly fallback UI
- Provide "Retry" button
- Log errors to monitoring service (e.g., Sentry)
- Preserve other store state

### API Error Handling

**Pattern:**

```typescript
try {
  await tradeStore.createTrade(userId, tradeData);
} catch (error) {
  console.error("[TradeStore] Failed to create trade:", error);
  set({ error: "Failed to create trade", isLoading: false });
  toast.error("Failed to create trade. Please try again.");
}
```

**Features:**

- User-facing error messages (via sonner toast)
- Console logging with [StoreName] prefix
- Store error state for UI display
- Loading state cleanup

---

## Testing Strategy (TO BE IMPLEMENTED)

### Unit Tests (Vitest)

**Store Tests:**

```typescript
describe("TradeStore", () => {
  beforeEach(() => {
    useTradeStore.getState().reset();
  });

  it("transitions from WATCHING to LOADED", () => {
    const { setCurrentTrade, transitionToLoaded } = useTradeStore.getState();
    setCurrentTrade(mockTrade);
    transitionToLoaded(mockContract);

    expect(useTradeStore.getState().tradeState).toBe("LOADED");
    expect(useTradeStore.getState().currentTrade?.contract).toEqual(
      mockContract
    );
  });
});
```

**Component Tests (React Testing Library):**

```typescript
describe("HDPanelWatchlist", () => {
  it("renders watchlist tickers with quotes", () => {
    useMarketStore.setState({
      watchlist: [mockTicker],
      quotes: new Map([["SPY", mockQuote]]),
    });

    render(<HDPanelWatchlist />);
    expect(screen.getByText("SPY")).toBeInTheDocument();
    expect(screen.getByText("$450.25")).toBeInTheDocument();
  });
});
```

### Integration Tests

**Trade Lifecycle:**

```typescript
it("completes full trade lifecycle", async () => {
  // 1. WATCHING → LOADED
  fireEvent.click(screen.getByText("SPY"));
  fireEvent.click(screen.getByText("SPY 450C 2024-11-22"));
  expect(useTradeStore.getState().tradeState).toBe("LOADED");

  // 2. LOADED → ENTERED
  fireEvent.click(screen.getByRole("button", { name: /enter/i }));
  await waitFor(() => {
    expect(useTradeStore.getState().tradeState).toBe("ENTERED");
  });

  // 3. ENTERED → EXITED
  fireEvent.click(screen.getByRole("button", { name: /exit/i }));
  await waitFor(() => {
    expect(useTradeStore.getState().historyTrades).toHaveLength(1);
  });
});
```

### E2E Tests (Playwright)

**Critical Flows:**

- User authentication
- Add ticker to watchlist
- Load options chain
- Enter and exit trade
- Send Discord alert

---

## Migration Status

### ✅ Completed Refactors

1. **Zustand Stores Created** (4 stores)

   - tradeStore.ts (300+ lines)
   - marketStore.ts (180 lines)
   - uiStore.ts (120 lines)
   - settingsStore.ts (220 lines)

2. **App.tsx Refactored** (502 → 270 lines)

   - Removed 15 useState declarations
   - Removed prop drilling through 3+ component layers
   - Centralized all state in Zustand stores
   - Simplified data loading logic

3. **Build Verified** ✅
   - Client bundle: 1,743.83 kB (367.20 kB gzipped)
   - No TypeScript errors in stores
   - Vite build successful

### 🚧 In Progress

4. **Component Decomposition**
   - DesktopLiveCockpit (1173 lines → split into 5 components)
   - HDLiveChart (704 lines → split into 5 components)

### ⏳ Pending

5. **React Query Integration**

   - Replace useQuotes with useQuery
   - Replace useStreamingOptionsChain with useQuery + WebSocket
   - Add mutation hooks for trade CRUD

6. **React Hook Form**

   - HDDialogDiscordSettings
   - HDDialogAddTicker
   - HDDialogAddChallenge
   - HDAlertComposer

7. **Performance Optimizations**

   - React.memo for pure components
   - useCallback for event handlers
   - Virtualization for DesktopHistory

8. **Error Boundaries**

   - StoreErrorBoundary wrapper
   - ComponentErrorBoundary for sections
   - Sentry integration

9. **Type Safety**
   - Remove all `any` types
   - Add proper discriminated unions
   - Update component prop types

---

## Architecture Decisions

### Why Zustand over Redux?

**Reasons:**

- **Simpler API**: No actions, reducers, or middleware boilerplate
- **Better TypeScript**: Inferred types without extra configuration
- **Smaller Bundle**: ~1KB vs ~13KB (Redux Toolkit)
- **DevTools Support**: Zustand DevTools middleware built-in
- **Familiar Hooks**: `useTradeStore()` feels like `useState()`

### Why Separate Stores?

**Benefits:**

- **Domain Isolation**: Trade logic separate from UI logic
- **Selective Re-renders**: Components only subscribe to needed slices
- **Testability**: Mock individual stores in tests
- **Code Organization**: Clear boundaries for state ownership

### Why Not Context API?

**Limitations:**

- **Re-render Issues**: All consumers re-render on any context change
- **No Selectors**: Can't subscribe to specific state slices
- **Verbose Setup**: Requires Provider, createContext, useContext
- **No DevTools**: No built-in debugging

---

## Next Steps

### Immediate Priorities

1. **Decompose DesktopLiveCockpit** (1173 lines → 300 lines per component)

   - TradingWorkspace.tsx (layout orchestrator)
   - TradeOrchestrator.tsx (state machine logic)
   - ContractSelector.tsx (options grid + filters)
   - RiskManager.tsx (TP/SL calculator + confluence)

2. **Decompose HDLiveChart** (704 lines → 200 lines per component)

   - ChartContainer.tsx (wrapper, dimensions)
   - ChartRenderer.tsx (lightweight-charts integration)
   - DataFetcher.tsx (bars + streaming)
   - IndicatorLayer.tsx (EMAs, VWAP, Bollinger)
   - LevelLayer.tsx (TP, SL, support/resistance)

3. **Add React Query**
   - `useQuotesQuery(symbols)` — real-time quotes
   - `useOptionsChainQuery(symbol)` — options chain
   - `useBarsQuery(symbol, timeframe)` — historical bars
   - `useTradesMutation()` — create/update/delete trades

### Medium-Term Goals

4. **Performance Audit**

   - Lighthouse performance score > 90
   - First Contentful Paint < 1.5s
   - Time to Interactive < 3.0s

5. **Testing Coverage**

   - Unit tests: 80% coverage
   - Integration tests: Critical flows
   - E2E tests: Happy path + error cases

6. **Monitoring & Analytics**
   - Sentry for error tracking
   - PostHog for user analytics
   - Custom logging for trade events

---

## Build & Deploy

### Development

```bash
pnpm install
pnpm run dev              # Vite dev server (http://localhost:5173)
                          # Express API server (http://localhost:3000)
```

### Production Build

```bash
pnpm run build            # Vite client build + tsc server build
pnpm run start            # Node server/dist/index.js (serves client + API)
```

### Environment Variables

**Client (exposed to browser):**

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key
- `VITE_MASSIVE_PROXY_TOKEN` — Shared secret for backend API auth

**Server (not exposed):**

- `MASSIVE_API_KEY` — Massive.com API key
- `MASSIVE_PROXY_TOKEN` — Shared secret for client auth
- `PORT` — Server port (default 3000)

---

## Contributing

### Code Style

- **Formatting**: Prettier (auto-format on save)
- **Linting**: ESLint (TypeScript + React rules)
- **Naming**: PascalCase components, camelCase functions/variables
- **Imports**: Group by external → internal → relative

### Component Guidelines

1. **Max 300 lines per component** (split if larger)
2. **Zustand for global state**, useState for local UI state
3. **Prop drilling max 2 levels** (use stores instead)
4. **Memoize expensive calculations** (useMemo)
5. **Stable callbacks** (useCallback for props)

### Store Guidelines

1. **One store per domain** (trade, market, ui, settings)
2. **Async actions for side effects** (API calls, Supabase)
3. **Sync actions for state updates** (setters, transitions)
4. **Error handling in actions** (try/catch + set error state)
5. **DevTools enabled** (Zustand devtools middleware)

---

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Massive.com API Docs](https://massive.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
