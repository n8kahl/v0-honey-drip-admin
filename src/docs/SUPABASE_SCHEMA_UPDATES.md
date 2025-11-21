# Supabase Schema Updates

## 1. Add P&L Columns to Trades Table

This migration adds P&L breakdown columns to the `trades` table so that profit/loss data persists across sessions.

### Migration SQL

Execute in Supabase SQL Editor:

```sql
-- Add P&L columns to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS (
  gross_pnl DECIMAL,                    -- Gross profit/loss before costs
  gross_pnl_percent DECIMAL,            -- Gross P&L as percentage
  net_pnl DECIMAL,                      -- Net profit/loss after costs
  net_pnl_percent DECIMAL,              -- Net P&L as percentage
  commission_cost DECIMAL,              -- Total commission paid (entry + exit)
  slippage_cost DECIMAL,                -- Bid-ask spread cost
  estimated_cost_percent DECIMAL        -- Cost impact as % of gross P&L
);

-- Add comment for clarity
COMMENT ON COLUMN trades.gross_pnl IS 'Profit/loss before commission and slippage: (exitPrice - entryPrice) * quantity';
COMMENT ON COLUMN trades.net_pnl IS 'Profit/loss after all costs: grossPnL - commissionCost - slippageCost';
COMMENT ON COLUMN trades.commission_cost IS 'Entry + exit commission (usually $1.30/contract)';
COMMENT ON COLUMN trades.slippage_cost IS 'Bid-ask spread cost (usually 0.5% of position)';

-- Create index for P&L queries
CREATE INDEX IF NOT EXISTS trades_pnl_idx ON trades(user_id, net_pnl_percent DESC, created_at DESC);
```

### What Each Column Does

| Column | Type | Purpose |
|--------|------|---------|
| `gross_pnl` | DECIMAL | Raw profit/loss: (exit - entry) × quantity |
| `gross_pnl_percent` | DECIMAL | Gross P&L as percentage of entry value |
| `net_pnl` | DECIMAL | Actual profit after costs |
| `net_pnl_percent` | DECIMAL | Net P&L as percentage (what trader actually made) |
| `commission_cost` | DECIMAL | Total commissions paid |
| `slippage_cost` | DECIMAL | Bid-ask spread cost |
| `estimated_cost_percent` | DECIMAL | Cost as % of gross P&L |

### 2. Add Greeks History Columns

Optional: For tracking Greeks at entry and exit:

```sql
ALTER TABLE trades ADD COLUMN IF NOT EXISTS (
  entry_greeks JSONB,    -- {delta, gamma, theta, vega, iv} at entry
  exit_greeks JSONB      -- {delta, gamma, theta, vega, iv} at exit
);

COMMENT ON COLUMN trades.entry_greeks IS 'Greek values at trade entry: {delta: 0.5, gamma: 0.02, theta: -0.01, vega: 0.1, iv: 0.25}';
COMMENT ON COLUMN trades.exit_greeks IS 'Greek values at trade exit';
```

### 3. Update Application Code

After running the migration, update `src/services/pnlCalculator.ts` to persist results:

```typescript
// In tradeStore when transitioning to EXITED state:
const pnlResult = calculatePnL({
  entryPrice: trade.entryPrice,
  exitPrice: exitPrice,
  quantity: trade.quantity,
  commission: { /* config */ },
});

// Persist to Supabase
const { error } = await supabase
  .from('trades')
  .update({
    gross_pnl: pnlResult.grossPnL,
    gross_pnl_percent: pnlResult.grossPnLPercent,
    net_pnl: pnlResult.netPnL,
    net_pnl_percent: pnlResult.netPnLPercent,
    commission_cost: pnlResult.totalCommission,
    slippage_cost: pnlResult.slippageCost,
    estimated_cost_percent: pnlResult.costImpactPercent,
  })
  .eq('id', trade.id);
```

### 4. Migration Verification

Verify the migration completed:

```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trades' 
AND column_name IN ('gross_pnl', 'net_pnl', 'commission_cost', 'slippage_cost');

-- Expected output:
-- column_name          | data_type
-- ---------------------|----------
-- gross_pnl            | numeric
-- gross_pnl_percent    | numeric
-- net_pnl              | numeric
-- net_pnl_percent      | numeric
-- commission_cost      | numeric
-- slippage_cost        | numeric
```

### 5. Backward Compatibility

For existing trades without P&L data:
- Leave columns NULL (old trades have incomplete data)
- Only new/updated trades will have P&L filled
- Queries can use `WHERE net_pnl IS NOT NULL` to filter complete records

### Impact

**Before**: 
- P&L calculated but lost on page refresh
- No P&L history for analysis
- Backtest vs live comparison impossible

**After**:
- P&L persisted to database
- Full audit trail of every trade
- Can analyze profitability trends
- Backtest comparison available
