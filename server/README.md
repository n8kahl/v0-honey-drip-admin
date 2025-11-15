# HoneyDrip Admin Server

Express backend for secure API proxying.

## Architecture

- **Vite SPA**: Built frontend served from `/build`
- **Express API**: Secure proxy for Massive.com and Discord
- **Environment**: Node 18+, ready for Railway deployment

## Environment Variables

Required:
- `MASSIVE_API_KEY` - Your Massive.com API key
- `PORT` - Server port (default: 3000)

Optional:
- `MASSIVE_BASE_URL` - Massive API base URL (default: https://api.massive.com)
- `SUPABASE_URL` - For Discord webhook storage
- `SUPABASE_SERVICE_ROLE_KEY` - For Discord webhook storage

## Development

\`\`\`bash
# Install dependencies
npm install

# Run dev server (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## API Endpoints

### Health
- `GET /api/health` - Server health check

### Massive.com Proxy
- `GET /api/massive/options/chain?symbol=TSLA` - Get options chain
- `GET /api/massive/options/quote?underlying=TSLA` - Get option quote
- `GET /api/massive/options/aggregates?symbol=...&interval=1m&from=...` - Get aggregates
- `GET /api/massive/options/indicators?symbol=...&indicator=rsi&timeframes=1h,1d` - Get indicators
- `GET /api/massive/market-status` - Get market status
- `GET /api/massive/quotes?symbols=TSLA,AAPL` - Get multiple quotes
- `GET /api/massive/indices?tickers=SPX,VIX` - Get indices snapshot

### Discord Proxy
- `POST /api/discord/send` - Send Discord alert
  \`\`\`json
  {
    "channelIds": ["channel-1", "channel-2"],
    "message": "Trade alert content",
    "embeds": [...],
    "webhookUrls": ["https://discord.com/api/webhooks/..."]
  }
  \`\`\`

## Railway Deployment

1. Connect your GitHub repo
2. Set environment variables in Railway dashboard
3. Railway will auto-detect and run:
   - Build: `npm run build`
   - Start: `npm start`

## Security

- API keys never exposed to client
- All Massive.com calls proxied through server
- Discord webhooks validated server-side
- CORS configured for frontend origin
