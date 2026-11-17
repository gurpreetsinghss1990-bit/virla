-- Final, self-contained version of the text-input guard.
--
-- Supersedes 20261107110000_input_text_limits.sql and
-- 20261107120000_fix_text_limits_null_char.sql. Safe to run whether or not
-- those two were applied: everything here is CREATE OR REPLACE + idempotent.
--
-- Fixes on top of them:
--   1. no NUL character in the helpers (that raised "null character not
--      permitted" on every write, which is what broke sign-up / login);
--   2. NULL stays NULL instead of silently becoming an empty string;
--   3. on UPDATE only the columns the client actually changed are cleaned, so
--      an old row that already holds a longer value is never truncated behind
--      the user's back;
--   4. addresses.apartment / floor / notes / gps_placeholder are clamped too
--      (the app writes them, the earlier version did not cover them);
--   5. a failure inside cleaning can never block a real write.

CREATE OR REPLACE FUNCTION public.virla_clean_line(v text, n int)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    ELSE left(
      btrim(
        regexp_replace(
          regexp_replace(v, '[[:cntrl:]]', '', 'g'),
          '[ \t]{2,}', ' ', 'g'
        )
      ),
      n
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.virla_clean_block(v text, n int)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    ELSE left(
      btrim(
        regexp_replace(
          replace(v, chr(13), ''),
          '[ \t]{2,}', ' ', 'g'
        )
      ),
      n
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.virla_enforce_text_limits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  j jsonb := to_jsonb(NEW);
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  upd boolean := TG_OP = 'UPDATE';
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF j ? 'name'   AND (NOT upd OR j->>'name'   IS DISTINCT FROM o->>'name')   THEN NEW.name   := public.virla_clean_line(j->>'name', 60); END IF;
    IF j ? 'email'  AND (NOT upd OR j->>'email'  IS DISTINCT FROM o->>'email')  THEN NEW.email  := public.virla_clean_line(j->>'email', 254); END IF;
    IF j ? 'phone'  AND (NOT upd OR j->>'phone'  IS DISTINCT FROM o->>'phone')  THEN NEW.phone  := public.virla_clean_line(j->>'phone', 20); END IF;
    IF j ? 'avatar' AND (NOT upd OR j->>'avatar' IS DISTINCT FROM o->>'avatar') THEN NEW.avatar := public.virla_clean_line(j->>'avatar', 512); END IF;

  ELSIF TG_TABLE_NAME = 'user_profiles' THEN
    IF j ? 'medical_notes'     AND (NOT upd OR j->>'medical_notes'     IS DISTINCT FROM o->>'medical_notes')     THEN NEW.medical_notes     := public.virla_clean_block(j->>'medical_notes', 1000); END IF;
    IF j ? 'height'            AND (NOT upd OR j->>'height'            IS DISTINCT FROM o->>'height')            THEN NEW.height            := public.virla_clean_line(j->>'height', 20); END IF;
    IF j ? 'weight'            AND (NOT upd OR j->>'weight'            IS DISTINCT FROM o->>'weight')            THEN NEW.weight            := public.virla_clean_line(j->>'weight', 20); END IF;
    IF j ? 'fitness_goal'      AND (NOT upd OR j->>'fitness_goal'      IS DISTINCT FROM o->>'fitness_goal')      THEN NEW.fitness_goal      := public.virla_clean_line(j->>'fitness_goal', 80); END IF;
    IF j ? 'preferred_workout' AND (NOT upd OR j->>'preferred_workout' IS DISTINCT FROM o->>'preferred_workout') THEN NEW.preferred_workout := public.virla_clean_line(j->>'preferred_workout', 120); END IF;
    IF j ? 'dob'               AND (NOT upd OR j->>'dob'               IS DISTINCT FROM o->>'dob')               THEN NEW.dob               := public.virla_clean_line(j->>'dob', 20); END IF;

  ELSIF TG_TABLE_NAME = 'chat_messages' THEN
    IF j ? 'chat_id' AND (NOT upd OR j->>'chat_id' IS DISTINCT FROM o->>'chat_id') THEN NEW.chat_id := public.virla_clean_line(j->>'chat_id', 120); END IF;
    IF j ? 'text'    AND (NOT upd OR j->>'text'    IS DISTINCT FROM o->>'text')    THEN NEW.text    := public.virla_clean_block(j->>'text', 2000); END IF;

  ELSIF TG_TABLE_NAME = 'addresses' THEN
    IF j ? 'label'           AND (NOT upd OR j->>'label'           IS DISTINCT FROM o->>'label')           THEN NEW.label           := public.virla_clean_line(j->>'label', 40); END IF;
    IF j ? 'name'            AND (NOT upd OR j->>'name'            IS DISTINCT FROM o->>'name')            THEN NEW.name            := public.virla_clean_line(j->>'name', 80); END IF;
    IF j ? 'building'        AND (NOT upd OR j->>'building'        IS DISTINCT FROM o->>'building')        THEN NEW.building        := public.virla_clean_line(j->>'building', 120); END IF;
    IF j ? 'street'          AND (NOT upd OR j->>'street'          IS DISTINCT FROM o->>'street')          THEN NEW.street          := public.virla_clean_line(j->>'street', 200); END IF;
    IF j ? 'landmark'        AND (NOT upd OR j->>'landmark'        IS DISTINCT FROM o->>'landmark')        THEN NEW.landmark        := public.virla_clean_line(j->>'landmark', 120); END IF;
    IF j ? 'city'            AND (NOT upd OR j->>'city'            IS DISTINCT FROM o->>'city')            THEN NEW.city            := public.virla_clean_line(j->>'city', 60); END IF;
    IF j ? 'pin_code'        AND (NOT upd OR j->>'pin_code'        IS DISTINCT FROM o->>'pin_code')        THEN NEW.pin_code        := public.virla_clean_line(j->>'pin_code', 10); END IF;
    IF j ? 'apartment'       AND (NOT upd OR j->>'apartment'       IS DISTINCT FROM o->>'apartment')       THEN NEW.apartment       := public.virla_clean_line(j->>'apartment', 40); END IF;
    IF j ? 'floor'           AND (NOT upd OR j->>'floor'           IS DISTINCT FROM o->>'floor')           THEN NEW.floor           := public.virla_clean_line(j->>'floor', 20); END IF;
    IF j ? 'notes'           AND (NOT upd OR j->>'notes'           IS DISTINCT FROM o->>'notes')           THEN NEW.notes           := public.virla_clean_block(j->>'notes', 500); END IF;
    IF j ? 'gps_placeholder' AND (NOT upd OR j->>'gps_placeholder' IS DISTINCT FROM o->>'gps_placeholder') THEN NEW.gps_placeholder := public.virla_clean_line(j->>'gps_placeholder', 120); END IF;

  ELSIF TG_TABLE_NAME = 'support_tickets' THEN
    IF j ? 'user_name'            AND (NOT upd OR j->>'user_name'            IS DISTINCT FROM o->>'user_name')            THEN NEW.user_name            := public.virla_clean_line(j->>'user_name', 80); END IF;
    IF j ? 'user_phone'           AND (NOT upd OR j->>'user_phone'           IS DISTINCT FROM o->>'user_phone')           THEN NEW.user_phone           := public.virla_clean_line(j->>'user_phone', 20); END IF;
    IF j ? 'category'             AND (NOT upd OR j->>'category'             IS DISTINCT FROM o->>'category')             THEN NEW.category             := public.virla_clean_line(j->>'category', 60); END IF;
    IF j ? 'reason'               AND (NOT upd OR j->>'reason'               IS DISTINCT FROM o->>'reason')               THEN NEW.reason               := public.virla_clean_line(j->>'reason', 200); END IF;
    IF j ? 'description'          AND (NOT upd OR j->>'description'          IS DISTINCT FROM o->>'description')          THEN NEW.description          := public.virla_clean_block(j->>'description', 2000); END IF;
    IF j ? 'preferred_resolution' AND (NOT upd OR j->>'preferred_resolution' IS DISTINCT FROM o->>'preferred_resolution') THEN NEW.preferred_resolution := public.virla_clean_line(j->>'preferred_resolution', 200); END IF;

  ELSIF TG_TABLE_NAME = 'trainer_applications' THEN
    IF j ? 'full_name'              AND (NOT upd OR j->>'full_name'              IS DISTINCT FROM o->>'full_name')              THEN NEW.full_name              := public.virla_clean_line(j->>'full_name', 80); END IF;
    IF j ? 'email'                  AND (NOT upd OR j->>'email'                  IS DISTINCT FROM o->>'email')                  THEN NEW.email                  := public.virla_clean_line(j->>'email', 254); END IF;
    IF j ? 'phone'                  AND (NOT upd OR j->>'phone'                  IS DISTINCT FROM o->>'phone')                  THEN NEW.phone                  := public.virla_clean_line(j->>'phone', 20); END IF;
    IF j ? 'dob'                    AND (NOT upd OR j->>'dob'                    IS DISTINCT FROM o->>'dob')                    THEN NEW.dob                    := public.virla_clean_line(j->>'dob', 20); END IF;
    IF j ? 'gender'                 AND (NOT upd OR j->>'gender'                 IS DISTINCT FROM o->>'gender')                 THEN NEW.gender                 := public.virla_clean_line(j->>'gender', 20); END IF;
    IF j ? 'avatar'                 AND (NOT upd OR j->>'avatar'                 IS DISTINCT FROM o->>'avatar')                 THEN NEW.avatar                 := public.virla_clean_line(j->>'avatar', 512); END IF;
    IF j ? 'address'                AND (NOT upd OR j->>'address'                IS DISTINCT FROM o->>'address')                THEN NEW.address                := public.virla_clean_line(j->>'address', 250); END IF;
    IF j ? 'city'                   AND (NOT upd OR j->>'city'                   IS DISTINCT FROM o->>'city')                   THEN NEW.city                   := public.virla_clean_line(j->>'city', 60); END IF;
    IF j ? 'state'                  AND (NOT upd OR j->>'state'                  IS DISTINCT FROM o->>'state')                  THEN NEW.state                  := public.virla_clean_line(j->>'state', 60); END IF;
    IF j ? 'pin_code'               AND (NOT upd OR j->>'pin_code'               IS DISTINCT FROM o->>'pin_code')               THEN NEW.pin_code               := public.virla_clean_line(j->>'pin_code', 10); END IF;
    IF j ? 'primary_workout'        AND (NOT upd OR j->>'primary_workout'        IS DISTINCT FROM o->>'primary_workout')        THEN NEW.primary_workout        := public.virla_clean_line(j->>'primary_workout', 60); END IF;
    IF j ? 'secondary_skills'       AND (NOT upd OR j->>'secondary_skills'       IS DISTINCT FROM o->>'secondary_skills')       THEN NEW.secondary_skills       := public.virla_clean_line(j->>'secondary_skills', 200); END IF;
    IF j ? 'languages'              AND (NOT upd OR j->>'languages'              IS DISTINCT FROM o->>'languages')              THEN NEW.languages              := public.virla_clean_line(j->>'languages', 120); END IF;
    IF j ? 'about_me'               AND (NOT upd OR j->>'about_me'               IS DISTINCT FROM o->>'about_me')               THEN NEW.about_me               := public.virla_clean_block(j->>'about_me', 1500); END IF;
    IF j ? 'fitness_qualifications' AND (NOT upd OR j->>'fitness_qualifications' IS DISTINCT FROM o->>'fitness_qualifications') THEN NEW.fitness_qualifications := public.virla_clean_block(j->>'fitness_qualifications', 1000); END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Cleaning must never stand between the user and the database.
    RETURN NEW;
END;
$fn$;

DO $att$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'user_profiles', 'chat_messages', 'addresses', 'support_tickets', 'trainer_applications']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'virla_text_limits_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.virla_enforce_text_limits()',
      'virla_text_limits_' || t, t
    );
  END LOOP;
END;
$att$;
