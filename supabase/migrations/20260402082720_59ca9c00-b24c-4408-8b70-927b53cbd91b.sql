
CREATE TABLE public.intel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'ai_analysis',
  category text NOT NULL DEFAULT 'geopolitical',
  title text NOT NULL,
  summary text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  region text,
  tags text[] NOT NULL DEFAULT '{}',
  raw_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_reports_created ON public.intel_reports (created_at DESC);
CREATE INDEX idx_intel_reports_category ON public.intel_reports (category);

ALTER TABLE public.intel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view intel reports"
  ON public.intel_reports FOR SELECT
  TO public
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_reports;
