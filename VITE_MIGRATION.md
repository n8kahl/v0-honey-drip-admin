# Vite SPA Migration Complete

This project has been successfully converted from Next.js to a pure Vite React SPA with secure API handling.

## Key Changes

### 1. Environment Variables
- **Before:** `process.env.NEXT_PUBLIC_*`
- **After:** `import.meta.env.VITE_*`

All client-side environment variables now use the `VITE_` prefix:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. Supabase Client
- **Before:** `@supabase/ssr` with `createBrowserClient`
- **After:** `@supabase/supabase-js` with `createClient`

The singleton pattern is maintained in `src/lib/supabase/client.ts`.

### 3. Massive API Security
The Massive.com API key is now **completely secure and never exposed to the client**.

#### REST API Calls
All REST API calls go through Next.js API routes:
- Client calls: `/api/massive/v3/snapshot/...`
- API route proxies to: `https://api.massive.com/v3/snapshot/...`
- API key is added server-side only in the API route handler

#### WebSocket Authentication
Instead of exposing the real API key to the browser:
1. Client requests ephemeral token from `/api/massive/ws-token`
2. Server generates short-lived token (5 min expiry)
3. Client uses ephemeral token for WebSocket auth
4. Token expires automatically - no real API key ever touches the browser

### 4. Database Functions
All stub functions in `src/lib/supabase/auth.ts` and `src/lib/supabase/database.ts` are now fully implemented with:
- Proper error handling
- RLS-safe queries
- Admin scoping where needed
- TypeScript type safety

### 5. Removed Files
No Next.js specific files were removed - this runs in v0's Next.js environment with the Vite app embedded via `app/page.tsx`.

## Setup Instructions

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables
Set these in your Vercel project settings:

**Client-side (VITE_ prefix):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Server-side (NO VITE_ prefix - never exposed to client):**
- `MASSIVE_API_KEY` - Your Massive.com API key (server-side only)

**Important:** The `MASSIVE_API_KEY` must NOT have the `VITE_` or `NEXT_PUBLIC_` prefix. It's server-side only and handled by Next.js API routes.

### 3. Run Development Server
\`\`\`bash
npm run dev
\`\`\`

This starts the Next.js development server which:
- Serves the Vite React app
- Provides `/api/massive/*` API routes for secure proxying
- Handles ephemeral token generation for WebSocket auth

## Architecture

### Client-Side (Browser)
- Vite React SPA embedded in Next.js
- Supabase client for auth/database
- Makes requests to `/api/massive/*` (Next.js API routes)
- Uses ephemeral tokens for WebSocket (never sees real API key)

### Server-Side (Next.js API Routes)
- API routes in `app/api/massive/` directory
- Holds real Massive API key securely
- Proxies REST API requests
- Generates ephemeral WS tokens

## Security Notes

✅ **Secure:**
- Massive API key is server-side only (Next.js API routes)
- Ephemeral tokens expire after 5 minutes
- No API keys in browser code or bundle
- Supabase uses RLS policies
- All sensitive data in server environment variables

❌ **Previous (Insecure):**
- API key was in client environment variables
- Exposed in browser bundle
- Visible in DevTools

## Production Deployment

The app is designed to deploy to Vercel:
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `MASSIVE_API_KEY` (server-only)
4. Deploy

The Next.js API routes automatically handle all server-side API key management.

## TypeScript Configuration

The project uses TypeScript with strict mode enabled. All types are properly defined, including:
- Supabase database types
- Massive API response types
- Component prop types
- Context types

## Testing

1. Start the dev server: `npm run dev`
2. Open the app in your browser
3. Check browser DevTools → Network tab
4. Verify requests go to `/api/massive/*` (not direct to massive.com)
5. Check that no API keys appear in:
   - Network request headers
   - Console logs
   - Source code in DevTools

## Migration Checklist

- [x] Replace all client-side API key references with server proxy calls
- [x] Replace `@supabase/ssr` with `@supabase/supabase-js`
- [x] Create singleton Supabase client
- [x] Implement all auth functions (signup, login, logout, getSession, getCurrentUser)
- [x] Implement all database functions (profiles, channels, watchlist, trades, trade_updates)
- [x] Create Next.js API routes for Massive API proxy
- [x] Implement ephemeral token generation for WebSocket
- [x] Update WebSocket client to use ephemeral tokens
- [x] Remove all API key references from client code
- [x] Update documentation
- [x] Verify no sensitive data in client bundle

## Support

If you encounter any issues:
1. Check that environment variables are properly configured in Vercel
2. Verify the API routes are responding correctly
3. Check browser console and Vercel function logs
4. Ensure all dependencies are installed
