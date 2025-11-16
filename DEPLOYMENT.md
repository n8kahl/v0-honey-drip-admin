# Deployment Guide

## Overview

HoneyDrip Admin is a Vite SPA with an Express backend for secure API proxying. It can be deployed to Railway, Heroku, or any Node.js hosting platform.

## Architecture

- **Frontend**: Vite SPA (React + TypeScript)
- **Backend**: Express server with API proxies
- **Database**: Supabase (PostgreSQL + Auth)
- **Market Data**: Massive.com API (proxied through backend)
- **Alerts**: Discord webhooks (proxied through backend)

---

## Deploying to Railway

Railway is the recommended hosting platform for this app.

### Step 1: Prepare Repository

1. Push your code to GitHub
2. Ensure `.env` (or any secrets file) is in `.gitignore`
3. Verify `package.json` uses the current build/start scripts:
   ```json
   {
     "scripts": {
       "build": "vite build && tsc -p tsconfig.server.json",
       "start": "node server/dist/index.js"
     }
   }
   ```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### Step 3: Configure Environment Variables

In Railway dashboard, add these environment variables:

**Required:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
MASSIVE_API_KEY=your_massive_api_key
MASSIVE_PROXY_TOKEN=<secure-proxy-token>
VITE_MASSIVE_PROXY_TOKEN=<matching-mirror-token>
NODE_ENV=production
PORT=8080
```

**Optional:**
```
DISCORD_WEBHOOK_SECRET=your_optional_secret
VITE_MASSIVE_WS_URL=wss://socket.massive.com
```

### Step 4: Deploy

1. Railway will automatically detect Node.js and run:
   - `pnpm install --frozen-lockfile`
   - `pnpm run build`
   - `pnpm run start`
2. Your app will be live at `your-app.railway.app`

### Step 5: Configure Custom Domain (Optional)

1. Go to Settings > Domains in Railway
2. Click "Add Custom Domain"
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs:
   - Go to Supabase Dashboard > Authentication > URL Configuration
   - Add `https://yourdomain.com` to "Site URL"
   - Add `https://yourdomain.com/**` to "Redirect URLs"

---

## Alternative: Deploying to Heroku

### Step 1: Install Heroku CLI

\`\`\`bash
npm install -g heroku
heroku login
\`\`\`

### Step 2: Create Heroku App

\`\`\`bash
heroku create your-app-name
\`\`\`

### Step 3: Set Environment Variables

\`\`\`bash
heroku config:set VITE_SUPABASE_URL=your_url
heroku config:set VITE_SUPABASE_ANON_KEY=your_key
heroku config:set MASSIVE_API_KEY=your_key
heroku config:set NODE_ENV=production
\`\`\`

### Step 4: Deploy

\`\`\`bash
git push heroku main
\`\`\`

---

## Post-Deployment Steps

### 1. Run Database Migrations

After first deployment:

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `scripts/001_create_tables.sql`
4. Paste and run the script

This creates all necessary tables with proper RLS policies.

### 2. Test the Deployment

1. Visit your deployment URL
2. Sign up for a new account
3. Check your email for verification
4. Verify your account and sign in
5. Test adding a ticker to the watchlist
6. Test creating a challenge
7. Test Discord alerts (if configured)

### 3. Monitor Health

Visit `https://your-app.railway.app/api/health` to check backend status:

\`\`\`json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "massive": true,
    "discord": true
  }
}
\`\`\`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon key |
| `MASSIVE_API_KEY` | Yes | Massive.com API key (server-only) |
| `MASSIVE_PROXY_TOKEN` | Yes | Secret required by `/api/massive/*` and WebSocket proxies |
| `VITE_MASSIVE_PROXY_TOKEN` | Yes | Client mirror of the proxy token (sent as `x-massive-proxy-token`) |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes (Railway) | Server port (default: 3000 for dev, 8080 for production) |
| `DISCORD_WEBHOOK_SECRET` | No | Optional secret for Discord webhook validation |
| `VITE_MASSIVE_WS_URL` | No | Override WebSocket URL |

---

## Security Considerations

1. **API Keys**: Never commit `.env` file to version control
2. **CORS**: Backend configured for same-origin requests only
3. **Rate Limiting**: Discord webhook proxy respects Discord's rate limits
4. **Input Validation**: All API requests are validated
5. **RLS Policies**: Supabase Row Level Security enabled

---

## Monitoring

### Application Logs

**Railway:**
- View in Railway Dashboard > Deployments > Logs

**Heroku:**
\`\`\`bash
heroku logs --tail
\`\`\`

### Database Monitoring

- View in Supabase Dashboard > Database > Query Performance

### API Health Check

Monitor `/api/health` endpoint for:
- Server uptime
- Massive.com API connectivity
- Discord webhook availability

---

## Troubleshooting

### Build Fails

**Issue**: TypeScript compilation errors

**Solution**:
\`\`\`bash
npm run build
# Fix any TypeScript errors shown
\`\`\`

### Backend Not Starting

**Issue**: Port already in use

**Solution**: Set `PORT` environment variable to a different port

### No Market Data

**Issue**: Massive.com API not responding

**Solution**:
1. Verify `MASSIVE_API_KEY` is set correctly
2. Check `/api/health` endpoint
3. View server logs for API errors

### Discord Webhooks Failing

**Issue**: 429 Too Many Requests

**Solution**: Backend automatically handles rate limiting. Wait 60 seconds and retry.

### CORS Errors

**Issue**: Frontend can't reach backend

**Solution**: Ensure frontend is served from same domain as backend

---

## Scaling Considerations

### Database
- Supabase automatically handles connection pooling
- Consider upgrading Supabase plan for high traffic

### Market Data
- Massive.com has rate limits based on your plan
- WebSocket connections are persistent per client
- Backend caches responses when possible

### Discord Webhooks
- Discord limits: 30 requests per minute per webhook
- Backend queues and batches requests automatically

---

## Backup and Recovery

### Database Backups
- Supabase automatically backs up daily
- Download backups from Supabase Dashboard > Database > Backups

### Configuration Backup
- Export challenges from Settings
- Store environment variables securely (use password manager)

---

## Production Checklist

- [ ] Code pushed to GitHub
- [ ] Railway/Heroku project created
- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] Supabase email confirmation configured
- [ ] Custom domain configured (if applicable)
- [ ] Health check endpoint verified
- [ ] Sign up flow tested end-to-end
- [ ] Trade lifecycle tested
- [ ] Discord alerts tested
- [ ] Mobile responsiveness verified
- [ ] Browser compatibility tested

---

## Support

For issues:
1. Check server logs first
2. Verify environment variables
3. Test `/api/health` endpoint
4. Review Supabase logs for database errors
