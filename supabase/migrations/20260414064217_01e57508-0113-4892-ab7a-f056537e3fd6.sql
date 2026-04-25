
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
  -- Nullify duplicate_of references pointing to old messages
  UPDATE public.telegram_messages
  SET duplicate_of = NULL
  WHERE duplicate_of IN (
    SELECT id FROM public.telegram_messages
    WHERE created_at < now() - interval '48 hours'
  );

  -- Now safe to delete old telegram messages
  DELETE FROM public.telegram_messages
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_tg = ROW_COUNT;

  DELETE FROM public.emergency_events
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_ee = ROW_COUNT;

  DELETE FROM public.intel_reports
  WHERE created_at < now() - interval '72 hours';
  GET DIAGNOSTICS deleted_ir = ROW_COUNT;

  DELETE FROM public.oref_alerts
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_oa = ROW_COUNT;

  DELETE FROM public.sentiment_scores
  WHERE created_at < now() - interval '48 hours';
  GET DIAGNOSTICS deleted_ss = ROW_COUNT;

  RAISE LOG 'Cleanup completed: TG=%, EE=%, IR=%, OA=%, SS=%',
    deleted_tg, deleted_ee, deleted_ir, deleted_oa, deleted_ss;
END;
$$;
