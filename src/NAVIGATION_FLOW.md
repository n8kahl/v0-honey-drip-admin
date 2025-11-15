# HoneyDrip Admin - Complete Navigation Flow

## Overview
HoneyDrip Admin uses a responsive tab-based navigation system with different patterns for desktop and mobile experiences.

---

## 🖥️ Desktop Navigation

### Tab Bar (Top)
Located in the header area, always visible:
- **Live Cockpit** - Three-pane trading interface
- **Active** - Quick view of all loaded/entered trades
- **History** - Past trades with filters
- **Settings** - App configuration

### Live Cockpit (3-Pane Layout)
**Left Pane - Always Visible**
- Watchlist with tickers
- Hot Trades section  
- Challenges section
- + buttons to add tickers/challenges

**Center Pane - Context Dependent**
1. **WATCHING State (no ticker)**: Empty state "Select a ticker from the watchlist"
2. **WATCHING State (ticker selected)**: Contract grid for strike/expiry selection
3. **LOADED State (no alert)**: Loaded trade card with "Enter Trade" and "Discard" buttons
4. **ENTERED State (no alert)**: Entered trade card with confluence panel
5. **Alert Showing**: Hidden on mobile, shows focused trade on desktop

**Right Pane - Context Dependent**
1. **WATCHING State**: Empty state "Select a contract to load a trade"
2. **LOADED State (no alert)**: Reminder card with "Enter Trade" button
3. **LOADED State (alert open)**: Alert composer full height
4. **ENTERED State (no alert)**: Quick Actions panel (Trim, Update SL, Trail Stop, Add, Exit)
5. **ENTERED State (alert open)**: Alert composer full height

---

## 📱 Mobile Navigation

### Bottom Tab Bar (Always Visible)
Fixed at bottom with 4 tabs:
- **Live** (BarChart3 icon) - Trading cockpit
- **Active** (Activity icon) - Active trades list
- **History** (History icon) - Past trades
- **Settings** (Settings icon) - Configuration

### Mobile Layout Behavior
Mobile uses a **single-panel, full-height** approach:

#### Live Tab - State Machine
1. **WATCHING (no ticker)**
   - Shows: Watchlist panel only
   - Height: Full available space

2. **WATCHING (ticker selected)**
   - Shows: Contract grid only
   - Hides: Watchlist (accessible via back button concept)

3. **LOADED (alert closed)**
   - Shows: Loaded trade card in center
   - Hides: Watchlist and right panel

4. **LOADED (alert open)**
   - Shows: Alert composer ONLY (full height)
   - Hides: All other panels
   - Actions: "Send Alert" and "Discard" buttons visible at bottom

5. **ENTERED (alert closed)**
   - Shows: Entered trade card with confluence
   - Shows: Quick Actions panel below
   - Hides: Watchlist

6. **ENTERED (alert open)**
   - Shows: Alert composer ONLY (full height)
   - Hides: All other panels
   - Actions: "Send Alert" and "Discard" buttons visible at bottom

#### Active Tab
- Simple scrollable list of all LOADED and ENTERED trades
- Tap trade → switches to "Live" tab and focuses that trade
- Shows: Ticker, contract details, state badge, P&L

#### History Tab
- Same as desktop - full-featured trade history
- Filters for date range, ticker, trade type
- Trade detail cards

#### Settings Tab
- Same as desktop - configuration options
- Discord webhook management
- Voice command setup
- Account preferences

---

## 🎯 Trade State Flow

### State Transitions
\`\`\`
WATCHING (no trade)
    ↓ [Select Ticker]
WATCHING (ticker selected, showing contracts)
    ↓ [Select Contract]
LOADED (draft alert opens automatically)
    ↓ [Send Load Alert]
LOADED (alert sent, card showing)
    ↓ [Enter Trade button → Entry alert opens]
ENTERED (alert sent, live trade showing)
    ↓ [Quick Action buttons → Update alerts]
ENTERED (with updates)
    ↓ [Exit button → Exit alert]
EXITED (removed from active trades)
\`\`\`

### Critical Mobile Rules
1. **One Panel at a Time**: Only show what's relevant for current state
2. **Full Height**: Each panel takes `h-[calc(100vh-11rem)]` (header 3rem + bottom nav 4rem + padding 4rem)
3. **Alert Composer Priority**: When alert is open, it's the ONLY thing visible
4. **Back Navigation**: Discard button returns to previous state

---

## 🔄 Alert Composer Pattern

### Alert Types & Triggers
1. **Load Alert** - Auto-opens when contract is selected
2. **Entry Alert** - Opens when "Enter Trade" clicked from LOADED card
3. **Update Alert** - Opens from Quick Actions (Trim, Update SL, generic update)
4. **Trail Stop Alert** - Opens from Quick Actions
5. **Add Alert** - Opens from Quick Actions (add to position)
6. **Exit Alert** - Opens from Quick Actions

### Alert Composer Sections (Scrollable)
1. Preview - Shows formatted alert message
2. Included Fields - Checkboxes for Entry/Current/Target/Stop/P&L
3. Comment - Textarea for admin notes
4. Discord Channels - Required, at least one must be selected
5. Challenges - Optional, multi-select

### Alert Composer Actions (Fixed Footer)
- **Primary Button**: "Load and Alert" or "Send Alert" (disabled if no channels)
- **Secondary Button**: "Discard" (returns to previous view)

---

## 🎨 Height Calculations

### Desktop
- Main container: `h-[calc(100vh-8rem)]` (header ~3rem + top nav ~3rem + padding ~2rem)
- Three panes: Flex layout with `h-full`

### Mobile  
- Main container: `h-[calc(100vh-7rem)]` (header 3rem + bottom padding 4rem)
- App wrapper: `pb-16` (4rem bottom padding for fixed nav)
- Single panel: `h-full` to fill available space
- Bottom nav: Fixed positioned, doesn't take layout space

### Mobile Bottom Nav
- Height: `h-16` (4rem)
- Position: `fixed bottom-0 left-0 right-0`
- Z-index: Above content
- Safe area: `safe-area-inset-bottom` class

---

## 🐛 Common Issues & Solutions

### Issue: Buttons not visible in Alert Composer (mobile)
**Cause**: Parent container doesn't have proper height constraints
**Solution**: Ensure right panel has `h-full` and alert composer uses `flex flex-col` with footer as `flex-shrink-0`

### Issue: Content cut off at bottom (mobile)
**Cause**: Missing bottom padding for fixed nav
**Solution**: App container needs `pb-16 lg:pb-0`

### Issue: Multiple panels visible at once (mobile)
**Cause**: Visibility conditions not mutually exclusive
**Solution**: Use state machine pattern - only one panel visible per state

### Issue: Alert composer scrolls behind bottom nav
**Cause**: Height calculation doesn't account for bottom nav
**Solution**: Use `h-[calc(100vh-11rem)]` for mobile container height

---

## 📝 Key Design Principles

1. **No Auto-Send**: ALL alerts require explicit admin approval via "Send Alert" button
2. **Draft-First**: Every action opens alert composer as a draft
3. **State-Driven UI**: Panel visibility determined by `tradeState` and `showAlert` flags
4. **Mobile Single-Panel**: One focused view at a time on mobile
5. **Desktop Three-Pane**: Persistent context across all panes on desktop
6. **Responsive Breakpoint**: `lg` (1024px) is the dividing line
7. **Full-Height Panels**: All panels fill available vertical space
8. **Bottom Navigation**: Mobile-only, desktop uses top tabs

---

## 🔍 Testing Checklist

### Mobile
- [ ] Bottom nav always visible
- [ ] Content doesn't scroll behind bottom nav
- [ ] Alert composer shows "Send Alert" and "Discard" buttons
- [ ] Only one panel visible per state
- [ ] Transitions smooth between states
- [ ] Watchlist accessible from WATCHING state
- [ ] Active tab shows all loaded/entered trades

### Desktop
- [ ] Top nav always visible
- [ ] Three panes maintain consistent widths
- [ ] Left pane always shows watchlist
- [ ] Right pane shows appropriate content per state
- [ ] Alert composer in right pane, doesn't affect other panes
- [ ] Quick actions accessible in ENTERED state

### Both
- [ ] Discard button returns to appropriate previous state
- [ ] Send Alert button disabled until channel selected
- [ ] Trade states flow correctly (WATCHING → LOADED → ENTERED → EXITED)
- [ ] Confluence panel shows for LOADED and ENTERED states
- [ ] All buttons have centered text with proper padding
