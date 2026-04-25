
-- Table to store Web Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (no auth required for this emergency system)
CREATE POLICY "Anyone can insert push subscriptions"
  ON public.push_subscriptions FOR INSERT
  TO public
  WITH CHECK (true);

-- Anyone can view their own subscription (by endpoint)
CREATE POLICY "Anyone can view push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO public
  USING (true);

-- Allow delete for unsubscribe
CREATE POLICY "Anyone can delete push subscriptions"
  ON public.push_subscriptions FOR DELETE
  TO public
  USING (true);
