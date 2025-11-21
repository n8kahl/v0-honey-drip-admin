# Type Safety & Test Improvements Guide

This document tracks TypeScript and test issues that need to be fixed incrementally.

## Current Status

- **TypeScript Errors**: 391 (down from 450)
- **Failing Unit Tests**: 29 out of 155
- **Test Pass Rate**: 81% (126/155 passing)

## TypeScript Configuration Strategy

We're using a **gradual typing approach**:

- `strict: false` - Temporarily disabled to allow incremental fixes
- `noImplicitAny: false` - Allow implicit any for now
- `strictNullChecks: false` - Allow null/undefined flexibility

### Goal

Gradually tighten these settings as code improves, eventually reaching `strict: true`.

---

## Priority 1: Critical Type Errors (Fix First)

### 1. Module Resolution Issues

**Files Affected**: Multiple components importing from `@/lib/massive/options-advanced` and `@/types`

**Error Example**:

```
src/components/Cockpit/FlowPanel.tsx(4,52): error TS2307: Cannot find module '@/lib/massive/options-advanced'
```

**Fix**:

- Verify path mappings in `tsconfig.json` match `vite.config.ts`
- Ensure barrel exports in `src/types/index.ts` export all necessary types

### 2. react-day-picker API Changes

**File**: `components/ui/calendar.tsx`

**Errors**: 13 errors related to API changes in react-day-picker v8.10.1

**Fix Options**:

1. **Upgrade approach**: Update component to use new react-day-picker API
2. **Replace approach**: Use a different date picker library (e.g., date-fns + custom UI)
3. **Lock version**: Downgrade to compatible version if API breaking

**Resources**:

- [react-day-picker v8 Migration Guide](https://react-day-picker.js.org/guides/upgrading)

### 3. String Literal Inconsistencies

**Pattern**: `"trail-stop"` vs `"trail_stop"` mismatches

**Files**:

- `src/components/hd/HDAlertComposer.tsx`
- `src/components/hd/HDPanelDiscordAlert.tsx`

**Errors**:

```
error TS2367: This comparison appears to be unintentional because the types
'"trail-stop"' and '"trail_stop"' have no overlap.
```

**Fix**: Standardize on one format (recommend `"trail-stop"` with hyphens)

---

## Priority 2: Missing Type Properties

### Trade Type Missing Properties

**Added (✅ Fixed)**:

```typescript
export interface Trade {
  // ... existing properties
  movePrice?: number; // ✅ Added
  confluence?: {
    // ✅ Added
    trend?: string;
    volatility?: string;
    liquidity?: string;
    strength?: string;
  };
}
```

**Still Missing** (need to add):

```typescript
confluence?: {
  trend?: string;
  volatility?: string;
  liquidity?: string;
  strength?: string;
  rsi14?: number;        // ❌ Missing
  macdSignal?: string;   // ❌ Missing
  volumeChange?: number; // ❌ Missing
}
```

### Contract Type Missing Properties

**Fixed**:

```typescript
export interface Contract {
  expiry: string;
  expiration?: string; // ✅ Added for compatibility
}
```

### Challenge Type Missing Properties

**Fixed**:

```typescript
export interface Challenge {
  scope?: ChallengeScope; // ✅ Added
}
```

### SymbolData Type Issues

**Files**: `src/components/Watchlist/MobileWatchlist.tsx`

**Missing Properties**:

- `bars?: Bar[]`
- `flowMetrics?: FlowMetrics`

**Action**: Find `SymbolData` type definition and add these properties

---

## Priority 3: Failing Unit Tests (29 failures)

### Test Category: Trade Type Inference

**File**: `src/lib/riskEngine/__tests__/profiles.test.ts`

**Failing Tests**:

1. `should classify 2 DTE as SCALP` - Expected SCALP, got something else
2. `should classify 14 DTE as DAY` - Expected DAY, got SWING
3. `should classify 60 DTE as SWING` - Expected SWING, got LEAP

**Root Cause**: DTE (Days to Expiration) thresholds changed in business logic

**Fix Options**:

1. **Update tests** to match new thresholds (if intentional)
2. **Revert business logic** to match original thresholds
3. **Document threshold changes** in CLAUDE_CONTEXT.md

**Action Required**:

- Review `src/lib/riskEngine/profiles.ts` - check `inferTradeTypeByDTE` function
- Determine if threshold changes were intentional
- Update tests or revert code accordingly

### Other Test Failures

Run `pnpm test` to see full list. Common patterns:

- **Strategy tests**: ML model prediction mismatches
- **Risk engine tests**: Greek calculation differences
- **Market regime tests**: Regime detection threshold changes

---

## Incremental Improvement Plan

### Week 1-2: Foundation

- [ ] Fix all module resolution errors (@/types, @/lib imports)
- [ ] Standardize string literals (trail-stop vs trail_stop)
- [ ] Add missing properties to core types (Trade, Contract, Challenge)

### Week 3-4: Components

- [ ] Fix react-day-picker calendar component
- [ ] Fix SymbolData type issues in Watchlist components
- [ ] Fix HDHeader props mismatch in VoiceCommandDemo

### Week 5-6: Tests

- [ ] Fix DTE classification tests (review threshold changes)
- [ ] Fix strategy pattern detection tests
- [ ] Fix Greek calculation tests

### Week 7-8: Gradual Strictness

- [ ] Enable `noImplicitAny: true`
- [ ] Fix all implicit any errors (run typecheck, fix systematically)
- [ ] Enable `strictNullChecks: true`
- [ ] Add null checks where needed

### Week 9+: Full Strict Mode

- [ ] Enable `strict: true`
- [ ] Fix remaining strict mode errors
- [ ] Add stricter linting rules
- [ ] Achieve 100% test pass rate

---

## Quick Fixes (Low Hanging Fruit)

### 1. Fix String Literal Mismatches (30 mins)

```bash
# Find all trail_stop usage
grep -r "trail_stop" src/

# Replace with trail-stop
find src/ -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/trail_stop/trail-stop/g'
```

### 2. Add Missing Confluence Properties (15 mins)

In `src/types/index.ts`:

```typescript
confluence?: {
  trend?: string;
  volatility?: string;
  liquidity?: string;
  strength?: string;
  rsi14?: number;
  macdSignal?: string;
  volumeChange?: number;
};
```

### 3. Fix HDHeaderProps (10 mins)

Add missing prop to HDHeader component:

```typescript
export interface HDHeaderProps {
  // ... existing props
  dataTimestamp?: Date;
  dataStale?: boolean;
}
```

---

## CI/CD Integration

### Current Setup

✅ **Type checking runs but doesn't block** (continue-on-error: true)
✅ **Unit tests run and report failures**
✅ **ESLint runs and reports issues**
✅ **Prettier checks formatting**

### Future Goals

1. **Remove `continue-on-error` from typecheck** once errors < 50
2. **Enforce 100% test pass rate** before merging to main
3. **Add coverage thresholds** per module (already set to 70% global)

---

## Resources

- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/
- **Gradual Type Migration**: https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html
- **Testing Best Practices**: https://vitest.dev/guide/
- **CLAUDE_CONTEXT.md**: Internal architecture documentation

---

## Notes

- **Don't rush!** Type safety improvements should be incremental
- **Test after every change**: `pnpm typecheck && pnpm test`
- **Ask AI assistants for help**: Reference this file and CLAUDE_CONTEXT.md
- **Document business logic changes**: Update tests AND comments when logic changes

---

**Last Updated**: November 2025
**Maintained By**: Development Team
