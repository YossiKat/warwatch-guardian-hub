
CREATE TABLE public.sentiment_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT 'neutral',
  data_points INTEGER NOT NULL DEFAULT 0,
  top_headlines TEXT[] NOT NULL DEFAULT '{}',
  sources TEXT[] NOT NULL DEFAULT '{}',
  analysis_window TEXT NOT NULL DEFAULT '1h',
  raw_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sentiment_scores_created ON public.sentiment_scores (created_at DESC);

ALTER TABLE public.sentiment_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sentiment scores"
ON public.sentiment_scores
FOR SELECT
TO public
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sentiment_scores;
