-- Fix telegram_bot_state: remove public SELECT, add authenticated-only
DROP POLICY IF EXISTS "Anyone can view bot state" ON public.telegram_bot_state;

CREATE POLICY "Authenticated users can view bot state"
ON public.telegram_bot_state
FOR SELECT
TO authenticated
USING (true);

-- Drop the public view since base table is already restricted
DROP VIEW IF EXISTS public.telegram_messages_public;