# Frontend Audit Report - Honey Drip Admin Dashboard
**Date**: November 22, 2025
**Auditor**: Claude Code
**Scope**: Complete frontend UI/UX, navigation, layout, and data freshness

---

## Executive Summary

This audit identifies **critical gaps** in navigation consistency, mobile/desktop parity, and data freshness across the Honey Drip Admin trading dashboard. The findings are organized into **actionable phases** that can be implemented incrementally without breaking backend configurations.

### Key Findings

- ✅ **Working**: 7 routes defined, React Router navigation, desktop tabs
- ⚠️ **Issues**: Mobile nav missing 2 tabs, no access to Radar page, inconsistent layouts
- 🔴 **Critical**: Data staleness indicators inconsistent, no unified refresh strategy

---

## 1. Navigation Audit

### Current Routes (router.tsx)

| Route | Page | Desktop Nav | Mobile Nav | Status |
|-------|------|-------------|------------|--------|
| `/` | Live View (Watch) | ✅ Yes | ✅ Yes | Working |
| `/active` | Active Trades | ✅ Yes | ✅ Yes | Working |
| `/history` | Trade History | ✅ Yes | ✅ Yes | Working |
| `/settings` | Settings | ❌ No | ❌ No | **Hidden** |
| `/monitoring` | Monitoring Dashboard | ✅ Yes | ❌ No | **Desktop Only** |
| `/radar` | Composite Signal Radar | ❌ No | ❌ No | **Orphaned** |
| `/trades/:id` | Trade Detail | ❌ No | ❌ No | **Deep Link Only** |

### Issues Identified

#### 🔴 Critical - Navigation Gaps

1. **Mobile Bottom Nav Incomplete** (MobileBottomNav.tsx:14-18)
   - Only shows: Watch, Trade, Review
   - Missing: Settings, Monitoring
   - Users cannot access settings on mobile devices

2. **Radar Page Orphaned** (router.tsx:53-58)
   - No navigation link from any page
   - Valuable composite signal scanner hidden
   - Requires manual URL entry

3. **Settings Access Inconsistent**
   - Desktop: No tab in main nav (hidden)
   - Mobile: No bottom nav item
   - Only accessible via keyboard shortcut `4`

#### ⚠️ Medium - Navigation UX

4. **Trade Detail Page** (router.tsx:61-66)
   - No breadcrumb navigation back to parent
   - Deep links work but no UI entry points
   - Missing from any list views

5. **Monitoring Tab**
   - Desktop only (App.tsx:274)
   - Mobile users have no access
   - Important for system health visibility

---

## 2. Layout & Responsiveness Audit

### Desktop Layout Issues

#### ✅ Working
- Tab navigation in header
- TraderHeader component
- LiveStatusBar component
- Proper routing via React Router

#### ⚠️ Issues

1. **Conditional Panel Rendering** (App.tsx:280-303)
   ```tsx
   hideDesktopPanels={activeTab === 'active'}
   hideMobilePanelsOnActiveTab={activeTab === 'active'}
   ```
   - Complex visibility logic
   - Panels hide/show based on activeTab
   - May confuse users (panels disappear)

2. **No Settings Tab in Desktop Nav** (App.tsx:256-277)
   - Settings accessible via keyboard only
   - Inconsistent with mobile behavior
   - Poor discoverability

### Mobile Layout Issues

#### ✅ Working
- MobileBottomNav with 3 tabs
- Safe area insets
- Flash animations for active trades
- Responsive breakpoints (lg:)

#### 🔴 Critical

3. **Mobile Bottom Nav Missing Tabs** (MobileBottomNav.tsx)
   - Only 3 tabs vs 5 routes
   - Settings hidden completely
   - Monitoring not accessible

4. **Mobile Active Tab Duplicate** (App.tsx:316-324)
   ```tsx
   {activeTab === 'active' && (
     <div className="lg:hidden">
       <MobileActive ... />
     </div>
   )}
   ```
   - DesktopLiveCockpitSlim also renders on `active` tab
   - Potential double rendering on mobile

5. **No Mobile Access to Radar**
   - Valuable feature hidden from mobile users
   - Should be integrated or linked

### Responsive Design Gaps

6. **Inconsistent Breakpoint Usage**
   - Using `lg:` prefix throughout
   - No `md:` or `sm:` granularity
   - May cause jarring transitions on tablets

7. **Mobile-Specific Components**
   - MobileActive, MobileLive, MobileHistory exist
   - But not consistently used across all routes
   - Settings page has no mobile variant

---

## 3. Data Freshness Audit

### Current Freshness Indicators

#### ✅ Implemented
- `HDDataAsOf` component (src/components/hd/common/HDDataAsOf.tsx)
- `HDBadgeFreshness` component (src/components/hd/signals/HDBadgeFreshness.tsx)
- Staleness threshold in marketDataStore (30 seconds)
- LRU cache in Massive API (60s TTL) (CLAUDE_CONTEXT.md:202)

#### ⚠️ Inconsistent

8. **No Global Refresh Strategy**
   - Market data polls every 60s (App.tsx:198)
   - User data loaded once on auth (App.tsx:175)
   - No manual refresh button

9. **Staleness Calculation Fragmented**
   - Different components calculate staleness independently
   - No centralized "as of" timestamp store
   - Inconsistent thresholds (30s vs 60s)

10. **WebSocket Fallback Transparency**
    - WebSocket → REST fallback is silent (CLAUDE_CONTEXT.md:59-61)
    - Users don't know which transport is active
    - No indicator for degraded mode

### Data Refresh Patterns

| Component | Refresh Strategy | Staleness Indicator | Status |
|-----------|------------------|---------------------|--------|
| Watchlist | WebSocket + 60s poll | ✅ HDDataAsOf | Good |
| Active Trades | Real-time via store | ❌ None | Missing |
| Composite Signals | Auto-subscribe hook | ✅ HDBadgeFreshness | Good |
| Market Session | 60s poll | ❌ None | Missing |
| Discord Channels | Load once | ❌ None | Missing |

---

## 4. Component Organization Audit

### Component Structure

```
src/components/
├── hd/                    # Honey Drip design system (71 files)
│   ├── alerts/           # Alert feed & composer
│   ├── cards/            # Trade/watchlist cards
│   ├── charts/           # Price charts & sparklines
│   ├── common/           # Shared HD components
│   ├── dashboard/        # Dashboard panels
│   ├── forms/            # Dialogs & forms
│   ├── layout/           # Header, command rail
│   ├── signals/          # Confluence & freshness badges
│   └── voice/            # Voice command UI
├── layouts/              # AppLayout, RadarLayout
├── monitoring/           # MonitoringDashboard
├── settings/             # SettingsPage components
├── shortcuts/            # KeyboardShortcutsDialog
├── trading/              # Trading workspace
└── Mobile*.tsx           # 6 mobile-specific components
```

### Issues

11. **Mobile Component Inconsistency**
    - 6 mobile components at root level
    - Should be in `components/mobile/` directory
    - Hard to track mobile-specific code

12. **HD Component Overload**
    - 71+ HD components in nested structure
    - Some may be unused or duplicates
    - No component usage audit

13. **Missing Page Components**
    - Only 3 pages in `src/pages/` (AuthPage, RadarPage, TradeDetailPage)
    - Other "pages" are components in App.tsx
    - Inconsistent architecture

---

## 5. Usability & Flow Audit

### User Flows

#### ✅ Working Flows
1. **Login → Watch → Load Ticker → View Trade**
2. **Keyboard Shortcuts** (App.tsx:102-159)
   - Keys 1-5 for navigation
   - Ctrl+? / Cmd+? for help
   - Escape to close dialogs

#### 🔴 Broken/Missing Flows

14. **No Trade Detail Navigation**
    - Trade cards don't link to `/trades/:id`
    - Detail page exists but unreachable
    - Users can't deep-dive into trade details

15. **No Breadcrumb Navigation**
    - BreadcrumbNav component exists (src/components/navigation/BreadcrumbNav.tsx)
    - But not used on any page
    - Users can't track navigation hierarchy

16. **Settings Not Discoverable**
    - No button in header
    - No menu item
    - Only keyboard shortcut `4`

17. **Radar Scanner Orphaned**
    - Powerful composite signal feature
    - No link from Watch tab
    - Should integrate with live view

### Flash Animations & Notifications

#### ✅ Working
- `flashTradeTab` animation when trades update
- `updatedTradeIds` highlight in trade lists
- Toast notifications via Sonner

#### ⚠️ Issues

18. **Flash Effect Overuse**
    - Trade tab flashes on updates (App.tsx:115-117)
    - May distract during high-frequency trading
    - No user setting to disable

19. **No Visual Feedback for Stale Data**
    - Data freshness badges exist
    - But not prominent enough
    - Users may trade on stale data

---

## 6. Missing Features & Pages

### Missing Pages

20. **No Dashboard/Home Page**
    - `/` goes directly to Live view
    - Could use a summary dashboard
    - Overview of P&L, portfolio health, signals

21. **No Profile Page**
    - User profile exists in DB (`profiles` table)
    - No UI to view/edit profile
    - Missing user preferences

22. **No Challenges Detail Page**
    - Challenges tracked in DB
    - HDDialogChallengeDetail exists but modal only
    - Should have dedicated page for challenge leaderboard

23. **No Alerts History Page**
    - Discord alerts sent (CLAUDE_CONTEXT.md:109)
    - No log of sent alerts
    - Can't review past notifications

### Missing Features

24. **No Global Search**
    - Can't search for symbols across app
    - Should add Cmd+K command palette
    - Search trades, symbols, challenges

25. **No Export Functionality**
    - Can't export trade history
    - No CSV/PDF reports
    - Limited analytics

26. **No Dark/Light Mode Toggle**
    - Uses CSS variables but no switcher
    - Should respect system preference
    - Add manual toggle in settings

---

## 7. Performance & Optimization

### Current Optimizations

#### ✅ Implemented
- Lazy loading for TradeDetailPage and RadarPage (router.tsx:12-13)
- Zustand state subscriptions (CLAUDE_CONTEXT.md:144)
- LRU cache for Massive API (CLAUDE_CONTEXT.md:202)
- React.useMemo for computed values (App.tsx:87, 102)

#### ⚠️ Needs Optimization

27. **No Code Splitting for Routes**
    - Only 2 pages lazy loaded (radar, trade detail)
    - Main App component not split
    - Bundle size could be reduced

28. **Watchlist Updates**
    - Full watchlist re-render on quote update (App.tsx:165-169)
    - Should use virtualization for large lists
    - Consider React Virtualized or TanStack Virtual

29. **Composite Signals Always Active** (App.tsx:91-99)
    - Signals subscribed even when not viewing
    - Should pause on inactive tabs
    - Waste of resources

30. **Market Data Store Initialization** (App.tsx:206-217)
    - Reinitializes on watchlist length change
    - Could be smarter (add/remove only delta)
    - Full cleanup/restart is heavy

---

## 8. Accessibility (A11y) Audit

### Current State

#### ✅ Good
- Keyboard shortcuts implemented (useKeyboardShortcuts)
- a11y.ts utility file exists (src/lib/a11y.ts)
- Radix UI components (accessible by default)

#### 🔴 Critical

31. **No Keyboard Navigation for Trade Cards**
    - Cards not focusable
    - Can't tab through watchlist
    - Screen reader support missing

32. **No ARIA Labels**
    - Buttons without aria-label
    - Interactive elements unlabeled
    - Poor screen reader experience

33. **Color-Only Indicators**
    - P&L shown with green/red only
    - No icons or patterns
    - Fails WCAG 2.1 AA

34. **No Focus Indicators**
    - Buttons don't show focus state
    - Keyboard users can't see position
    - Need `:focus-visible` styles

---

## 9. Prioritized Improvement Roadmap

### Phase 1: Critical Navigation Fixes (Week 1)

**Goal**: Make all routes accessible, fix mobile nav

#### Tasks

1. **Add Settings & Monitoring to Mobile Nav**
   - Update `MobileBottomNav.tsx` to include 5 tabs
   - Use horizontal scroll or expandable menu
   - Ensure safe area compatibility

2. **Add Radar Link to Main Nav**
   - Add "Radar" tab to desktop nav
   - Add to mobile nav or as button in Watch tab
   - Make feature discoverable

3. **Add Settings Button to Desktop Header**
   - Add gear icon to TraderHeader
   - Consistent with mobile expectations
   - Remove reliance on keyboard shortcut

4. **Fix Trade Detail Navigation**
   - Make trade cards clickable → navigate to `/trades/:id`
   - Add breadcrumb nav to TradeDetailPage
   - Add back button

**Files to Modify**:
- `src/components/MobileBottomNav.tsx`
- `src/App.tsx` (desktop nav)
- `src/components/Header/TraderHeader.tsx`
- `src/components/hd/cards/HDEnteredTradeCard.tsx` (add onClick)
- `src/pages/TradeDetailPage.tsx` (add breadcrumb)

**Backend Impact**: ✅ None (navigation only)

---

### Phase 2: Layout Consistency (Week 2)

**Goal**: Harmonize mobile/desktop layouts, improve responsiveness

#### Tasks

5. **Create Mobile Settings Page**
   - Adapt SettingsPage for mobile
   - Ensure all settings accessible on small screens
   - Test on iOS/Android

6. **Create Mobile Monitoring View**
   - Adapt MonitoringDashboard for mobile
   - Simplified metrics for small screens
   - Swipeable cards

7. **Unify Panel Visibility Logic**
   - Remove `hideDesktopPanels` conditional logic
   - Make panels consistently visible
   - Use layout instead of hiding

8. **Add Tablet Breakpoints**
   - Define `md:` breakpoint styles
   - Optimize for iPad/tablet screens
   - Test transitions between breakpoints

9. **Reorganize Mobile Components**
   - Move `Mobile*.tsx` to `components/mobile/`
   - Create barrel export (`components/mobile/index.ts`)
   - Cleaner file structure

**Files to Modify**:
- `src/components/settings/SettingsPage.tsx`
- `src/components/monitoring/MonitoringDashboard.tsx`
- `src/components/DesktopLiveCockpitSlim.tsx`
- Create `src/components/mobile/` directory
- Move 6 mobile components

**Backend Impact**: ✅ None (UI only)

---

### Phase 3: Data Freshness & Indicators (Week 3)

**Goal**: Unified staleness strategy, clear indicators

#### Tasks

10. **Create Global Refresh Button**
    - Add refresh icon to TraderHeader
    - Trigger refresh for all data sources
    - Show loading spinner

11. **Centralized Staleness Store**
    - Create `freshnessStore.ts` in Zustand
    - Track "as of" timestamps for all data
    - Single source of truth

12. **Standardize Freshness Thresholds**
    - Define thresholds: Fresh (<10s), Stale (<30s), Very Stale (>30s)
    - Update all components to use consistent values
    - Color-coded indicators

13. **WebSocket Status Indicator**
    - Add indicator in LiveStatusBar
    - Show: Connected (WS) | Degraded (REST) | Offline
    - Click to view details

14. **Add Refresh Timestamps**
    - Show "Last updated: 5s ago" on all data panels
    - Auto-update every second
    - Use `HDDataAsOf` consistently

**Files to Modify**:
- Create `src/stores/freshnessStore.ts`
- `src/components/Header/TraderHeader.tsx` (refresh button)
- `src/components/LiveStatusBar.tsx` (WS indicator)
- `src/components/hd/common/HDDataAsOf.tsx` (enhance)
- Update all dashboard panels

**Backend Impact**: ✅ None (reads existing timestamps)

---

### Phase 4: Missing Features (Week 4)

**Goal**: Add high-value missing features

#### Tasks

15. **Add Command Palette (Cmd+K)**
    - Search symbols, trades, navigate
    - Use `cmdk` library (already has HDCommandCenter)
    - Fuzzy search integration

16. **Create Dashboard/Home Page**
    - Summary view at `/dashboard`
    - Portfolio health, P&L, top signals
    - Make it optional default route

17. **Add Profile Page**
    - View/edit user profile at `/profile`
    - User preferences (dark mode, notifications)
    - Link from TraderHeader

18. **Export Trade History**
    - Add "Export" button to History tab
    - CSV download of all trades
    - Filterable by date range

19. **Alerts History Page**
    - `/alerts` route
    - Log of all sent Discord alerts
    - Search and filter

**Files to Create**:
- `src/pages/DashboardPage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/AlertsHistoryPage.tsx`
- `src/lib/export/tradeExporter.ts`

**Files to Modify**:
- `src/router.tsx` (add routes)
- `src/components/hd/layout/HDCommandCenter.tsx` (enhance)
- `src/components/DesktopHistory.tsx` (export button)

**Backend Impact**: ⚠️ Minor (may need alerts history endpoint)

---

### Phase 5: Performance & A11y (Week 5)

**Goal**: Optimize rendering, improve accessibility

#### Tasks

20. **Lazy Load All Routes**
    - Split App component into page components
    - Lazy load all routes in router.tsx
    - Measure bundle size reduction

21. **Virtualize Watchlist**
    - Use TanStack Virtual for watchlist rendering
    - Handle 100+ symbols efficiently
    - Maintain scroll position

22. **Pause Inactive Subscriptions**
    - Pause composite signals on hidden tabs
    - Use Page Visibility API
    - Reduce server load

23. **Add ARIA Labels**
    - Audit all buttons, links, inputs
    - Add `aria-label` where missing
    - Test with screen reader

24. **Keyboard Navigation**
    - Make trade cards focusable (tabIndex=0)
    - Add keyboard handlers (Enter = click)
    - Focus management on navigation

25. **Focus Indicators**
    - Add `:focus-visible` styles globally
    - Test keyboard navigation flow
    - Ensure contrast meets WCAG AA

26. **Add Dark/Light Mode**
    - Implement theme switcher in settings
    - Respect system preference
    - Persist user choice in localStorage

**Files to Modify**:
- `src/router.tsx` (lazy load all)
- `src/components/hd/dashboard/HDPanelWatchlist.tsx` (virtualize)
- `src/hooks/useCompositeSignals.ts` (pause logic)
- `src/styles/globals.css` (focus styles)
- Create `src/contexts/ThemeContext.tsx`
- `src/components/settings/SettingsPage.tsx` (theme toggle)

**Backend Impact**: ✅ None (frontend only)

---

## 10. Testing Strategy

### Before Each Phase

1. **Visual Regression Testing**
   - Screenshot key pages before changes
   - Compare after changes
   - Ensure no unintended UI breaks

2. **Manual Testing Checklist**
   - Test all navigation paths
   - Test mobile (iOS Safari, Android Chrome)
   - Test desktop (Chrome, Firefox, Safari)
   - Test keyboard navigation
   - Test screen reader (VoiceOver, NVDA)

3. **Playwright E2E Tests**
   - Update existing tests (e2e/auth.spec.ts, etc.)
   - Add tests for new routes
   - Verify navigation flows

### Regression Prevention

4. **CI Checks**
   - Run `pnpm typecheck` before commit (already setup)
   - Run `pnpm test` (Vitest)
   - Run `pnpm test:e2e` (Playwright)
   - Ensure all pass before merge

5. **Component Storybook** (Future)
   - Document HD components
   - Visual testing in isolation
   - Easier QA

---

## 11. Risk Assessment

### Low Risk (✅ Safe to Implement)

- Navigation fixes (Phase 1)
- Layout improvements (Phase 2)
- UI indicators (Phase 3)
- New pages (Phase 4)
- A11y enhancements (Phase 5)

**Reason**: All changes are frontend-only, no DB schema changes, no backend API changes.

### Medium Risk (⚠️ Test Thoroughly)

- Data refresh strategy (Phase 3, Task 10-14)
  - Risk: May conflict with existing WebSocket logic
  - Mitigation: Add feature flag, test with real trading data

- Performance optimizations (Phase 5, Task 20-22)
  - Risk: Code splitting may break lazy imports
  - Mitigation: Test build output, verify chunk sizes

### High Risk (🔴 Avoid or Defer)

- **None identified** - All proposed changes are additive and reversible

---

## 12. Metrics & Success Criteria

### Navigation

- ✅ All routes accessible from UI (no orphaned pages)
- ✅ Mobile nav includes all 5 main tabs
- ✅ <3 clicks to reach any feature

### Layout

- ✅ No layout shifts on route changes
- ✅ Consistent breakpoints (sm, md, lg, xl)
- ✅ Mobile renders correctly on iOS/Android

### Data Freshness

- ✅ All panels show "as of" timestamps
- ✅ Staleness indicators consistent
- ✅ <5s to refresh all data

### Performance

- ✅ Lighthouse score >90 (performance)
- ✅ First Contentful Paint <1.5s
- ✅ Bundle size <500KB (gzipped)

### Accessibility

- ✅ WCAG 2.1 AA compliance
- ✅ All interactive elements keyboard navigable
- ✅ Screen reader tested (VoiceOver, NVDA)

---

## 13. How to Work with Claude on This Audit

### Incremental Approach

**Do NOT** try to fix everything at once. Follow this workflow:

1. **Pick One Phase** (e.g., Phase 1: Critical Navigation Fixes)
2. **Pick One Task** (e.g., Task 1: Add Settings to Mobile Nav)
3. **Ask Claude**: "Implement Task 1 from Phase 1 of FRONTEND_AUDIT.md"
4. **Review Changes**: Check the diff, test locally
5. **Commit & Push**: Small, focused commits
6. **Repeat**: Move to next task

### Example Workflow

```bash
# Start a new session
# Say: "Read FRONTEND_AUDIT.md and implement Phase 1, Task 1"

# Claude will:
# 1. Read the audit doc
# 2. Modify MobileBottomNav.tsx
# 3. Update types and routing
# 4. Test the changes
# 5. Commit with descriptive message

# You verify, then:
git push -u origin claude/audit-frontend-01BeH8qL3XAEb71S5TnCSqhk

# Next session:
# Say: "Implement Phase 1, Task 2 from FRONTEND_AUDIT.md"
```

### Collaboration Tips

- **Be Specific**: Reference task numbers (e.g., "Task 3")
- **Review Each Change**: Don't merge blindly
- **Test on Real Devices**: Claude can't test mobile Safari
- **Ask Questions**: If a task is unclear, ask for clarification
- **Adjust Plan**: If you disagree with a task, skip or modify it

### Tracking Progress

Use this checklist to track completed tasks:

#### Phase 1: Critical Navigation Fixes
- [ ] Task 1: Add Settings & Monitoring to Mobile Nav
- [ ] Task 2: Add Radar Link to Main Nav
- [ ] Task 3: Add Settings Button to Desktop Header
- [ ] Task 4: Fix Trade Detail Navigation

#### Phase 2: Layout Consistency
- [ ] Task 5: Create Mobile Settings Page
- [ ] Task 6: Create Mobile Monitoring View
- [ ] Task 7: Unify Panel Visibility Logic
- [ ] Task 8: Add Tablet Breakpoints
- [ ] Task 9: Reorganize Mobile Components

#### Phase 3: Data Freshness & Indicators
- [ ] Task 10: Create Global Refresh Button
- [ ] Task 11: Centralized Staleness Store
- [ ] Task 12: Standardize Freshness Thresholds
- [ ] Task 13: WebSocket Status Indicator
- [ ] Task 14: Add Refresh Timestamps

#### Phase 4: Missing Features
- [ ] Task 15: Add Command Palette (Cmd+K)
- [ ] Task 16: Create Dashboard/Home Page
- [ ] Task 17: Add Profile Page
- [ ] Task 18: Export Trade History
- [ ] Task 19: Alerts History Page

#### Phase 5: Performance & A11y
- [ ] Task 20: Lazy Load All Routes
- [ ] Task 21: Virtualize Watchlist
- [ ] Task 22: Pause Inactive Subscriptions
- [ ] Task 23: Add ARIA Labels
- [ ] Task 24: Keyboard Navigation
- [ ] Task 25: Focus Indicators
- [ ] Task 26: Add Dark/Light Mode

---

## 14. Appendix: File Inventory

### Key Files for Reference

| File | Purpose | Phase |
|------|---------|-------|
| `src/router.tsx` | Route definitions | 1, 4 |
| `src/App.tsx` | Main app shell, tab logic | 1, 2 |
| `src/components/MobileBottomNav.tsx` | Mobile navigation | 1 |
| `src/components/Header/TraderHeader.tsx` | Desktop header | 1, 3 |
| `src/components/LiveStatusBar.tsx` | Market status bar | 3 |
| `src/components/DesktopLiveCockpitSlim.tsx` | Main desktop view | 2, 3 |
| `src/components/settings/SettingsPage.tsx` | Settings UI | 2, 5 |
| `src/components/monitoring/MonitoringDashboard.tsx` | Monitoring view | 2 |
| `src/components/hd/dashboard/HDPanelWatchlist.tsx` | Watchlist panel | 3, 5 |
| `src/stores/marketDataStore.ts` | Market data state | 3 |
| `src/hooks/useCompositeSignals.ts` | Composite signals hook | 3, 5 |
| `src/pages/TradeDetailPage.tsx` | Trade detail | 1, 4 |
| `src/pages/RadarPage.tsx` | Radar scanner | 1 |

### Component Count

- **Total Components**: ~100+ (71 in `hd/` alone)
- **Mobile Components**: 6 (at root level)
- **Pages**: 3 (AuthPage, RadarPage, TradeDetailPage)
- **Stores**: 5 (tradeStore, marketStore, uiStore, settingsStore, marketDataStore)
- **Hooks**: 20+

---

## 15. Questions for Product Owner

Before starting implementation, clarify:

1. **Priority**: Which phase should we tackle first? (Recommend: Phase 1)
2. **Mobile Nav Design**: 5 tabs won't fit - use scroll, hamburger menu, or icon-only?
3. **Radar Integration**: Standalone page or integrate into Live view?
4. **Dashboard Page**: Do you want a new landing page, or keep Live as default?
5. **Dark Mode**: Is this a priority for Phase 5, or defer to later?
6. **Trade Detail Page**: Should all trade cards link to detail, or only in Review tab?
7. **Monitoring Access**: Should mobile users have full monitoring, or simplified view?

---

## Conclusion

This audit identified **34 issues** across 9 categories:

- 🔴 **Critical**: 12 issues (navigation, mobile nav, a11y)
- ⚠️ **Medium**: 15 issues (layout, data freshness, performance)
- ✅ **Low**: 7 enhancements (dark mode, export, search)

**Recommended Next Steps**:

1. Review this audit with your team
2. Prioritize phases (suggest: 1 → 3 → 2 → 5 → 4)
3. Start with **Phase 1, Task 1**: Fix mobile navigation
4. Work incrementally, testing after each task
5. Update FRONTEND_AUDIT.md as you complete tasks

**Estimated Timeline**: 5 weeks (1 phase/week) for full implementation.

**Backend Safety**: ✅ All changes are frontend-only, no risk to backend configurations.

---

**Ready to start?** Ask Claude:
> "Implement Phase 1, Task 1 from FRONTEND_AUDIT.md"

Good luck! 🚀
