# Educational Use Notice

This application is configured to connect to live market data APIs for **educational purposes only**.

## Production Security

This application uses a **server-side API proxy** to securely connect to Massive.com:

✅ API keys are stored **server-side only** (never exposed to client)
✅ All market data requests go through `/api/massive/*` proxy endpoints
✅ WebSocket authentication uses **ephemeral tokens** (5-minute expiry)
✅ Client-side code has **no direct API key access**

## For Production Deployment:

Set the following server-side environment variable:
- `MASSIVE_API_KEY` - Your Massive.com API key (stored securely on server)

## NOT Suitable For:

❌ Real money trading (this is read-only market data only)
❌ Order execution (no trading capabilities)
❌ Financial advice or recommendations

## Disclaimer:

This software is provided for educational purposes. Users are responsible for:
- Complying with all API terms of service
- Following financial regulations in their jurisdiction
- Understanding that this is market data only, not trading software

Always consult with security and legal professionals before deploying any financial application to production.
