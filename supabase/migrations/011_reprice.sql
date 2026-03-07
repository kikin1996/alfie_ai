-- Přecenění plánů: 99 / 149 / 249 Kč + nové Stripe price IDs
UPDATE subscription_plans SET price_czk = 99,  stripe_price_id = 'price_1T8S3d7YJf5YvqAeAmyWq4Xp' WHERE id = 'starter';
UPDATE subscription_plans SET price_czk = 149, stripe_price_id = 'price_1T8S3d7YJf5YvqAeuyDJBZfC' WHERE id = 'pro';
UPDATE subscription_plans SET price_czk = 249, stripe_price_id = 'price_1T8S3d7YJf5YvqAeMkz39Qo8' WHERE id = 'business';
