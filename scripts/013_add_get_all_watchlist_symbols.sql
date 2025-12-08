-- Migration 013: Add function to get all watchlist symbols for workers
-- This function bypasses RLS to allow workers to see all symbols across all users
-- Date: 2024-12-08

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_all_watchlist_symbols();

-- Create function to return all distinct symbols from watchlist
CREATE OR REPLACE FUNCTION get_all_watchlist_symbols()
RETURNS TABLE (symbol TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT w.symbol
  FROM public.watchlist w
  ORDER BY w.symbol;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_all_watchlist_symbols() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_watchlist_symbols() TO anon;

-- Add comment
COMMENT ON FUNCTION get_all_watchlist_symbols() IS
  'Returns all distinct symbols from watchlist table across all users. Used by workers to determine what data to ingest. SECURITY DEFINER allows bypassing RLS.';
