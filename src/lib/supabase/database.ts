import { createClient } from './client';

// ============================================================================
// PROFILES
// ============================================================================

export async function getProfile(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: {
  display_name?: string;
  discord_handle?: string;
  avatar_url?: string;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// DISCORD CHANNELS
// ============================================================================

export async function getDiscordChannels(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('discord_channels')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addDiscordChannel(userId: string, name: string, webhookUrl: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('discord_channels')
    .insert({
      user_id: userId,
      name,
      webhook_url: webhookUrl,
      is_active: true,
      is_default_load: false,
      is_default_enter: false,
      is_default_exit: false,
      is_default_update: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDiscordChannel(channelId: string, updates: {
  name?: string;
  webhook_url?: string;
  is_active?: boolean;
  is_default_load?: boolean;
  is_default_enter?: boolean;
  is_default_exit?: boolean;
  is_default_update?: boolean;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('discord_channels')
    .update(updates)
    .eq('id', channelId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDiscordChannel(id: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('discord_channels')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// CHALLENGES
// ============================================================================

export async function getChallenges(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addChallenge(userId: string, challenge: {
  name: string;
  description?: string;
  starting_balance: number;
  target_balance: number;
  start_date: string;
  end_date: string;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      user_id: userId,
      name: challenge.name,
      description: challenge.description,
      starting_balance: challenge.starting_balance,
      current_balance: challenge.starting_balance,
      target_balance: challenge.target_balance,
      start_date: challenge.start_date,
      end_date: challenge.end_date,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateChallenge(challengeId: string, updates: {
  name?: string;
  description?: string;
  current_balance?: number;
  is_active?: boolean;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('challenges')
    .update(updates)
    .eq('id', challengeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChallenge(id: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('challenges')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// WATCHLIST
// ============================================================================

export async function getWatchlist(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addToWatchlist(userId: string, ticker: string, notes?: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      ticker,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFromWatchlist(id: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// TRADES
// ============================================================================

export async function getTrades(userId: string, status?: string) {
  const supabase = createClient();
  
  let query = supabase
    .from('trades')
    .select('*, trade_updates(*)')
    .eq('user_id', userId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTrade(userId: string, trade: {
  ticker: string;
  contract_type: 'call' | 'put';
  strike: number;
  expiration: string;
  quantity: number;
  entry_price?: number;
  status?: string;
  notes?: string;
  challenge_id?: string;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('trades')
    .insert({
      user_id: userId,
      ticker: trade.ticker,
      contract_type: trade.contract_type,
      strike: trade.strike,
      expiration: trade.expiration,
      quantity: trade.quantity,
      entry_price: trade.entry_price,
      status: trade.status || 'watching',
      notes: trade.notes,
      challenge_id: trade.challenge_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrade(id: string, updates: {
  status?: string;
  quantity?: number;
  entry_price?: number;
  exit_price?: number;
  entry_time?: string;
  exit_time?: string;
  pnl?: number;
  pnl_percent?: number;
  notes?: string;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  move_percent?: number;
  state?: string;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// TRADE UPDATES
// ============================================================================

export async function addTradeUpdate(tradeId: string, userId: string, update: {
  action: string;
  quantity?: number;
  price?: number;
  notes?: string;
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('trade_updates')
    .insert({
      trade_id: tradeId,
      user_id: userId,
      action: update.action,
      quantity: update.quantity,
      price: update.price,
      notes: update.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTradeUpdates(tradeId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('trade_updates')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}
