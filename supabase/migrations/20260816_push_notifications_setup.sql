-- Migration: Setup Push Notification Token Storage, Audit Logs, and Triggers
-- Created At: 2026-08-16

-- Enable pg_net extension (for async http push calls to Expo API)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create device_tokens table
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id TEXT PRIMARY KEY DEFAULT ('tok-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- Disable Row Level Security to match existing database access patterns
ALTER TABLE public.device_tokens DISABLE ROW LEVEL SECURITY;

-- Create push_delivery_logs table
CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
    id TEXT PRIMARY KEY DEFAULT ('pushlog-' || (extract(epoch from now()) * 1000)::text || '-' || floor(random() * 1000000)::text),
    notification_id TEXT,
    user_id TEXT,
    device_token TEXT,
    platform TEXT,
    sent_at TIMESTAMPTZ DEFAULT now(),
    payload JSONB
);

-- Disable Row Level Security
ALTER TABLE public.push_delivery_logs DISABLE ROW LEVEL SECURITY;

-- Create Postgres Trigger function to automatically fire push notifications via pg_net when notifications table row is inserted
CREATE OR REPLACE FUNCTION public.on_notification_inserted()
RETURNS trigger AS $$
DECLARE
  token_row record;
  payload jsonb;
  body_meta jsonb;
  msg_body text;
  msg_deep_link text;
  sound_name text;
  chan_id text;
BEGIN
  -- Attempt to parse body as JSON metadata
  BEGIN
    body_meta := NEW.body::jsonb;
    msg_body := body_meta->>'body';
    msg_deep_link := body_meta->>'deepLink';
  EXCEPTION WHEN OTHERS THEN
    body_meta := NULL;
    msg_body := NEW.body;
    msg_deep_link := '';
  END;

  -- Determine sound and channel based on title and content keywords
  IF NEW.title LIKE '%Reminder%' OR NEW.title LIKE '%reminder%' THEN
    sound_name := 'virla_reminder.wav';
    chan_id := 'virla_session_reminders';
  ELSIF NEW.title LIKE '%Cancel%' OR NEW.title LIKE '%cancel%' OR NEW.title LIKE '%Book%' OR NEW.title LIKE '%Assign%' THEN
    sound_name := 'virla_notification.wav';
    chan_id := 'virla_bookings';
  ELSE
    sound_name := 'default';
    chan_id := 'virla_general';
  END IF;

  -- Loop through active tokens for this user
  FOR token_row IN 
    SELECT token, platform 
    FROM public.device_tokens 
    WHERE user_id = NEW.user_id
  LOOP
    -- Construct payload for Expo Push API
    payload := json_build_object(
      'to', token_row.token,
      'title', NEW.title,
      'body', msg_body,
      'sound', sound_name,
      'channelId', chan_id,
      'data', json_build_object(
        'deepLink', msg_deep_link,
        'notificationId', NEW.id
      )
    );

    -- Call Expo Push API asynchronously using pg_net
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Log the delivery attempt
    INSERT INTO public.push_delivery_logs (notification_id, user_id, device_token, platform, payload)
    VALUES (NEW.id, NEW.user_id, token_row.token, token_row.platform, payload);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if already exists
DROP TRIGGER IF EXISTS trg_notification_inserted ON public.notifications;

-- Create the trigger
CREATE TRIGGER trg_notification_inserted
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.on_notification_inserted();
