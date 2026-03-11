CREATE TABLE IF NOT EXISTS briefings (
  id          SERIAL PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  ticker       VARCHAR(20)  NOT NULL,
  sector       VARCHAR(120) NOT NULL,
  analyst_name VARCHAR(160) NOT NULL,
  summary      TEXT         NOT NULL,
  recommendation TEXT       NOT NULL,
  is_generated BOOLEAN      NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ,
  rendered_html TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_ticker ON briefings (ticker);

CREATE TABLE IF NOT EXISTS briefing_points (
  id           SERIAL PRIMARY KEY,
  briefing_id  INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  point_type   VARCHAR(10) NOT NULL CHECK (point_type IN ('key', 'risk')),
  content      TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_briefing_points_briefing_id ON briefing_points (briefing_id);

CREATE TABLE IF NOT EXISTS briefing_metrics (
  id          SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  value       VARCHAR(120) NOT NULL,
  UNIQUE (briefing_id, name)
);

CREATE INDEX IF NOT EXISTS idx_briefing_metrics_briefing_id ON briefing_metrics (briefing_id);