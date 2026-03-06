-- Přidat stripe_price_id sloupec do subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Přidat stripe_customer_id a stripe_subscription_id do user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Aktualizovat kredity plánů: 30 / 50 / 100 + Stripe price IDs
UPDATE public.subscription_plans SET
  credits_per_month = 30,
  stripe_price_id = 'price_1T86iI7YJf5YvqAeMhobfK9z',
  description = 'Vhodné pro menší realitní kanceláře – až 30 SMS nebo 6 hovorů měsíčně.'
WHERE id = 'starter';

UPDATE public.subscription_plans SET
  credits_per_month = 50,
  stripe_price_id = 'price_1T86jI7YJf5YvqAelo8ey5fx',
  description = 'Pro aktivní makléře – až 50 SMS nebo 10 hovorů měsíčně.'
WHERE id = 'pro';

UPDATE public.subscription_plans SET
  credits_per_month = 100,
  stripe_price_id = 'price_1T86jJ7YJf5YvqAec35b8rXC',
  description = 'Bez omezení pro velké kanceláře – až 100 SMS nebo 20 hovorů měsíčně.'
WHERE id = 'business';
