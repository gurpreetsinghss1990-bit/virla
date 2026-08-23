-- Migration: Authentication Fallback for get_client_assessment_history
-- Created At: 2026-08-23

CREATE OR REPLACE FUNCTION public.get_client_assessment_history(
  p_client_id text
) RETURNS TABLE (
  booking_id text,
  session_date text,
  session_time text,
  coach_name text,
  assessment text,
  scheduled_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id text;
BEGIN
  -- Resolve caller identity: try auth.uid() first, fall back to x-user-id header in local dev
  v_caller_id := auth.uid()::text;
  IF v_caller_id IS NULL AND public.is_local_development() THEN
     v_caller_id := (current_setting('request.headers', true)::jsonb->>'x-user-id');
  END IF;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify caller is either the client themselves, the assigned trainer for an upcoming booking of this client, or an admin
  IF v_caller_id != p_client_id 
     AND NOT EXISTS (
       SELECT 1 FROM public.bookings
       WHERE client_id = p_client_id
         AND trainer_id = v_caller_id
         AND status = 'upcoming'
     ) 
     AND NOT EXISTS (
       SELECT 1 FROM public.users
       WHERE id = v_caller_id
         AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Access denied. You are not authorized to view this client''s history.';
  END IF;

  RETURN QUERY
  SELECT 
    b.id,
    b.date,
    b.time,
    b.trainer_name,
    b.questionnaire->>'coachNotes',
    b.scheduled_start_at
  FROM public.bookings b
  WHERE b.client_id = p_client_id
    AND b.status = 'completed'
    AND b.questionnaire->>'coachNotes' IS NOT NULL
    AND b.questionnaire->>'coachNotes' != ''
  ORDER BY b.scheduled_start_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_assessment_history(text) TO authenticated;
