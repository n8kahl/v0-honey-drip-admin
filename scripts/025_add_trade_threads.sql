-- ============================================================================
-- Migration 025: Trade Threads V1
--
-- Implements HoneyDrip's differentiator:
-- - Trade Threads: Canonical thread object linking all admin updates
-- - Member Subscriptions: "I Took This Trade" with entry tracking
-- - Public Wins/Losses: EOD publishing with admin attribution
-- ============================================================================

-- ==================================
-- 1. Trade Threads Table
-- ==================================
-- Canonical trade thread - all admin updates link to this
CREATE TABLE IF NOT EXISTS trade_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  admin_name TEXT,  -- Denormalized for fast display
  symbol TEXT NOT NULL,
  contract_id TEXT NOT NULL,  -- Option contract identifier (e.g., "SPY250120C600")
  contract JSONB,  -- Full contract details for member reference

  -- Thread status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

  -- Original alert data
  entry_price NUMERIC,
  target_price NUMERIC,
  stop_loss NUMERIC,
  trade_type TEXT,  -- Scalp/Day/Swing/LEAP

  -- Outcome (populated on close)
  exit_price NUMERIC,
  final_pnl_percent NUMERIC,
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'breakeven')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  latest_update_at TIMESTAMPTZ DEFAULT NOW(),

  -- Tags for filtering
  tags TEXT[] DEFAULT '{}'::TEXT[]
);

-- Indexes for trade_threads
CREATE INDEX IF NOT EXISTS idx_trade_threads_admin_id ON trade_threads(admin_id);
CREATE INDEX IF NOT EXISTS idx_trade_threads_symbol ON trade_threads(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_threads_status ON trade_threads(status);
CREATE INDEX IF NOT EXISTS idx_trade_threads_created_at ON trade_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_threads_latest_update ON trade_threads(latest_update_at DESC);

-- ==================================
-- 2. Trade Thread Updates Table
-- ==================================
-- Timeline of admin actions on a thread
CREATE TABLE IF NOT EXISTS trade_thread_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_thread_id UUID REFERENCES trade_threads(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Update type
  type TEXT NOT NULL CHECK (type IN ('OPEN', 'UPDATE', 'STOP_MOVE', 'TRIM', 'EXIT', 'NOTE')),

  -- Content
  message TEXT,
  payload JSONB DEFAULT '{}'::JSONB,  -- { stopPrice, targetPrices[], entryPrice, exitPrice, pnlPercent }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trade_thread_updates
CREATE INDEX IF NOT EXISTS idx_trade_thread_updates_thread_id ON trade_thread_updates(trade_thread_id);
CREATE INDEX IF NOT EXISTS idx_trade_thread_updates_type ON trade_thread_updates(type);
CREATE INDEX IF NOT EXISTS idx_trade_thread_updates_created_at ON trade_thread_updates(created_at DESC);

-- ==================================
-- 3. Member Trades Table
-- ==================================
-- Member subscriptions to trade threads
CREATE TABLE IF NOT EXISTS member_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  trade_thread_id UUID REFERENCES trade_threads(id) ON DELETE CASCADE NOT NULL,

  -- Entry details (required)
  entry_price NUMERIC NOT NULL,
  entry_time TIMESTAMPTZ DEFAULT NOW(),

  -- Optional details
  size_contracts INTEGER,
  stop_price NUMERIC,  -- Custom stop (default: use admin's)
  targets JSONB,  -- Custom targets (default: use admin's)

  -- Exit details (populated when member exits)
  exit_price NUMERIC,
  exit_time TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exited')),

  -- Journal
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: One member trade per user per thread
  UNIQUE(user_id, trade_thread_id)
);

-- Indexes for member_trades
CREATE INDEX IF NOT EXISTS idx_member_trades_user_id ON member_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_member_trades_thread_id ON member_trades(trade_thread_id);
CREATE INDEX IF NOT EXISTS idx_member_trades_status ON member_trades(status);
CREATE INDEX IF NOT EXISTS idx_member_trades_created_at ON member_trades(created_at DESC);

-- ==================================
-- 4. Public Trade Outcomes Table
-- ==================================
-- EOD published results for /wins page
CREATE TABLE IF NOT EXISTS public_trade_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_thread_id UUID REFERENCES trade_threads(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Trade details
  symbol TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  trade_type TEXT,

  -- Outcome
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
  pnl_percent NUMERIC NOT NULL,

  -- Admin attribution
  admin_id UUID REFERENCES auth.users(id),
  admin_name TEXT,
  admin_avatar_url TEXT,

  -- Entry details (masked for non-members)
  entry_price_masked BOOLEAN DEFAULT true,  -- If true, show "Members Only"

  -- Public comment/teaser
  public_comment TEXT,

  -- Timestamps
  trade_opened_at TIMESTAMPTZ,
  trade_closed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ DEFAULT NOW(),

  -- For EOD batching
  publish_date DATE DEFAULT CURRENT_DATE
);

-- Indexes for public_trade_outcomes
CREATE INDEX IF NOT EXISTS idx_public_trade_outcomes_symbol ON public_trade_outcomes(symbol);
CREATE INDEX IF NOT EXISTS idx_public_trade_outcomes_outcome ON public_trade_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_public_trade_outcomes_publish_date ON public_trade_outcomes(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_public_trade_outcomes_pnl ON public_trade_outcomes(pnl_percent DESC);
CREATE INDEX IF NOT EXISTS idx_public_trade_outcomes_admin ON public_trade_outcomes(admin_id);

-- ==================================
-- 5. Member Notification Preferences
-- ==================================
-- Optional: Per-member notification thresholds
CREATE TABLE IF NOT EXISTS member_notification_prefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,

  -- P/L thresholds for notifications (percentages)
  pnl_thresholds NUMERIC[] DEFAULT '{10, 20, -10}'::NUMERIC[],

  -- Notification settings
  notify_admin_updates BOOLEAN DEFAULT true,
  notify_pnl_thresholds BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for member_notification_prefs
CREATE INDEX IF NOT EXISTS idx_member_notification_prefs_user ON member_notification_prefs(user_id);

-- ==================================
-- 6. Row-Level Security (RLS) Policies
-- ==================================

-- Trade Threads: Admins can CRUD their own, everyone can read open threads
ALTER TABLE trade_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trade threads"
  ON trade_threads FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert own threads"
  ON trade_threads FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update own threads"
  ON trade_threads FOR UPDATE
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete own threads"
  ON trade_threads FOR DELETE
  USING (auth.uid() = admin_id);

-- Trade Thread Updates: Admins can insert, everyone can read
ALTER TABLE trade_thread_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view thread updates"
  ON trade_thread_updates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert updates"
  ON trade_thread_updates FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Member Trades: Users can CRUD their own
ALTER TABLE member_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own member trades"
  ON member_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own member trades"
  ON member_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own member trades"
  ON member_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own member trades"
  ON member_trades FOR DELETE
  USING (auth.uid() = user_id);

-- Public Trade Outcomes: Anyone can read (it's public!)
ALTER TABLE public_trade_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public outcomes"
  ON public_trade_outcomes FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert public outcomes"
  ON public_trade_outcomes FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Member Notification Prefs: Users can CRUD their own
ALTER TABLE member_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification prefs"
  ON member_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification prefs"
  ON member_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs"
  ON member_notification_prefs FOR UPDATE
  USING (auth.uid() = user_id);

-- ==================================
-- 7. Helper Functions
-- ==================================

-- Function to publish a trade thread to public outcomes
CREATE OR REPLACE FUNCTION publish_trade_to_public(thread_id UUID)
RETURNS UUID AS $$
DECLARE
  outcome_id UUID;
  thread_record RECORD;
BEGIN
  -- Get thread details
  SELECT * INTO thread_record FROM trade_threads WHERE id = thread_id;

  IF thread_record.status != 'closed' THEN
    RAISE EXCEPTION 'Cannot publish unclosed trade thread';
  END IF;

  -- Insert or update public outcome
  INSERT INTO public_trade_outcomes (
    trade_thread_id, symbol, contract_id, trade_type,
    outcome, pnl_percent,
    admin_id, admin_name,
    trade_opened_at, trade_closed_at
  ) VALUES (
    thread_id, thread_record.symbol, thread_record.contract_id, thread_record.trade_type,
    thread_record.outcome, thread_record.final_pnl_percent,
    thread_record.admin_id, thread_record.admin_name,
    thread_record.created_at, thread_record.closed_at
  )
  ON CONFLICT (trade_thread_id) DO UPDATE SET
    pnl_percent = EXCLUDED.pnl_percent,
    outcome = EXCLUDED.outcome,
    published_at = NOW()
  RETURNING id INTO outcome_id;

  RETURN outcome_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get member's P/L on a trade thread
CREATE OR REPLACE FUNCTION calculate_member_pnl(
  member_entry_price NUMERIC,
  current_price NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  IF member_entry_price IS NULL OR member_entry_price = 0 THEN
    RETURN 0;
  END IF;
  RETURN ((current_price - member_entry_price) / member_entry_price) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==================================
-- 8. Triggers
-- ==================================

-- Auto-update latest_update_at on trade_threads when an update is added
CREATE OR REPLACE FUNCTION update_thread_latest_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trade_threads
  SET latest_update_at = NOW()
  WHERE id = NEW.trade_thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_latest
  AFTER INSERT ON trade_thread_updates
  FOR EACH ROW EXECUTE FUNCTION update_thread_latest_update();

-- Auto-update member_trades.updated_at
CREATE OR REPLACE FUNCTION update_member_trade_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_member_trade_updated
  BEFORE UPDATE ON member_trades
  FOR EACH ROW EXECUTE FUNCTION update_member_trade_timestamp();

-- ==================================
-- 9. Link existing trades to threads (optional migration helper)
-- ==================================
-- This function can be called manually to link existing admin trades
-- to new trade_threads for backwards compatibility

CREATE OR REPLACE FUNCTION migrate_existing_trades_to_threads(admin_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER := 0;
  trade_record RECORD;
  new_thread_id UUID;
BEGIN
  FOR trade_record IN
    SELECT * FROM trades
    WHERE user_id = admin_user_id
    AND state IN ('ENTERED', 'EXITED')
  LOOP
    -- Create a thread for each existing trade
    INSERT INTO trade_threads (
      admin_id, admin_name, symbol, contract_id, contract,
      status, entry_price, target_price, stop_loss, trade_type,
      exit_price, final_pnl_percent,
      outcome,
      created_at, closed_at
    ) VALUES (
      trade_record.user_id,
      NULL, -- admin_name can be populated later
      trade_record.ticker,
      COALESCE(trade_record.contract->>'id', trade_record.ticker || '-contract'),
      trade_record.contract,
      CASE WHEN trade_record.state = 'EXITED' THEN 'closed' ELSE 'open' END,
      trade_record.entry_price,
      trade_record.target_price,
      trade_record.stop_loss,
      trade_record.trade_type,
      trade_record.exit_price,
      trade_record.move_percent,
      CASE
        WHEN trade_record.state = 'EXITED' AND COALESCE(trade_record.move_percent, 0) > 0 THEN 'win'
        WHEN trade_record.state = 'EXITED' AND COALESCE(trade_record.move_percent, 0) < 0 THEN 'loss'
        WHEN trade_record.state = 'EXITED' THEN 'breakeven'
        ELSE NULL
      END,
      trade_record.created_at,
      trade_record.exit_time
    )
    RETURNING id INTO new_thread_id;

    -- Create an OPEN update
    INSERT INTO trade_thread_updates (
      trade_thread_id, admin_id, type, message, created_at
    ) VALUES (
      new_thread_id,
      trade_record.user_id,
      'OPEN',
      'Trade opened',
      trade_record.created_at
    );

    -- If exited, create an EXIT update
    IF trade_record.state = 'EXITED' THEN
      INSERT INTO trade_thread_updates (
        trade_thread_id, admin_id, type, message, payload, created_at
      ) VALUES (
        new_thread_id,
        trade_record.user_id,
        'EXIT',
        'Trade closed',
        jsonb_build_object('exitPrice', trade_record.exit_price, 'pnlPercent', trade_record.move_percent),
        COALESCE(trade_record.exit_time, trade_record.updated_at)
      );
    END IF;

    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================
-- Done!
-- ==================================
COMMENT ON TABLE trade_threads IS 'Canonical trade thread - all admin updates and member subscriptions link here';
COMMENT ON TABLE trade_thread_updates IS 'Timeline of admin actions on a trade thread';
COMMENT ON TABLE member_trades IS 'Member subscriptions - tracks member entry/exit on admin trade threads';
COMMENT ON TABLE public_trade_outcomes IS 'Published EOD results for public /wins feed';
