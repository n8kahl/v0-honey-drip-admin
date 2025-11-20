# Production Monitoring System

## Overview

The monitoring dashboard provides real-time visibility into the trading application's production health across four critical dimensions:

1. **Data Provider Health** - Massive/Tradier API availability and performance
2. **Greeks/IV Quality** - Options Greeks validation and anomaly detection
3. **P&L Accuracy** - Trading profitability including realistic cost accounting
4. **System Health** - API response times, error rates, and WebSocket stability

## Quick Start

### Accessing the Monitoring Dashboard

1. **Keyboard Shortcut**: Press `5` to navigate to the Monitoring tab
2. **Navigation**: Click the "Monitoring" tab in the main navigation bar (between Review and Settings)
3. **Real-time Updates**: Dashboard automatically updates every 5 seconds

### Dashboard Controls

- **Pause Button**: Click to pause metrics updates while investigating issues
- **Resume Button**: Resumes real-time metric collection
- **Updated Timestamp**: Shows when metrics were last refreshed

## The Four Monitoring Panels

### 1. Data Provider Health Panel

**What it monitors**: API availability and response time performance for both data sources

**Key Metrics**:
- **Uptime %**: Percentage of successful API requests
  - 🟢 Green (≥99%): Excellent health
  - 🟡 Yellow (95-99%): Acceptable, minor issues
  - 🔴 Red (<95%): Serious issues, failover activated

- **Request Count**: Total API calls made to this provider
- **Success Count**: Number of successful requests
- **Response Time**: Average API response latency in milliseconds
- **Fallback Count**: How many times requests failed and were retried or redirected

**What to look for**:
- Sudden uptime drops indicate API issues (check provider status page)
- Rising response times suggest network congestion or provider overload
- High fallback counts mean Massive is down, traffic routing to Tradier
- If both providers <95%, check network connectivity

**Typical values**:
- Massive: 150-250ms response time
- Tradier: 100-200ms response time
- Combined uptime: 99%+

### 2. Greeks/IV Quality Panel

**What it monitors**: Options Greeks data accuracy and IV (implied volatility) anomalies

**Key Metrics**:
- **Valid Greeks Rate**: Percentage of trades with valid Greeks data
  - 🟢 Green (≥95%): Excellent
  - 🟡 Yellow (85-95%): Minor validation issues
  - 🔴 Red (<85%): Serious Greeks data problems

- **Total Trades**: Number of trades analyzed
- **Estimated Greeks**: Count of trades using fallback Greeks (missing API data)
- **Validation Errors**: Trades with Greeks outside valid bounds
- **IV Anomalies**: Unusual IV values (crushes, spikes)

**Critical Errors Section** (displayed in red):
- **Gamma = 0**: Mathematical impossibility indicating data error (100%+ pricing error risk)
- **Delta Out of Bounds**: Delta outside [-1, 1] range (pricing model invalid)

**What to look for**:
- Gamma=0 errors = immediate data quality issue, may affect pricing
- Delta out of bounds = corrupted Greeks data from API
- High "Estimated" count = API returning incomplete data
- IV spikes = potential implied volatility crush (impacts option pricing)

**Bounds Reference**:
- Delta: -1 to +1
- Gamma: 0 to 0.5 (never 0)
- Theta: -5 to +5
- Vega: -1 to +1
- IV: 0.01 to 5.0 (1% to 500%)

### 3. P&L Accuracy Panel

**What it monitors**: Trading profitability accounting for realistic market costs

**Key Metrics**:
- **Avg Gross P&L %**: Average profit before commissions and slippage
  - Shows raw market movement
  - Higher is better

- **Avg Net P&L %**: Average profit after all costs
  - This is the "real" P&L traders experience
  - Should be 5-10% lower than gross due to costs

- **Cost Impact %**: Red bar showing cost as % of P&L
  - Typical: 2-5% impact
  - High (>10%): Trading too small positions or paying high commissions

- **Trades**: Number of trades executed
- **Total Commission**: Sum of all entry/exit commissions
- **Avg Slippage**: Average bid-ask spread cost per trade
- **Backtest Variance**: Difference between backtest and live P&L
  - 🟢 Green (<5%): Excellent backtest accuracy
  - 🟡 Yellow (5-10%): Minor variance (normal)
  - 🔴 Red (>10%): Major mismatch, review assumptions

**What to look for**:
- Gross much higher than net = high cost environment
- Backtest variance >10% = backtest assumptions unrealistic
- High commission costs = consider larger position sizes
- Slippage spikes = avoid illiquid strike prices

**Example**:
- Gross: 5.5% (market profit)
- Cost: 1.2% (0.8% commission + 0.4% slippage)
- Net: 4.3% (actual profit)
- Backtest claimed: 5.8% (2% over-optimistic)

### 4. System Health Panel

**What it monitors**: Application infrastructure performance and stability

**Key Metrics**:
- **WebSocket Status**:
  - 🟢 Green "✓ Connected": Real-time market data flowing
  - 🔴 Red "✗ Disconnected": Quotes/charts will lag

- **API Response Time**: Average time for REST API calls (ms)
  - Typical: 100-300ms
  - >1000ms: Check network/provider status

- **WS Latency**: WebSocket message round-trip time
  - Typical: <100ms
  - >500ms: Potential real-time data lag

- **Total Errors**: Cumulative count of system errors
  - 🟢 Green (<10): Normal
  - 🟡 Yellow (10-50): Minor issues
  - 🔴 Red (>50): Active problems

- **Uptime**: How long the application has been running
  - Example: "5h 23m" = running 5 hours 23 minutes

**Error Breakdown** (shown if errors exist):
- Shows top error types (API_ERROR, VALIDATION_ERROR, etc.)
- Last Error: Most recent system error message

**What to look for**:
- WebSocket disconnection = immediate chart/quote issues
- Rising error count = investigate error breakdown
- Consistent timeouts = check provider APIs
- Uptime >24h = healthy long-running session

## Interpreting Common Scenarios

### Scenario: Data Provider Failover in Progress

**Indicators**:
- Massive uptime drops from 100% to 0%
- Tradier uptime at 100%
- Request counts increasing on Tradier

**What's happening**: Massive API is down, requests automatically routing to Tradier fallback

**Action**:
- Check Massive API status page
- Monitor that Tradier data quality is acceptable
- No user action needed, failover automatic

**Expected Recovery**: 15-30 minutes if provider maintenance, hours if outage

### Scenario: Greeks Data Quality Degradation

**Indicators**:
- Valid Greeks Rate drops from 95% to 75%
- Estimated Greeks count increases
- Gamma=0 errors appearing

**What's happening**: API returning incomplete or corrupted Greeks data

**Action**:
1. Check Data Provider Health - if Massive down, switch to Tradier chain
2. Cancel large new positions until resolved
3. Review "Estimated Greeks" trades - these use fallback values
4. Monitor Greeks QA - should resolve when API recovers

**Expected Recovery**: 5-15 minutes typically

### Scenario: High Backtest Variance Detected

**Indicators**:
- Backtest Variance >10%
- Actual P&L consistently lower than expected
- Cost Impact >5%

**What's happening**: Trading environment different from backtest assumptions

**Possible causes**:
1. **Liquidity**: Using illiquid strikes, experiencing wider spreads
2. **Fill Quality**: Not getting fills at expected prices
3. **Costs**: Commissions or fees higher than modeled
4. **Position Size**: Trading smaller positions (fixed costs become larger %)

**Action**:
1. Review P&L Cost Breakdown
2. Check Average Slippage - if high, use more liquid strikes
3. Check Total Commission - if high relative to trade size, increase position size
4. Update backtester cost assumptions to match live environment

### Scenario: WebSocket Disconnection

**Indicators**:
- WebSocket Status: "✗ Disconnected"
- Live chart stops updating
- Quotes become stale

**What's happening**: Real-time market data connection lost

**Typical causes**:
1. Network interruption
2. Server-side connection issue
3. Browser developer tools affecting WebSocket

**Action**:
1. Check browser network tab for WebSocket errors
2. Verify internet connection
3. Refresh the page to reconnect
4. Check server logs for disconnection reason

**Expected Recovery**: Immediate after reconnection

## Metrics Service Architecture

### Client-Side Metrics Collection

The MetricsService runs in the browser and collects metrics from:

1. **API Calls**: Every Massive/Tradier request records response time and success status
2. **Greeks Validation**: Every trade's Greeks are validated against bounds
3. **P&L Calculation**: Every trade records gross, net, and cost breakdown
4. **Error Handling**: Every system error is categorized and recorded

### Real-Time Dashboard Updates

- **Update Frequency**: Every 5 seconds
- **Pause**: Freezes updates for investigation without losing data
- **Running Averages**: Response times and P&L use exponential moving averages
- **Last Update**: Timestamp shows most recent metrics refresh

### Metrics Retention

- **In-Memory Only**: Metrics reset on page refresh
- **For Persistence**: Implement metrics export (save to localStorage or server)
- **Session Duration**: Tracks uptime from page load to refresh

## API Integration

### GET /api/metrics

Returns monitoring status and tracked metrics info:

```json
{
  "status": "ok",
  "monitoring": true,
  "message": "Production metrics are tracked client-side via MonitoringDashboard",
  "metricsTracked": [
    "Provider Health (Massive/Tradier uptime, response times)",
    "Greeks Quality (validation rates, bounds checking)",
    "P&L Accuracy (gross vs net P&L, cost impact)",
    "System Health (API times, errors, WebSocket status)"
  ],
  "updateFrequency": "5 seconds",
  "timestamp": "2025-02-14T10:30:45.123Z"
}
```

## Best Practices

### Daily Checks

1. **First Trade of Day**:
   - Verify both Massive and Tradier uptime >99%
   - Check that Greeks Valid Rate >95%
   - Confirm WebSocket Connected

2. **During Trading**:
   - Monitor Cost Impact % to catch position sizing issues
   - Watch Backtest Variance - should be <5%
   - Check error count stays low (<10 during session)

3. **End of Day**:
   - Review total commission paid vs strategy assumptions
   - Check avg slippage vs expected bid-ask spreads
   - Document any errors for investigation

### Troubleshooting Guide

| Symptom | Likely Cause | Check First |
|---------|-------------|------------|
| Uptime <95% | API outage or network issue | Provider health panel |
| Valid Greeks <90% | Corrupted API data | Greeks quality panel, check error details |
| Backtest variance >10% | Cost assumptions wrong | P&L panel, compare gross vs net |
| WebSocket disconnected | Connection lost | System health, browser console |
| High error count | Application issues | Error breakdown, system logs |
| Slippage >2% | Using illiquid strikes | Check strike selection, switch to more liquid |

### Performance Optimization

1. **Reduce Update Frequency**: If dashboard slow, click Pause when not actively monitoring
2. **Clear Browser Cache**: Old service workers can cause issues, clear cache and refresh
3. **Close Other Tabs**: Reduces browser CPU usage, improves dashboard responsiveness
4. **Use Chrome DevTools**: Performance tab shows if dashboard is causing slowdowns

## Integration with Monitoring Services

For production deployments, integrate metrics with external monitoring:

### Option 1: Send to Grafana/Prometheus
```typescript
// Add metric export to external monitoring service
const metrics = metricsService.getDashboardMetrics();
await fetch('https://metrics-server/v1/metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(metrics)
});
```

### Option 2: Send to DataDog/New Relic
```typescript
// Log metrics to APM service
window.DD_RUM?.addUserAction('metrics_update', metrics);
```

### Option 3: LocalStorage Persistence
```typescript
// Save metrics locally for dashboard export
const metrics = metricsService.getDashboardMetrics();
localStorage.setItem(
  `trading-metrics-${new Date().toISOString()}`,
  JSON.stringify(metrics)
);
```

## Troubleshooting the Monitoring System

### Dashboard Not Updating

1. Check browser console for errors (F12 → Console)
2. Verify WebSocket is connected
3. Click the "Resume" button if paused
4. Refresh page to restart metrics collection

### Metrics Appear Stuck

1. This is normal if no API activity - pauses when idle
2. Make an API request (load watchlist, open options chain)
3. Metrics update every 5 seconds when changes detected

### Missing Data in Panels

1. Need to generate data - metrics start at zero
2. Make trades or API calls to populate
3. Greeks data requires open positions
4. Error data requires actual errors to occur

## See Also

- **PRODUCTION_READINESS_PLAN.md** - Overall production readiness status
- **src/services/monitoring.ts** - MetricsService implementation
- **src/components/monitoring/MonitoringDashboard.tsx** - Dashboard UI component
- **src/services/__tests__/monitoring.test.ts** - Metrics service unit tests
