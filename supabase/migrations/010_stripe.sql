-- Přidat stripe_price_id sloupec do subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Přidat stripe_customer_id a stripe_subscription_id do user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Aktualizovat kredity plánů: 30 / 50 / 100
UPDATE public.subscription_plans SET
  credits_per_month = 30,
  description = 'Vhodné pro menší realitní kanceláře – až 30 SMS nebo 6 hovorů měsíčně.'
WHERE id = 'starter';

UPDATE public.subscription_plans SET
  credits_per_month = 50,
  description = 'Pro aktivní makléře – až 50 SMS nebo 10 hovorů měsíčně.'
WHERE id = 'pro';

UPDATE public.subscription_plans SET
  credits_per_month = 100,
  description = 'Bez omezení pro velké kanceláře – až 100 SMS nebo 20 hovorů měsíčně.'
WHERE id = 'business';
