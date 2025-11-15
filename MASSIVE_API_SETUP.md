# Massive.com API Security Configuration

## Current Issue

The Massive.com API key cannot be safely used directly in the client-side code because:
1. Anyone viewing the client code can steal your API key
2. Your API key would be exposed in browser dev tools
3. This creates billing and security risks

## Solution: Server-Side Proxy

To use live market data securely, you need to create a backend API proxy that:

### 1. Backend Setup (Node.js/Express Example)

\`\`\`javascript
// server/api/massive-proxy.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY; // Stored on server only
const MASSIVE_BASE_URL = 'https://api.massive.com/v1';

// Proxy quotes endpoint
router.get('/quotes', async (req, res) => {
  try {
    const { symbols } = req.query;
    const response = await axios.get(`${MASSIVE_BASE_URL}/quotes`, {
      params: { symbols },
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy options chain endpoint
router.get('/options/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { expiry } = req.query;
    const url = expiry 
      ? `${MASSIVE_BASE_URL}/options/${symbol}?expiry=${expiry}`
      : `${MASSIVE_BASE_URL}/options/${symbol}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
\`\`\`

### 2. Update Client Code

Modify `src/lib/massive/client.ts` to point to your backend:

\`\`\`typescript
const MASSIVE_API_BASE = '/api/massive'; // Your backend proxy URL

private async fetch(endpoint: string, options: RequestInit = {}) {
  const url = `${this.baseUrl}${endpoint}`;
  // No Authorization header needed - backend handles it
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  // ... rest of fetch logic
}
\`\`\`

### 3. WebSocket Proxy

For WebSocket connections, you'll need a WebSocket proxy:

\`\`\`javascript
// server/websocket-proxy.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (clientWs) => {
  // Connect to Massive.com on behalf of client
  const massiveWs = new WebSocket('wss://api.massive.com/ws');
  
  massiveWs.on('open', () => {
    // Authenticate with your API key
    massiveWs.send(JSON.stringify({
      action: 'auth',
      token: process.env.MASSIVE_API_KEY
    }));
  });

  // Forward messages between client and Massive.com
  clientWs.on('message', (message) => {
    massiveWs.send(message);
  });

  massiveWs.on('message', (message) => {
    clientWs.send(message);
  });
});
\`\`\`

## Current Status

The app is configured to show:
- **"NO API KEY"** indicator in header (yellow) - API requires server-side proxy
- **"DISCONNECTED"** indicator (red) when data unavailable
- **"LIVE DATA"** indicator (green) when connected through secure proxy

## Next Steps

1. Set up a backend server (Node.js, Python Flask, etc.)
2. Store `MASSIVE_API_KEY` as a server-side environment variable
3. Implement proxy endpoints for REST API calls
4. Implement WebSocket proxy for real-time data
5. Update client code to use proxy URLs instead of direct API calls

This architecture keeps your API key secure on the server while still providing live data to your trading dashboard.
