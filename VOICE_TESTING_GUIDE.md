# Voice Commands Quick Test Guide

## Test Scenarios

### 1. Compound Commands

**Test A: Take Profits + Break-Even**

```
Say: "Hey Honey, take profits on SPY and move stop to break even"

Expected:
✓ Opens trim dialog for SPY
✓ After confirming trim → speaks "Next action: update stop loss"
✓ Opens SL dialog with price = entry price
✓ After confirming SL → speaks "All actions completed"
```

**Test B: Exit + Enter**

```
Say: "Hey Honey, exit QQQ and enter TSLA"

Expected:
✓ Opens exit dialog for QQQ
✓ After confirming exit → speaks "Next action: enter trade"
✓ Opens contract selector for TSLA
✓ After selecting contract → speaks "All actions completed"
```

**Test C: Cancel Compound**

```
Say: "Hey Honey, take profits on SPY and move stop to break even"
Then: "Cancel"

Expected:
✓ Opens trim dialog
✓ "Cancel" → speaks "Cancelled"
✓ Clears pendingCompoundActions queue
✓ Does NOT execute second action
```

### 2. Trade Disambiguation

**Setup**: Create 2 SPY trades with different strikes/expirations

**Test A: Numeric Selection**

```
Say: "Hey Honey, exit SPY"

Expected:
✓ Speaks: "I found 2 SPY trades. Say 1 for the first one..."
✓ Shows numbered list in HUD

Say: "1"

Expected:
✓ Executes exit on first SPY trade
```

**Test B: Descriptive Selection**

```
Say: "Hey Honey, trim SPY"

Expected:
✓ Disambiguation prompt

Say: "The second one" or "455 call"

Expected:
✓ Executes trim on second SPY trade
```

**Test C: Single Match**

```
Setup: Only 1 QQQ trade

Say: "Hey Honey, exit QQQ"

Expected:
✓ NO disambiguation prompt
✓ Immediately opens exit dialog for QQQ
```

### 3. Context Extraction

**Test A: Sizing Hint**

```
Say: "Hey Honey, enter QQQ and size lightly"

Expected:
✓ Opens contract selector for QQQ
✓ After selecting contract:
  - Comment field shows "Size lightly"
  - Smart alert reasoning includes "size lightly"
```

**Test B: Chart Level**

```
Say: "Hey Honey, enter SPY at resistance"

Expected:
✓ Opens contract selector for SPY
✓ Smart alert reasoning includes "at resistance"
```

**Test C: Multiple Contexts**

```
Say: "Hey Honey, enter TSLA quick scalp near support"

Expected:
✓ Extracts first match: "quick scalp" OR "near support"
✓ Passed to onLoadContract as reasoning
```

### 4. Voice Navigation

**Test A: Go to Active**

```
Say: "Hey Honey, go to active trades"

Expected:
✓ Navigates to /active route
✓ Flash animation on active trades tab
✓ Speaks: "Navigating to active"
```

**Test B: Show Settings**

```
Say: "Hey Honey, show settings"

Expected:
✓ Navigates to /settings route
✓ Speaks: "Navigating to settings"
```

**Test C: All Destinations**

```
Test each:
- "go to live" → /
- "show history" → /history
- "open monitoring" → /monitoring
```

### 5. Break-Even Stops

**Setup**: Enter a trade with entryPrice = $15.50

**Test A: Break-Even Command**

```
Say: "Hey Honey, move stop to break even"

Expected:
✓ Opens SL dialog
✓ Price field pre-filled with $15.50 (entry price)
✓ Reasoning shows "Break-even stop"
```

**Test B: Variations**

```
Test each variation:
- "break even"
- "breakeven"
- "b/e"
- "break-even"

All should:
✓ Calculate SL = entry price
✓ Open SL dialog with pre-filled price
```

### 6. Command Tracking

**Test A: Track Supported Command**

```
Say: "Hey Honey, exit SPY"

Check localStorage:
key: voice_command_history
value: [{
  userId: "...",
  command: "processed",
  transcript: "exit SPY",
  parsedType: "exit-trade",
  wasHandled: true,
  timestamp: 1234567890
}]
```

**Test B: Track Unsupported Command**

```
Say: "Hey Honey, show me the chart"

Check localStorage:
✓ parsedType: null
✓ wasHandled: false
✓ Command logged for future feature prioritization
```

**Test C: View Analytics** (future feature)

```
Open console:
import { getTopCommands, getUnsupportedCommands } from '@/lib/services/commandTracking';

console.log(getTopCommands(userId, 5));
// Shows: [
//   { type: "exit-trade", count: 10 },
//   { type: "trim-trade", count: 8 },
//   ...
// ]

console.log(getUnsupportedCommands(userId));
// Shows: [
//   { command: "show me the chart", count: 5 },
//   { command: "what's my profit", count: 3 },
//   ...
// ]
```

## Quick Debugging

### Check State

**Voice Hook State** (in DesktopLiveCockpitSlim):

```javascript
// Add temporary console.log in useVoiceCommands:
console.log("[v0] Voice state:", {
  pendingCompoundActions,
  compoundActionIndex,
  awaitingTradeSelection,
  isListening,
  waitingForWakeWord,
});
```

**Command History**:

```javascript
// Browser console:
JSON.parse(localStorage.getItem("voice_command_history") || "[]");
```

### Clear State

**Reset Command History**:

```javascript
// Browser console:
localStorage.removeItem("voice_command_history");
```

**Reset Voice State**:

```
Say: "Hey Honey, cancel"
// OR refresh page
```

## Expected Issues & Workarounds

### Issue 1: Wake Word Not Detected

**Symptom**: "Hey Honey" doesn't activate mic

**Workaround**:

- Check mic permissions in browser
- Try manual mic button click in header
- Check Web Speech API support (Chrome/Edge best)

### Issue 2: Compound Action Stuck

**Symptom**: First action completes, second never starts

**Debug**:

1. Check pendingCompoundActions in state
2. Check compoundActionIndex increments in confirmAction
3. Verify confirmAction calls executeAction(nextAction)

**Workaround**: Say "cancel" to reset

### Issue 3: Trade Disambiguation Infinite Loop

**Symptom**: Keeps asking "which one?" after selection

**Debug**:

1. Check awaitingTradeSelection clears after response
2. Check handleTradeSelectionResponse() regex patterns
3. Verify numeric ("1") and descriptive ("first one") both work

**Workaround**: Say full contract details: "SPY 450 call"

### Issue 4: Context Not Preserved

**Symptom**: "size lightly" doesn't appear in comment

**Debug**:

1. Check extractContext() detects pattern
2. Verify extractedContext passed through action chain
3. Check onLoadContract receives reasoning parameter

**Workaround**: Manually type in comment field

## Performance Expectations

**Wake Word Detection**: < 500ms
**Command Parsing**: < 100ms
**Action Execution**: < 200ms
**Total Latency**: ~1 second end-to-end

**Whisper Fallback** (when Web Speech fails):

- Latency: 2-5 seconds (server processing)
- Accuracy: Higher than Web Speech
- Cost: $0.006 per minute

## Next Steps After Testing

1. **Report Bugs**:
   - Note exact transcript that failed
   - Check browser console for errors
   - Save localStorage command history

2. **Request Features**:
   - Check getUnsupportedCommands() for patterns
   - Prioritize by frequency
   - Add to voice command roadmap

3. **Optimize**:
   - Identify slow commands (> 2s latency)
   - Profile parseVoiceCommand performance
   - Consider caching frequently used patterns

## Success Criteria

✅ All 6 feature categories tested
✅ Compound commands execute sequentially
✅ Disambiguation prompts and handles responses
✅ Context extraction captures natural language
✅ Voice navigation changes routes correctly
✅ Break-even stops calculate entry price
✅ Command tracking logs to localStorage

## Ready to Test!

1. Start dev server: `pnpm run dev`
2. Open http://localhost:5173
3. Login with test account
4. Enable mic permissions
5. Say "Hey Honey" to activate
6. Try test scenarios above

Happy testing! 🎤✨
