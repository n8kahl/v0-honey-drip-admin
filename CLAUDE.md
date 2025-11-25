# CLAUDE.md - AI Assistant Guide

> **Purpose**: Comprehensive guide for AI assistants (Claude, GPT, etc.) working on the Honey Drip Admin Trading Dashboard codebase. This is THE definitive reference - always consult this file before making changes.

**Last Updated**: November 23, 2025
**Project**: Honey Drip Admin Trading Dashboard
**Tech Stack**: React 18 + TypeScript + Express + PostgreSQL (Supabase) + Massive.com API

**Recent Updates**:
- ✅ **Chart Initialization Fix**: Callback ref pattern ensures charts initialize on first symbol selection
- ✅ **Chart Zoom Levels**: Timeframe-specific zoom (1m: 30 bars, 5m: 20 bars, others: 100 bars)
- ✅ **Phase 1 Data Optimizations**: 25x faster weekend analysis, 90% API cost reduction
- ✅ **Smart Cache TTL**: Historical data cached 7 days vs 5 seconds
- ✅ **Database Persistence**: New `historical_bars` table for 10-50x faster backtests
- ✅ **Weekend Pre-Warm Worker**: Auto-fetches data Fridays at 4:05pm ET
- ✅ **Parallel Fetching**: 25x speedup for multi-symbol queries

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Recent Session Changes](#recent-session-changes)
3. [Project Overview](#project-overview)
4. [Architecture](#architecture)
5. [Directory Structure](#directory-structure)
6. [Technology Stack](#technology-stack)
7. [API Integration](#api-integration)
8. [Database Schema](#database-schema)
9. [State Management](#state-management)
10. [Testing Strategy](#testing-strategy)
11. [Development Workflow](#development-workflow)
12. [Deployment](#deployment)
13. [Critical Patterns](#critical-patterns)
14. [Common Tasks](#common-tasks)
15. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### For AI Assistants Starting a New Session

1. **Read this file first** - Contains all critical context
2. **Check recent commits**: `git log --oneline -5`
3. **Verify test status**: `pnpm test`
4. **Review current branch**: Should be working on `claude/*` branches

### Essential Commands

```bash
# Development
pnpm dev              # Start frontend (5173) + backend (3000)
pnpm dev:all          # Start frontend + backend + composite scanner worker
pnpm dev:prewarm      # Run weekend pre-warm worker (test mode)

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Watch mode for development
pnpm test:e2e         # Run E2E tests with Playwright
./scripts/test-phase1-optimizations.sh  # Test Phase 1 optimizations

# Code Quality
pnpm lint             # Check for linting errors
pnpm lint:fix         # Auto-fix linting errors
pnpm format           # Format code with Prettier
pnpm typecheck        # TypeScript type checking

# Session Management
pnpm run session-check  # Run before ending session (tests + build + git status)

# Production Workers
pnpm start:composite  # Run composite scanner worker
pnpm start:prewarm    # Run weekend pre-warm worker (manual trigger)
```

---

## 📝 Recent Session Changes

### Session: November 23, 2025 - Loaded Trades & Contract Persistence

**Branch**: `claude/fix-loaded-trades-nav-01C7dP6XiJ9sjtQZmozssYp9`

#### Changes Made:

1. **Fixed Critical UX Issues (Commits: f644d57, 8707217)**
   - Added missing `HDTagTradeType` import to HDWatchlistRail
   - Fixed center column not loading when "Load and Alert" clicked
   - Preserved `activeTicker` for load alerts so charts continue to display
   - Implemented database deletion for dismissed trades (no reappearing on refresh)
   - Fixed chart layout (1m/5m side-by-side instead of stacked)
   - Added active trades to left navigation with row-based styling

2. **Contract JSONB Persistence (Commit: e39519c)**
   - Added `contract` JSONB column to trades table (migration 011)
   - Store full contract object (bid, ask, volume, Greeks, etc.) in database
   - Trades now persist across sessions with complete market details
   - Prevents "ghost" loaded trades showing with 0.00 prices

3. **Deferred Trade Persistence - KEY CHANGE (Commit: d6ea76b)**
   - **BREAKING**: Changed when trades are saved to database
   - `handleContractSelect()`: Creates WATCHING state trade (preview only)
     - Shows Trade Details, Contract Analysis, Market Analysis panels
     - Does NOT add to activeTrades
     - Does NOT persist to database
   - `handleSendAlert("load")`: Creates trade in database for first time
     - Transitions WATCHING → LOADED
     - Adds to activeTrades
     - Only explicit "Load and Alert" action triggers persistence
   - **Result**: No more ghost trades from just browsing contracts

4. **Fixed Import Bundling Error (Commits: 67137c0, 3406f76)**
   - Removed `.js` extensions from massive imports in vixClassifier
   - Fixed "massive is not defined" error in production builds
   - Lesson: TypeScript imports from `.ts` files without extensions

#### Database Migrations to Apply:

```sql
-- Migration 011: Add contract JSONB persistence
ALTER TABLE trades ADD COLUMN IF NOT EXISTS contract JSONB;
CREATE INDEX IF NOT EXISTS idx_trades_contract ON trades USING GIN (contract);
```

#### Trade Lifecycle (Updated):

```
Symbol Click (e.g., SPY)
  ↓
  Middle: Empty
  Left Nav: No changes

Contract Click (e.g., 649P · 1 DTE)
  ↓
  State: WATCHING (temporary, local only)
  Middle: Show Trade Details, Analysis panels
  Left Nav: "Loaded Trades" still empty
  ↓
  [User decides to load...]
  ↓
"Load and Alert" Button Click
  ↓
  State: Creating trade in DB...
  ↓
  State: LOADED (with real database ID)
  Middle: Continue showing contract
  Left Nav: Trade appears in "Loaded Trades" section ✅
```

#### Key Files Modified:

- `src/hooks/useTradeStateMachine.ts` - handleContractSelect & handleSendAlert refactored
- `src/lib/supabase/database.ts` - createTrade accepts contract param
- `src/stores/tradeStore.ts` - loadTrades restores contract from JSONB
- `src/lib/api/tradeApi.ts` - Added deleteTradeApi function
- `src/components/hd/charts/HDLiveChartContextAware.tsx` - Fixed flex layout
- `src/components/hd/layout/HDWatchlistRail.tsx` - Added HDTagTradeType import
- `server/routes/trades.ts` - Updated to store full contract object
- `src/lib/strategy/vixClassifier.ts` - Fixed massive import
- `scripts/011_add_contract_jsonb.sql` - New migration

#### Testing Checklist for Next Session:

- [ ] Select symbol → middle column empty ✓
- [ ] Select contract → panels load ✓
- [ ] Dismiss via X → deleted from DB, doesn't reappear on refresh ✓
- [ ] Click "Load and Alert" → trade appears in "Loaded Trades" ✓
- [ ] Refresh page → loaded trades persist with full contract data ✓
- [ ] Charts display side-by-side (1m + 5m) ✓
- [ ] Active trades show in left nav with P&L coloring ✓

#### Known Issues / Next Steps:

- [ ] Migration 011 needs to be run in Supabase SQL Editor before full deployment
- [ ] Test the full flow end-to-end with real market data
- [ ] Verify P&L calculations for active trades are correct
- [ ] Consider adding confirmation dialog before dismissing loaded trades

---

## 📊 Project Overview

**Honey Drip Admin** is a real-time options trading dashboard with the following capabilities:

### Core Features

- **Real-time Market Data**: Live quotes, options chains, and indices via Massive.com WebSocket streaming
- **Trade Management**: Full lifecycle tracking (WATCHING → LOADED → ENTERED → EXITED)
- **Discord Integration**: Automated alerts for trade actions
- **Challenge Tracking**: Group trades into challenges and track performance
- **Composite Signal Scanner**: Background worker detecting 16 types of trading opportunities
- **Risk Engine**: DTE-aware TP/SL calculations with Greeks monitoring
- **Options Advanced**: Trade flow indicators, liquidity analysis, confluence signals
- **Weekend Radar Analysis**: 25x faster data loading with database persistence (Phase 1)
- **Historical Data Optimization**: Smart caching system with 90% API cost reduction

### Data Providers

1. **Massive.com** (Primary)
   - OPTIONS ADVANCED subscription
   - INDICES ADVANCED subscription
   - Real-time WebSocket streaming
   - Historical bars and aggregates

2. **Tradier** (Fallback)
   - Stock quotes and historical data
   - Options chains (backup)
   - Market status

### Key Integrations

- **Supabase**: PostgreSQL database with Row-Level Security (RLS)
- **Discord**: Webhook-based alerts
- **Railway**: Deployment platform (main app + worker)

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                     │
│  - Port 5173 (dev) / Static files (prod)                   │
│  - Zustand state management                                 │
│  - Radix UI components                                      │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ HTTP/WebSocket
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (Express + TypeScript)                             │
│  - Port 3000                                                 │
│  - API proxy to Massive.com                                  │
│  - WebSocket proxy (ephemeral token auth)                   │
│  - Rate limiting (1200 req/min)                             │
└─────────────┬───────────────────────────────────────────────┘
              │
              ├──────────────────────┬──────────────────────────┐
              ▼                      ▼                          ▼
┌──────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Massive.com         │  │  Supabase           │  │  Background Worker  │
│  - REST API          │  │  - PostgreSQL       │  │  - Composite Scanner│
│  - WebSocket         │  │  - Auth             │  │  - Runs every 60s   │
│  - Options data      │  │  - RLS policies     │  │  - Signal detection │
└──────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### Security Model: API Proxy Architecture

**Critical**: Client NEVER directly accesses external APIs. All requests proxied through backend.

```
Client Request → /api/massive/* → Server adds API key → Massive.com
                                 ↓
                          Ephemeral token for WebSocket (5-min expiry)
```

**Why?**

- API keys never exposed to browser
- Rate limiting enforced server-side
- Request validation and sanitization
- Unified error handling

### Data Flow: Streaming-First Architecture

```
User Request
    ↓
Primary: WebSocket subscription → Real-time updates
    ↓ (if fails)
Fallback: REST polling (3-second interval)
    ↓
Stale detection: Show warning if data >5s old
```

---

## 📁 Directory Structure

```
/home/user/v0-honey-drip-admin/
│
├── src/                           # Frontend React application
│   ├── components/
│   │   ├── ui/                    # Radix UI + shadcn components (40+)
│   │   ├── hd/                    # Core trading UI components
│   │   │   ├── cards/             # Trade cards, contract rows
│   │   │   ├── forms/             # Dialog forms (Discord, Add Ticker, etc.)
│   │   │   ├── layout/            # Header, command center, market banner
│   │   │   ├── voice/             # Voice command UI
│   │   │   └── signals/           # Signal detection UI
│   │   ├── trading/               # Trading workspace components
│   │   └── monitoring/            # Monitoring dashboard
│   │
│   ├── lib/                       # Core business logic
│   │   ├── api/                   # API client functions (Phase 4)
│   │   │   └── tradeApi.ts        # Trade API with exponential backoff retry
│   │   ├── massive/               # Massive.com integration
│   │   │   ├── websocket.ts       # WebSocket client with auto-reconnect
│   │   │   ├── streaming-manager.ts  # Centralized subscription manager
│   │   │   ├── options-advanced.ts   # Options data
│   │   │   └── unifiedWebSocket.ts   # Unified WebSocket handler
│   │   ├── riskEngine/            # Risk calculations
│   │   │   ├── calculator.ts      # Position sizing
│   │   │   ├── profiles.ts        # Risk profiles
│   │   │   └── marketContext.ts   # Market regime detection
│   │   ├── composite/             # Composite signal system
│   │   │   ├── CompositeScanner.ts    # Main scanner
│   │   │   ├── CompositeSignal.ts     # Signal definitions
│   │   │   ├── detectors/             # 16 detector modules
│   │   │   └── OptimizedScannerConfig.ts
│   │   ├── strategy/              # Trading strategies
│   │   ├── supabase/              # Database operations
│   │   ├── discord/               # Discord webhook integration
│   │   ├── greeks/                # Options Greeks calculations
│   │   └── data-provider/         # Multi-provider abstraction
│   │
│   ├── stores/                    # Zustand state management (7 stores)
│   │   ├── tradeStore.ts          # Trade lifecycle management
│   │   ├── marketDataStore.ts     # Real-time market data cache
│   │   ├── marketStore.ts         # Watchlist and quotes
│   │   ├── settingsStore.ts       # User settings (Discord, challenges)
│   │   ├── uiStore.ts             # UI state (dialogs, voice)
│   │   └── index.ts               # Store exports
│   │
│   ├── hooks/                     # Custom React hooks (~25 hooks)
│   │   ├── useMassiveData.ts
│   │   ├── useOptionsChain.ts
│   │   ├── useRiskEngine.ts
│   │   ├── useTradeStateMachine.ts
│   │   └── useCompositeSignals.ts
│   │
│   ├── pages/                     # Route pages
│   ├── types/                     # TypeScript definitions
│   └── styles/                    # CSS/TailwindCSS styles
│
├── server/                        # Express.js backend
│   ├── index.ts                   # Main server entry point
│   ├── routes/
│   │   ├── api.ts                 # Main API routes (970+ lines)
│   │   ├── trades.ts              # Trade persistence API (507 lines, Phase 4)
│   │   └── strategies.ts          # Strategy routes
│   ├── ws/                        # WebSocket servers
│   │   ├── index.ts               # WebSocket setup
│   │   └── hub.ts                 # WebSocket hub for proxying
│   ├── workers/
│   │   ├── compositeScanner.ts    # Composite signal scanner (800+ lines)
│   │   └── scanner.ts             # Legacy strategy scanner
│   ├── massive/
│   │   └── client.ts              # Server-side Massive.com client
│   ├── vendors/
│   │   └── tradier.ts             # Tradier API client
│   └── lib/                       # Server utilities
│       ├── cache.ts               # LRU caching
│       ├── marketCalendar.ts      # Market hours
│       └── symbolUtils.ts         # Symbol normalization
│
├── scripts/                       # Database migrations
│   ├── 001_create_schema.sql
│   ├── 002_add_profiles.sql
│   ├── 006_add_composite_signals.sql  # Phase 5 composite system
│   ├── 008_add_trade_discord_channels.sql  # Phase 4 trade persistence
│   └── README.md
│
├── e2e/                           # Playwright E2E tests
│   └── options-chain/
│
├── .github/workflows/             # CI/CD pipelines
│   └── ci.yml                     # GitHub Actions workflow
│
└── docs/                          # Additional documentation
    └── GREEKS_STREAMING_ARCHITECTURE.md
```

---

## 🔧 Technology Stack

### Frontend Core

| Package            | Version | Purpose          |
| ------------------ | ------- | ---------------- |
| `react`            | 18.3.1  | UI framework     |
| `typescript`       | ^5      | Type safety      |
| `vite`             | 6.3.5   | Build tool       |
| `react-router-dom` | ^7.9.6  | Routing          |
| `zustand`          | ^4.5.0  | State management |

### UI Libraries

| Package              | Version  | Purpose                    |
| -------------------- | -------- | -------------------------- |
| `@radix-ui/*`        | 1.x-2.x  | 20+ headless UI components |
| `tailwindcss`        | 3.4.15   | Utility-first CSS          |
| `lucide-react`       | ^0.454.0 | Icon library               |
| `recharts`           | 2.15.2   | Data visualization         |
| `lightweight-charts` | ^4.2.0   | Trading charts             |
| `sonner`             | 2.0.3    | Toast notifications        |

### Backend

| Package              | Version | Purpose              |
| -------------------- | ------- | -------------------- |
| `express`            | ^4.18.2 | Web server           |
| `ws`                 | ^8.18.3 | WebSocket server     |
| `helmet`             | ^8.1.0  | Security headers     |
| `compression`        | ^1.8.1  | Response compression |
| `express-rate-limit` | ^8.2.1  | Rate limiting        |
| `morgan`             | ^1.10.1 | Request logging      |

### Database & Auth

| Package                 | Purpose                       |
| ----------------------- | ----------------------------- |
| `@supabase/supabase-js` | PostgreSQL client             |
| `@supabase/ssr`         | Server-side rendering support |

### Testing

| Package                  | Purpose                 |
| ------------------------ | ----------------------- |
| `vitest`                 | Unit testing framework  |
| `@testing-library/react` | React component testing |
| `@playwright/test`       | E2E testing             |

### Development Tools

| Package        | Purpose                |
| -------------- | ---------------------- |
| `tsx`          | TypeScript execution   |
| `concurrently` | Run multiple processes |
| `husky`        | Git hooks              |
| `eslint`       | Code linting           |
| `prettier`     | Code formatting        |

---

## 🌐 API Integration

### ⚠️ CRITICAL: Correct API Endpoints

**All API calls MUST use these endpoints:**

#### Massive.com API

```typescript
// REST API Base URL
const MASSIVE_BASE = "https://api.massive.com";

// WebSocket URLs
const WS_OPTIONS = "wss://socket.massive.com/options";
const WS_INDICES = "wss://socket.massive.com/indices";

// Common REST Endpoints
GET / v2 / aggs / ticker / { optionsTicker } / range / 1 / minute / { from } / { to };
GET / v3 / snapshot / options / { underlyingAsset };
GET / v3 / snapshot / indices;
GET / v3 / reference / options / contracts;
```

#### Tradier API (Fallback)

```typescript
const TRADIER_BASE = "https://api.tradier.com/v1";

// Common endpoints
GET / markets / quotes;
GET / markets / history;
GET / markets / options / chains;
```

### Backend API Routes

All client requests go through the backend proxy:

```typescript
// Health & Monitoring
GET  /api/health                    // Server health check
GET  /api/market/status             // Market open/close status
GET  /api/massive-key-status        // Massive.com API key diagnostic

// Authentication
POST /api/ws-token                  // Generate ephemeral WebSocket token (5-min expiry)

// Market Data (Unified)
GET  /api/quotes?tickers=SPY,SPX,NDX           // Real-time quotes (stocks + indices)
GET  /api/bars?symbol=SPY&timespan=minute      // Historical bars
GET  /api/options/chain?symbol=SPX&window=10   // Unified options chain

// Trade Persistence (Phase 4 Implementation)
POST /api/trades                              // Create trade
PATCH /api/trades/:tradeId                    // Update trade
DELETE /api/trades/:tradeId                   // Delete trade
POST /api/trades/:tradeId/updates             // Record trade action (entry, exit, trim, etc.)
POST /api/trades/:tradeId/channels/:channelId // Link Discord channel to trade
DELETE /api/trades/:tradeId/channels/:channelId // Unlink Discord channel
POST /api/trades/:tradeId/challenges/:challengeId // Link challenge to trade
DELETE /api/trades/:tradeId/challenges/:challengeId // Unlink challenge

// Massive.com Proxy (requires x-massive-proxy-token header)
GET  /api/massive/indices/bars
GET  /api/massive/options/bars
GET  /api/massive/options/chain?underlying=SPY
GET  /api/massive/options/contracts
ALL  /api/massive/*                 // Catch-all proxy
```

### WebSocket Proxy

```typescript
// Client connects to local proxy
ws://localhost:3000/ws/options
ws://localhost:3000/ws/indices

// Server proxies to Massive.com with authentication
wss://socket.massive.com/options
wss://socket.massive.com/indices
```

### Ephemeral Token System

**Problem**: Cannot expose API keys to browser
**Solution**: Server generates short-lived signed tokens

```typescript
// Client requests token
const { token, expiresAt } = await fetch("/api/ws-token").then((r) => r.json());

// Token format: base64(payload).hmac_signature
// Payload: { exp: timestamp, n: nonce }
// Signature: HMAC-SHA256(payload, MASSIVE_API_KEY)
// Expiry: 5 minutes

// Client uses token in WebSocket auth
ws.send({ action: "auth", params: token });
```

### Rate Limiting

```typescript
// Express middleware
const generalLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 1200, // 1200 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
```

---

## 🗄️ Database Schema

### Core Tables

#### `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS**: Users can only see/edit their own profile

#### `discord_channels`

```sql
CREATE TABLE discord_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  UNIQUE(user_id, name)
);
```

**RLS**: Users can only CRUD their own channels

#### `challenges`

```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  short_name TEXT,
  scope TEXT CHECK (scope IN ('admin', 'honeydrip-wide')),
  default_channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**RLS**: Users can only manage their own challenges

#### `watchlist`

```sql
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);
```

**RLS**: Users can only see their own watchlist

#### `trades`

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  ticker TEXT NOT NULL,
  trade_type TEXT CHECK (trade_type IN ('Scalp', 'Day', 'Swing', 'LEAP')),
  state TEXT CHECK (state IN ('WATCHING', 'LOADED', 'ENTERED', 'EXITED')),
  contract JSONB,                    -- Full contract details
  entry_price NUMERIC,
  entry_time TIMESTAMPTZ,
  current_price NUMERIC,
  target_price NUMERIC,
  stop_loss NUMERIC,
  exit_price NUMERIC,
  exit_time TIMESTAMPTZ,
  discord_channels TEXT[],           -- Array of channel names
  challenges TEXT[],                 -- Array of challenge IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_state ON trades(state);
CREATE INDEX idx_trades_ticker ON trades(ticker);
```

**RLS**: Users can only CRUD their own trades

#### `trade_updates`

```sql
CREATE TABLE trade_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('enter', 'trim', 'update', 'update-sl', 'trail-stop', 'add', 'exit')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  message TEXT,
  price NUMERIC,
  pnl_percent NUMERIC
);
```

**RLS**: Users can only see updates for their trades

#### `trades_discord_channels` (Phase 4 - Trade Persistence)

```sql
CREATE TABLE trades_discord_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  discord_channel_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, discord_channel_id)
);

CREATE INDEX idx_trades_discord_channels_trade_id ON trades_discord_channels(trade_id);
```

**Purpose**: Many-to-many relationship between trades and Discord channels
**RLS**: Users can only view/edit links on their own trades

#### `trades_challenges` (Phase 4 - Trade Persistence)

```sql
CREATE TABLE trades_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_id, challenge_id)
);

CREATE INDEX idx_trades_challenges_trade_id ON trades_challenges(trade_id);
```

**Purpose**: Many-to-many relationship between trades and challenges
**RLS**: Users can only view/edit links on their own trades

#### `composite_signals` (Phase 5+)

```sql
CREATE TABLE composite_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,   -- 16 different types
  direction TEXT CHECK (direction IN ('LONG', 'SHORT')),
  asset_class TEXT CHECK (asset_class IN ('INDEX', 'EQUITY_ETF', 'STOCK')),
  base_score NUMERIC(5,2),          -- 0-100
  scalp_score NUMERIC(5,2),
  day_trade_score NUMERIC(5,2),
  swing_score NUMERIC(5,2),
  recommended_style TEXT,
  confluence JSONB,                 -- Factor breakdown
  entry_price NUMERIC,
  stop_price NUMERIC,
  target_t1 NUMERIC,
  target_t2 NUMERIC,
  target_t3 NUMERIC,
  risk_reward NUMERIC,
  features JSONB,                   -- Full snapshot
  status TEXT DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ,
  bar_time_key TEXT,                -- Deduplication key
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, bar_time_key)
);

-- 10+ indexes for performance
CREATE INDEX idx_composite_signals_owner ON composite_signals(owner);
CREATE INDEX idx_composite_signals_symbol ON composite_signals(symbol);
CREATE INDEX idx_composite_signals_status ON composite_signals(status);
CREATE INDEX idx_composite_signals_created ON composite_signals(created_at DESC);
-- ... more indexes
```

#### `historical_bars` (Phase 1 - Data Optimization)

**Purpose**: Persistent storage for historical OHLCV bars. Enables 10-50x faster backtesting and weekend analysis without refetching from Massive.com.

```sql
CREATE TABLE historical_bars (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,      -- '1m', '5m', '15m', '1h', '4h', 'day'
  timestamp BIGINT NOT NULL,     -- Epoch milliseconds (matches Massive.com)
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT,
  vwap NUMERIC,                  -- Volume-weighted average price
  trades INTEGER,                -- Number of trades in this bar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, timeframe, timestamp)
);

-- Indexes for fast queries
CREATE INDEX idx_historical_bars_symbol ON historical_bars(symbol);
CREATE INDEX idx_historical_bars_timeframe ON historical_bars(timeframe);
CREATE INDEX idx_historical_bars_timestamp ON historical_bars(timestamp DESC);
CREATE INDEX idx_historical_bars_symbol_timeframe ON historical_bars(symbol, timeframe, timestamp DESC);

-- Composite index for date range queries
CREATE INDEX idx_historical_bars_range ON historical_bars(symbol, timeframe, timestamp)
  WHERE timestamp > extract(epoch from now() - interval '90 days')::bigint * 1000;
```

**RLS Policy**: All authenticated users can read (global market data). Only service role can write (server-side workers).

**Storage**: ~250 MB/year for 50 symbols × 5 timeframes (FREE on Supabase)

**Cleanup**: Auto-delete data >1 year old via `cleanup_old_historical_bars()` function

### Row-Level Security (RLS)

**Critical Pattern**: ALL tables have RLS policies enabled

```sql
-- Example: trades table RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  USING (auth.uid() = user_id);
```

**Best Practice**:

```typescript
// ✅ CORRECT: RLS automatically filters by auth.uid()
const { data } = await supabase.from("trades").select("*");
// Only returns current user's trades

// ❌ WRONG: Never use service role in frontend
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY); // SECURITY RISK!
```

### Triggers & Functions

```sql
-- Auto-create profile on signup
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamp
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 🔄 State Management (Zustand)

### Store Architecture

**Pattern**: Feature-based stores (not global monolith)

#### 1. `tradeStore.ts` - Trade Lifecycle Management

```typescript
interface TradeStore {
  // State
  activeTrades: Trade[];
  historyTrades: Trade[];
  currentTrade: Trade | null;
  tradeState: TradeState;

  // CRUD Operations
  createTrade(userId: string, trade: Partial<Trade>): Promise<void>;
  updateTrade(tradeId: string, updates: Partial<Trade>): Promise<void>;
  deleteTrade(tradeId: string): Promise<void>;
  loadTrades(userId: string): Promise<void>;

  // Lifecycle Transitions
  transitionToLoaded(contract: Contract): void;
  transitionToEntered(entryPrice: number, quantity: number): void;
  transitionToExited(exitPrice: number): void;

  // Selectors
  getTradeById(tradeId: string): Trade | undefined;
  getLoadedTrades(): Trade[];
  getEnteredTrades(): Trade[];
}

export const useTradeStore = create<TradeStore>()(
  devtools(
    (set, get) => ({
      /* implementation */
    }),
    { name: "TradeStore" }
  )
);
```

#### 2. `marketDataStore.ts` - Real-time Market Data

```typescript
interface MarketDataStore {
  // State
  symbols: Record<string, SymbolData>;
  wsConnection: WebSocketConnection;
  isConnected: boolean;
  subscribedSymbols: Set<string>;

  // Multi-timeframe candles
  candles: Record<Timeframe, Candle[]>;

  // Computed data
  indicators: Indicators;
  mtfTrend: Record<Timeframe, MTFTrend>;
  confluence: ConfluenceScore;
  greeks?: Greeks;

  // Actions
  initialize(watchlistSymbols: string[]): void;
  connectWebSocket(): void;
  subscribe(symbol: string): void;
  handleAggregateBar(msg: AggregateMessage): void;
  recomputeSymbol(symbol: string): void;
}
```

**Uses Immer middleware** for immutable updates:

```typescript
import { immer } from "zustand/middleware/immer";

set(
  produce((draft) => {
    draft.symbols[symbol].candles["1m"].push(bar);
  })
);
```

#### 3. `marketStore.ts` - Watchlist & Quotes

```typescript
interface MarketStore {
  watchlist: WatchlistItem[];
  quotes: Map<string, Quote>;

  addTicker(userId: string, symbol: string): Promise<void>;
  removeTicker(tickerId: string): Promise<void>;
  updateQuotes(quotes: Quote[]): void;
}
```

#### 4. `settingsStore.ts` - User Settings

```typescript
interface SettingsStore {
  discordChannels: DiscordChannel[];
  challenges: Challenge[];

  createDiscordChannel(userId: string, name: string, url: string): Promise<void>;
  createChallenge(userId: string, challenge: Challenge): Promise<void>;
}
```

#### 5. `uiStore.ts` - UI State

```typescript
interface UIStore {
  // Dialog states
  showDiscordDialog: boolean;
  showAddTickerDialog: boolean;

  // Voice
  voiceState: "idle" | "listening" | "processing";

  // Focus
  focusedTrade: Trade | null;
}
```

### Best Practices

#### ✅ Slice-Based Subscriptions (Prevents Re-renders)

```typescript
// Only re-renders when activeTrades changes
const activeTrades = useTradeStore((state) => state.activeTrades);

// Derived selector
const enteredTrades = useTradeStore((state) =>
  state.activeTrades.filter((t) => t.state === "ENTERED")
);
```

#### ✅ DevTools Integration

```typescript
import { devtools } from "zustand/middleware";

export const useStore = create<Store>()(
  devtools(
    (set, get) => ({
      /* state */
    }),
    { name: "StoreName" }
  )
);
```

#### ✅ Async Actions

```typescript
loadTrades: async (userId) => {
  set({ isLoading: true });
  try {
    const trades = await getTrades(userId);
    set({ activeTrades: trades, isLoading: false });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
};
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)

**Location**: Co-located `__tests__/` directories

```bash
src/lib/riskEngine/__tests__/
  - calculator.test.ts
  - profiles.test.ts
  - marketContext.test.ts

src/lib/composite/__tests__/
  - CompositeScanner.test.ts
  - SignalDeduplication.test.ts

src/hooks/__tests__/
  - useTradeStateMachine.test.ts
```

**Configuration**: `vitest.config.ts`

```typescript
{
  globals: true,
  environment: 'jsdom',
  coverage: {
    provider: 'v8',
    thresholds: {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70
    }
  }
}
```

**Running Tests**:

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test:ui           # Interactive UI
```

### E2E Tests (Playwright)

**Location**: `/e2e/`

```bash
e2e/
└── options-chain/
    └── options-chain.spec.ts
```

**Configuration**: `playwright.config.ts`

```typescript
{
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173'
  }
}
```

**Running E2E Tests**:

```bash
pnpm test:e2e           # Run all E2E tests
pnpm test:e2e:ui        # Interactive UI mode
pnpm test:e2e:headed    # See browser window
pnpm test:e2e:debug     # Step-through debugging
```

### Test Patterns

#### Risk Engine Test Example

```typescript
describe("Risk Calculator", () => {
  it("calculates position size with Kelly Criterion", () => {
    const size = calculatePositionSize({
      winRate: 0.65,
      avgWin: 150,
      avgLoss: 100,
      capital: 10000,
    });
    expect(size).toBeLessThan(10000);
    expect(size).toBeGreaterThan(0);
  });
});
```

#### Store Test Example

```typescript
describe("marketStore", () => {
  it("adds ticker to watchlist", async () => {
    const store = useMarketStore.getState();
    await store.addTicker("user-id", "SPY");

    expect(store.watchlist).toContainEqual(expect.objectContaining({ symbol: "SPY" }));
  });
});
```

---

## 🔨 Development Workflow

### Starting a New Session

1. **Pull latest changes**

   ```bash
   git pull origin main
   ```

2. **Install dependencies** (if package.json changed)

   ```bash
   pnpm install
   ```

3. **Check environment**

   ```bash
   cp .env.example .env.local  # If .env.local doesn't exist
   ```

4. **Run tests**

   ```bash
   pnpm test
   ```

5. **Start development servers**
   ```bash
   pnpm dev      # Frontend + Backend
   # OR
   pnpm dev:all  # Frontend + Backend + Worker
   ```

### Making Changes

1. **Create feature branch**

   ```bash
   git checkout -b claude/feature-description-sessionid
   ```

2. **Run tests in watch mode**

   ```bash
   pnpm test:watch
   ```

3. **Type check frequently**

   ```bash
   pnpm typecheck
   ```

4. **Lint and format**
   ```bash
   pnpm lint:fix
   pnpm format
   ```

### Pre-Commit (Husky - Automatic)

```bash
# Automatically runs on git commit:
- Lint-staged on changed files
- Type checking
- Blocks commit if errors found
```

### End of Session Checklist

**Run the automated check**:

```bash
pnpm run session-check
```

This command:

- ✅ Runs all tests
- ✅ Checks TypeScript errors (non-blocking)
- ✅ Verifies build works
- ✅ Shows git status
- ✅ Displays recent commits
- ✅ Provides status report

**Status Meanings**:

- 🚀 **READY FOR NEXT SESSION**: All good, commit and push
- ⚠️ **NEEDS ATTENTION**: Uncommitted changes or few test failures
- ❌ **BLOCKED**: Tests failing or build broken - must fix

### CI/CD Pipeline (GitHub Actions)

**File**: `.github/workflows/ci.yml`

**Triggers**:

- Push to `main`, `develop`, or `claude/**` branches
- Pull requests to `main` or `develop`

**Jobs**:

1. **Test & Build**
   - TypeScript type checking (warns, doesn't block)
   - Unit tests with coverage
   - E2E tests
   - Frontend build
   - Backend build

2. **Lint & Format Check**
   - ESLint
   - Prettier formatting

3. **Security Audit**
   - `pnpm audit --prod`

4. **Deployment Ready Check**
   - Runs on merge to `main`
   - All checks must pass

---

## 🚀 Deployment

### Current Platform: Railway

**Architecture**:

- **Service 1**: Main app (frontend + backend)
- **Service 2**: Composite scanner worker

### Build Process

```bash
# Development
pnpm dev

# Production Build
pnpm build
# 1. Cleans old strategy JS files
# 2. Builds frontend (Vite) → /dist/
# 3. Builds backend (TypeScript) → /server/dist/
```

### Environment Variables

**Railway Dashboard**: Set these in Project → Variables

```bash
# Client-side (exposed to browser - VITE_ prefix)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Server-side (NEVER expose to browser - NO VITE_ prefix)
MASSIVE_API_KEY=your_massive_api_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
TRADIER_ACCESS_TOKEN=your_tradier_token
PORT=8080
NODE_ENV=production
WEB_ORIGIN=https://yourdomain.com
```

### Start Commands

**Railway Configuration**:

```json
{
  "build": "pnpm build",
  "start": "node server/dist/server/index.js",
  "healthCheck": "GET /api/health"
}
```

**Worker Service**:

```json
{
  "build": "pnpm build",
  "start": "node server/dist/server/workers/compositeScanner.js"
}
```

### Health Monitoring

**Health Endpoint**: `/api/health`

Returns:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-22T12:00:00Z",
  "checks": {
    "massive": "connected",
    "supabase": "connected",
    "scanner": "healthy"
  }
}
```

### Rollback Strategy

```bash
# Railway keeps deployment history
railway rollback <deployment-id>
```

---

## 🎯 Critical Patterns

### 1. Ephemeral Token System for WebSocket

**Problem**: Cannot expose API keys to browser
**Solution**: Server generates short-lived signed tokens

```typescript
// Client requests token
const { token, expiresAt } = await fetch("/api/ws-token").then((r) => r.json());

// Server generates token (server/index.ts)
const payload = { exp: Date.now() + 5 * 60 * 1000, n: nonce };
const signature = crypto
  .createHmac("sha256", MASSIVE_API_KEY)
  .update(JSON.stringify(payload))
  .digest("base64");
const token = `${Buffer.from(JSON.stringify(payload)).toString("base64")}.${signature}`;

// Client uses in WebSocket
ws.send({ action: "auth", params: token });
```

### 2. Streaming-First Data Architecture

```typescript
// Primary: WebSocket with real-time updates
const handle = streamingManager.subscribe("SPY", ["quotes", "trades", "agg1m"], (data) =>
  handleUpdate(data)
);

// Auto-fallback on disconnect
if (!wsConnected) {
  startPolling(3000); // 3-second interval
}

// Stale detection
const isStale = Date.now() - lastUpdate > 5000; // >5s old
if (isStale) showWarning("Data may be stale");
```

### 3. Intelligent Fallback Aggregates

**Problem**: Massive.com v2/aggs occasionally returns 500 errors
**Solution**: Circuit breaker pattern

```typescript
// server/routes/api.ts
const failureCache = new Map<string, number>();

function shouldShortCircuit(path: string): boolean {
  const lastFailure = failureCache.get(path);
  return lastFailure && Date.now() - lastFailure < 30000; // 30s
}

// Return empty result instead of error
if (shouldShortCircuit(path)) {
  return res.status(200).json({ results: [] });
}
```

### 4. Composite Signal Deduplication

**Problem**: Scanner runs every 60s, may detect same signal twice
**Solution**: Idempotency key

```typescript
const barTimeKey = `${timeISO}_${symbol}_${opportunityType}`;

// Database constraint
// UNIQUE(symbol, bar_time_key)
// Duplicate inserts are silently ignored
```

### 5. Trade State Machine & Contract Preview Workflow

**States**: WATCHING → LOADED → ENTERED → EXITED

**Important**: As of November 2025, the trade workflow uses a **preview-then-persist** pattern:

```typescript
// Step 1: User clicks contract → Preview (NOT persisted yet)
handleContractSelect(contract) {
  const previewTrade = {
    id: crypto.randomUUID(),  // Temporary ID
    state: "WATCHING",         // Preview state
    contract,
    // ... calculated TP/SL
  };
  setCurrentTrade(previewTrade);  // Show in UI for analysis
  setShowAlert(true);              // Show "Load and Alert" dialog

  // DO NOT add to activeTrades yet
  // DO NOT persist to database yet
}

// Step 2: User clicks "Load and Alert" → Persist
handleSendAlert(channelIds, challengeIds) {
  if (alertType === "load") {
    // NOW we persist to database
    const dbTrade = await createTradeApi(userId, {
      ticker: currentTrade.ticker,
      contract: currentTrade.contract,  // Full contract as JSONB
      // ...
    });

    // Update with real database ID
    const persistedTrade = {
      ...currentTrade,
      id: dbTrade.id,           // Real ID from database
      state: "LOADED",          // Now officially loaded
    };

    setActiveTrades(prev => [...prev, persistedTrade]); // Add to sidebar
    await linkChannelsApi(userId, dbTrade.id, channelIds);
  }
}

// Step 3: Transition to ENTERED
function transitionToEntered(entryPrice: number) {
  if (currentState !== "LOADED") {
    throw new Error("Cannot enter trade from WATCHING state");
  }
  setState("ENTERED");
  recordUpdate("enter", entryPrice);
}
```

**Key Points**:
- Contract selection creates a **temporary preview trade** (state=WATCHING)
- Preview is shown in Trade Details panel but NOT in sidebar
- "Load and Alert" button triggers **database persistence**
- Only after persistence does the trade enter LOADED state
- This prevents premature database writes and allows user to analyze before committing

### 6. DTE-Aware Risk Calculations

```typescript
function calculateTPSL(contract: OptionContract) {
  const dte = calculateDTE(contract.expiry);

  // Tighter stops for 0DTE
  const stopMultiplier = dte === 0 ? 0.5 : dte <= 7 ? 0.75 : 1.0;

  const stopLoss = entryPrice - atr * stopMultiplier;
  return { stopLoss, targetPrice };
}
```

### 7. Smart Cache TTL (Phase 1 Optimization)

**Problem**: Historical data never changes but was cached for only 5 seconds
**Solution**: Dynamic TTL based on data age

```typescript
// server/lib/cache.ts
function getSmartTTL(timestamp: number): number {
  const age = Date.now() - timestamp;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;

  if (age > oneDay) {
    // Historical data (>1 day old): cache for 7 days
    return sevenDays;
  } else if (age > oneHour) {
    // Recent data (>1 hour old): cache for 1 hour
    return oneHour;
  } else {
    // Live data (<1 hour old): cache for 5 seconds
    return 5_000;
  }
}

// Automatically set TTL when caching bars
export function setCachedBars(key: string, value: any): void {
  const timestamp = getMostRecentTimestamp(value);
  const ttl = getSmartTTL(timestamp);
  barsCache.set(key, value, { ttl });
}
```

**Impact**: 80-90% fewer API calls for historical queries

### 8. Write-Through Cache with Database Persistence (Phase 1)

**Problem**: Historical data refetched every time, no persistence across restarts
**Solution**: 3-step database-backed cache

```typescript
// server/routes/api.ts
router.get("/api/bars", async (req, res) => {
  // STEP 1: Check database first (10ms query)
  const dbBars = await queryHistoricalBars(symbol, timeframe, from, to);

  if (dbBars && dbBars.length > 0) {
    // Database hit! Return instantly
    return res.json({ bars: dbBars, _source: 'database' });
  }

  // STEP 2: Database miss - fetch from Massive API (500ms)
  const apiResults = await massiveFetch(path);

  // STEP 3: Store in database for future use (async, non-blocking)
  storeHistoricalBars(symbol, timeframe, apiResults).catch(console.warn);

  return res.json({ bars: apiResults, _source: 'api' });
});
```

**Impact**: 10-50x faster repeated queries (database vs API)

### 9. Weekend Pre-Warm Worker (Phase 1)

**Problem**: Users wait 25 seconds for Radar to load on weekends
**Solution**: Pre-fetch data every Friday at market close

```typescript
// server/workers/weekendPreWarm.ts
// Runs Fridays at 4:05pm ET
async function preWarmWeekendCache() {
  // 1. Get all watchlist symbols
  const symbols = await fetchAllWatchlistSymbols();

  // 2. Fetch Friday's bars for all timeframes (1m, 5m, 15m, 1h, 4h)
  const CONCURRENCY_LIMIT = 5; // Respect rate limits
  for (const batch of chunk(symbols, CONCURRENCY_LIMIT)) {
    await Promise.allSettled(
      batch.map(symbol => preWarmSymbol(symbol, fridayDate))
    );
    await delay(1000); // Small delay between batches
  }

  // 3. Store in historical_bars table
  // Next day: Instant access from database
}
```

**Impact**: Weekend Radar load time: 25s → <1s (25x speedup)

### 10. LRU Caching with TTL

```typescript
import LRUCache from "lru-cache";

const cache = new LRUCache<string, CachedData>({
  max: 500, // Max 500 entries
  ttl: 5000, // 5-second TTL
  updateAgeOnGet: false, // Don't reset TTL on read
  allowStale: false, // Reject stale entries
});

const cacheKey = `bars:${symbol}:${timespan}:${from}:${to}`;
```

### 11. Row-Level Security Pattern

```typescript
// ✅ CORRECT: Frontend always uses user client
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await supabase.from("trades").select("*");
// RLS automatically filters by auth.uid()

// ✅ CORRECT: Backend worker uses service role
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Only use in server/workers/* - bypasses RLS

// ❌ WRONG: Never use service role in frontend
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY); // SECURITY RISK!
```

### 9. Runtime Type Validation with ensureArray Utility

**Problem**: Database/API responses may return `null`, `undefined`, or wrong types for array fields
**Solution**: Use validation utilities from `src/lib/utils/validation.ts`

**Critical for**:
- Discord channel arrays (`trade.discordChannels`)
- Challenge arrays (`trade.challenges`)
- Trade updates (`trade.updates`)
- Any data from external sources (Supabase, APIs)

```typescript
import { ensureArray, ensureStringArray, safeIncludes } from '@/lib/utils/validation';

// ✅ CORRECT: Always validate arrays before operations
const channels = ensureArray(trade.discordChannels);
channels.forEach(id => console.log(id)); // Safe

// ✅ CORRECT: Safe includes check
if (safeIncludes(trade.discordChannels, channelId)) {
  // ...
}

// ✅ CORRECT: Filter non-strings
const validIds = ensureStringArray(trade.challengeIds);

// ✅ CORRECT: Safe spreading
const currentUpdates = ensureArray(trade.updates);
const newUpdates = [...currentUpdates, newUpdate];

// ❌ WRONG: Assumes always array
const channels = trade.discordChannels || [];  // May still crash if not array
channels.includes(id);  // TypeError if channels is not array
```

**Implementation** (`src/lib/utils/validation.ts`):
```typescript
export function ensureArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function ensureStringArray(value: any): string[] {
  const arr = ensureArray(value);
  return arr.filter((item): item is string => typeof item === 'string');
}

export function safeIncludes<T>(arr: T[] | any, value: T): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.includes(value);
}
```

**When to Use**:
1. **Component props from stores**: `ensureArray(useTradeStore(s => s.trade.channels))`
2. **Database query results**: `ensureArray(dbTrade.discord_channels)`
3. **Before array operations**: Spreading, mapping, filtering, includes
4. **API responses**: Any external data that should be arrays

---

## 📝 Common Tasks

### Add a New API Endpoint

**File**: `server/routes/api.ts`

```typescript
// 1. Add route
router.get("/api/your-endpoint", async (req, res) => {
  try {
    const data = await yourFunction();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Update TypeScript types in src/types/
// 3. Add tests in server/__tests__/
// 4. Update CLAUDE.md API section
```

### Add a New Zustand Store

**File**: `src/stores/yourStore.ts`

```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface YourStore {
  // State
  data: YourData[];

  // Actions
  loadData(): Promise<void>;
  updateData(id: string, updates: Partial<YourData>): void;
}

export const useYourStore = create<YourStore>()(
  devtools(
    (set, get) => ({
      data: [],

      loadData: async () => {
        const data = await fetchData();
        set({ data });
      },

      updateData: (id, updates) => {
        set((state) => ({
          data: state.data.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        }));
      },
    }),
    { name: "YourStore" }
  )
);
```

**Export**: Add to `src/stores/index.ts`

```typescript
export { useYourStore } from "./yourStore";
```

### Add a Database Table

1. **Create migration**: `scripts/00X_add_your_table.sql`

```sql
CREATE TABLE your_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  -- your columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_your_table_user_id ON your_table(user_id);

-- Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own records"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
  ON your_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add triggers
CREATE TRIGGER your_table_updated_at
  BEFORE UPDATE ON your_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

2. **Apply in Supabase**: Run in SQL Editor
3. **Update TypeScript types**: `src/types/database.ts`
4. **Update CLAUDE.md**: Document the new table

### Add a Composite Signal Detector

**File**: `src/lib/composite/detectors/YourDetector.ts`

```typescript
import { DetectorModule } from "../types";

export const YourDetector: DetectorModule = {
  name: "Your Detector",

  async detect(features, config) {
    // Your detection logic
    const score = calculateScore(features);

    if (score >= config.minScore) {
      return {
        detected: true,
        score,
        opportunityType: "YOUR_OPPORTUNITY_TYPE",
        direction: "LONG", // or 'SHORT'
        confluence: {
          factor1: weight1,
          factor2: weight2,
        },
        entryPrice: features.close,
        stopPrice: calculateStop(features),
        targets: calculateTargets(features),
      };
    }

    return { detected: false, score: 0 };
  },
};
```

**Register**: Add to `src/lib/composite/CompositeScanner.ts`

```typescript
import { YourDetector } from "./detectors/YourDetector";

const detectors = [
  // ... existing detectors
  YourDetector,
];
```

### Run Background Worker Locally

```bash
# Terminal 1: Main app
pnpm dev

# Terminal 2: Composite scanner
pnpm dev:composite

# Terminal 3: Legacy scanner (optional)
pnpm dev:worker
```

---

## 🐛 Troubleshooting

### Tests Failing

```bash
# Run tests with full output
pnpm test

# Run specific test file
pnpm test src/lib/riskEngine/__tests__/calculator.test.ts

# Run in watch mode for debugging
pnpm test:watch

# Check coverage
pnpm test:coverage
```

### Build Broken

```bash
# Clean and rebuild
rm -rf dist server/dist
pnpm build

# Check TypeScript errors
pnpm typecheck

# Check syntax errors
pnpm lint
```

### WebSocket Not Connecting

1. **Check token generation**:

   ```bash
   curl http://localhost:3000/api/ws-token
   # Should return: { "token": "...", "expiresAt": ... }
   ```

2. **Check Massive.com API key**:

   ```bash
   curl http://localhost:3000/api/massive-key-status
   ```

3. **Check WebSocket proxy**:
   ```bash
   # Install wscat: npm install -g wscat
   wscat -c ws://localhost:3000/ws/options
   ```

### Database Queries Failing

1. **Check RLS policies**:

   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'trades';
   ```

2. **Test as specific user**:

   ```sql
   SET request.jwt.claim.sub = 'user-uuid-here';
   SELECT * FROM trades;
   ```

3. **Check Supabase connection**:
   ```bash
   curl http://localhost:3000/api/health
   # Should show supabase: "connected"
   ```

### Massive.com API Errors

1. **Check API key status**:

   ```bash
   curl http://localhost:3000/api/massive-key-status
   ```

2. **Check rate limits**:
   - Massive.com: 5 requests/second
   - App rate limit: 1200 requests/minute

3. **Test endpoint directly**:
   ```bash
   curl "https://api.massive.com/v3/snapshot/indices" \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### E2E Tests Failing in CI

1. **Run locally first**:

   ```bash
   pnpm test:e2e:headed  # See what's happening
   ```

2. **Check for race conditions**:
   - Add `await page.waitForSelector()`
   - Increase timeouts for slow CI

3. **Check CI environment**:
   - `CI=true` disables certain features
   - Check GitHub Actions logs

### Railway Build Errors

**Common Issue**: TypeScript overload resolution errors during `pnpm build`

**Symptoms**:
```
error TS2769: No overload matches this call.
Argument of type '{ symbol: string; timeframe: string; ... }'
```

**Solutions**:

1. **Supabase `.upsert()` type errors**:
   ```typescript
   // ❌ WRONG - TypeScript can't infer types
   .upsert(rows, { onConflict: 'symbol,timeframe,timestamp' })

   // ✅ CORRECT - Add type assertion
   .upsert(rows as any, { onConflict: 'symbol,timeframe,timestamp' })
   ```

2. **Multi-line `.select()` query errors**:
   ```typescript
   // ❌ WRONG - Multi-line template literals cause inference issues
   .select(`
     *,
     trade_updates(*),
     trades_discord_channels(discord_channel_id)
   `)

   // ✅ CORRECT - Use single-line string
   .select('*, trade_updates(*), trades_discord_channels(discord_channel_id)')
   ```

3. **Check `tsconfig.server.json` has permissive options**:
   ```json
   {
     "compilerOptions": {
       "strict": false,
       "skipLibCheck": true,
       "noImplicitAny": false,
       "strictNullChecks": false,
       "strictFunctionTypes": false
     }
   }
   ```

### Runtime Errors in Production

**Common Issue**: `ReferenceError: [variable] is not defined`

**Example**: `volatility is not defined` in `HDConfluenceDetailPanel.tsx`

**Cause**: Using a variable that was removed during refactoring or never defined

**Solution**:
1. Search for the undefined variable in the component
2. Check if it should reference an existing variable (e.g., `volPercentile` instead of `volatility.ivPercentile`)
3. Add proper fallbacks/defaults for computed values

**Prevention**:
- Run `pnpm typecheck` before committing
- Test in development mode with React strict mode enabled
- Use ESLint to catch undefined variables

### Trade Lifecycle Issues

**Common Issue**: Array methods failing with "is not a function" errors

**Symptoms**:
```
TypeError: selectedChannels.includes is not a function
TypeError: trade.updates.map is not a function
```

**Root Cause**: Database queries returning `null` or non-array values for array fields

**Solutions**:

1. **Always validate array types**:
   ```typescript
   // ❌ WRONG - Assumes always array
   const channels = trade.discordChannels || [];

   // ✅ CORRECT - Runtime validation
   const channels = Array.isArray(trade.discordChannels) ? trade.discordChannels : [];
   ```

2. **Use helper utility** (`src/lib/utils/validation.ts`):
   ```typescript
   import { ensureArray } from '@/lib/utils/validation';

   const channels = ensureArray(trade.discordChannels);
   const updates = ensureArray(trade.updates);
   ```

3. **Add defensive checks before spreading**:
   ```typescript
   // ❌ WRONG - May crash if not array
   updates: [...trade.updates, newUpdate]

   // ✅ CORRECT - Safe spreading
   const currentUpdates = Array.isArray(trade.updates) ? trade.updates : [];
   updates: [...currentUpdates, newUpdate]
   ```

**Prevention**:
- Always use `Array.isArray()` checks for data from external sources
- Add runtime type validation at API boundaries
- Use the `ensureArray` utility consistently

---

## 📚 Additional Resources

### Internal Documentation

- `README.md` - Project overview and setup
- `SETUP_GUIDE.md` - Detailed setup instructions
- `QUICKSTART.md` - Quick start guide
- `DEPLOYMENT_GUIDE.md` - Full deployment reference
- `AUDIT_REPORT.md` - Comprehensive code audit (Nov 2025)
- `COMPLETE_SYSTEM_SUMMARY.md` - System architecture overview
- `docs/BACKFILL_GUIDE.md` - Historical data backfill guide
- `src/lib/data-provider/README.md` - Data provider architecture
- `src/docs/options-chain.md` - Options chain implementation
- `docs/GREEKS_STREAMING_ARCHITECTURE.md` - Greeks streaming

### External API Documentation

- [Massive.com API Docs](https://docs.massive.com)
- [Tradier API Docs](https://developer.tradier.com)
- [Supabase Docs](https://supabase.com/docs)

### Framework Documentation

- [React 18](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Vite](https://vitejs.dev)
- [Zustand](https://docs.pmnd.rs/zustand)
- [Radix UI](https://www.radix-ui.com)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)

---

## 🎓 Best Practices for AI Assistants

### Do's ✅

1. **Always read this file first** before making changes
2. **Run tests frequently**: `pnpm test:watch`
3. **Check TypeScript errors**: `pnpm typecheck`
4. **Use the session check**: `pnpm run session-check` before finishing
5. **Follow existing patterns**: Match code style and architecture
6. **Update documentation**: Keep CLAUDE.md current
7. **Write tests**: For new features and bug fixes
8. **Use RLS correctly**: Frontend = user client, Worker = service role
9. **Verify API endpoints**: Only Massive.com and Tradier URLs
10. **Commit frequently**: Logical, small commits with clear messages

### Don'ts ❌

1. **Don't expose API keys** to frontend (no `VITE_*` for secrets)
2. **Don't bypass RLS** in frontend code
3. **Don't use polygon.io** - Only Massive.com and Tradier
4. **Don't skip tests** - Always ensure tests pass
5. **Don't create files unnecessarily** - Prefer editing existing
6. **Don't commit secrets** - Use `.env` files (gitignored)
7. **Don't break the build** - Run `pnpm build` before committing
8. **Don't ignore TypeScript errors** - Fix or document why they exist
9. **Don't modify database schema** without migration SQL
10. **Don't push to main** - Always use feature branches

### Code Review Checklist

Before submitting changes:

- [ ] All tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Code is linted (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Build succeeds (`pnpm build`)
- [ ] No console.logs left in code
- [ ] Documentation updated
- [ ] No secrets exposed
- [ ] RLS policies respected
- [ ] Session check passes (`pnpm run session-check`)

---

## 📞 Support

For issues and questions:

1. Check this CLAUDE.md file first
2. Review README.md and other docs
3. Check browser console for client errors
4. Check server logs for API errors
5. Open a GitHub issue if needed

---

**Remember**: This file is your source of truth. When in doubt, consult CLAUDE.md first!

**Happy coding! 🚀**
