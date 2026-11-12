-- Migration: Purge the fabricated trainership coordinates already stored in the database
-- Created At: 2026-11-07
--
-- approve_trainer_application() and the trainer address form used to write 19.0176/72.8164
-- (Mumbai centre) whenever the real location was unknown. Six trainer rows carry that pair,
-- three of them in operating_latitude/operating_longitude and three more inside
-- preferences->operatingLatitude/Longitude. Those trainers now fall back to "pending" so the
-- app asks them to pin their real operating base (Profile -> Submit Request -> admin verifies).
-- Real coordinates are never invented here: anything unverified becomes NULL.

UPDATE public.trainers
SET operating_latitude = NULL,
    operating_longitude = NULL,
    operating_location_status = 'pending',
    preferences = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(preferences, '{}'::jsonb), '{operatingLatitude}', 'null'::jsonb),
        '{operatingLongitude}', 'null'::jsonb
      ),
      '{operatingLocationStatus}', '"pending"'::jsonb
    )
WHERE (round(operating_latitude::numeric, 6) = 19.017600 AND round(operating_longitude::numeric, 6) = 72.816400)
   OR (preferences->>'operatingLatitude' IN ('19.0176', '19.017600')
       AND preferences->>'operatingLongitude' IN ('72.8164', '72.816400'));

-- A trainer cannot be "verified" without a real base; send them back to the location request flow.
UPDATE public.trainers
SET operating_location_status = 'pending',
    preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{operatingLocationStatus}', '"pending"'::jsonb)
WHERE operating_latitude IS NULL
  AND operating_longitude IS NULL
  AND operating_location_status = 'verified'
  AND (preferences->>'operatingLatitude' IS NULL)
  AND (preferences->>'operatingLongitude' IS NULL);
