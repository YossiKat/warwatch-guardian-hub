
-- Bot polling state (singleton)
CREATE TABLE public.telegram_bot_state (
  id INT PRIMARY KEY CHECK (id = 1),
  update_offset BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Telegram groups being monitored
CREATE TABLE public.telegram_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'group',
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Telegram messages
CREATE TABLE public.telegram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  update_id BIGINT NOT NULL UNIQUE,
  chat_id BIGINT NOT NULL,
  message_id BIGINT,
  sender_name TEXT,
  text TEXT,
  message_date TIMESTAMPTZ,
  content_hash TEXT,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES public.telegram_messages(id),
  severity TEXT DEFAULT 'low',
  tags TEXT[] DEFAULT '{}',
  raw_update JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_content_hash ON public.telegram_messages (content_hash);
CREATE INDEX idx_telegram_messages_created_at ON public.telegram_messages (created_at DESC);

-- Enable RLS
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Public read access for the war room display
CREATE POLICY "Anyone can view telegram groups" ON public.telegram_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can view telegram messages" ON public.telegram_messages FOR SELECT USING (true);

-- Service role only for writes (edge functions use service role)
-- No insert/update/delete policies for anon = only service_role can write

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_messages;

-- Update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_telegram_groups_updated_at
  BEFORE UPDATE ON public.telegram_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
