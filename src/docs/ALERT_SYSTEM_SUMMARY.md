# HoneyDrip Admin – Alert System Summary

## 🎯 What We Built

A complete **Global Alert System** design specification with visual reference components that can be reused across both Desktop and Mobile wireframes in HoneyDrip Admin.

---

## 📄 Documents Created

### 1. `/docs/ALERT_SYSTEM_SPEC.md`
**Complete 3,000+ line specification** covering:
- ✅ Alert Types (LOAD, ENTER, UPDATE, ADD, EXIT)
- ✅ Alert Composer Component (Desktop + Mobile variants)
- ✅ Included Fields panel with "Use live" toggle
- ✅ Stop Loss Control (Breakeven, Fixed, Trailing modes)
- ✅ Quick Actions → Composer mapping
- ✅ Toast Notifications design
- ✅ Voice Command system (high-level UX)
- ✅ Design tokens (colors, typography, spacing)
- ✅ Accessibility guidelines
- ✅ Implementation checklist

---

## 🧩 Visual Components Created

### 2. `/components/wireframes/AlertComposerDesktop.tsx`
**Desktop Alert Composer** reference implementation showing:
- Three-column layout with trade list + composer panel
- UPDATE (Trim) alert type example
- All sections: Preview Card, Included Fields, Comment, Channels, Challenges
- Desktop-specific patterns: side-by-side buttons, hover states, standard inputs

**View it:** Click **"Alert Composer Desktop"** tab in the app

---

### 3. `/components/wireframes/AlertComposerMobile.tsx`
**Mobile Alert Composer** (bottom sheet) showing:
- UPDATE (Stop Loss - Trailing) alert type example
- Stop Loss Control with all three modes visible
- Mobile-specific patterns: bottom sheet, drag handle, stacked buttons
- Touch-friendly inputs and larger tap targets

**View it:** Click **"Alert Composer Mobile"** tab in the app

---

### 4. `/components/wireframes/ToastExamples.tsx`
**Toast Notification** examples showing:
- All 5 alert types (LOADED, ENTERED, UPDATE, ADDED, EXITED)
- Desktop positioning (bottom-right, stacked vertically)
- Mobile positioning (bottom-center, above nav)
- Animation patterns (slide-in from right/bottom)

**View it:** Click **"Toast Examples"** tab in the app

---

### 5. `/components/wireframes/VoiceCommandOverlay.tsx`
**Voice Command UI** showing all three states:
1. **Listening** – Animated waveform, pulsing mic icon
2. **Processing** – Spinner + parsed text preview
3. **Parsed Command Review** – Interpreted action + "Review Alert" button

Plus 8 example voice commands with their mappings.

**View it:** Click **"Voice Command Overlay"** tab in the app

---

## 🔑 Key Design Decisions

### 1. **No Auto-Send Rule**
Every alert action opens a composer requiring explicit admin approval via "Send Alert" button. This is the **core safety principle** of the entire system.

### 2. **Unified Pattern Across Surfaces**
The same Alert Composer structure works on:
- Desktop right panel (Live Cockpit)
- Mobile bottom sheet
- Future surfaces (tablet, PWA, etc.)

### 3. **Configurable Fields**
All alert fields (Entry, Current, Target, Stop, P&L) have:
- Checkbox: Include/exclude in message
- Value: Editable or live-synced
- "Use live" toggle: Manual override capability

### 4. **Stop Loss Intelligence**
Three distinct modes:
- **Breakeven:** Auto-calculates from entry price
- **Fixed Price:** Manual numeric input
- **Trailing Stop:** Distance + unit + trail-from logic

### 5. **Voice Commands Never Send**
Voice only shortcuts to building the right **draft alert** – never executes the send.

---

## 🎨 Design Tokens

All components use consistent CSS variables from `/styles/globals.css`:

\`\`\`css
--brand-primary: #E2B714    /* Primary actions, alerts */
--positive: #16A34A         /* Profit, gains */
--negative: #EF4444         /* Loss, stops */
--bg-base: #0A0A0A          /* Base background */
--surface-1: #171717        /* Cards, panels */
--surface-2: #262626        /* Nested cards */
--border-hairline: #404040  /* Subtle borders */
--text-high: #FAFAFA        /* Primary text */
--text-muted: #A3A3A3       /* Secondary text */
\`\`\`

---

## 📋 Quick Actions Mapping

| Quick Action | Alert Type | Default Fields | Comment |
|--------------|------------|----------------|---------|
| **Load** | `load` | None | "Watching this contract..." |
| **Enter** | `enter` | Entry, Target, Stop | "Entering this trade here." |
| **Trim** | `update` | Current, P&L | "Trimming 50% here..." |
| **Update SL** | `update` | Stop (with SL control) | Auto-generated based on mode |
| **Update** | `update` | Current | "Quick update on this position." |
| **Add** | `add` | Current, P&L | "Adding to this position here." |
| **Exit** | `exit` | Current (exit), P&L | "Exiting the position here." |

---

## 🚀 How to Use This Spec

### For Design
1. Use `/docs/ALERT_SYSTEM_SPEC.md` as your source of truth
2. Reference visual components for layout patterns
3. Maintain consistency with design tokens

### For Development
1. Implement `AlertComposer` component (reusable)
2. Map quick actions to composer configurations (see Section 3 of spec)
3. Build toast notification system (Section 4)
4. Add voice command overlay (Section 5)

### For Testing
- [ ] Test all 7 quick actions open correct composer state
- [ ] Test field checkboxes show/hide in preview
- [ ] Test "Use live" toggle enables/disables manual editing
- [ ] Test all 3 Stop Loss modes calculate correctly
- [ ] Test toast stacking and auto-dismiss
- [ ] Test voice commands prefill composer correctly
- [ ] Test keyboard navigation (Tab, Enter, Escape)

---

## 📱 Responsive Behavior

| Screen Size | Layout | Notes |
|-------------|--------|-------|
| **Desktop** (≥768px) | Right panel in Live Cockpit | 400-500px width, full height |
| **Mobile** (<768px) | Bottom sheet overlay | Max 85vh, rounded top corners |
| **Tablet** (768-1024px) | Desktop layout | Touch-friendly sizes (44px min) |

---

## 🎯 Next Steps

1. **Integrate into existing wireframes:**
   - Replace static "alert preview" sections with reusable `AlertComposer`
   - Add toast notifications after "Send Alert" actions
   - Wire up voice commands to open composers

2. **Extend to new surfaces:**
   - PWA notifications
   - Tablet landscape mode
   - Watch OS companion app (future)

3. **Add backend integration:**
   - Discord webhook API calls
   - Alert history/audit log
   - Template management (save/reuse alert configs)

---

## 💡 Example Flows

### Desktop Trim Flow
1. Admin clicks **"Trim"** on active SPX trade
2. Right panel slides in with Alert Composer
3. Title: "Trim – Alert Preview"
4. Preview shows: Current ($27.30), P&L (+21.3%)
5. Comment prefilled: "Trimming 50% here to lock partial profit."
6. Channels inherited from ENTER alert
7. Admin reviews, clicks **"Send Alert"**
8. Composer closes, toast appears: "📊 UPDATE alert sent to #options-signals, #spx-room"

### Mobile Voice → SL Update Flow
1. Admin taps mic icon in header
2. Voice overlay appears, listening state
3. Admin says: **"Update stop to breakeven on SPX"**
4. Parsed command shows interpretation
5. Admin taps **"Review Alert"**
6. Bottom sheet opens with UPDATE composer (SL mode)
7. Breakeven mode selected, Stop field shows entry price
8. Admin taps **"Send Alert"**
9. Toast appears: "📊 UPDATE sent to #spx-room"

---

## 🔗 Related Files

- **Spec:** `/docs/ALERT_SYSTEM_SPEC.md`
- **Desktop Composer:** `/components/wireframes/AlertComposerDesktop.tsx`
- **Mobile Composer:** `/components/wireframes/AlertComposerMobile.tsx`
- **Toasts:** `/components/wireframes/ToastExamples.tsx`
- **Voice:** `/components/wireframes/VoiceCommandOverlay.tsx`
- **Existing Wireframes:**
  - `/components/wireframes/Desktop.LiveCockpit.*.tsx` (4 frames)
  - `/components/wireframes/Mobile.Live.*.tsx` (3 frames)
  - `/components/wireframes/Mobile.Active.List.tsx`

---

**Ready to be turned into production components!** 🚀
