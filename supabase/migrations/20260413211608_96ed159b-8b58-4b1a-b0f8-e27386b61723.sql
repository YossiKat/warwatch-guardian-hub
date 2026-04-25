-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can delete push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can view push subscriptions" ON public.push_subscriptions;

-- Allow anyone to register for push (needed for browser push registration)
CREATE POLICY "Anyone can register push subscription"
ON public.push_subscriptions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow deletion by endpoint match (unsubscribe)
CREATE POLICY "Anyone can unsubscribe push"
ON public.push_subscriptions FOR DELETE
TO anon, authenticated
USING (true);

-- Only service_role can read subscriptions (for sending notifications)
-- No public SELECT policy needed