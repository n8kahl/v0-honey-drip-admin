# Deployment Guide

## Deploying to Vercel

This app is designed to run on Vercel and uses the v0 environment.

### Automatic Deployment

1. Click the "Publish" button in the top right of the v0 interface
2. The app will be automatically deployed to Vercel
3. All environment variables (Supabase credentials) are already configured

### Manual Deployment

If you want to deploy manually:

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
\`\`\`

## Post-Deployment Steps

### 1. Run Database Migrations

After first deployment:

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `scripts/001_create_tables.sql`
4. Paste and run the script

This creates all necessary tables with proper RLS policies.

### 2. Configure Optional Services

**Massive.com** (for live market data):
1. Sign up at https://massive.com
2. Get your API key
3. Add to Vercel environment variables:
   - `VITE_MASSIVE_API_KEY=your_key_here`

**Discord** (handled in-app):
1. Create Discord webhooks in your server
2. Add them via Settings > Discord Integration in the app
3. No environment variables needed - stored in Supabase

### 3. Test the Deployment

1. Visit your deployment URL
2. Sign up for a new account
3. Check your email for verification
4. Verify your account and sign in
5. Test adding a ticker to the watchlist
6. Test creating a Discord channel (if configured)

## Environment Variables

All environment variables are managed in Vercel:

**Required** (already configured in v0):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

**Optional**:
- `VITE_MASSIVE_API_KEY` - Massive.com API key for live data
- `VITE_MASSIVE_WS_URL` - WebSocket URL (defaults to Massive.com)

## Domain Configuration

To use a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update Supabase redirect URLs:
   - Go to Supabase Dashboard > Authentication > URL Configuration
   - Add your custom domain to "Site URL"
   - Add `https://yourdomain.com/**` to "Redirect URLs"

## Monitoring

**Application Logs**:
- View in Vercel Dashboard > Deployments > [Your Deployment] > Functions

**Database Monitoring**:
- View in Supabase Dashboard > Database > Query Performance

**Error Tracking**:
- Check browser console for client-side errors
- Check Vercel function logs for server-side errors

## Scaling Considerations

**Database**:
- Supabase automatically handles connection pooling
- Consider upgrading Supabase plan for high traffic

**Market Data**:
- Massive.com has rate limits based on your plan
- WebSocket connections are persistent per client

**Discord Webhooks**:
- Discord has rate limits (30 requests per minute per webhook)
- App handles this automatically with batching

## Troubleshooting

**Users can't sign up**:
- Check Supabase email settings
- Verify SMTP configuration in Supabase

**No market data showing**:
- Verify `VITE_MASSIVE_API_KEY` is set (or check mock data is working)
- Check browser console for API errors

**Discord alerts not sending**:
- Verify webhook URLs are correct
- Test webhooks using the "Test" button in settings
- Check Discord server permissions

**Database errors**:
- Verify SQL script was run
- Check RLS policies are enabled
- Ensure user is authenticated

## Backup and Recovery

**Database Backups**:
- Supabase automatically backs up daily
- Download backups from Supabase Dashboard > Database > Backups

**Configuration Backup**:
- Export Discord channels and challenges from Settings
- Store environment variables securely

## Production Checklist

- [ ] Database schema deployed
- [ ] Supabase email confirmation configured
- [ ] Custom domain configured (if applicable)
- [ ] Massive.com API key added (if using live data)
- [ ] Discord webhooks tested
- [ ] Sign up flow tested end-to-end
- [ ] Trade lifecycle tested
- [ ] Mobile responsiveness verified
- [ ] Browser compatibility tested
