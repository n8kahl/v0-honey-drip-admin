-- Honey Drip Trading Platform Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & PROFILES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- DISCORD CHANNELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discord_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.discord_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discord_channels_select_own" ON public.discord_channels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "discord_channels_insert_own" ON public.discord_channels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "discord_channels_update_own" ON public.discord_channels
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "discord_channels_delete_own" ON public.discord_channels
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- CHALLENGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('admin', 'honeydrip-wide')),
  default_channel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges_select_own" ON public.challenges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "challenges_insert_own" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenges_update_own" ON public.challenges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "challenges_delete_own" ON public.challenges
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- WATCHLIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_select_own" ON public.watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "watchlist_insert_own" ON public.watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_delete_own" ON public.watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRADES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Trade basics
  ticker TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('Scalp', 'Day', 'Swing', 'LEAP')),
  state TEXT NOT NULL CHECK (state IN ('WATCHING', 'LOADED', 'ENTERED', 'EXITED')),
  
  -- Contract details (stored as JSONB for flexibility)
  contract JSONB NOT NULL,
  
  -- Trade pricing & management
  entry_price NUMERIC,
  entry_time TIMESTAMP WITH TIME ZONE,
  current_price NUMERIC,
  target_price NUMERIC,
  stop_loss NUMERIC,
  stop_mode TEXT CHECK (stop_mode IN ('fixed', 'trailing')),
  move_percent NUMERIC,
  exit_price NUMERIC,
  exit_time TIMESTAMP WITH TIME ZONE,
  
  -- Associations
  discord_channels TEXT[] DEFAULT '{}',
  challenges TEXT[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_state ON public.trades(state);
CREATE INDEX idx_trades_ticker ON public.trades(ticker);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select_own" ON public.trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trades_insert_own" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trades_update_own" ON public.trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "trades_delete_own" ON public.trades
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRADE UPDATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trade_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('enter', 'trim', 'update', 'update-sl', 'trail-stop', 'add', 'exit')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message TEXT NOT NULL,
  price NUMERIC NOT NULL,
  pnl_percent NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trade_updates_trade_id ON public.trade_updates(trade_id);

ALTER TABLE public.trade_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_updates_select_own" ON public.trade_updates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trade_updates_insert_own" ON public.trade_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
