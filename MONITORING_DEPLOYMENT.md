# Monitoring System Deployment & Operations Guide

## Deployment Checklist

### Pre-Deployment Verification

- [ ] All metrics tests passing (`npm run test:monitoring`)
- [ ] MonitoringDashboard component renders without errors
- [ ] MetricsService initializes on app start
- [ ] API endpoint `/api/metrics` responds with 200 status
- [ ] All data providers integrated with metrics recording
- [ ] Greeks service recording validation metrics
- [ ] P&L calculator recording cost metrics
- [ ] No breaking changes to existing trades/data

### Staging Environment Deployment

```bash
# 1. Deploy code to staging
git push origin claude/trading-coach-app-013FbqyEuRjn48R7ac8ivX1C
npm run build

# 2. Run tests in staging
npm run test:monitoring
npm run test:integration

# 3. Start staging server
npm run start:staging

# 4. Verify monitoring dashboard loads
# Navigate to https://staging.app/
# Press key '5' to open Monitoring tab
# Verify all 4 panels display without errors

# 5. Run one week of staging monitoring
# Execute sample trades
# Verify metrics accumulate correctly
# Check for memory leaks (restart browser daily)
```

### Production Deployment

```bash
# 1. Create production release branch
git checkout -b release/v1.0-monitoring
git merge claude/trading-coach-app-013FbqyEuRjn48R7ac8ivX1C

# 2. Update version in package.json
# e.g., "version": "1.4.0" with monitoring support

# 3. Tag release
git tag -a v1.4.0-monitoring -m "Add production monitoring dashboard"
git push origin v1.4.0-monitoring

# 4. Deploy to production
# Use your CI/CD pipeline or manual deployment

# 5. Verify in production
# Navigate to monitoring dashboard
# Confirm metrics are accumulating
# Check API endpoint: GET /api/metrics
```

### Post-Deployment Validation

**Immediate (0-1 hour)**:
- [ ] Monitoring dashboard accessible on all tabs
- [ ] Metrics updating every 5 seconds
- [ ] No console errors in browser DevTools
- [ ] API endpoint responding correctly

**24 Hours**:
- [ ] Metrics accumulating without memory issues
- [ ] All 4 panels populating with real data
- [ ] Error tracking functional (test with fake error)
- [ ] Greeks validation tracking working
- [ ] P&L costs recording accurately

**1 Week**:
- [ ] No memory leaks with extended sessions
- [ ] Metrics trends match expected values
- [ ] Fallback provider tracking working correctly
- [ ] No impact on trading latency
- [ ] Dashboard responsive under load

## Production Operations

### Daily Operations

#### Morning Checklist

1. **System Health**
   ```bash
   # Check API health endpoint
   curl https://api.yourdomain.com/health
   # Should return { status: "ok", uptime: ..., timestamp: ... }
   ```

2. **Monitoring Dashboard**
   - Verify Massive uptime ≥99%
   - Verify Tradier available as fallback
   - Check Greeks validation rate ≥95%
   - Confirm WebSocket connected

3. **Error Count**
   - Review any overnight errors
   - Check error breakdown by type
   - Investigate critical errors (gamma=0, delta OOB)

#### Hourly Monitoring

- Monitor Data Provider uptime
- Track response times (should be <300ms)
- Watch error accumulation (should stay <5/hour)
- Monitor WebSocket connectivity
- Check backtest variance staying within bounds

#### End-of-Day Report

```markdown
## Daily Monitoring Report - YYYY-MM-DD

### Availability
- Massive Uptime: XX%
- Tradier Uptime: XX%
- System Errors: XX

### Data Quality
- Greeks Valid Rate: XX%
- IV Anomalies: XX
- Gamma=0 Errors: XX

### Trading Performance
- Total Trades: XX
- Gross P&L: XX.X%
- Net P&L: XX.X%
- Backtest Variance: XX.X%

### Issues Encountered
- [List any issues and resolutions]

### Action Items
- [List follow-up items]
```

### Handling Common Issues

#### Issue: Provider Uptime Drops Below 99%

**Detection**: Data Provider Health panel shows red uptime

**Diagnosis**:
```bash
# Check Massive API status
curl https://api.massive.com/health -H "Authorization: Bearer $TOKEN"

# Check Tradier API status
curl https://api.tradier.com/v1/markets/status -H "Authorization: Bearer $TOKEN"

# Check application logs for API errors
tail -f /var/log/app/error.log | grep "API_ERROR\|MASSIVE\|TRADIER"
```

**Resolution**:
1. If Massive down: System automatically falls back to Tradier ✓
2. If both down: Alert ops team, investigate network connectivity
3. If intermittent: Check for timeout misconfigurations

**Prevention**:
- Monitor provider status pages regularly
- Set uptime alerts <98% for immediate notification
- Keep provider API credentials current

#### Issue: Greeks Validation Rate Drops

**Detection**: Greeks Quality panel shows yellow/red valid rate

**Diagnosis**:
```bash
# Check what validation errors are occurring
# Review browser console for error messages
# Check if Massive API returning complete Greeks data

# Sample API call to inspect
curl "https://api.massive.com/v3/snapshot/options/AAPL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-massive-proxy-token: $PROXY_TOKEN" \
  | jq '.results[0] | {delta, gamma, theta, vega, iv}'
```

**Common Causes**:
1. **Gamma = 0**: Data error from API (immediate data quality issue)
2. **Missing Greeks**: API returning incomplete fields
3. **Out of Bounds**: Unusual IV/delta values from market

**Resolution**:
1. If gamma=0: Contact Massive support, use Tradier as fallback
2. If missing data: API issue, no immediate fix
3. If IV anomalies: Normal during market stress, monitor only

**Prevention**:
- Daily validation testing with known symbols
- Alerts for gamma=0 (set to critical severity)
- Monitor IV ranges against historical norms

#### Issue: High Backtest Variance (>10%)

**Detection**: P&L Accuracy panel shows red backtest variance

**Diagnosis**:
```bash
# Compare expected vs actual P&L
# Review cost assumptions in backtest
# Check: commission, slippage, execution quality

# Sample calculation
entry_price = 5.00
exit_price = 5.50
quantity = 10
commission = 0.65 * 2 = $1.30  # Entry + exit
slippage = entry_price * quantity * 0.005 = $0.25  # 0.5% spread

gross_pnl = (exit_price - entry_price) * quantity = $5.00
net_pnl = gross_pnl - commission - slippage = $3.45
net_pnl% = 3.45 / (entry_price * quantity) = 6.9%

# If backtest showed 8.5%, variance = 1.6% ✓ acceptable
# If backtest showed 12%, variance = 5.1% ✗ investigate
```

**Common Causes**:
1. **Cost Assumptions Wrong**: Backtest underestimated commissions or spreads
2. **Position Size Mismatch**: Using smaller positions in live (fixed costs hurt more)
3. **Liquidity Differences**: Using illiquid strikes increases slippage
4. **Fill Quality**: Not getting fills at expected prices

**Resolution**:
1. Update backtest cost assumptions based on live experience
2. Increase position sizes to reduce % impact of fixed costs
3. Focus on more liquid strikes (higher volume)
4. Verify execution quality with broker

**Prevention**:
- Run backtests with conservative cost assumptions
- Add 10-20% cushion to expected costs
- Start with smaller position sizes to validate assumptions

#### Issue: WebSocket Disconnection

**Detection**: System Health panel shows "✗ Disconnected"

**Diagnosis**:
```bash
# Check browser Network tab
# Look for WebSocket upgrade failures
# Check WebSocket error code (1000=clean, 1006=abnormal)

# Server-side check
netstat -an | grep :8080  # WebSocket port
ps aux | grep "node\|server"  # Check if server running
tail -f /var/log/app/ws.log  # WebSocket logs
```

**Common Causes**:
1. **Network Issue**: Client lost connectivity
2. **Server Issue**: WebSocket server crashed or restarted
3. **Browser Issue**: Developer tools, extensions interfering
4. **Firewall**: Port 8080 blocked or rate limited

**Resolution**:
1. **Client Side**: Refresh page, clear DevTools, disable extensions
2. **Network**: Check connectivity, VPN status
3. **Server**: Restart WebSocket server, check logs
4. **Firewall**: Verify port is open, not rate limited

**Prevention**:
- Monitor WebSocket connection health metrics
- Implement auto-reconnect with exponential backoff
- Alert ops team on >1 minute disconnection

### Memory Management

The MetricsService maintains metrics in-memory. Monitor memory usage:

```bash
# Check browser memory usage
# DevTools → Performance → Memory
# Should stay <50MB for normal operation
# If >100MB: May indicate memory leak

# Server-side memory
free -h  # Check available RAM
ps aux --sort=-%mem | head -5  # Top memory consumers
```

**Memory Optimization**:
1. Limit metrics history to last 1000 entries (not implemented in v1, for future)
2. Clear metrics on daily reset (currently on page refresh only)
3. Monitor for memory leaks in long-running sessions
4. Add metrics export/reset feature if needed

### Performance Optimization

**Dashboard Performance Targets**:
- Update frequency: Every 5 seconds (adjustable)
- Memory usage: <50MB
- CPU usage: <5% while idle, <15% while updating
- Network: ~1KB per update (minimal)

**If Dashboard Slow**:
1. Click "Pause" to freeze updates
2. Close other browser tabs
3. Check browser extensions (may intercept metrics calls)
4. Verify no heavy JavaScript running (check DevTools)

### Monitoring Integration

#### Export Metrics to External Systems

**Option 1: Prometheus Export**
```typescript
// Add to MonitoringDashboard.tsx
function exportPrometheusMetrics() {
  const metrics = getMetricsService().getDashboardMetrics();

  return `
# HELP trading_provider_uptime Data provider uptime percentage
# TYPE trading_provider_uptime gauge
trading_provider_uptime{provider="massive"} ${metrics.providers.massive.uptime}
trading_provider_uptime{provider="tradier"} ${metrics.providers.tradier.uptime}

# HELP trading_greeks_valid_rate Valid Greeks percentage
# TYPE trading_greeks_valid_rate gauge
trading_greeks_valid_rate ${(metrics.greeksQuality.validGreeks / metrics.greeksQuality.totalTrades) * 100}

# HELP trading_pnl_net_percent Net P&L percentage
# TYPE trading_pnl_net_percent gauge
trading_pnl_net_percent ${metrics.pnl.avgNetPnL}

# HELP trading_system_errors_total Total system errors
# TYPE trading_system_errors_total counter
trading_system_errors_total ${metrics.systemHealth.errorCount}
  `.trim();
}
```

**Option 2: Send to Time-Series DB**
```typescript
// Periodically send metrics to backend
setInterval(async () => {
  const metrics = getMetricsService().getDashboardMetrics();
  await fetch('/api/metrics/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics)
  });
}, 60000); // Every minute
```

### Alerting Rules

Set up alerts for these thresholds:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Provider Uptime | <99% | <95% | Check provider status, verify fallback |
| Greeks Valid Rate | <90% | <75% | Investigate data quality, contact provider |
| Error Count | >20/hour | >50/hour | Review error types, restart if needed |
| API Response Time | >500ms | >2000ms | Check network, contact provider |
| WebSocket Latency | >500ms | >2000ms | Check network, restart connection |
| Backtest Variance | >5% | >15% | Update cost assumptions, investigate fills |
| Memory Usage | >50MB | >100MB | Check for leaks, restart browser |

### Runbook Examples

#### Runbook: Massive API Downtime

```markdown
## Massive API Downtime Response

**Severity**: Medium (Tradier fallback available)
**Detection**: Monitoring Dashboard shows Massive uptime 0%

### Immediate Actions (0-5 min)
1. ✓ Confirm on Monitoring Dashboard
2. Check https://status.massive.com
3. Verify Tradier uptime is 100%
4. Notify trading team (in Slack channel #trading-alerts)

### Diagnosis (5-15 min)
5. SSH to production server
6. Test Massive API directly:
   ```bash
   curl https://api.massive.com/health
   ```
7. Check network connectivity from server:
   ```bash
   traceroute api.massive.com
   ping api.massive.com
   ```
8. Review application logs:
   ```bash
   tail -f /var/log/app/error.log | grep MASSIVE
   ```

### Resolution (15-60 min)
9. If Massive responsive but app not connecting:
   - Check API key validity
   - Verify IP whitelist
   - Check firewall rules

10. If Massive truly down:
    - Switch UI to show Tradier-only mode (optional UI change)
    - Update status page
    - Monitor for recovery

### Recovery Validation
11. Confirm Massive uptime returns to 100%
12. Verify Greeks data quality returns to >95%
13. Check all panels back to green
14. Document resolution in incident log

### Post-Incident
15. Update runbook with new learnings
16. Schedule provider reliability discussion
17. Consider multi-provider strategy improvements
```

#### Runbook: High Backtest Variance Detected

```markdown
## High Backtest Variance Investigation

**Issue**: P&L Accuracy panel shows >10% variance
**Root Cause Investigation Flowchart**

### Step 1: Gather Data
1. Record current metrics from dashboard
2. Review recent trades (last 10)
3. Check cost breakdown
4. Compare to backtest assumptions

### Step 2: Analyze Costs
```
Expected Cost | Actual Cost | Difference
Commission   | $X.XX      | ?
Slippage     | $X.XX      | ?
Total        | $X.XX      | ?
```

### Step 3: Investigate by Category

**If Commission Higher Than Expected**
- [ ] Check broker fees invoice
- [ ] Verify position size matches backtest
- [ ] Confirm no new fees added

**If Slippage Higher Than Expected**
- [ ] Review bid-ask spreads on trades
- [ ] Check strike selection (more/less liquid)
- [ ] Compare to market maker conditions

**If Execution Quality Poor**
- [ ] Check order fill prices vs market prices
- [ ] Review order entry time vs execution time
- [ ] Confirm order type matches backtest

### Step 4: Remediation
- Update backtest model with actual costs
- Adjust position sizing if needed
- Add safety margin to cost assumptions
- Revalidate with new assumptions

### Success Criteria
- Backtest variance reduces to <5%
- Trader confidence in model restored
- Updated assumptions documented
```

## Monitoring System Health Metrics

Track these meta-metrics about the monitoring system itself:

```
Monitoring System Health Checklist:
- [ ] MetricsService initializes correctly
- [ ] All 4 dashboard panels render
- [ ] Metrics update every 5 seconds
- [ ] No infinite loops or memory leaks
- [ ] Error handling prevents crashes
- [ ] Graceful degradation if API fails
- [ ] Pause/Resume button works
- [ ] Real-time updates stop when paused
```

## Escalation Path

**Monitoring System Issues**:
1. Junior Trader: Monitor dashboard, report issues
2. Trading Manager: Investigate metrics discrepancies
3. Tech Lead: Debug integration issues
4. DevOps: Handle deployment/infrastructure issues

**Critical Issues** (escalate immediately):
- Data provider completely unavailable
- Greeks validation >50% failures
- Backtest variance >20%
- WebSocket disconnection lasting >10 minutes
- Memory usage >100MB

## Maintenance Schedule

- **Daily**: Review morning metrics, check error count
- **Weekly**: Generate monitoring report, review trends
- **Monthly**: Update cost assumptions if variance detected
- **Quarterly**: Review monitoring accuracy, collect feedback
- **Annually**: Plan monitoring enhancements for next release

## Success Metrics

After 1 week of production monitoring:
- [ ] Provider uptime ≥99% on both sources
- [ ] Greeks validation ≥95% on all trades
- [ ] Backtest variance <5% average
- [ ] <10 critical errors per week
- [ ] No trader-reported missed data
- [ ] Dashboard responsive to all users
- [ ] Metrics trends match expectations

## Support & Escalation

**Questions about monitoring**:
- Check MONITORING.md for usage guide
- Check src/services/monitoring.ts for implementation details
- Review test files for expected behavior

**Issues found**:
- Create GitHub issue with monitoring dashboard screenshot
- Include error message from browser console
- Note which metrics panel shows the problem
- Provide reproduction steps

**Feature Requests**:
- Add to sprint planning for next release
- Discuss implementation approach with team
- Examples: Export metrics, persistence, alerts integration
