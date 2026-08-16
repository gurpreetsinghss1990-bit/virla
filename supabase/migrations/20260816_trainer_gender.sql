-- 1. ADD gender column to trainers table
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS gender TEXT;

-- 2. UPDATE existing trainer rows to normalize gender
UPDATE public.trainers SET gender = 'male' WHERE id = 'c-1';
UPDATE public.trainers SET gender = 'female' WHERE id = 'c-2';
UPDATE public.trainers SET gender = 'male' WHERE id = 'c-3';
UPDATE public.trainers SET gender = 'female' WHERE id = 'c-4';

-- Normalize other legacy trainers if any
UPDATE public.trainers SET gender = 'male' WHERE gender IS NULL OR (LOWER(gender) NOT IN ('male', 'female'));

-- 3. ADD check constraint for gender on trainers
ALTER TABLE public.trainers DROP CONSTRAINT IF EXISTS chk_trainer_gender;
ALTER TABLE public.trainers ADD CONSTRAINT chk_trainer_gender CHECK (gender IN ('male', 'female'));

-- 4. NORMALIZE and validate trainer_applications gender
UPDATE public.trainer_applications SET gender = 'male' WHERE LOWER(gender) IN ('m', 'male', 'boy', 'guy');
UPDATE public.trainer_applications SET gender = 'female' WHERE LOWER(gender) IN ('f', 'female', 'girl', 'woman');

-- Suspend/de-verify any trainers with invalid gender applications to hide them from booking systems
UPDATE public.trainers SET verified_badge = FALSE, gender = NULL WHERE name IN (
    SELECT full_name FROM public.trainer_applications WHERE gender IS NULL OR (LOWER(gender) NOT IN ('male', 'female'))
);

-- Add constraint to trainer_applications
ALTER TABLE public.trainer_applications DROP CONSTRAINT IF EXISTS chk_application_gender;
ALTER TABLE public.trainer_applications ADD CONSTRAINT chk_application_gender CHECK (gender IN ('male', 'female'));

-- 5. Normalize and validate user_profiles.trainer_preference
UPDATE public.user_profiles SET trainer_preference = 'no_preference' WHERE trainer_preference IS NULL OR (LOWER(trainer_preference) NOT IN ('male', 'female', 'no_preference'));
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_trainer_preference;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_trainer_preference CHECK (trainer_preference IN ('male', 'female', 'no_preference'));
