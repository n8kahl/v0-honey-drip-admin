# ✅ Challenge Visibility Fix

## Problem
Challenges section wasn't visible on mobile Live screen because:
1. Watchlist was expanded by default (showing 6 tickers)
2. This pushed Challenges section below the fold
3. Users didn't know to scroll down to see it

## Root Cause
In `/components/hd/HDPanelWatchlist.tsx`, the watchlist started with:
\`\`\`tsx
const [watchlistExpanded, setWatchlistExpanded] = useState(true);
\`\`\`

This meant 6 watchlist items were always shown on load, taking up all the visible space on mobile.

## Solution Applied
Changed the default state to collapsed:
\`\`\`tsx
const [watchlistExpanded, setWatchlistExpanded] = useState(false);
\`\`\`

## Result
Now on mobile Live screen, you'll see:
- ✅ **LOADED TRADES (0)** ▼ (expanded, but empty = no space)
- ✅ **WATCHLIST (6)** ▶ (collapsed - click arrow to expand)
- ✅ **CHALLENGES (X)** ▼ (expanded and VISIBLE!)

This ensures challenges are immediately visible without scrolling.

## User Flow
1. User opens Live screen
2. Sees collapsed watchlist (saving space)
3. Sees expanded challenges section below it
4. Can click watchlist arrow to expand if needed
5. Can click into any challenge to see details

## File Modified
- `/components/hd/HDPanelWatchlist.tsx` - Changed `watchlistExpanded` default from `true` to `false`

## Testing
- [x] Challenges section now visible on mobile without scrolling
- [x] Watchlist still expandable by clicking arrow
- [x] Challenge click opens detail dialog
- [x] Empty state shows when no challenges exist
- [x] Desktop view unaffected (always has space)
