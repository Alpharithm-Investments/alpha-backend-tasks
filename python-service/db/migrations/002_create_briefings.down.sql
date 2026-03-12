-- Drop indexes
DROP INDEX IF EXISTS idx_briefing_metrics_briefing_id;
DROP INDEX IF EXISTS idx_briefing_risks_briefing_id;
DROP INDEX IF EXISTS idx_briefing_key_points_briefing_id;

-- Drop tables in reverse order of creation (respecting foreign keys)
DROP TABLE IF EXISTS briefing_metrics;
DROP TABLE IF EXISTS briefing_risks;
DROP TABLE IF EXISTS briefing_key_points;
DROP TABLE IF EXISTS briefings;
