-- Input hardening: every free-text column written from the app is clamped to a
-- sane length and stripped of control characters before it hits the row. This
-- is defence in depth on top of the client-side maxLength caps, so a modified
-- client (or a direct PostgREST call) cannot store a multi-megabyte string.
--
-- Nothing is rejected here: values are trimmed/clamped, so existing app flows
-- keep working and never surface a database error to the user.

CREATE OR REPLACE FUNCTION public.virla_clean_line(v text, n int)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT left(
    btrim(
      regexp_replace(
        regexp_replace(replace(coalesce(v, ''), chr(0), ''), '[[:cntrl:]]', '', 'g'),
        '[ \t]{2,}', ' ', 'g'
      )
    ),
    n
  );
$fn$;

CREATE OR REPLACE FUNCTION public.virla_clean_block(v text, n int)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT left(
    btrim(
      regexp_replace(
        replace(replace(coalesce(v, ''), chr(0), ''), chr(13), ''),
        '[ \t]{2,}', ' ', 'g'
      )
    ),
    n
  );
$fn$;

CREATE OR REPLACE FUNCTION public.virla_enforce_text_limits()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  j jsonb := to_jsonb(NEW);
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF j ? 'name'   THEN NEW.name   := public.virla_clean_line(j->>'name', 60); END IF;
    IF j ? 'email'  THEN NEW.email  := public.virla_clean_line(j->>'email', 254); END IF;
    IF j ? 'phone'  THEN NEW.phone  := public.virla_clean_line(j->>'phone', 20); END IF;
    IF j ? 'avatar' THEN NEW.avatar := public.virla_clean_line(j->>'avatar', 512); END IF;

  ELSIF TG_TABLE_NAME = 'user_profiles' THEN
    IF j ? 'medical_notes'      THEN NEW.medical_notes      := public.virla_clean_block(j->>'medical_notes', 1000); END IF;
    IF j ? 'height'             THEN NEW.height             := public.virla_clean_line(j->>'height', 20); END IF;
    IF j ? 'weight'             THEN NEW.weight             := public.virla_clean_line(j->>'weight', 20); END IF;
    IF j ? 'fitness_goal'       THEN NEW.fitness_goal       := public.virla_clean_line(j->>'fitness_goal', 80); END IF;
    IF j ? 'preferred_workout'  THEN NEW.preferred_workout  := public.virla_clean_line(j->>'preferred_workout', 120); END IF;
    IF j ? 'dob'                THEN NEW.dob                := public.virla_clean_line(j->>'dob', 20); END IF;

  ELSIF TG_TABLE_NAME = 'chat_messages' THEN
    IF j ? 'chat_id' THEN NEW.chat_id := public.virla_clean_line(j->>'chat_id', 120); END IF;
    IF j ? 'text'    THEN NEW.text    := public.virla_clean_block(j->>'text', 2000); END IF;

  ELSIF TG_TABLE_NAME = 'addresses' THEN
    IF j ? 'label'     THEN NEW.label     := public.virla_clean_line(j->>'label', 40); END IF;
    IF j ? 'name'      THEN NEW.name      := public.virla_clean_line(j->>'name', 80); END IF;
    IF j ? 'building'  THEN NEW.building  := public.virla_clean_line(j->>'building', 120); END IF;
    IF j ? 'street'    THEN NEW.street    := public.virla_clean_line(j->>'street', 200); END IF;
    IF j ? 'landmark'  THEN NEW.landmark  := public.virla_clean_line(j->>'landmark', 120); END IF;
    IF j ? 'city'      THEN NEW.city      := public.virla_clean_line(j->>'city', 60); END IF;
    IF j ? 'pin_code'  THEN NEW.pin_code  := public.virla_clean_line(j->>'pin_code', 10); END IF;

  ELSIF TG_TABLE_NAME = 'support_tickets' THEN
    IF j ? 'user_name'            THEN NEW.user_name            := public.virla_clean_line(j->>'user_name', 80); END IF;
    IF j ? 'user_phone'           THEN NEW.user_phone           := public.virla_clean_line(j->>'user_phone', 20); END IF;
    IF j ? 'category'             THEN NEW.category             := public.virla_clean_line(j->>'category', 60); END IF;
    IF j ? 'reason'               THEN NEW.reason               := public.virla_clean_line(j->>'reason', 200); END IF;
    IF j ? 'description'          THEN NEW.description          := public.virla_clean_block(j->>'description', 2000); END IF;
    IF j ? 'preferred_resolution' THEN NEW.preferred_resolution := public.virla_clean_line(j->>'preferred_resolution', 200); END IF;

  ELSIF TG_TABLE_NAME = 'trainer_applications' THEN
    IF j ? 'full_name'              THEN NEW.full_name              := public.virla_clean_line(j->>'full_name', 80); END IF;
    IF j ? 'email'                  THEN NEW.email                  := public.virla_clean_line(j->>'email', 254); END IF;
    IF j ? 'phone'                  THEN NEW.phone                  := public.virla_clean_line(j->>'phone', 20); END IF;
    IF j ? 'dob'                    THEN NEW.dob                    := public.virla_clean_line(j->>'dob', 20); END IF;
    IF j ? 'gender'                 THEN NEW.gender                 := public.virla_clean_line(j->>'gender', 20); END IF;
    IF j ? 'avatar'                 THEN NEW.avatar                 := public.virla_clean_line(j->>'avatar', 512); END IF;
    IF j ? 'address'                THEN NEW.address                := public.virla_clean_line(j->>'address', 250); END IF;
    IF j ? 'city'                   THEN NEW.city                   := public.virla_clean_line(j->>'city', 60); END IF;
    IF j ? 'state'                  THEN NEW.state                  := public.virla_clean_line(j->>'state', 60); END IF;
    IF j ? 'pin_code'               THEN NEW.pin_code               := public.virla_clean_line(j->>'pin_code', 10); END IF;
    IF j ? 'primary_workout'        THEN NEW.primary_workout        := public.virla_clean_line(j->>'primary_workout', 60); END IF;
    IF j ? 'secondary_skills'       THEN NEW.secondary_skills       := public.virla_clean_line(j->>'secondary_skills', 200); END IF;
    IF j ? 'languages'              THEN NEW.languages              := public.virla_clean_line(j->>'languages', 120); END IF;
    IF j ? 'about_me'               THEN NEW.about_me               := public.virla_clean_block(j->>'about_me', 1500); END IF;
    IF j ? 'fitness_qualifications' THEN NEW.fitness_qualifications := public.virla_clean_block(j->>'fitness_qualifications', 1000); END IF;
  END IF;

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
