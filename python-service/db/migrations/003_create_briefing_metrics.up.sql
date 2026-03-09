CREATE TABLE briefing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(briefing_id, name)
);

CREATE INDEX idx_briefing_metrics_briefing_id ON briefing_metrics(briefing_id);