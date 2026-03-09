CREATE TABLE briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    sector VARCHAR(100),
    analyst_name VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    generated BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_briefings_ticker ON briefings(ticker);
CREATE INDEX idx_briefings_created_at ON briefings(created_at);