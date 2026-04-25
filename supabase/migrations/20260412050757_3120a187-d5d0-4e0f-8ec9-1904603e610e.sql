
CREATE TABLE public.daily_intel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  summary text NOT NULL,
  threat_level integer NOT NULL DEFAULT 0,
  fronts jsonb NOT NULL DEFAULT '{}'::jsonb,
  key_findings text[] NOT NULL DEFAULT '{}'::text[],
  source_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations text[] NOT NULL DEFAULT '{}'::text[],
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_intel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily intel reports"
ON public.daily_intel_reports FOR SELECT
TO public USING (true);
