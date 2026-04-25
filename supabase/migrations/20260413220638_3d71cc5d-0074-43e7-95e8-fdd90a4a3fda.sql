CREATE POLICY "Anon can read bot state"
ON public.telegram_bot_state
FOR SELECT
TO anon
USING (true);