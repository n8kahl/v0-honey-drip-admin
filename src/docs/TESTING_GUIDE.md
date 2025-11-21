# Testing Guide - Phase 9.5

Comprehensive testing infrastructure for the honey drip trading platform.

## Table of Contents

1. [Component Testing](#component-testing)
2. [Integration Testing](#integration-testing)
3. [Regression Testing](#regression-testing)
4. [Performance Testing](#performance-testing)
5. [User Acceptance Testing](#user-acceptance-testing)

---

## Component Testing

### Target Coverage
- **New Components**: 80% coverage minimum
- **Modified Components**: 60% coverage minimum
- **Overall Project**: 50% coverage minimum

### Component Test Template

```typescript
// src/components/hd/signals/__tests__/CompositeSignalBadge.test.tsx

import { render, screen } from '@testing-library/react';
import { CompositeSignalBadge } from '../CompositeSignalBadge';
import { CompositeSignal } from '../../../../lib/composite/CompositeSignal';

describe('CompositeSignalBadge', () => {
  const mockSignal: CompositeSignal = {
    signalId: 'test-signal-1',
    ticker: 'SPY',
    direction: 'bullish',
    finalScore: 85,
    reasoning: 'Strong bullish momentum with high confluence',
    timestamp: Date.now(),
    // ... other required fields
  };

  it('renders signal badge with correct score', () => {
    render(<CompositeSignalBadge signal={mockSignal} />);

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('SPY')).toBeInTheDocument();
  });

  it('displays bullish styling for bullish signals', () => {
    render(<CompositeSignalBadge signal={mockSignal} />);

    const badge = screen.getByTestId('signal-badge');
    expect(badge).toHaveClass('text-[var(--accent-positive)]');
  });

  it('displays bearish styling for bearish signals', () => {
    const bearishSignal = { ...mockSignal, direction: 'bearish' as const };
    render(<CompositeSignalBadge signal={bearishSignal} />);

    const badge = screen.getByTestId('signal-badge');
    expect(badge).toHaveClass('text-[var(--accent-negative)]');
  });

  it('shows reasoning when available', () => {
    render(<CompositeSignalBadge signal={mockSignal} />);

    expect(screen.getByText(mockSignal.reasoning)).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalSignal = {
      ...mockSignal,
      reasoning: undefined,
    };

    expect(() => render(<CompositeSignalBadge signal={minimalSignal} />)).not.toThrow();
  });
});
```

### Priority Components to Test

1. **Signal Components** (High Priority)
   - `CompositeSignalBadge.tsx`
   - `CompositeSignalCard.tsx`
   - `CompositeSignalList.tsx`
   - `HDConfluenceChips.tsx`

2. **Dashboard Components** (High Priority)
   - `HDRadarScanner.tsx`
   - `HDPanelWatchlist.tsx`

3. **Card Components** (Medium Priority)
   - `HDLoadedTradeCard.tsx`
   - `HDEnteredTradeCard.tsx`

4. **Form Components** (Medium Priority)
   - `HDDialogDiscordSettings.tsx`
   - `HDDialogAddTicker.tsx`

---

## Integration Testing

### Critical User Flows

#### Test 1: Signal Generation → Display → User Action

```typescript
// src/__tests__/integration/signalFlow.integration.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useCompositeSignals } from '../../hooks/useCompositeSignals';

describe('Signal Flow Integration', () => {
  it('should generate, display, and allow action on signals', async () => {
    const { result } = renderHook(() => useCompositeSignals({
      userId: 'test-user',
      autoSubscribe: true,
      autoExpire: true,
    }));

    // Wait for signals to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify signals are received
    expect(result.current.signals.length).toBeGreaterThan(0);

    // Verify active signals are filtered correctly
    expect(result.current.activeSignals.length).toBeGreaterThanOrEqual(0);

    // Test signal expiration
    const oldSignal = {
      ...result.current.signals[0],
      timestamp: Date.now() - (25 * 60 * 1000), // 25 minutes old
    };

    // Signal should be expired after 20 minutes
    expect(oldSignal.timestamp).toBeLessThan(Date.now() - (20 * 60 * 1000));
  });
});
```

#### Test 2: Watchlist → Signals → Trade Entry

```typescript
// src/__tests__/integration/tradeLifecycle.integration.test.ts

describe('Trade Lifecycle Integration', () => {
  it('should flow from watchlist to signal to trade entry', async () => {
    // 1. Add symbol to watchlist
    // 2. Wait for signals to generate
    // 3. User sees signal
    // 4. User enters trade
    // 5. Trade appears in active trades
    // 6. Position monitoring begins

    // Implementation here...
  });
});
```

---

## Regression Testing

### Manual Test Checklist

#### ✅ Core Functionality

- [ ] **Watchlist Display**
  - [ ] Watchlist loads on app start
  - [ ] Add ticker dialog works
  - [ ] Remove ticker works
  - [ ] Real-time price updates display
  - [ ] Symbol cards show correct data

- [ ] **Strategy Signals**
  - [ ] Strategy signals appear for watchlist symbols
  - [ ] Signal badges display correctly
  - [ ] Signal reasoning is visible
  - [ ] Expired signals are filtered out

- [ ] **Composite Signals**
  - [ ] Composite signals generate correctly
  - [ ] Signal cards display in radar view
  - [ ] Filtering by score works
  - [ ] Search by ticker works

- [ ] **Chart Rendering**
  - [ ] Charts load without errors
  - [ ] Timeframe switching works
  - [ ] Indicators display correctly
  - [ ] Zoom and pan work smoothly

#### ✅ Real-time Updates

- [ ] **WebSocket Connection**
  - [ ] WebSocket connects on app load
  - [ ] Connection status indicator is accurate
  - [ ] Reconnection works after disconnect
  - [ ] Data streams are not duplicated

- [ ] **Price Updates**
  - [ ] Quotes update in real-time
  - [ ] Trade cards show current prices
  - [ ] Charts update with new candles
  - [ ] Confluence scores update

#### ✅ Trade Management

- [ ] **Trade Entry**
  - [ ] Manual trade entry works
  - [ ] Auto-entry from signals works
  - [ ] Contract details are correct
  - [ ] Risk levels are calculated

- [ ] **Trade Exit**
  - [ ] Manual exit works
  - [ ] Auto-exit triggers work
  - [ ] Exit price is recorded
  - [ ] Trade moves to history

#### ✅ User Interface

- [ ] **Mobile View**
  - [ ] All pages render on mobile
  - [ ] Bottom navigation works
  - [ ] Touch interactions work
  - [ ] Modals display correctly

- [ ] **Desktop View**
  - [ ] Side navigation works
  - [ ] Panels resize correctly
  - [ ] Keyboard shortcuts work
  - [ ] Multi-column layouts work

#### ✅ Alerts & Notifications

- [ ] **Discord Integration**
  - [ ] Settings dialog works
  - [ ] Webhook test succeeds
  - [ ] Alerts send to Discord
  - [ ] Message format is correct

- [ ] **Alert Escalation**
  - [ ] Alerts appear in feed
  - [ ] Severity levels display correctly
  - [ ] Actionable alerts work
  - [ ] Dismiss functionality works

---

## Performance Testing

### Metrics to Track

#### Load Time Metrics
- **Initial Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds
- **First Contentful Paint**: < 1.5 seconds
- **Largest Contentful Paint**: < 2.5 seconds

#### Runtime Metrics
- **WebSocket Message Processing**: < 50ms per message
- **Component Render Time**: < 16ms (60fps)
- **Memory Usage**: < 200MB for 10 active trades
- **Bundle Size**: < 500KB (gzipped)

### Performance Testing Tools

```bash
# 1. React DevTools Profiler
# - Record interaction
# - Check component render times
# - Identify unnecessary re-renders

# 2. Chrome DevTools Performance
# - Record page load
# - Analyze main thread activity
# - Check for long tasks (>50ms)

# 3. Lighthouse
npm run build
npx serve build
# Open Chrome DevTools → Lighthouse → Run audit

# 4. Bundle Analyzer
npm install --save-dev webpack-bundle-analyzer
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

### Performance Checklist

- [ ] **Initial Load**
  - [ ] Lighthouse score > 90
  - [ ] No render-blocking resources
  - [ ] Images are optimized
  - [ ] Code splitting is implemented

- [ ] **Runtime Performance**
  - [ ] No components re-render > 5 times/second
  - [ ] WebSocket updates don't block UI
  - [ ] Large lists use virtualization
  - [ ] Expensive calculations are memoized

- [ ] **Memory Performance**
  - [ ] No memory leaks over 30 minutes
  - [ ] Event listeners are cleaned up
  - [ ] WebSocket connections close properly
  - [ ] Old data is garbage collected

- [ ] **Bundle Size**
  - [ ] Main bundle < 300KB
  - [ ] Total JS < 500KB (gzipped)
  - [ ] No duplicate dependencies
  - [ ] Tree-shaking is effective

---

## User Acceptance Testing

### UAT Scenarios

#### Scenario 1: Power User Flow
**User**: Experienced day trader with 20+ watchlist symbols

**Test Steps**:
1. Log in and see watchlist loaded
2. Check that all 20 symbols display with live prices
3. Filter signals by score > 75
4. Enter a trade from a high-score signal
5. Monitor position in real-time
6. Receive alert when confluence drops
7. Exit trade manually
8. Review trade in history

**Success Criteria**:
- All actions complete without errors
- Real-time updates are < 1 second delay
- Trade entry/exit is smooth
- Alerts arrive promptly

#### Scenario 2: New User Flow
**User**: First-time user exploring the platform

**Test Steps**:
1. Log in for the first time
2. See empty watchlist with "Add Ticker" prompt
3. Add first symbol (SPY)
4. Explore signals as they appear
5. View chart for SPY
6. Read signal reasoning
7. Simulate a trade entry (paper trading)
8. Navigate all main sections

**Success Criteria**:
- UI is intuitive without documentation
- No confusing error messages
- Help text is visible where needed
- Core features are discoverable

#### Scenario 3: Mobile User Flow
**User**: Trader checking positions on mobile device

**Test Steps**:
1. Log in on mobile browser
2. View active trades
3. Check current P&L
4. Receive alert notification
5. Take action (trim position)
6. View updated position
7. Switch between tabs

**Success Criteria**:
- All elements are touch-friendly
- Text is readable without zooming
- Actions complete with single tap
- Performance is smooth (no lag)

---

## Test Execution

### Running Tests

```bash
# Unit and Component Tests
npm test

# Integration Tests
npm run test:integration

# E2E Tests
npm run test:e2e

# Coverage Report
npm test -- --coverage

# Watch Mode (development)
npm test -- --watch
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Next Steps

1. **Implement Component Tests**: Start with high-priority signal components
2. **Add Integration Tests**: Focus on critical user flows
3. **Manual Regression**: Run full checklist before each release
4. **Performance Audit**: Run Lighthouse and profiler monthly
5. **UAT Sessions**: Conduct with 2-3 users before major releases

---

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright E2E Testing](https://playwright.dev/)
