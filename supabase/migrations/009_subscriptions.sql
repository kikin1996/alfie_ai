-- Plány předplatného (statická referenční tabulka)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_czk integer NOT NULL,
  credits_per_month integer NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.subscription_plans (id, name, price_czk, credits_per_month, description, sort_order) VALUES
  ('starter',  'Starter',      399,   50,  'Vhodné pro menší realitní kanceláře – až 50 SMS nebo 10 hovorů měsíčně.',  1),
  ('pro',      'Profesionál',  899,  200,  'Pro aktivní makléře – až 200 SMS nebo 40 hovorů měsíčně.',                2),
  ('business', 'Business',    1999,  600,  'Bez omezení pro velké kanceláře – až 600 SMS nebo 120 hovorů měsíčně.',   3)
ON CONFLICT (id) DO NOTHING;

-- Uživatelská předplatná
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id     text        NOT NULL REFERENCES public.subscription_plans(id),
  credits_remaining integer NOT NULL,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end   timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  status      text        NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are public"
  ON public.subscription_plans FOR SELECT USING (true);

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);
