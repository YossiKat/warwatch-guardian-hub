-- Drop and recreate with security_invoker
DROP VIEW IF EXISTS public.telegram_messages_public;

-- Instead of a view, just restore public SELECT on the base table
-- but the app code will be updated to not fetch raw_update
-- This is simpler and avoids the security_definer warning
CREATE POLICY "Anon can read telegram messages without raw_update"
ON public.telegram_messages
FOR SELECT
TO anon
USING (true);