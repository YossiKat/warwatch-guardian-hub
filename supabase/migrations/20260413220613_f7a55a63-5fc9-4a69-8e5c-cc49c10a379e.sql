-- Recreate the safe public view
CREATE OR REPLACE VIEW public.telegram_messages_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, created_at, is_duplicate, content_hash, message_date, text, sender_name, message_id, chat_id, update_id, duplicate_of, severity, tags, bot_name
FROM public.telegram_messages;

-- Grant anon access to the view
GRANT SELECT ON public.telegram_messages_public TO anon;
GRANT SELECT ON public.telegram_messages_public TO authenticated;