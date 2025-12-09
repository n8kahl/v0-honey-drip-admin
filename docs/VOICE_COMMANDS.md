# Voice Commands Reference

Hands-free trading with voice controls. Commands trigger the same flows as clicking.

## Activation

| Method | Description |
|--------|-------------|
| "Hey Honey" | Wake word to activate voice listening |
| Press `M` | Keyboard shortcut to toggle listening |

## Entry Alerts

| Command | Action |
|---------|--------|
| "Enter SPY" | Search best contract and generate entry alert |
| "Enter QQQ at 500" | Load QQQ 500 strike |
| "Enter SPY at 15 dollars" | Generate alert with specified price |
| "Go long AAPL" | Generate call entry alert |
| "Load SPX calls" | Load SPX call options chain |

## Exit & Trims

| Command | Action |
|---------|--------|
| "Exit SPY" | Generate exit alert for active trade |
| "Take profit" | Partial exit at current price |
| "Trim 50" | Trim 50% of position |
| "Trim current trade" | Generate trim alert (default 30-50%) |
| "Exit all" | Full exit |

## Position Management

| Command | Action |
|---------|--------|
| "Update stop loss" | Generate stop loss update alert |
| "Move stop to 2.50" | Update stop loss to specific price |
| "Add to position" | Scale in / add to existing trade |

## Watchlist

| Command | Action |
|---------|--------|
| "Add NVDA" | Add ticker to watchlist |
| "Add TSLA to watchlist" | Add ticker to watchlist |
| "Remove SPY" | Remove from watchlist |

## How It Works

1. **Activate**: Say "Hey Honey" or press `M`
2. **Command**: Speak naturally - the system understands context
3. **Smart Search**: For entries, automatically searches best contracts
4. **Confirmation**: Reviews alert with voice readback before sending (if enabled)
5. **Send**: Confirms and sends to your default Discord channels

## Browser Support

Voice commands require Chrome, Edge, or Safari with microphone permissions.

## Settings

Configure voice behavior in Settings > Voice Commands:
- Enable/disable voice commands
- Require confirmation for trade actions
- Enable audio feedback (TTS)
