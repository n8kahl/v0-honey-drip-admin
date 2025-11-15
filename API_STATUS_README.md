# Massive.com API Integration Status

## Current Configuration

This application uses a **secure server-side proxy** to connect to Massive.com's options market data API.

### Architecture:
- **Client → Server Proxy → Massive.com**
- API key stored server-side only
- Ephemeral WebSocket tokens (5-minute TTL)

### API Endpoints (Proxied):
- **REST API**: `/api/massive/*` → `https://api.massive.com/*`
- **WebSocket**: Ephemeral token endpoint → `wss://socket.massive.com/options`

### Authentication:
- Server-side: Uses `MASSIVE_API_KEY` environment variable
- Client-side: No API key exposure

## Connection Status Indicator

The header displays real-time connection status:

- **🟢 LIVE DATA** - Successfully connected to Massive.com and receiving real-time market data
- **🔴 DISCONNECTED** - Connection failed (check server logs or API availability)

## How to Configure

1. Sign up for a Massive.com API account at https://massive.com
2. Obtain your API key from the dashboard
3. Add it to your **server-side** environment variables:
   - Variable name: `MASSIVE_API_KEY` (not `NEXT_PUBLIC_*`)
   - This keeps the key secure on the server
4. Restart the server

## Troubleshooting

### Connection Fails Despite Valid API Key

Possible causes:
1. **Server not running** - Ensure the proxy server is running
2. **Missing environment variable** - Check `MASSIVE_API_KEY` is set on server
3. **Invalid credentials** - Verify your API key is active and has proper permissions
4. **API subscription** - Ensure your Massive.com account has an active subscription

Check server logs for detailed error messages.

## Security

✅ **Production-ready security:**
- API key never exposed to client-side code
- Ephemeral WebSocket tokens prevent key leakage
- Server proxy provides centralized authentication
- Client bundle contains no sensitive credentials

## Support

For Massive.com API issues:
- Documentation: https://massive.com/docs
- Support: https://massive.com/contact
