#!/bin/bash
# Verify that compiled JavaScript has correct watchlist queries
# Run this AFTER build to verify compilation

echo "========================================"
echo "Verifying Compiled Worker Code"
echo "========================================"

if [ ! -d "server/dist" ]; then
  echo "❌ server/dist directory not found - build hasn't run yet"
  exit 1
fi

echo ""
echo "1. Checking compositeScanner.js:"
if [ -f "server/dist/server/workers/compositeScanner.js" ]; then
  grep -n "watchlist" server/dist/server/workers/compositeScanner.js | head -5
  echo ""
  echo "Checking for 'ticker' column references:"
  if grep -q '\.select.*ticker' server/dist/server/workers/compositeScanner.js; then
    echo "❌ FOUND 'ticker' column reference - BUILD IS WRONG"
    grep -n '\.select.*ticker' server/dist/server/workers/compositeScanner.js
  else
    echo "✅ No 'ticker' column references found"
  fi
  echo ""
  echo "Checking for 'symbol' column references:"
  if grep -q '\.select.*symbol' server/dist/server/workers/compositeScanner.js; then
    echo "✅ FOUND 'symbol' column reference - BUILD IS CORRECT"
    grep -n '\.select.*symbol' server/dist/server/workers/compositeScanner.js | head -3
  else
    echo "⚠️  No 'symbol' column references found either - CHECK MANUALLY"
  fi
else
  echo "❌ compositeScanner.js not found in dist"
fi

echo ""
echo "========================================"
echo "2. Checking scanner.js:"
if [ -f "server/dist/server/workers/scanner.js" ]; then
  if grep -q '\.select.*ticker' server/dist/server/workers/scanner.js; then
    echo "❌ FOUND 'ticker' in scanner.js"
  else
    echo "✅ No 'ticker' in scanner.js"
  fi
else
  echo "⚠️  scanner.js not found (may be legacy, ok to skip)"
fi

echo ""
echo "========================================"
echo "Summary:"
echo "Run this in Railway after deployment to verify build:"
echo "  cd /app && bash scripts/verify-compiled-code.sh"
echo "========================================"
