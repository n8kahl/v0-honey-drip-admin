# Navigation & Routing - File Reference Guide

## Routing Configuration Files

| File | Purpose | Issue |
|------|---------|-------|
| `/src/router.tsx` | React Router configuration | Conflicts with Next.js routing |
| `/app/layout.tsx` | Next.js root layout | Dual routing causes confusion |
| `/app/page.tsx` | Home route (/) | Works but uses App.tsx wrapper |
| `/app/trades/active/page.tsx` | Active tab route | Works |
| `/app/trades/history/page.tsx` | History tab route | Works |
| `/app/settings/page.tsx` | Settings tab route | Works |
| `/app/trades/[id]/page.tsx` | Trade detail (UNUSED) | Dead code - not integrated |
| `/app/radar/page.tsx` | Radar view (UNUSED) | Dead code - not linked anywhere |
| `/app/api/massive/ws-token/route.ts` | WebSocket token endpoint | Working API route |

## Core Navigation Files

| File | Purpose | Lines | Issue |
|------|---------|-------|-------|
| `/src/App.tsx` | Main app component + tab logic | 433 | Overly complex - mixing routing with component logic |
| `/src/hooks/useNavigationRouter.ts` | React Router hook | 37 | Good abstraction but conflicts with Zustand |
| `/src/hooks/useAppNavigation.ts` | Zustand navigation hook | 58 | Duplicates useNavigationRouter functionality |
| `/src/hooks/usePathNavigation.ts` | Path-based navigation (UNUSED) | 35 | Incomplete - doesn't integrate with main app |
| `/src/stores/uiStore.ts` | Tab state + navigation actions | 150+ | Mixes navigation state with UI state |

## Mobile & Responsive Files

| File | Purpose | Issue |
|------|---------|-------|
| `/src/components/MobileBottomNav.tsx` | Bottom tab navigation | Good pattern but hard-coded for 4 tabs |
| `/src/components/trading/ActiveTradesDock.tsx` | Active trades dock | TOO LARGE (340px) - blocks content |
| `/src/components/MobileActive.tsx` | Mobile active trades view | Works but dock overlays it |
| `/src/components/MobileHistory.tsx` | Mobile history view | Works, no major issues |
| `/src/components/MobileLive.tsx` | Mobile watchlist view | Works, no major issues |
| `/src/components/MobileNowPlaying.tsx` | Mobile trade entry | Works but complex logic |
| `/src/components/MobileNowPlayingSheet.tsx` | Mobile sheet modal | Works |

## Layout & Structure Files

| File | Purpose | Issue |
|------|---------|-------|
| `/src/components/Header/TraderHeader.tsx` | Fixed header (h-16) | OVERLOADED - 4 info sections crammed |
| `/src/components/LiveStatusBar.tsx` | Market status bar | Works but info could be condensed |
| `/src/components/DesktopLiveCockpitSlim.tsx` | Main trading workspace | Complex but works |
| `/src/components/Cockpit/MainCockpit.tsx` | Detailed cockpit view | Good but not fully integrated |
| `/src/components/DesktopHistory.tsx` | Trade history view | Works on desktop, needs mobile support |
| `/src/components/DesktopSettings.tsx` | Settings page | COMPLETELY BROKEN - 40+ fields, no organization |

## Design System Files (HD - Honey Drip)

| File | Purpose | Mobile Issue |
|------|---------|--------------|
| `/src/components/hd/HDPanelWatchlist.tsx` | Watchlist panel | Not responsive |
| `/src/components/hd/HDLiveChart.tsx` | Chart component | Works but no zoom responsiveness |
| `/src/components/hd/HDContractGrid.tsx` | Options chain grid | NOT RESPONSIVE - fixed columns, requires scroll |
| `/src/components/hd/HDActiveTradesPanel.tsx` | Active trades sidebar | Not mobile-friendly |
| `/src/components/hd/HDMacroPanel.tsx` | Macro indicators | Works |
| `/src/components/hd/HDRowWatchlist.tsx` | Watchlist row | Remove button hidden on mobile |
| `/src/components/hd/HDButton.tsx` | Button component | Works |
| `/src/components/hd/HDInput.tsx` | Input component | Works |

## UI Component Library (shadcn/ui)

| File | Purpose |
|------|---------|
| `/src/components/ui/dialog.tsx` | Modal dialogs |
| `/src/components/ui/sheet.tsx` | Bottom sheet modals |
| `/src/components/ui/dropdown-menu.tsx` | Dropdown menus |
| `/src/components/ui/slider.tsx` | Range sliders (tracks too small on mobile) |
| `/src/components/ui/sidebar.tsx` | Sidebar component |
| `/src/components/ui/navigation-menu.tsx` | Navigation menus |
| `/src/components/ui/input.tsx` | Text inputs |
| `/src/components/ui/button.tsx` | Buttons |

## State Management Files

| File | Purpose | Lines | Issue |
|------|---------|-------|-------|
| `/src/stores/uiStore.ts` | UI + navigation state | 200+ | Mixes concerns - should split navigation to separate store |
| `/src/stores/tradeStore.ts` | Trade data | OK | Good separation |
| `/src/stores/marketStore.ts` | Market data | OK | Good separation |
| `/src/stores/settingsStore.ts` | Settings | OK | Good separation |
| `/src/stores/marketDataStore.ts` | Market data streaming | OK | Good separation |
| `/src/stores/activeTradesDockStore.ts` | Dock UI state | Small | Good separation |

## Styling Files

| File | Purpose | Lines | Breakpoints |
|------|---------|-------|-------------|
| `/src/styles/globals.css` | Global styles + CSS vars | 240 | Good - has media queries for mobile |
| `/tailwind.config.js` | Tailwind config | 51 | Uses default Tailwind breakpoints |
| `/index.html` | Vite entry point | 16 | Has viewport meta tag |
| `/app/globals.css` | Next.js globals | ? | May be unused/duplicate |

## Hook Files (Navigation-related)

| File | Purpose | Status |
|------|---------|--------|
| `/src/hooks/useNavigationRouter.ts` | React Router navigation | Working |
| `/src/hooks/useAppNavigation.ts` | Zustand navigation | Working |
| `/src/hooks/usePathNavigation.ts` | Path mapping (UNUSED) | Dead code |
| `/src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcuts | Working |
| `/src/hooks/useCommandCenter.ts` | Command center | May relate to navigation |

## Problem Files Summary

### CRITICAL (P0)
- `/src/App.tsx` - Too complex, mixing routing + UI logic
- `/src/router.tsx` - Conflicts with Next.js routing
- `/src/components/trading/ActiveTradesDock.tsx` - Too large on mobile
- `/src/components/Header/TraderHeader.tsx` - Overloaded with info

### HIGH (P1)
- `/src/components/DesktopSettings.tsx` - 40+ fields, no organization
- `/src/components/hd/HDContractGrid.tsx` - Not responsive
- `/app/trades/[id]/page.tsx` - Defined but not used
- `/src/stores/uiStore.ts` - Mixes too many concerns

### MEDIUM (P2)
- `/src/components/hd/HDRowWatchlist.tsx` - Remove button hidden
- `/src/components/trading/ActiveTradesDock.tsx` - Sliders too small
- `/src/components/ErrorBoundary.tsx` - Exists but not used

### LOW (P3)
- `/app/radar/page.tsx` - Dead code
- `/src/hooks/usePathNavigation.ts` - Dead code
- `/src/styles/globals.css` - Font scaling could be better

## Files to Keep/Delete

### Keep (Core)
- All files in `/src/stores/` (good separation)
- All files in `/src/components/ui/` (shadcn base)
- `/src/hooks/useNavigationRouter.ts`
- `/src/components/MobileBottomNav.tsx`
- `/src/components/Header/TraderHeader.tsx`

### Refactor
- `/src/App.tsx` (split routing from UI)
- `/src/stores/uiStore.ts` (extract navigation to separate store)
- `/src/components/DesktopSettings.tsx` (reorganize with tabs)

### Delete/Remove
- `/app/radar/page.tsx` (not used)
- `/app/trades/[id]/page.tsx` (not used, or implement properly)
- `/src/hooks/usePathNavigation.ts` (incomplete)
- `/src/router.tsx` (if using Next.js exclusively)
- OR: `/app/**` routes (if using React Router exclusively)

## Quick Navigation File Lookup

### "I want to change..." → Edit:

| What | File(s) |
|-----|---------|
| Tab buttons | `/src/components/MobileBottomNav.tsx`, `/src/App.tsx` (line 263-288) |
| Header layout | `/src/components/Header/TraderHeader.tsx` |
| Active trades dock | `/src/components/trading/ActiveTradesDock.tsx` |
| Settings page | `/src/components/DesktopSettings.tsx` |
| Route paths | `/src/router.tsx` |
| Navigation state | `/src/stores/uiStore.ts` |
| Tab content | `/src/App.tsx` (line 290-344) |
| Mobile layout | `/src/App.tsx` (line 380-394) + responsive components |
| Breakpoints | `/tailwind.config.js`, `/src/styles/globals.css` |
| Colors/tokens | `/src/styles/globals.css` (lines 8-78) |

## Component Tree (Simplified)

```
App.tsx (root)
├─ TraderHeader (fixed)
├─ LiveStatusBar (sticky)
├─ Desktop TabNav (hidden on mobile)
├─ Main Content (flex-1)
│  ├─ Live Tab: DesktopLiveCockpitSlim
│  │  ├─ Left: HDPanelWatchlist + HDActiveTradesPanel
│  │  ├─ Center: HDLiveChart + HDContractGrid
│  │  └─ Right: HDCommandRail + HDVoiceHUD
│  │
│  ├─ Active Tab: MobileActive (mobile) + DesktopLiveCockpitSlim (desktop)
│  ├─ History Tab: DesktopHistory
│  └─ Settings Tab: DesktopSettings
│
├─ ActiveTradesDock (bottom, fixed)
├─ MobileBottomNav (fixed on mobile)
├─ Dialogs (floating)
│  ├─ HDDialogDiscordSettings
│  ├─ HDDialogAddTicker
│  └─ HDDialogAddChallenge
└─ Toaster (notifications)
```

---

**Last Updated:** Nov 20, 2025  
**Total Files Referenced:** 70+  
**Framework:** Next.js 16.0.3 + React Router 7.9.6 + Zustand 4.5.0  
**Styling:** Tailwind CSS 3.4.15 + Custom CSS variables
