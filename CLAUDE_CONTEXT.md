# Claude Code Context - Honey Drip Admin Trading Dashboard

> **Purpose**: This document provides AI assistants with comprehensive context about the codebase architecture, patterns, and critical business logic. Always reference this file when working on the project.

---

## 📋 Project Overview

**Honey Drip Admin** is a real-time options trading dashboard that integrates with:

- **Massive.com**: Real-time options data via WebSocket and REST API
- **Tradier**: Market data and order execution
- **Supabase**: PostgreSQL database with Row-Level Security (RLS)
- **Railway**: Deployment platform

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js + TypeScript + WebSocket
- **Database**: PostgreSQL (Supabase) with RLS policies
- **Testing**: Vitest (unit) + Playwright (E2E)
- **State Management**: Zustand

---

## 🏗️ Architecture Overview

### Directory Structure

```
/src                    # Frontend React application
  /components          # UI components (Radix UI + shadcn/ui)
  /lib                 # Core business logic
    /massive           # Massive.com WebSocket/REST integration
    /riskEngine        # Risk calculations (position sizing, Greeks)
    /strategy          # ML models & trading strategies
    /marketData        # Market data providers with fallback
  /stores              # Zustand state management
  /hooks               # Custom React hooks

/server                # Express backend
  /index.ts            # Main server with WebSocket proxies
  /workers             # Background jobs (scanner.ts)
  /dist                # Compiled output (git-ignored)

/e2e                   # Playwright E2E tests
/scripts               # SQL migrations and utilities
```

---

## 🔑 Critical Business Logic

### 1. Real-time Data Flow (Massive.com)

**Architecture**: Intelligent fallback system (WebSocket → REST)

```
User Request → Frontend → WebSocket Proxy → Massive.com WebSocket
                                  ↓ (if fails)
                            REST API Fallback
```

**Key Files**:

- `src/lib/massive/websocket-client.ts` - WebSocket connection with auto-reconnect
- `src/lib/massive/index.ts` - REST API client with LRU caching
- `server/index.ts:150-250` - WebSocket proxy endpoints

**Common Pattern**:

```typescript
// Always use the dual-mode provider
import { useMassiveOptionsChain } from "@/lib/massive";

// This automatically falls back to REST if WebSocket fails
const { data, loading, error } = useMassiveOptionsChain(symbol);
```

### 2. Risk Management System

**Files**: `src/lib/riskEngine/*.ts`

**Core Calculations**:

1. **Position Sizing** (`calculatePositionSize.ts`)
   - Uses Kelly Criterion with risk percentage
   - Enforces max position size limits
   - Accounts for Greeks (delta, gamma, vega)

2. **Greeks Calculations** (`greeks.ts`)
   - Black-Scholes model for option pricing
   - Delta, Gamma, Theta, Vega computations
   - IV (Implied Volatility) calculations

3. **Stop Loss / Take Profit** (`calculateTPSL.ts`)
   - Dynamic TP/SL based on ATR (Average True Range)
   - Market regime awareness (trending vs ranging)
   - VIX-adjusted risk levels

**Critical**: NEVER bypass risk checks when executing trades. All trades MUST pass through `validateTradeRisk()` before execution.

### 3. Database Schema & RLS Policies

**Core Tables**:

```sql
profiles           # User profiles linked to auth.users
discord_channels   # Trading alert channels
challenges         # Trading challenges/competitions
watchlist          # User watchlists
trades             # Executed trades
trade_updates      # Real-time trade status updates
```

**RLS Enforcement**:

- ALL queries use `auth.uid()` for row-level filtering
- Service role key ONLY used for background workers
- Frontend ALWAYS uses user JWT tokens

**Example Query Pattern**:

```typescript
// ✅ CORRECT: Uses RLS automatically
const { data } = await supabase.from("trades").select("*").eq("user_id", user.id); // RLS enforces this

// ❌ WRONG: Never use service role in frontend
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY); // SECURITY RISK!
```

### 4. State Management (Zustand)

**Key Stores**:

- `tradeStore.ts` - Active trades, positions, P&L
- `watchlistStore.ts` - User watchlists
- `marketDataStore.ts` - Real-time market data cache
- `authStore.ts` - User authentication state

**Pattern**:

```typescript
// Subscribe to specific slices to avoid re-renders
const trades = useTradeStore((state) => state.trades);
const addTrade = useTradeStore((state) => state.addTrade);
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)

- **Location**: `src/lib/**/__tests__/`
- **Coverage Target**: 70% (enforced in CI)
- **Run**: `pnpm test` or `pnpm test:watch`

**Key Test Files**:

- `riskEngine/__tests__/` - Position sizing, Greeks, TP/SL
- `strategy/__tests__/` - ML models, market regime detection
- `massive/__tests__/` - WebSocket fallback logic

### E2E Tests (Playwright)

- **Location**: `e2e/`
- **Run**: `pnpm test:e2e`
- **Browser**: Chromium (can add Firefox/Safari)

**Test Suites**:

- `auth.spec.ts` - Login/logout flows
- `trade-discovery.spec.ts` - Options chain loading
- `watchlist.spec.ts` - Add/remove symbols

---

## 🚨 Common Pitfalls & Solutions

### 1. TypeScript Errors After Deployment

**Problem**: Code works locally but breaks in production
**Solution**: ALWAYS run `pnpm typecheck` before committing
**CI Check**: GitHub Actions runs type checks on every PR

### 2. WebSocket Connection Drops

**Problem**: Massive.com WebSocket disconnects after 5 minutes
**Solution**: Auto-reconnect logic in `websocket-client.ts:45`
**Fallback**: REST API takes over seamlessly (check `useMassiveOptionsChain` hook)

### 3. RLS Policy Violations

**Problem**: "Row-level security policy violation" errors
**Solution**: Ensure all queries include `user_id` or use `auth.uid()`
**Debug**: Check `scripts/migrations/*.sql` for policy definitions

### 4. Stale Market Data

**Problem**: Options chain shows outdated prices
**Solution**: LRU cache in `massive/index.ts` has 60-second TTL
**Force Refresh**: Call `refetch()` on the hook

### 5. Test Failures in CI

**Problem**: Tests pass locally but fail in GitHub Actions
**Solution**: Use `CI=true` environment variable to disable flaky features
**Example**: `vitest.config.ts` excludes `src/lib/massive/**` in CI mode

---

## 🔐 Security Best Practices

1. **Never commit secrets** - Use `.env` files (git-ignored)
2. **Use RLS policies** - Database access controlled at row level
3. **Validate all inputs** - Express middleware validates API requests
4. **Rate limiting** - 1200 req/min per IP (see `server/index.ts:30`)
5. **Helmet.js** - Security headers enabled (CSP, HSTS, etc.)
6. **CORS** - Whitelist allowed origins only

---

## 🚀 Development Workflow

### Before Starting Work

1. **Pull latest changes**: `git pull origin main`
2. **Install dependencies**: `pnpm install`
3. **Check environment**: Copy `.env.example` to `.env.local`

### Making Changes

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Run tests**: `pnpm test` (watch mode: `pnpm test:watch`)
3. **Type check**: `pnpm typecheck`
4. **Lint & format**: `pnpm lint:fix && pnpm format`

### Pre-Commit (Automatic via Husky)

- **Lint-staged** runs on changed files
- **Type checking** on entire codebase
- **Commit blocked** if errors found

### CI/CD Pipeline (GitHub Actions)

1. **On PR/Push**:
   - Type checking
   - Unit tests with coverage
   - E2E tests
   - Linting & formatting
   - Security audit

2. **On Merge to Main**:
   - All checks pass → "Deployment Ready" ✅
   - Manual deployment to Railway (for now)

---

## 📊 Performance Optimization

### Frontend

- **Code splitting**: Vite automatically splits routes
- **Lazy loading**: Heavy components use `React.lazy()`
- **Memoization**: `useMemo`/`useCallback` for expensive computations
- **Zustand subscriptions**: Subscribe to specific state slices

### Backend

- **LRU Cache**: Massive.com responses cached (60s TTL)
- **Rate limiting**: Prevents API abuse
- **Compression**: Gzip enabled for responses
- **WebSocket pooling**: Reuse connections

### Database

- **Indexes**: Created on frequently queried columns
- **RLS policies**: Optimized with proper indexes
- **Connection pooling**: Supabase handles automatically

---

## 🐛 Debugging Tips

### 1. Frontend Issues

```bash
# Check browser console for errors
# React DevTools → Components → Zustand stores

# Run dev server with verbose logging
pnpm dev
```

### 2. Backend Issues

```bash
# Check server logs
tsx watch server/index.ts

# Test WebSocket endpoint
wscat -c ws://localhost:5000/ws/options
```

### 3. Database Issues

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'trades';

-- Test query as specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM trades;
```

### 4. Test Failures

```bash
# Run specific test file
pnpm test src/lib/riskEngine/__tests__/greeks.test.ts

# Run E2E tests in headed mode (see browser)
pnpm test:e2e:headed

# Debug mode (step through)
pnpm test:e2e:debug
```

---

## 📝 Code Style & Conventions

### Naming Conventions

- **Components**: PascalCase (`TradeCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useTradeData.ts`)
- **Utilities**: camelCase (`calculateGreeks.ts`)
- **Types**: PascalCase (`Trade`, `OptionsChain`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_POSITION_SIZE`)

### File Organization

- **One component per file** (exception: small sub-components)
- **Co-locate tests**: `__tests__/` next to source files
- **Barrel exports**: Use `index.ts` for public API

### TypeScript

- **Strict mode enabled** - No `any` unless absolutely necessary
- **Explicit return types** - For functions
- **Interface over type** - For object shapes

### Comments

```typescript
// ✅ GOOD: Explains WHY, not WHAT
// Use Kelly Criterion to avoid over-leveraging positions
const optimalSize = calculateKellySize(winRate, payoff);

// ❌ BAD: States the obvious
// Calculate optimal size
const optimalSize = calculateKellySize(winRate, payoff);
```

---

## 🔄 CI/CD Status Checks

Before merging any PR, ensure ALL checks pass:

- ✅ **Type Check** - No TypeScript errors
- ✅ **Unit Tests** - All tests passing (70% coverage)
- ✅ **E2E Tests** - Critical user flows working
- ✅ **Linting** - ESLint rules satisfied
- ✅ **Formatting** - Prettier formatting applied
- ✅ **Security Audit** - No high/critical vulnerabilities

**GitHub Actions** automatically runs these on every push/PR.

---

## 🔄 Session Workflow

### End of Session Checklist

Run this command after every Claude Code session:

```bash
pnpm run session-check
```

This automated script will:

- ✅ Run all tests and report pass rate
- ✅ Check TypeScript errors (non-blocking)
- ✅ Verify build works
- ✅ Show git status (uncommitted changes)
- ✅ Display recent commits
- ✅ Update CLAUDE_CONTEXT.md with latest stats
- ✅ Provide a clear status report

**Example Output**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    📊 SESSION END REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Tests: 140/141 passing
⚠️  TypeScript: 391 errors (non-blocking)
✅ Build: Success
✅ Git: All changes committed

🚀 Status: READY FOR NEXT SESSION
```

### Quick Commands

```bash
# Run tests only
pnpm test

# Run tests in watch mode
pnpm test:watch

# Check TypeScript
pnpm run typecheck

# Run linter
pnpm run lint

# Format code
pnpm run format
```

---

## 🆘 Getting Help

### Internal Resources

1. **This file** (`CLAUDE_CONTEXT.md`) - Architecture overview
2. **README.md** - Setup instructions
3. **Test files** - Examples of expected behavior
4. **GitHub Issues** - Known bugs and feature requests

### External Resources

- **Massive.com API Docs**: https://docs.massive.com
- **Tradier API Docs**: https://developer.tradier.com
- **Supabase Docs**: https://supabase.com/docs
- **Vitest Docs**: https://vitest.dev
- **Playwright Docs**: https://playwright.dev

---

## 🎯 Quick Reference Commands

```bash
# Development
pnpm dev              # Start frontend + backend
pnpm dev:all          # Start frontend + backend + worker

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report
pnpm test:e2e         # Run E2E tests

# Code Quality
pnpm lint             # Check for errors
pnpm lint:fix         # Auto-fix errors
pnpm format           # Format code
pnpm typecheck        # TypeScript check

# Build
pnpm build            # Build for production
pnpm start            # Start production server
```

---

## 🔮 Future Enhancements (Planned)

- [ ] Railway auto-deployment on merge to `main`
- [ ] Slack/Discord notifications for CI failures
- [ ] Multi-browser E2E testing (Firefox, Safari)
- [ ] Visual regression testing
- [ ] Automated dependency updates (Renovate)
- [ ] Performance monitoring (Sentry)

---

**Last Updated**: November 2025
**Maintained By**: Development Team
**Questions?**: Open a GitHub issue or ask Claude Code!
