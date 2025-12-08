-- Check if warehouse tables exist and have data
SELECT 'historical_greeks' as table_name, COUNT(*) as row_count, 
       MIN(timestamp) as earliest, MAX(timestamp) as latest
FROM historical_greeks
UNION ALL
SELECT 'gamma_exposure_snapshots', COUNT(*), 
       MIN(timestamp), MAX(timestamp)
FROM gamma_exposure_snapshots
UNION ALL
SELECT 'iv_percentile_cache', COUNT(*), 
       MIN(EXTRACT(EPOCH FROM date)::BIGINT * 1000), 
       MAX(EXTRACT(EPOCH FROM date)::BIGINT * 1000)
FROM iv_percentile_cache
UNION ALL
SELECT 'options_flow_history', COUNT(*), 
       MIN(timestamp), MAX(timestamp)
FROM options_flow_history;
