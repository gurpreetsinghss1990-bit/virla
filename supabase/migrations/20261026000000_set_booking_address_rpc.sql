-- Migration: persist the client's selected venue (JSON with lat/lng) on a booking.
-- create_booking is intentionally left untouched; this is a separate, additive RPC.
CREATE OR REPLACE FUNCTION public.set_booking_address(
  p_booking_id text,
  p_address text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id text;
BEGIN
  v_client_id := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(auth.uid()::text, ''),
    (current_setting('request.headers', true)::jsonb->>'x-user-id')
  );

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Only the booking's own client may set it, and only while it is still upcoming.
  UPDATE public.bookings
     SET address = p_address
   WHERE id = p_booking_id
     AND client_id = v_client_id
     AND status = 'upcoming';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_booking_address(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_booking_address(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_booking_address(text, text) TO service_role;
