-- Enable RLS on emergency_events
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view emergency events"
ON public.emergency_events FOR SELECT
TO public
USING (true);

-- Enable RLS on telegram_bot_state
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bot state"
ON public.telegram_bot_state FOR SELECT
TO public
USING (true);