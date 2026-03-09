CREATE TABLE briefing_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    point_type VARCHAR(20) NOT NULL CHECK (point_type IN ('key_point', 'risk')),
    content TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_briefing_points_briefing_id ON briefing_points(briefing_id);
CREATE INDEX idx_briefing_points_type ON briefing_points(point_type);