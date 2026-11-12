-- Migration: Never keep a device-local image path in the database
-- Created At: 2026-11-07
--
-- Admin flows used to fall back to the picked image's device URI (file:// / content://)
-- when the storage upload failed, and saved that string as if it were an image URL.
-- Such a row renders as a broken/blank image on every other device. This clears the
-- values already stored and makes the database reject new ones.

UPDATE public.users
SET avatar = ''
WHERE avatar ~* '^(file|content|ph|assets-library):';

UPDATE public.trainers
SET photo = ''
WHERE photo ~* '^(file|content|ph|assets-library):';

UPDATE public.trainer_applications
SET avatar = ''
WHERE avatar ~* '^(file|content|ph|assets-library):';

UPDATE public.trainer_applications
SET document_selfie = ''
WHERE document_selfie ~* '^(file|content|ph|assets-library):';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_avatar_is_not_device_path;
ALTER TABLE public.users ADD CONSTRAINT users_avatar_is_not_device_path
  CHECK (avatar IS NULL OR avatar !~* '^(file|content|ph|assets-library):');

ALTER TABLE public.trainers DROP CONSTRAINT IF EXISTS trainers_photo_is_not_device_path;
ALTER TABLE public.trainers ADD CONSTRAINT trainers_photo_is_not_device_path
  CHECK (photo IS NULL OR photo !~* '^(file|content|ph|assets-library):');

ALTER TABLE public.trainer_applications DROP CONSTRAINT IF EXISTS trainer_applications_avatar_is_not_device_path;
ALTER TABLE public.trainer_applications ADD CONSTRAINT trainer_applications_avatar_is_not_device_path
  CHECK (avatar IS NULL OR avatar !~* '^(file|content|ph|assets-library):');

ALTER TABLE public.trainer_applications DROP CONSTRAINT IF EXISTS trainer_applications_selfie_is_not_device_path;
ALTER TABLE public.trainer_applications ADD CONSTRAINT trainer_applications_selfie_is_not_device_path
  CHECK (document_selfie IS NULL OR document_selfie !~* '^(file|content|ph|assets-library):');
