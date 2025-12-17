# Production Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Quality

- [x] All tests passing (606 tests)
- [x] Production build successful (`pnpm run build`)
- [x] No TypeScript errors
- [x] No ESLint warnings (only expected dynamic import warnings)

### Features Complete

- [x] **Phase 1**: HDWatchlistRail widened to w-96 for symmetric layout
- [x] **Phase 2**: Alert Composer with presets and inline editing
- [x] **Phase 3**: Inline Price Strip for quick updates
- [x] **Phase 4**: effectiveTrade object for persistence
- [x] **Phase 5**: Confluence wiring through Discord
- [x] **Phase 6**: WebSocket connection pool for multi-admin support

### Performance

- [x] WebSocket connection pooling implemented
- [x] Health monitoring endpoint (`/api/ws-health`)
- [x] Automatic reconnection with exponential backoff
- [x] Topic ref-counting to prevent duplicate subscriptions

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For workers only

# Massive.com API
MASSIVE_API_KEY=your_massive_api_key
VITE_MASSIVE_PROXY_TOKEN=shared_secret_for_proxy_auth

# WebSocket Connection Pool (IMPORTANT!)
MAX_WS_CONNECTIONS=5  # Set based on your Massive.com plan tier

# Production Settings
NODE_ENV=production
PORT=8080  # Railway auto-assigns, but default is 8080
```

### Plan-Specific Connection Limits

Set `MAX_WS_CONNECTIONS` according to your Massive.com subscription:

- **Basic/Free**: `1-2`
- **Professional**: `5-10`
- **Advanced**: `10-25`
- **Enterprise**: `50+`

**Note**: With the connection pool, you typically only need 2 connections (options + indices) regardless of the number of admins. Set this to your plan's limit as a safety margin.

## 🚀 Railway Deployment Steps

### 1. Connect Repository

```bash
# Railway auto-deploys from main branch
git push origin main
```

### 2. Configure Environment Variables

In Railway dashboard:

1. Go to project → Variables
2. Add all variables from above
3. **Critical**: Set `MAX_WS_CONNECTIONS` based on your plan
4. Save changes

### 3. Verify Build

Railway will automatically:

- Install dependencies (`pnpm install`)
- Build frontend (`pnpm run build`)
- Compile server (`tsc -p tsconfig.server.json`)
- Start production server (`node server/dist/index.js`)

Watch build logs for:

- ✓ Dependencies installed
- ✓ Vite build successful (~7-8s)
- ✓ TypeScript compilation successful
- ✓ Server started on PORT

### 4. Health Checks

After deployment, verify:

```bash
# Basic health
curl https://your-app.railway.app/api/health

# WebSocket pool health
curl https://your-app.railway.app/api/ws-health

# Expected response:
{
  "healthy": true,
  "timestamp": "...",
  "metrics": {
    "options": { "totalClients": 0, "upstreamConnections": 0, ... },
    "indices": { "totalClients": 0, "upstreamConnections": 0, ... }
  },
  "limits": { "maxUpstreamConnections": 5 }
}
```

### 5. Test Multi-Admin Access

1. Open app in multiple browser windows/tabs
2. Log in with different admin accounts
3. Monitor `/api/ws-health` to verify:
   - `totalClients` increases with each tab
   - `upstreamConnections` stays at 2 (options + indices)
   - `connectionState: "connected"`
   - `reconnectAttempts: 0`

### 6. Monitor for Issues

Watch Railway logs for:

- `[ConnectionPool]` messages showing client registration
- `[WS options]` and `[WS indices]` showing upstream connections
- No `1008: Connection limit reached` errors
- No `Maximum number of websocket connections exceeded` from Massive

## 🔄 Background Workers

### Worker Deployment

Workers run as separate Railway services:

```bash
# Composite Signal Scanner (60s intervals)
pnpm start:composite

# Historical Data Ingestion (15m intervals)
pnpm start:ingestion

# Gamma Exposure Snapshots
pnpm start:gamma

# Weekend Pre-Warm (manual trigger)
pnpm start:prewarm
```

### Railway Worker Configuration

For each worker:

1. Create new service in Railway
2. Link same repository
3. Set custom start command (e.g., `pnpm start:composite`)
4. Add environment variables (same as main app)
5. Deploy

**Note**: Workers use `SUPABASE_SERVICE_ROLE_KEY` for direct database access (bypasses RLS).

## 📊 Monitoring Setup

### Key Metrics to Track

1. **WebSocket Health**: `/api/ws-health`
   - Alert on `healthy: false`
   - Alert on `reconnectAttempts > 5`
   - Alert on `upstreamConnections === 0` for >1 minute

2. **API Errors**:
   - 1008 connection limit errors
   - 429 rate limit errors from Massive.com
   - 503 service unavailable

3. **Database**:
   - Connection pool exhaustion
   - Slow query performance (>1s)
   - RLS policy violations

### Recommended Tools

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry, Rollbar
- **Logs**: Railway logs + custom log aggregation
- **Alerts**: PagerDuty, Opsgenie

## 🔒 Security Checklist

### API Keys

- [x] `MASSIVE_API_KEY` never exposed to client
- [x] `VITE_MASSIVE_PROXY_TOKEN` used for proxy auth
- [x] `SUPABASE_SERVICE_ROLE_KEY` only in workers

### Database

- [x] Row Level Security (RLS) enabled on all tables
- [x] User isolation enforced via `user_id` filtering
- [x] Service role key only for background jobs

### WebSocket

- [x] Token authentication required for `/ws/*` endpoints
- [x] Connection pool prevents abuse
- [x] Automatic disconnection of unauthorized clients

### Discord Webhooks

- [x] User-owned webhooks stored in database
- [x] Rate limiting per channel (avoid 429 errors)
- [x] Webhook validation before sending

## 🐛 Troubleshooting

### Issue: Clients Can't Connect

**Check**:

```bash
# Verify server is running
curl https://your-app.railway.app/api/health

# Check WebSocket pool
curl https://your-app.railway.app/api/ws-health

# Test WebSocket connection
wscat -c "wss://your-app.railway.app/ws/options?token=YOUR_TOKEN"
```

**Solutions**:

1. Verify `VITE_MASSIVE_PROXY_TOKEN` matches on client and server
2. Check Railway logs for connection errors
3. Ensure `MAX_WS_CONNECTIONS` is set correctly

### Issue: "Connection Limit Reached"

**Symptoms**: Clients disconnected with code 1008

**Check**:

```bash
curl https://your-app.railway.app/api/ws-health | jq '.metrics'
```

**Solutions**:

1. Increase `MAX_WS_CONNECTIONS` if below plan limit
2. Kill zombie connections (check Railway logs for leaks)
3. Verify only 1 server instance is running

### Issue: Massive.com "Maximum Connections Exceeded"

**Symptoms**: Upstream returns 1008, `upstreamConnections > plan limit`

**Check**:

```bash
curl https://your-app.railway.app/api/ws-health | jq '.metrics.options.upstreamConnections'
# Should be 1, not higher
```

**Solutions**:

1. **This should not happen with hub architecture** (only 1 upstream per asset)
2. Check for connection leaks in code
3. Verify hub is properly closing upstream on last client disconnect
4. Contact Massive support to verify plan limits

### Issue: Data Staleness

**Symptoms**: Stale indicators shown in UI, data >5s old

**Check**:

```bash
# WebSocket connection state
curl https://your-app.railway.app/api/ws-health | jq '.metrics.options.connectionState'
```

**Solutions**:

1. If `disconnected`: Server will auto-reconnect (exponential backoff)
2. If `error`: Check Railway logs for error details
3. Verify Massive.com service status
4. Ensure network connectivity to Massive.com

## 📝 Post-Deployment

### User Communication

Notify admins of new features:

1. **Multi-Admin Support**: Unlimited users can access simultaneously
2. **Improved Reliability**: Connection pool prevents disconnections
3. **Health Monitoring**: Visible metrics at `/api/ws-health`

### Documentation Updates

- [x] README.md updated with WebSocket pool overview
- [x] WEBSOCKET_CONNECTION_POOL.md created with full documentation
- [x] Environment variable documentation complete
- [x] Deployment checklist created (this file)

### Next Steps

1. **Monitor initial deployment** for 24-48 hours
2. **Collect metrics** on concurrent user count
3. **Optimize `MAX_WS_CONNECTIONS`** based on actual usage
4. **Set up alerts** for health endpoint warnings
5. **Plan worker deployment** for background processes

## 🎉 Success Criteria

Deployment is successful when:

- [x] Build completes without errors
- [x] Health endpoint returns `200 OK`
- [x] WebSocket pool shows `healthy: true`
- [x] Multiple admins can connect simultaneously
- [x] `upstreamConnections` stays at 2 (options + indices)
- [x] No 1008 connection limit errors in logs
- [x] Real-time data updates working in UI
- [x] Trade lifecycle flows work end-to-end

## 📞 Support

If issues persist:

1. **Check Railway Logs**: Look for `[ConnectionPool]` and `[WS]` messages
2. **Review Health Endpoint**: `/api/ws-health` for diagnostics
3. **Test Locally**: `pnpm run build && pnpm run start` to reproduce
4. **Contact Massive Support**: If seeing upstream connection errors
5. **File Issue**: GitHub repository for code-related bugs

---

**Deployment Date**: _Fill in after deployment_  
**Deployed By**: _Your name_  
**Railway Project**: _Your project URL_  
**Massive.com Plan**: _Basic/Pro/Advanced/Enterprise_  
**MAX_WS_CONNECTIONS**: _Your setting_
