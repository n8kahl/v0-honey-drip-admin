# Honey Drip Admin Setup Guide

## Step 1: Create Supabase Database Tables

Your Supabase is connected, but you need to create the database tables. Here's how:

### Option A: Run from v0 (Recommended)
The SQL script is ready at `scripts/001_create_tables.sql`. v0 can execute it for you automatically.

### Option B: Manual Setup
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `scripts/001_create_tables.sql`
4. Paste and run the SQL script
5. Verify tables are created in **Table Editor**

The script will create:
- `discord_channels` - Store Discord webhook URLs
- `challenges` - Trading challenges
- `watchlist` - Stock watchlist
- `trades` - Trade records
- `trade_updates` - Trade history/updates

All tables include Row Level Security (RLS) policies to protect your data.

## Step 2: Market Data

### Current Setup: Mock Data (Recommended for Development)
The app currently uses **realistic mock data** that:
- Updates in real-time (every 2 seconds)
- Simulates realistic price movements
- Includes accurate options chains with Greeks
- Perfect for testing and development
- **No API key needed**

### For Live Market Data (Production)
To use live Massive.com data, you need to implement a **server-side API proxy** to keep your API key secure:

1. **Create API route** (if using Next.js):
   \`\`\`typescript
   // app/api/massive/quotes/route.ts
   export async function POST(request: Request) {
     const { symbols } = await request.json();
     const response = await fetch(`https://api.massive.com/v1/quotes?symbols=${symbols.join(',')}`, {
       headers: {
         'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}` // Server-side only
       }
     });
     return Response.json(await response.json());
   }
   \`\`\`

2. **Update client code** to call your API route instead of Massive directly

3. **Add API key** to your server environment variables (not NEXT_PUBLIC_*)

**Security Note**: Never expose API keys to the client. Always use server-side proxies for sensitive data.

## Step 3: Add Discord Webhooks (Optional)

To send trade alerts to Discord:

1. **In Discord**:
   - Go to your Discord server
   - Right-click a channel → **Edit Channel**
   - Go to **Integrations** → **Webhooks**
   - Click **New Webhook** or **Copy Webhook URL**

2. **In the App**:
   - Go to **Settings** tab
   - Add your Discord channels with webhook URLs
   - Select channels when loading/entering trades

## Verification

After setup, verify everything works:

1. **Database**: Try adding a ticker to your watchlist
2. **Mock Data**: Watch stock prices update every 2 seconds
3. **Discord**: Send a test alert from Settings

## Troubleshooting

### "Could not find table" errors
- Run the SQL script in Supabase (Step 1)
- Refresh the page after running the script

### Want real-time live data?
- Mock data is sufficient for most use cases
- For production, implement server-side API proxy (see Step 2)
- Never expose API keys to the client

### Discord alerts not sending
- Verify webhook URL is correct
- Check Discord channel permissions
- Test the webhook with a curl command

## Environment Variables Summary

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ (Auto-configured) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | ✅ (Auto-configured) |
| `MASSIVE_API_KEY` | Live market data (server-side) | ⚠️ Optional (uses mock if not set) |

**Note**: The `MASSIVE_API_KEY` should be a server-only environment variable, NOT `NEXT_PUBLIC_*`.

## Next Steps

1. Run the SQL script to create database tables
2. Configure Discord webhooks in Settings
3. Start trading with realistic mock data!
4. (Optional) Implement server-side API proxy for live data
