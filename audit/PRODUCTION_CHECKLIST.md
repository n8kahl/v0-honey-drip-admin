# Production Readiness Checklist

**Project**: Honey Drip Admin Trading Dashboard
**Created**: December 8, 2025

Use this checklist to track progress toward production readiness. Items are organized by priority.

---

## Legend

- 🔴 **Must fix before launch** - Blocking issues that prevent production deployment
- 🟡 **Should fix soon after launch** - Important issues to address in first weeks
- 🟢 **Nice to have improvements** - Enhancements for ongoing maintenance

---

## 🔴 Must Fix Before Launch (Critical Blockers)

### Security - Credential Exposure
- [ ] **Rotate Massive.com API key** (exposed in QUICKSTART.md)
- [ ] **Rotate Massive.com proxy token** (exposed in QUICKSTART.md)
- [ ] **Rotate Alpha Vantage API key** (exposed in .env.example)
- [ ] **Review Supabase project security** (URL exposed)
- [ ] **Replace hardcoded keys with placeholders in QUICKSTART.md**
- [ ] **Replace hardcoded key with placeholder in .env.example**
- [ ] **Add git-secrets or pre-commit hook to prevent future exposure**

### Security - Authentication
- [ ] **Remove x-user-id header fallback authentication** (`server/routes/trades.ts:59-68`)
- [ ] **Enforce JWT-only authentication on all trade endpoints**
- [ ] **Add authentication middleware to all sensitive routes**

### Security - Dependency Vulnerabilities
- [ ] **Update express to 4.19.2+** (4 CVEs)
- [ ] **Update vite to latest patch** (3 CVEs)
- [ ] **Run `pnpm audit fix` and verify no breaking changes**
- [ ] **Remove unused `next` dependency** (has vulnerability, not used)

### Security - Code Fixes
- [ ] **Replace Math.random() with crypto.randomUUID()** in:
  - [ ] `src/stores/alertEscalationStore.ts:394`
  - [ ] `src/services/autoPositionService.ts:96`
  - [ ] `src/services/autoPositionService.ts:256`
- [ ] **Remove service role key access from frontend** (`src/lib/backtest/BacktestEngine.ts`)

---

## 🟡 Should Fix Soon After Launch (High Priority)

### Security - Additional Fixes
- [ ] **Sanitize error messages in API responses** (`server/routes/api.ts:330,1517`)
- [ ] **Add SSRF protection to Discord webhook validation** (`server/routes/api.ts:314`)
- [ ] **Remove byteLength check before timingSafeEqual** (`server/routes/api.ts:194`)
- [ ] **Use environment variables for CSP domains** (`server/index.ts:35`)

### Testing - Critical Paths
- [ ] **Add API route tests for trades.ts** (entry, update, delete)
- [ ] **Add API route tests for api.ts** (ws-token, quotes, bars)
- [ ] **Add database integration tests** (RLS policy verification)
- [ ] **Fix E2E test environment setup** (document TEST_USER env vars)

### Performance - Quick Wins
- [ ] **Fix N+1 query in options chain endpoint** (`server/routes/api.ts:643-655`)
  - Replace sequential `for` loop with `Promise.all()`
- [ ] **Parallelize historical bar fetching** (`src/stores/marketDataStore.ts:501`)
- [ ] **Add pagination to getTrades()** (`src/lib/supabase/database.ts:363`)

### Error Handling
- [ ] **Add logging to empty catch blocks**:
  - [ ] `server/ws/hub.ts:73`
  - [ ] `server/ws/hub.ts:84`
  - [ ] `server/ws/hub.ts:97`
  - [ ] `server/ws/hub.ts:136`
  - [ ] `server/ws/hub.ts:148`
  - [ ] `src/lib/massive/indices-advanced.ts:240`
  - [ ] `src/lib/strategy/realtime.ts:37`

### DevOps
- [ ] **Make TypeScript errors blocking in CI** (remove `continue-on-error`)
- [ ] **Make security audit blocking for high/critical** (modify ci.yml)
- [ ] **Set up error tracking** (Sentry, Datadog, or similar)

---

## 🟢 Nice to Have Improvements (Technical Debt)

### Testing - Extended Coverage
- [ ] Add component tests for core UI:
  - [ ] `HDWatchlistRail`
  - [ ] `HDTradeCard`
  - [ ] `HDOptionsChain`
  - [ ] `HDLiveChart`
- [ ] Add service layer tests:
  - [ ] `massiveClient.ts`
  - [ ] `pnlCalculator.ts`
  - [ ] `flowAnalysisService.ts`
- [ ] Enable excluded integration tests (fix mocking issues)
- [ ] Achieve 50% test coverage (currently 14%)

### Code Quality
- [ ] Split `server/routes/api.ts` into smaller modules:
  - [ ] `server/routes/quotes.ts`
  - [ ] `server/routes/bars.ts`
  - [ ] `server/routes/options.ts`
  - [ ] `server/routes/discord.ts`
- [ ] Enable TypeScript strict mode progressively
- [ ] Replace `any` types with proper interfaces
- [ ] Standardize import patterns (remove .js extensions)

### Error Handling
- [ ] Replace console calls with structured logger (`src/lib/utils/logger.ts`)
- [ ] Add granular error boundaries around major features:
  - [ ] Charts
  - [ ] Watchlist
  - [ ] Options Chain
  - [ ] Trade Management
- [ ] Create error classification utility for user-safe messages

### Performance
- [ ] Add composite indexes to database:
  - [ ] `composite_signals(owner, status, created_at)`
  - [ ] `trades_discord_channels(discord_channel_id)`
- [ ] Implement rate limit backoff for Massive.com API
- [ ] Add alert_history retention policy (90 days)
- [ ] Implement REST polling conditional on WebSocket failure

### Documentation
- [ ] Generate OpenAPI documentation for API
- [ ] Update README.md project structure (currently shows Next.js)
- [ ] Add migration ordering documentation
- [ ] Create runbook for common operations

### Dependencies
- [ ] Pin all `latest` dependencies to specific versions
- [ ] Audit and remove unused dependencies:
  - [ ] `next`
  - [ ] `@edge-runtime/vm`
  - [ ] Unused CSS preprocessors
- [ ] Set up Dependabot or Renovate for automated updates

### Monitoring & Observability
- [ ] Add APM (Application Performance Monitoring)
- [ ] Configure alerting for error rate thresholds
- [ ] Add structured logging for audit trails
- [ ] Implement request tracing (correlation IDs)

---

## Verification Checklist

Before declaring production-ready:

### Security Verification
- [ ] All exposed API keys have been rotated
- [ ] No secrets in version control (run git-secrets scan)
- [ ] Authentication requires valid JWT on all endpoints
- [ ] `pnpm audit` shows 0 high/critical vulnerabilities
- [ ] CSP and security headers are properly configured

### Functionality Verification
- [ ] All unit tests pass (`pnpm test`)
- [ ] E2E tests pass (`pnpm test:e2e`)
- [ ] Health endpoint returns healthy status (`/api/health`)
- [ ] WebSocket connections work in production mode
- [ ] Discord alerts send successfully

### Performance Verification
- [ ] Options chain loads in <3 seconds
- [ ] Trade list pagination works correctly
- [ ] No N+1 queries in critical paths
- [ ] Database queries use appropriate indexes

### Deployment Verification
- [ ] Build succeeds without errors (`pnpm build`)
- [ ] TypeScript has no blocking errors
- [ ] Environment variables documented and set
- [ ] Railway deployment health check passes

---

## Progress Tracking

| Phase | Items | Completed | Status |
|-------|-------|-----------|--------|
| Critical Blockers | 14 | 0 | 🔴 Not Started |
| High Priority | 18 | 0 | 🟡 Not Started |
| Nice to Have | 30+ | 0 | 🟢 Not Started |

**Overall Progress**: 0% complete

---

## Quick Reference Commands

```bash
# Security checks
pnpm audit                          # Check for vulnerabilities
grep -r "API_KEY=" . --include="*.md"  # Find exposed keys

# Testing
pnpm test                           # Run unit tests
pnpm test:e2e                       # Run E2E tests
pnpm test:coverage                  # Check coverage

# Build verification
pnpm typecheck                      # TypeScript errors
pnpm build                          # Production build
pnpm lint                           # Linting

# Session check (comprehensive)
pnpm run session-check              # All checks at once
```

---

*Checklist created December 8, 2025 based on production readiness audit*
