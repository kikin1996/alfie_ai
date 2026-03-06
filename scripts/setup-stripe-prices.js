// Jednorázový script: vytvoří Stripe produkty + ceny a uloží price_id do Supabase
// Spustit: node scripts/setup-stripe-prices.js

const Stripe = require("stripe");

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Chybí env proměnné. Spusť s: STRIPE_SECRET_KEY=... node scripts/setup-stripe-prices.js");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2026-02-25.clover" });

const PLANS = [
  { id: "starter",  name: "Starter",      priceCzk: 399,  credits: 30 },
  { id: "pro",      name: "Profesionál",  priceCzk: 899,  credits: 50 },
  { id: "business", name: "Business",     priceCzk: 1999, credits: 100 },
];

async function supabaseUpdate(planId, stripePriceId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${planId}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({ stripe_price_id: stripePriceId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed for ${planId}: ${text}`);
  }
}

async function run() {
  for (const plan of PLANS) {
    console.log(`\nZpracovávám plán: ${plan.name} (${plan.priceCzk} Kč, ${plan.credits} kreditů)`);

    // Vytvořit produkt
    const product = await stripe.products.create({
      name: `ViewingBot ${plan.name}`,
      metadata: { plan_id: plan.id, credits: String(plan.credits) },
    });
    console.log(`  Produkt vytvořen: ${product.id}`);

    // Vytvořit měsíční cenu v CZK
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.priceCzk * 100, // haléře
      currency: "czk",
      recurring: { interval: "month" },
      metadata: { plan_id: plan.id },
    });
    console.log(`  Cena vytvořena: ${price.id}`);

    // Uložit do Supabase
    await supabaseUpdate(plan.id, price.id);
    console.log(`  Uloženo do Supabase ✓`);
  }

  console.log("\n✅ Hotovo! Stripe ceny jsou nastaveny.");
}

run().catch((err) => {
  console.error("Chyba:", err.message);
  process.exit(1);
});
