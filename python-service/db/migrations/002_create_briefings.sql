-- Create briefings table
CREATE TABLE briefings (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  summary TEXT NOT NULL,
  recommendation VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create briefing_key_points table
CREATE TABLE briefing_key_points (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create briefing_risks table
CREATE TABLE briefing_risks (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create briefing_metrics table
CREATE TABLE briefing_metrics (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  value VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(briefing_id, name)
);

-- Create indexes for foreign key lookups
CREATE INDEX idx_briefing_key_points_briefing_id ON briefing_key_points(briefing_id);
CREATE INDEX idx_briefing_risks_briefing_id ON briefing_risks(briefing_id);
CREATE INDEX idx_briefing_metrics_briefing_id ON briefing_metrics(briefing_id);
