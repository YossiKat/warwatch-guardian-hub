-- Recreate view with SECURITY INVOKER
DROP VIEW IF EXISTS public.telegram_messages_public;

CREATE VIEW public.telegram_messages_public
WITH (security_invoker = true) AS
SELECT id, created_at, is_duplicate, content_hash, message_date, text, sender_name, message_id, chat_id, update_id, duplicate_of, severity, tags, bot_name
FROM public.telegram_messages;