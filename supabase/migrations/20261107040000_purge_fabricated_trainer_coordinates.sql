-- Migration: Purge the fabricated trainer coordinates already stored in the database
-- Created At: 2026-11-07
--
-- The trainer "Operating Base" form and approve_trainer_application() used to write
-- 19.0176/72.8164 (Mumbai centre) whenever the real location was unknown. Six trainer rows
-- carry that pair, three in operating_latitude/operating_longitude and three more inside
-- preferences. Real coordinates are never invented here: unverified trainers are reset to a
-- clean slate and must pin their base again from Profile -> Request Address Change.

-- 1. Rows holding the fabricated pair in the columns or in preferences.
UPDATE public.trainers
SET operating_latitude = NULL,
    operating_longitude = NULL,
    operating_address = NULL,
    operating_location_status = 'pending',
    preferences = (
      (coalesce(preferences, '{}'::jsonb)
        - 'operatingLatitude' - 'operatingLongitude' - 'operatingAddress' - 'operatingPlaceId')
      || '{"operatingLocationStatus":"pending"}'::jsonb
    )
WHERE (round(operating_latitude::numeric, 6) = 19.017600 AND round(operating_longitude::numeric, 6) = 72.816400)
   OR (preferences->>'operatingLatitude' IN ('19.0176', '19.017600')
       AND preferences->>'operatingLongitude' IN ('72.8164', '72.816400'));

-- 2. Pending change requests that themselves carry the fabricated pair must not reach admin.
UPDATE public.trainers
SET preferences = coalesce(preferences, '{}'::jsonb) - 'addressChangeRequest'
WHERE preferences->'addressChangeRequest'->>'requestedLatitude' IN ('19.0176', '19.017600')
  AND preferences->'addressChangeRequest'->>'requestedLongitude' IN ('72.8164', '72.816400');

-- 3. "Verified" without a real base is impossible: reset the base text and send them back.
UPDATE public.trainers
SET operating_address = NULL,
    operating_location_status = 'pending',
    preferences = (
      (coalesce(preferences, '{}'::jsonb)
        - 'operatingLatitude' - 'operatingLongitude' - 'operatingAddress' - 'operatingPlaceId')
      || '{"operatingLocationStatus":"pending"}'::jsonb
    )
WHERE operating_latitude IS NULL
  AND operating_longitude IS NULL
  AND operating_location_status = 'verified'
  AND (preferences->>'operatingLatitude' IS NULL);
