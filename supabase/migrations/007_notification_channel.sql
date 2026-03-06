ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notification_channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS notification_email text;
