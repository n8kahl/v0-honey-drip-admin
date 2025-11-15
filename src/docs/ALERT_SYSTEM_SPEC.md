# HoneyDrip Admin – Global Alert System Specification

**Version:** 1.0  
**Date:** November 13, 2025  
**Author:** HoneyDrip Design System

---

## Overview

This document defines the **Global Alert System** for HoneyDrip Admin – a unified, reusable pattern for composing, previewing, and sending trade alerts across Desktop and Mobile interfaces.

**Core Principle:** No alert is ever auto-sent. Every alert action opens a composer/preview requiring explicit admin approval via "Send Alert" button.

---

## 1. Alert Types

HoneyDrip supports five alert types, each with a distinct emoji identifier and default field configuration:

| Alert Type | Emoji | Label | Use Case |
|------------|-------|-------|----------|
| `load` | 📋 | LOADED | Contract added to watchlist, not yet entered |
| `enter` | 🎯 | ENTERED | Trade execution confirmation |
| `update` | 📊 | UPDATE | Position updates (trim, price change, stop adjustment) |
| `add` | ➕ | ADDED | Additional position added to existing trade |
| `exit` | 🏁 | EXITED | Complete position exit |

### 1.1 Message Format

All alerts follow this structure:

\`\`\`
**{TICKER} ${STRIKE}{C/P} {EXPIRY}** ({TradeType})

[Included Fields - conditionally rendered based on checkboxes]
Entry: $XX.XX
Current: $XX.XX
Target: $XX.XX
Stop: $XX.XX
P&L: +X.X%

{Comment text}
\`\`\`

**Examples:**

**LOAD Alert:**
\`\`\`
📋 **LOADED**
**SPX $5800C 0DTE** (Scalp)

Watching this contract for potential entry. Looking for breakout above 5790.
\`\`\`

**ENTER Alert:**
\`\`\`
🎯 **ENTERED**
**SPX $5800C 0DTE** (Scalp)

Entry: $22.50
Target: $31.00 (+37.8%)
Stop: $17.90 (-20.4%)

Entering this trade here.
\`\`\`

**UPDATE Alert (Trim):**
\`\`\`
📊 **UPDATE**
**SPX $5800C 0DTE** (Scalp)

Current: $27.30
P&L: +21.3%

Trimming 50% here to lock partial profit.
\`\`\`

**UPDATE Alert (Stop Loss - Breakeven):**
\`\`\`
📊 **UPDATE**
**SPX $5800C 0DTE** (Scalp)

Stop: Breakeven ($22.50)

Moving stop loss to breakeven to protect capital.
\`\`\`

**ADD Alert:**
\`\`\`
➕ **ADDED**
**SPX $5800C 0DTE** (Scalp)

Current: $24.80
P&L: +10.2%

Adding to this position here.
\`\`\`

**EXIT Alert:**
\`\`\`
🏁 **EXITED**
**SPX $5800C 0DTE** (Scalp)

Exit: $29.50
P&L: +31.1%

Exiting the position here. Target nearly reached.
\`\`\`

---

## 2. Alert Composer Component

The Alert Composer is the central UI pattern for all alert creation. It has **Desktop** and **Mobile** variants with identical functionality but adapted layouts.

### 2.1 Component Structure

#### A) Header
- **Title:** "Alert Preview" or "{Action} – Alert Preview" (e.g., "Trim – Alert Preview")
- **Alert Type Pill:** Small badge showing current alert type
  - Visual: `bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] rounded px-2 py-0.5 text-xs uppercase`
  - Text: "LOADED" | "ENTERED" | "UPDATE" | "ADDED" | "EXITED"
- **Close/Dismiss Button:** X icon (top-right on desktop, in header on mobile)

#### B) Preview Card
- **Purpose:** Live preview of the final alert message
- **Visual Style:**
  - Background: `bg-[var(--surface-2)]`
  - Border: `border border-[var(--brand-primary)]/50 rounded-lg`
  - Padding: `p-3 md:p-4`
- **Content (Read-only):**
  - Alert type emoji + label (e.g., "🎯 **ENTERED**")
  - Contract line: `**{TICKER} ${STRIKE}{C/P} {EXPIRY}** ({TradeType})`
  - Included fields (only those checked below)
  - Comment text (if present)
- **Behavior:**
  - Updates in real-time as fields below change
  - Markdown rendering for bold ticker/contract
  - Field order: Entry → Current → Target → Stop → P&L

#### C) Included Fields Panel
- **Label:** "Included Fields" (uppercase, small, muted)
- **Layout:** Vertical list of field rows

**Field Row Structure:**
\`\`\`
[✓] Entry                    $22.50        [Use live ●]
[✓] Current                  $27.30        [Use live ●]
[ ] Target                   $31.00        [Use live ○]
[✓] Stop                     $17.90        [Use live ●]
[✓] P&L                      +21.3%        [Use live ●]
\`\`\`

**Field Row Components:**
- **Checkbox:** Include/exclude field in message
- **Label:** Field name (Entry, Current, Target, Stop, P&L)
- **Value:**
  - **Desktop:** Numeric input `<input type="number" />` with currency/percentage formatting
  - **Mobile:** Tappable text that opens inline editor or number pad
  - Styling: `bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded px-2 py-1`
- **"Use live" Toggle:**
  - **ON (default):** Value syncs with real-time market data
  - **OFF:** Admin can manually override
  - Visual: Small toggle switch or radio option
  - When live data unavailable: toggle is OFF and grayed out

**Default Field States per Alert Type:**

| Alert Type | Entry | Current | Target | Stop | P&L |
|------------|-------|---------|--------|------|-----|
| `load` | ○ unchecked | ○ unchecked | ○ unchecked | ○ unchecked | ○ unchecked |
| `enter` | ● checked | ○ unchecked | ● checked | ● checked | ○ unchecked |
| `update` (generic) | ○ unchecked | ● checked | ○ unchecked | ○ unchecked | ○ unchecked |
| `update` (trim) | ○ unchecked | ● checked | ○ unchecked | ○ unchecked | ● checked |
| `update` (SL) | ○ unchecked | ○ unchecked | ○ unchecked | ● checked | ○ unchecked |
| `add` | ○ unchecked | ● checked | ○ unchecked | ○ unchecked | ● checked |
| `exit` | ○ unchecked | ● checked (exit) | ○ unchecked | ○ unchecked | ● checked |

**Notes:**
- "Current" in EXIT alerts is semantically treated as "Exit Price"
- Admins can always toggle any field on/off
- When a field is unchecked, it's excluded from the preview and final message

#### D) Stop Loss Control (Conditional)

**Visibility:** Only shown when alert type = `update` AND quick action = "Update Stop Loss"

**Label:** "New Stop Loss" (uppercase, small, muted)

**Control Type:** Radio buttons or segmented control with three options:

\`\`\`
● Breakeven
○ Fixed Price
○ Trailing Stop
\`\`\`

**Mode: Breakeven**
- **Behavior:**
  - Stop value automatically set to entry price
  - Stop field in "Included Fields" shows: "Breakeven ($22.50)"
  - "Use live" toggle disabled (value is calculated, not live)
- **Comment Suggestion:** "Moving stop loss to breakeven to protect capital."

**Mode: Fixed Price**
- **UI:**
  - Price input: `$ [ ____.__ ]`
  - Validation: Must be a valid price
- **Behavior:**
  - Stop field shows the entered price
  - "Use live" toggle OFF (manual value)
- **Comment Suggestion:** "Adjusting stop loss to ${PRICE}."

**Mode: Trailing Stop**
- **UI:**
  \`\`\`
  Trailing distance: [ ____ ] [points ▼]
                              [%      ]
  
  Trail from: ● Current price
              ○ Entry price
  \`\`\`
- **Inputs:**
  - **Distance:** Numeric input (e.g., 0.50)
  - **Unit:** Dropdown: `points` | `%`
  - **Trail from:** Radio: `Current price` | `Entry price`
- **Behavior:**
  - Stop field shows calculated effective stop:
    - "Trailing 0.50 points from current (effective stop: $26.80)"
  - Effective stop = (trail from price) - (distance in chosen unit)
  - "Use live" toggle ON (effective stop recalculates)
- **Comment Suggestion:** "Setting a trailing stop: {distance}{unit} from {current/entry}."

**Preview Impact:**
- When SL control is active, Stop field in preview shows mode-specific text:
  - Breakeven: "Stop: Breakeven ($22.50)"
  - Fixed: "Stop: $20.00"
  - Trailing: "Stop: Trailing 0.50 pts from current ($26.80)"

#### E) Comment Section
- **Label:** "Comment (Optional)" (uppercase, small, muted)
- **Input:** Multi-line textarea
  - Placeholder: Varies by alert type (see defaults below)
  - Rows: 3-4 on desktop, 2-3 on mobile
  - Character limit: Optional (e.g., 500 chars)
- **Styling:**
  - `bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-lg`
  - `text-sm text-[var(--text-high)] placeholder:text-[var(--text-muted)]`

**Default Placeholder/Suggestions:**

| Alert Type | Quick Action | Default Comment |
|------------|--------------|-----------------|
| `load` | Load | "Watching this contract for potential entry." |
| `enter` | Enter | "Entering this trade here." |
| `update` | Trim | "Trimming 50% here to lock partial profit." |
| `update` | Update SL (Breakeven) | "Moving stop loss to breakeven to protect capital." |
| `update` | Update SL (Fixed) | "Adjusting stop loss to $XX.XX." |
| `update` | Update SL (Trailing) | "Setting a trailing stop: {distance}{unit} from {current/entry}." |
| `update` | Update (generic) | "Quick update on this position." |
| `add` | Add Position | "Adding to this position here." |
| `exit` | Full Exit | "Exiting the position here." |

**Behavior:**
- Comment is always appended to the end of the alert message
- If left empty, no comment line appears in the message
- Admin can replace placeholder with custom text

#### F) Channels & Challenges
- **Label:** "Discord Channels" (uppercase, small, muted)
- **UI:** List of checkboxes with channel names
  - Each row: `[✓] #options-signals`
  - Visual: `text-sm text-[var(--text-high)]`
- **Validation:** At least one channel must be selected
  - If none selected, "Send Alert" button is disabled
- **Default Selection:**
  - Based on trade's linked challenges (if any)
  - Or global default channels from Settings
  - Or first channel in list

**Challenges Section (Optional):**
- **Label:** "Link to Challenges (Optional)" (uppercase, small, muted)
- **UI:** List of checkboxes with challenge names
  - Each row: `[✓] November Scalp Challenge`
  - Shows challenge scope (ALL TRADES | specific ticker)
- **Behavior:**
  - Selecting a challenge may auto-select its default channels
  - Multiple challenges can be selected
  - Challenge linkage is metadata (doesn't appear in alert text)

#### G) Footer Actions
- **Primary Button:** "Send Alert"
  - Visual: `bg-[var(--brand-primary)] text-[var(--bg-base)] rounded-lg py-3 px-6`
  - Enabled when: At least one channel selected
  - Action: Sends alert, closes composer, triggers toast
- **Secondary Button:** "Discard"
  - Visual: `border border-[var(--border-hairline)] text-[var(--text-muted)] rounded-lg py-3 px-6`
  - Action: Closes composer, discards draft, returns to previous view

**Desktop Layout:**
- Buttons side-by-side: `[Discard] [Send Alert]`
- Sticky footer at bottom of composer panel

**Mobile Layout:**
- Buttons stacked vertically: Send Alert on top, Discard below
- Sticky footer at bottom of bottom sheet

---

### 2.2 Desktop Variant

**Container:**
- Right panel in Live Cockpit (replaces watchlist/trade details)
- Width: ~400-500px (1/3 of screen)
- Full height, scrollable content

**Layout:**
- Header: Fixed at top
- Content: Scrollable middle section
  - Preview Card
  - Included Fields
  - Stop Loss Control (if applicable)
  - Comment
  - Channels & Challenges
- Footer: Fixed at bottom

**Interaction:**
- Fields use standard inputs with hover states
- Toggle switches for "Use live"
- Click anywhere on field row to toggle checkbox

### 2.3 Mobile Variant

**Container:**
- Bottom sheet modal overlay
- Max height: 85vh
- Rounded top corners: `rounded-t-2xl`
- Background overlay: `bg-black/60`

**Layout:**
- Drag handle at top (visual indicator)
- Header: Title + Close button
- Content: Scrollable middle section (same sections as desktop)
- Footer: Sticky at bottom of sheet

**Interaction:**
- Swipe down to dismiss (or tap Discard)
- Tap field values to edit (opens number pad for numeric fields)
- Checkboxes use larger touch targets (44px min)
- "Use live" toggle uses native mobile switch

---

## 3. Quick Actions → Composer Mapping

Each quick action button in the UI maps to a specific composer configuration:

### 3.1 Load (from Watchlist)

**Trigger:** User selects contract from watchlist dropdown  
**Alert Type:** `load`  
**Composer State:**
- Title: "Load – Alert Preview"
- All fields unchecked by default
- Comment: "Watching this contract for potential entry."
- Channels: Default from settings
- Preview: Shows ticker/contract only, no numeric fields

### 3.2 Enter

**Trigger:** "Enter Now" button from LOADED trade  
**Alert Type:** `enter`  
**Composer State:**
- Title: "Enter – Alert Preview"
- Fields checked: Entry, Target, Stop
- All values use live data (Use live ON)
- Comment: "Entering this trade here."
- Channels: Inherit from LOAD alert channels
- Preview: Shows Entry, Target, Stop

### 3.3 Trim

**Trigger:** "Trim" quick action from ENTERED trade  
**Alert Type:** `update`  
**Composer State:**
- Title: "Trim – Alert Preview"
- Fields checked: Current, P&L
- Values use live data
- Comment: "Trimming 50% here to lock partial profit."
- Channels: Inherit from ENTER alert channels
- Preview: Shows Current, P&L

### 3.4 Update Stop Loss

**Trigger:** "Update SL" quick action from ENTERED trade  
**Alert Type:** `update`  
**Composer State:**
- Title: "Update Stop Loss – Alert Preview"
- **Stop Loss Control visible**
  - Default mode: Breakeven (safest assumption)
- Fields checked: Stop (only)
- Comment: Auto-generated based on SL mode
- Channels: Inherit from ENTER alert channels
- Preview: Shows Stop with mode-specific formatting

### 3.5 Update (Generic)

**Trigger:** "Update" quick action from ENTERED trade  
**Alert Type:** `update`  
**Composer State:**
- Title: "Update – Alert Preview"
- Fields checked: Current (only)
- Comment: "Quick update on this position." (or blank)
- Channels: Inherit from ENTER alert channels
- Preview: Shows Current price

### 3.6 Add to Position

**Trigger:** "Add Position" quick action from ENTERED trade  
**Alert Type:** `add`  
**Composer State:**
- Title: "Add Position – Alert Preview"
- Fields checked: Current, P&L
- Values use live data
- Comment: "Adding to this position here."
- Channels: Inherit from ENTER alert channels
- Preview: Shows Current, P&L

### 3.7 Full Exit

**Trigger:** "Full Exit" quick action from ENTERED trade  
**Alert Type:** `exit`  
**Composer State:**
- Title: "Full Exit – Alert Preview"
- Fields checked: Current (labeled as Exit), P&L
- Values use live data
- Comment: "Exiting the position here."
- Channels: Inherit from ENTER alert channels
- Preview: Shows Exit price, P&L

---

## 4. Toast Notifications

**Purpose:** Confirm successful alert transmission without blocking workflow

### 4.1 Toast Component Spec

**Visual Design:**
- Background: `bg-[var(--surface-1)] border border-[var(--brand-primary)]/50`
- Shadow: `shadow-lg`
- Padding: `px-4 py-3`
- Border radius: `rounded-lg`
- Icon + Text layout: `flex items-center gap-3`

**Position:**
- **Desktop:** Bottom-right corner, 24px from edges
- **Mobile:** Bottom-center, 16px from bottom (above nav if present)

**Content Structure:**
\`\`\`
[Icon] {Alert Type} alert sent to #{channel1}, #{channel2}
\`\`\`

**Icon Mapping:**
- LOADED: 📋
- ENTERED: 🎯
- UPDATE: 📊
- ADDED: ➕
- EXITED: 🏁

**Examples:**
\`\`\`
📋 LOADED alert sent to #options-signals
🎯 ENTERED alert sent to #options-signals, #spx-room
📊 UPDATE alert sent to #options-signals, #spx-room
➕ ADDED alert sent to #options-signals
🏁 EXITED alert sent to #options-signals, #spx-room, #scalp-challenge
\`\`\`

### 4.2 Behavior

**Trigger:** Fired immediately after successful "Send Alert" action  
**Duration:** 4 seconds (auto-dismiss)  
**Stacking:** If multiple alerts sent in quick succession:
- Stack vertically (most recent at top)
- Max 3 visible at once (older ones fade out)
- 8px gap between stacked toasts

**Interaction:**
- Hover: Pause auto-dismiss (desktop only)
- Click: Manual dismiss
- Swipe left/right: Manual dismiss (mobile)

**Animation:**
- Enter: Slide in from bottom (mobile) or right (desktop) + fade in
- Exit: Fade out + slide down (collapse space)

---

## 5. Voice Command System

**Purpose:** Accelerate alert creation via voice shortcuts (never auto-sends)

### 5.1 Voice Command Overlay

**Trigger:** Mic icon in app header  
**Visual:** Full-screen or centered modal overlay

**States:**

**A) Listening State**
- Animated waveform or pulsing mic icon
- Text: "Listening..." (muted, small)
- Background: Semi-transparent dark overlay
- Cancel button visible

**B) Parsing/Processing State**
- Text: "Processing..." with spinner
- Shows parsed text as it appears: "Enter SPX 0DTE 5800C..."

**C) Parsed Command Review**
- Shows interpreted command:
  \`\`\`
  Parsed Command:
  "Enter SPX 0DTE 5800C call"
  
  Interpreted as:
  → Open ENTER alert for SPX $5800C 0DTE
  \`\`\`
- Two buttons:
  - **"Review Alert"** (primary): Opens appropriate composer prefilled
  - **"Cancel"** (secondary): Closes overlay

### 5.2 Command Grammar (High-Level)

**Watchlist Commands:**
- "Add [TICKER] to watchlist" → Adds ticker, no alert
- "Remove [TICKER] from watchlist" → Removes ticker, no alert

**Load Commands:**
- "Load [TICKER] [CONTRACT]" → Opens LOAD composer
  - Example: "Load SPX 0DTE 5800 call"

**Enter Commands:**
- "Enter [TICKER] [CONTRACT]" → Opens ENTER composer
  - Example: "Enter SPX 0DTE 5800C call"
- "Enter [TICKER] [CONTRACT] at [PRICE]" → Prefills entry price
  - Example: "Enter NVDA weekly 485 put at $8.50"

**Update Commands:**
- "Trim [TICKER] [CONTRACT]" → Opens UPDATE composer (trim mode)
  - Example: "Trim SPX scalp"
- "Update stop to breakeven on [TICKER]" → Opens UPDATE composer (SL mode, breakeven)
  - Example: "Update stop to breakeven on SPX"
- "Update stop to [PRICE] on [TICKER]" → Opens UPDATE composer (SL mode, fixed)
  - Example: "Update stop to $20 on NVDA"
- "Update [TICKER]" → Opens UPDATE composer (generic)
  - Example: "Update SPX"

**Add Commands:**
- "Add to [TICKER]" → Opens ADD composer
  - Example: "Add to SPX"

**Exit Commands:**
- "Exit [TICKER]" → Opens EXIT composer
  - Example: "Exit SPX"
- "Exit [TICKER] at [PRICE]" → Prefills exit price
  - Example: "Exit NVDA at $29.50"

### 5.3 Voice UX Rules

1. **Never auto-send:** All commands open the appropriate composer for review
2. **Prefill intelligently:** Use parsed values (ticker, price, mode) to prefill composer fields
3. **Disambiguation:** If multiple active trades match, show picker before opening composer
4. **Error handling:** If command can't be parsed, show "Sorry, I didn't understand" + text input fallback
5. **Visual feedback:** Always show parsed text before opening composer (user confirms intent)

---

## 6. Design System Tokens

Use the following CSS variables consistently across all alert components:

### Colors
\`\`\`css
--brand-primary: #E2B714      /* Primary actions, alert type pills */
--positive: #16A34A           /* Profit, gains, positive P&L */
--negative: #EF4444           /* Loss, exits, stops */
--bg-base: #0A0A0A            /* Base background */
--surface-1: #171717          /* Cards, panels */
--surface-2: #262626          /* Nested cards, inputs */
--border-hairline: #404040    /* Subtle borders */
--text-high: #FAFAFA          /* Primary text */
--text-muted: #A3A3A3         /* Secondary text, labels */
\`\`\`

### Typography
\`\`\`css
/* Headers */
.alert-header-title: text-base font-medium
.alert-section-label: text-xs uppercase tracking-wide text-muted

/* Preview */
.alert-preview-ticker: font-medium (use **bold** in markdown)
.alert-preview-field: text-sm

/* Inputs */
.alert-input: text-sm
.alert-comment: text-sm leading-relaxed

/* Toasts */
.toast-text: text-sm
\`\`\`

### Spacing
\`\`\`css
/* Composer sections */
--composer-section-gap: 1rem (16px)
--composer-padding: 1rem (16px) on mobile, 1.5rem (24px) on desktop

/* Field rows */
--field-row-gap: 0.5rem (8px)
--field-row-padding: 0.75rem (12px)

/* Buttons */
--button-padding-y: 0.75rem (12px)
--button-padding-x: 1.5rem (24px)
\`\`\`

### Borders & Radius
\`\`\`css
--radius-sm: 0.375rem (6px)
--radius-md: 0.5rem (8px)
--radius-lg: 0.75rem (12px)
--radius-xl: 1rem (16px)
\`\`\`

---

## 7. Accessibility

### Keyboard Navigation
- **Tab order:** Header → Preview (read-only, skip) → Field checkboxes → Field inputs → Comment → Channels → Challenges → Discard → Send Alert
- **Enter key:** Submits "Send Alert" when focused on primary button
- **Escape key:** Closes composer (same as Discard)

### Screen Readers
- Preview card: `aria-label="Alert message preview"`
- Field checkboxes: `aria-label="Include {field name} in alert"`
- "Use live" toggle: `aria-label="Use live {field name} data"`
- Stop Loss mode: `role="radiogroup" aria-label="Stop loss type"`
- Channel checkboxes: `role="group" aria-label="Discord channels"`

### Visual Indicators
- Required channels: Show validation error if none selected
- Disabled "Send Alert" button: Include tooltip "Select at least one channel"
- Live data toggle: Visual indicator when data is stale or unavailable

---

## 8. Responsive Behavior

### Desktop (≥768px)
- Composer opens in right panel (Live Cockpit)
- Composer replaces current right panel content
- Smooth slide-in animation from right
- Can still see trades list on left while composing

### Mobile (<768px)
- Composer opens as bottom sheet overlay
- Dims main content with `bg-black/60`
- Drag handle for dismissal
- Swipe down to close
- Stacks above bottom navigation (if present)

### Tablet (768px - 1024px)
- Use desktop layout with slightly narrower composer panel
- Touch-friendly input sizes (44px min touch targets)

---

## 9. Implementation Checklist

### Phase 1: Core Composer
- [ ] Alert Composer component (desktop variant)
- [ ] Alert Composer component (mobile variant)
- [ ] Preview Card with live update
- [ ] Included Fields panel with checkboxes
- [ ] "Use live" toggle functionality
- [ ] Comment textarea
- [ ] Channels checkboxes with validation
- [ ] Send Alert + Discard actions

### Phase 2: Stop Loss Control
- [ ] SL Control UI (3 modes)
- [ ] Breakeven mode logic
- [ ] Fixed price mode with input
- [ ] Trailing stop mode with distance + unit + trail-from
- [ ] Preview updates based on SL mode

### Phase 3: Quick Actions Integration
- [ ] Map all 7 quick actions to composer states
- [ ] Prefill logic for each action
- [ ] Default comment suggestions
- [ ] Channel inheritance from previous alerts

### Phase 4: Toasts
- [ ] Toast component (desktop position)
- [ ] Toast component (mobile position)
- [ ] Auto-dismiss timer
- [ ] Stacking logic
- [ ] Animation in/out

### Phase 5: Voice Commands
- [ ] Voice overlay UI (listening, parsing, review)
- [ ] Command parser (basic grammar)
- [ ] Prefill composer from voice command
- [ ] Disambiguation for multiple trades
- [ ] Error handling

### Phase 6: Polish
- [ ] Keyboard navigation
- [ ] Screen reader labels
- [ ] Responsive layout tests
- [ ] Animation polish
- [ ] Dark theme consistency

---

## 10. Usage Examples

### Example 1: Desktop Trim Flow
1. Admin clicks "Trim" on active SPX trade
2. Right panel slides in with Alert Composer
3. Title: "Trim – Alert Preview"
4. Preview shows: **SPX $5800C 0DTE** (Scalp) → Current: $27.30 → P&L: +21.3%
5. Comment prefilled: "Trimming 50% here to lock partial profit."
6. Channels: #options-signals, #spx-room (both checked)
7. Admin reviews, clicks "Send Alert"
8. Composer closes, toast appears: "📊 UPDATE alert sent to #options-signals, #spx-room"

### Example 2: Mobile Update Stop Loss Flow
1. Admin taps "Update SL" in Now-Playing panel
2. Bottom sheet slides up with Alert Composer
3. Stop Loss Control visible with Breakeven selected
4. Preview shows: **SPX $5800C 0DTE** (Scalp) → Stop: Breakeven ($22.50)
5. Admin switches to "Trailing Stop", sets 0.50 points from current
6. Preview updates: Stop: Trailing 0.50 pts from current ($26.80)
7. Comment auto-updates: "Setting a trailing stop: 0.50 points from current."
8. Admin taps "Send Alert"
9. Bottom sheet closes, toast appears at bottom: "📊 UPDATE alert sent to #spx-room"

### Example 3: Voice Command Flow
1. Admin taps mic icon in header
2. Voice overlay appears, listening state
3. Admin says: "Trim SPX scalp"
4. Parsed command shows: "Trim SPX scalp" → "Open UPDATE alert (trim mode) for SPX $5800C 0DTE"
5. Admin taps "Review Alert"
6. Alert Composer opens in trim mode, prefilled
7. Admin makes adjustments, sends alert

---

## Appendix: Design Artifacts

Reference wireframes demonstrating this spec:
- `/components/wireframes/AlertComposerDesktop.tsx` (desktop variant)
- `/components/wireframes/AlertComposerMobile.tsx` (mobile variant)
- `/components/wireframes/ToastExamples.tsx` (all toast variants)
- `/components/wireframes/VoiceCommandOverlay.tsx` (voice UI)

---

**End of Specification**
