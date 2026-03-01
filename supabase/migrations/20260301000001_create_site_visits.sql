-- Site visits tracking table
CREATE TABLE IF NOT EXISTS site_visits (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast monthly queries
CREATE INDEX idx_site_visits_created_at ON site_visits (created_at DESC);

-- RLS
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (public tracking from frontend)
CREATE POLICY "anon_insert_site_visits"
    ON site_visits FOR INSERT
    TO anon
    WITH CHECK (true);

-- Service role can read everything (admin dashboard)
CREATE POLICY "service_role_select_site_visits"
    ON site_visits FOR SELECT
    TO service_role
    USING (true);
