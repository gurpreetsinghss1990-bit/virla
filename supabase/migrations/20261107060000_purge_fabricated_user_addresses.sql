-- Migration: Purge fabricated / demo addresses on the user side
-- Created At: 2026-11-07
--
-- Older dev builds could save a booking address from the mock geocoder: the row carried a
-- fake place_id ("mock-...") and the fabricated Mumbai-centre pair 19.0176/72.8164 instead of a
-- real doorstep. Users with such a row were shown a location nobody ever chose, and the
-- service-area check then measured against that made-up point.
--
-- Rules:
--   * a row with a mock place_id was never a real address -> delete it;
--   * a row holding the fabricated pair while its place_id is missing/mock -> delete it;
--   * a row with the fabricated pair but a real Google place_id may be a genuine save on that
--     exact point, so it is only demoted (it must be re-confirmed), never deleted.
-- No real address is removed.

DELETE FROM public.addresses
WHERE coalesce(place_id, '') LIKE 'mock-%';

DELETE FROM public.addresses
WHERE coalesce(place_id, '') = ''
  AND round(lat::numeric, 6) = 19.017600
  AND round(lng::numeric, 6) = 72.816400;

UPDATE public.addresses
SET place_id = NULL
WHERE coalesce(place_id, '') NOT LIKE 'mock-%'
  AND round(lat::numeric, 6) = 19.017600
  AND round(lng::numeric, 6) = 72.816400;

-- The same fabricated pair must never reach a user's home coordinates.
UPDATE public.user_profiles
SET home_address = NULL,
    home_latitude = NULL,
    home_longitude = NULL
WHERE round(home_latitude::numeric, 6) = 19.017600
  AND round(home_longitude::numeric, 6) = 72.816400;

-- Bookings already confirmed against the fabricated point keep their text but lose the
-- invented coordinates so the live map is never centred on a place nobody chose.
-- bookings.address is TEXT holding a JSON payload, so only JSON-looking rows are touched.
UPDATE public.bookings
SET address = (
  (address::jsonb - 'lat' - 'lng') || '{"needsReconfirm": true}'::jsonb
)::text
WHERE btrim(coalesce(address, '')) LIKE '{%'
  AND (address::jsonb->>'lat') ~ '^[0-9.]+$'
  AND (address::jsonb->>'lng') ~ '^[0-9.]+$'
  AND (address::jsonb->>'lat')::numeric BETWEEN 19.01759 AND 19.01761
  AND (address::jsonb->>'lng')::numeric BETWEEN 72.81639 AND 72.81641;

-- A demo place id must never be stored again.
ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_place_id_is_not_mock;
ALTER TABLE public.addresses ADD CONSTRAINT addresses_place_id_is_not_mock
  CHECK (place_id IS NULL OR place_id !~* '^mock-');
