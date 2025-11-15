# Honey Drip Admin Trading Dashboard

A production-ready options trading platform with real-time market data, Discord alerts, and comprehensive trade management.

## Features

- **Real-time Market Data**: Live quotes and options chains via Massive.com integration with streaming WebSocket feeds
- **Trade Management**: Full lifecycle from watchlist → load → enter → manage → exit
- **Discord Integration**: Automated alerts for all trade actions
- **Challenge Tracking**: Group trades into challenges and track performance
- **Trade History**: Comprehensive review and analysis of past trades
- **Risk Engine**: DTE-aware TP/SL calculations with ATR and technical levels
- **OPTIONS ADVANCED**: Trade flow indicators, liquidity analysis, and confluence signals
- **Voice Commands**: Hands-free trade management (coming soon)
- **Mobile & Desktop**: Responsive design optimized for both platforms

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS v4 + Radix UI + Recharts + Lightweight Charts
- **Auth & Database**: Supabase (PostgreSQL + Row Level Security)
- **Market Data**: Massive.com OPTIONS ADVANCED + INDICES ADVANCED (REST + WebSocket)
- **Alerts**: Discord Webhooks
- **Testing**: Vitest + React Testing Library

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Massive.com API key with OPTIONS ADVANCED subscription
- Discord webhook URLs (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Create `.env` file (copy from `.env.example`):
   \`\`\`env
   # Client-side (exposed to browser)
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   
   # Server-side ONLY (not exposed to browser)
   MASSIVE_API_KEY=your-massive-api-key
   \`\`\`

4. Run the SQL scripts in Supabase:
   - Execute `scripts/001_create_schema.sql` in Supabase SQL editor

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Architecture

### Security Model

The application uses a secure proxy architecture:

- **Client Side**: No API keys exposed in browser bundles
- **Server Side**: API routes proxy all Massive.com requests
  - `/api/massive/[...path]` - REST API proxy with server-side authentication
  - `/api/massive/ws-token` - Generates ephemeral tokens for WebSocket (5-min expiry)

### Data Flow

1. **Streaming-First**: WebSocket connections for real-time quotes, trades, and aggregates
2. **REST Fallback**: Automatic 3-second polling when WebSocket disconnects
3. **Stale Detection**: Visual indicators when data is >5s old (WebSocket) or >6s old (REST)
4. **Lifecycle Management**: Proper cleanup on unmount/tab switch/route change

### Database Schema

The platform uses Supabase with Row Level Security enabled on all tables:

- `profiles`: User profiles linked to auth.users
- `discord_channels`: User Discord webhook configurations
- `challenges`: Trading challenges for grouping trades
- `watchlist`: User watchlists
- `trades`: Trade records with full lifecycle tracking
- `trade_updates`: Trade update history (entries, exits, trims, etc.)

All tables are protected with RLS policies ensuring users can only access their own data.

## Usage

### Watchlist
- Add tickers to your watchlist
- View live streaming quotes with real-time price movements
- Confluence chips show technical signals and trade flow
- Click a ticker to view options chain

### Loading Trades
- Select a contract from the options chain (filtered by liquidity)
- Risk engine auto-calculates TP/SL based on DTE and ATR
- Load the idea with Discord alert (optional)

### Entering Trades
- Click "Enter Trade" on a loaded idea
- Confirm entry price and parameters
- Send entry alert to Discord channels
- Real-time PnL tracking begins

### Managing Trades
- Trim positions with automatic Discord notifications
- Update stop loss with trailing stops
- Add to positions
- Exit with P/L tracking and performance analytics

### Trade History
- Review all past trades with filters
- Analyze performance metrics
- Re-share alerts to Discord
- Export data for tax reporting

## Testing

### Run Tests
\`\`\`bash
npm test                 # Run all tests
npm run test:ui         # Run tests with UI
npm run test:coverage   # Generate coverage report
\`\`\`

### Test Coverage

- Unit tests for risk calculations
- Integration tests for StreamingManager
- Component tests for key UI elements
- End-to-end tests for trade lifecycle (coming soon)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

1. Push code to GitHub
2. Import to Vercel
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `MASSIVE_API_KEY` (server-side only, no VITE_ prefix)
4. Deploy

## Environment Variables

| Variable | Description | Required | Exposed to Client |
|----------|-------------|----------|-------------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes | Yes |
| `MASSIVE_API_KEY` | Massive.com API key | Yes | **No** (server-only) |

**Security Note**: The `MASSIVE_API_KEY` must NOT have the `VITE_` prefix. It's only used in server-side API routes and never exposed to the browser.

## Development

### Project Structure

\`\`\`
honey-drip-admin/
├── app/                          # Next.js API routes (server-side)
│   ├── api/massive/[...path]/    # REST API proxy
│   └── api/massive/ws-token/     # WebSocket token generator
├── src/
│   ├── components/               # React components
│   │   ├── hd/                   # Core trading UI components
│   │   └── ui/                   # Reusable UI components
│   ├── hooks/                    # Custom React hooks
│   ├── lib/
│   │   ├── massive/              # Massive.com integration
│   │   │   ├── streaming-manager.ts
│   │   │   ├── options-advanced.ts
│   │   │   └── websocket.ts
│   │   ├── riskEngine/           # TP/SL calculations
│   │   └── supabase/             # Database & auth
│   ├── types/                    # TypeScript definitions
│   └── utils/                    # Helper functions
├── scripts/                      # Database migrations
└── tests/                        # Test files
\`\`\`

### Key Concepts

#### StreamingManager

Centralized manager for all real-time data subscriptions:

\`\`\`typescript
import { streamingManager } from '@/lib/massive/streaming-manager';

const handle = streamingManager.subscribe(
  'AAPL',
  ['quotes', 'agg1s'],
  (data) => {
    console.log('Live quote:', data);
  }
);

// Cleanup
handle.unsubscribe();
\`\`\`

#### Risk Engine

DTE-aware TP/SL calculations:

\`\`\`typescript
import { useRiskEngine } from '@/hooks/useRiskEngine';

const { calculation, loading } = useRiskEngine({
  ticker: 'AAPL',
  optionTicker: 'O:AAPL251220C00175000',
  mode: 'calculated',
});

// calculation.tp1, calculation.sl, calculation.levels
\`\`\`

#### OPTIONS ADVANCED

Trade flow and liquidity analysis:

\`\`\`typescript
import { useOptionTrades, useLiquidity } from '@/hooks/useOptionsAdvanced';

const { trades, sentiment } = useOptionTrades('O:SPY251220C00550000');
const { quality, warnings } = useLiquidity(contract);
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT

## Support

For issues and questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
2. Review browser console for client-side errors
3. Check server logs for API proxy errors
4. Open an issue on GitHub

## Roadmap

- [ ] Voice command integration
- [ ] Mobile app (React Native)
- [ ] Multi-leg options strategies
- [ ] Portfolio-level risk management
- [ ] Machine learning trade signals
- [ ] Social trading features
- [ ] Advanced charting tools
- [ ] Backtesting engine
