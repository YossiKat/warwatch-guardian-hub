
CREATE TABLE public.oref_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_date timestamptz NOT NULL,
  title text NOT NULL,
  category integer NOT NULL DEFAULT 0,
  description text,
  locations text[] NOT NULL DEFAULT '{}',
  raw_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oref_alerts_date ON public.oref_alerts (alert_date DESC);
CREATE INDEX idx_oref_alerts_locations ON public.oref_alerts USING GIN (locations);

ALTER TABLE public.oref_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view oref alerts"
  ON public.oref_alerts FOR SELECT
  TO public
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.oref_alerts;
