
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_tg INT;
  deleted_ee INT;
  deleted_ir INT;
  deleted_oa INT;
  deleted_ss INT;
BEGIN
  -- Delete telegram messages older than 48 hours
  DELETE FROM public.telegram_messages
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_tg = ROW_COUNT;

  -- Delete emergency events older than 24 hours
  DELETE FROM public.emergency_events
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_ee = ROW_COUNT;

  -- Delete intel reports older than 72 hours
  DELETE FROM public.intel_reports
  WHERE created_at < now() - interval '72 hours';
  GET DIAGNOSTICS deleted_ir = ROW_COUNT;

  -- Delete oref alerts older than 48 hours
  DELETE FROM public.oref_alerts
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_oa = ROW_COUNT;

  -- Delete sentiment scores older than 48 hours
  DELETE FROM public.sentiment_scores
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_ss = ROW_COUNT;

  RAISE LOG 'Cleanup completed: TG=%, EE=%, IR=%, OA=%, SS=%',
    deleted_tg, deleted_ee, deleted_ir, deleted_oa, deleted_ss;
END;
$$;

-- Schedule cleanup every 2 hours
SELECT cron.schedule(
  'cleanup-old-data',
  '0 */2 * * *',
  $$SELECT public.cleanup_old_data()$$
);
