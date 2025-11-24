#!/bin/bash

# Test Scanner Setup Script
# Verifies composite scanner is properly configured

echo "========================================="
echo "Scanner Setup Verification"
echo "========================================="
echo ""

# Check if backend is running
echo "1. Checking backend server (port 3000)..."
if lsof -i :3000 > /dev/null 2>&1; then
  echo "   ✅ Backend is running on port 3000"
else
  echo "   ❌ Backend is NOT running on port 3000"
  echo "   Run: pnpm dev (in a separate terminal)"
fi
echo ""

# Check if frontend is running
echo "2. Checking frontend (port 5173)..."
if lsof -i :5173 > /dev/null 2>&1; then
  echo "   ✅ Frontend is running on port 5173"
elif lsof -i :5174 > /dev/null 2>&1; then
  echo "   ✅ Frontend is running on port 5174"
else
  echo "   ❌ Frontend is NOT running"
  echo "   Run: pnpm dev (in a separate terminal)"
fi
echo ""

# Check if scanner worker is running
echo "3. Checking scanner worker..."
if pgrep -f "compositeScanner" > /dev/null 2>&1; then
  PID=$(pgrep -f "compositeScanner")
  echo "   ✅ Scanner is running (PID: $PID)"
else
  echo "   ❌ Scanner is NOT running"
  echo "   Run: pnpm dev:composite (in a separate terminal)"
  echo "   OR: pnpm dev:all (to start everything)"
fi
echo ""

# Check backend health endpoint
echo "4. Checking backend health..."
if command -v curl > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
  if [ -n "$HEALTH" ]; then
    echo "   ✅ Backend health endpoint responding"

    # Parse scanner status
    SCANNER_STATUS=$(echo "$HEALTH" | grep -o '"scanner":[^,}]*' | cut -d':' -f2)
    if [ "$SCANNER_STATUS" = "true" ]; then
      echo "   ✅ Scanner heartbeat is healthy"
    else
      echo "   ❌ Scanner heartbeat not detected"
      echo "   The scanner may be running but not updating the database"
    fi
  else
    echo "   ❌ Backend not responding"
  fi
else
  echo "   ⚠️  curl not available, skipping health check"
fi
echo ""

# Check environment variables
echo "5. Checking environment variables..."
if [ -f ".env.local" ]; then
  echo "   ✅ .env.local file exists"

  # Check for required variables
  if grep -q "VITE_SUPABASE_URL" .env.local; then
    echo "   ✅ VITE_SUPABASE_URL is set"
  else
    echo "   ❌ VITE_SUPABASE_URL is missing"
  fi

  if grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
    echo "   ✅ VITE_SUPABASE_ANON_KEY is set"
  else
    echo "   ❌ VITE_SUPABASE_ANON_KEY is missing"
  fi

  if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
    echo "   ✅ SUPABASE_SERVICE_ROLE_KEY is set (needed for scanner)"
  else
    echo "   ❌ SUPABASE_SERVICE_ROLE_KEY is missing (needed for scanner)"
  fi

  if grep -q "MASSIVE_API_KEY" .env.local; then
    echo "   ✅ MASSIVE_API_KEY is set"
  else
    echo "   ❌ MASSIVE_API_KEY is missing"
  fi
else
  echo "   ❌ .env.local file not found"
  echo "   Copy .env.example to .env.local and fill in your credentials"
fi
echo ""

# Summary
echo "========================================="
echo "Summary"
echo "========================================="
echo ""
echo "To generate signals, you need:"
echo "1. ✅ Scanner worker running (pnpm dev:composite)"
echo "2. ✅ Backend API running (pnpm dev)"
echo "3. ❓ Symbols in your watchlist (add via Watch tab)"
echo "4. ❓ Database heartbeat record (run migration)"
echo ""
echo "Next steps:"
echo "1. Ensure all services are running: pnpm dev:all"
echo "2. Add symbols to your watchlist in the Watch tab"
echo "3. Run database migration: scripts/013_add_composite_scanner_heartbeat.sql"
echo "4. Wait 60 seconds for first scan"
echo "5. Check Radar tab for signals"
echo ""
echo "For detailed instructions, see: WEEKEND_RADAR_SETUP.md"
echo "========================================="
