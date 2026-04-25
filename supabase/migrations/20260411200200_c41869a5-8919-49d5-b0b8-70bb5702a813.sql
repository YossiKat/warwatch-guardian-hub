-- Remove the CHECK constraint if it exists (allow multiple rows)
ALTER TABLE public.telegram_bot_state DROP CONSTRAINT IF EXISTS telegram_bot_state_id_check;

-- Add bot_name column
ALTER TABLE public.telegram_bot_state ADD COLUMN bot_name text NOT NULL DEFAULT 'warroom_control';

-- Update existing row
UPDATE public.telegram_bot_state SET bot_name = 'warroom_control' WHERE id = 1;

-- Insert rows for red and blue bots
INSERT INTO public.telegram_bot_state (id, update_offset, bot_name) VALUES (2, 0, 'red_bot') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.telegram_bot_state (id, update_offset, bot_name) VALUES (3, 0, 'blue_bot') ON CONFLICT (id) DO NOTHING;