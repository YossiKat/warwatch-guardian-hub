-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view telegram messages" ON public.telegram_messages;

-- Create a restricted policy: only authenticated users can read the base table
CREATE POLICY "Authenticated users can view telegram messages"
ON public.telegram_messages
FOR SELECT
TO authenticated
USING (true);

-- Create a public view excluding raw_update for the frontend
CREATE OR REPLACE VIEW public.telegram_messages_public AS
SELECT id, created_at, is_duplicate, content_hash, message_date, text, sender_name, message_id, chat_id, update_id, duplicate_of, severity, tags, bot_name
FROM public.telegram_messages;