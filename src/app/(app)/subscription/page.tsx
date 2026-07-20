"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, CreditCard, Zap, Building2, ExternalLink, Plus } from "lucide-react";
import type { SubscriptionPlan, UserSubscription } from "@/types";
import { CREDIT_PACKS } from "@/lib/creditPacks";

function PlanIcon({ planId }: { planId: string }) {
  if (planId === "business") return <Building2 className="h-6 w-6" />;
  if (planId === "pro") return <Zap className="h-6 w-6" />;
  return <CreditCard className="h-6 w-6" />;
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Emailová podpora"],
  pro: ["SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Prioritní podpora"],
  business: ["SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Dedikovaná podpora"],
};

function PlanDiscount(plan: SubscriptionPlan, basePricePerCredit: number): number | null {
  if (!plan.creditsPerMonth || !plan.priceCzk) return null;
  const pricePerCredit = plan.priceCzk / plan.creditsPerMonth;
  const saving = Math.round((1 - pricePerCredit / basePricePerCredit) * 100);
  return saving > 0 ? saving : null;
}

function SubscriptionPageInner() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successParam = searchParams?.get("success");
  const cancelledParam = searchParams?.get("cancelled");
  const topupParam = searchParams?.get("topup");

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch("/api/subscription/plans"),
          fetch("/api/subscription"),
        ]);
        if (plansRes.ok) setPlans(await plansRes.json());
        if (subRes.ok) {
          const data = await subRes.json();
          setSubscription(data);
        }
      } catch {
        setError("Nepodařilo se načíst data předplatného.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelect = async (planId: string) => {
    if (redirecting) return;
    setRedirecting(planId);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Chyba při vytváření platby.");
        setRedirecting(null);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError("Nepodařilo se spustit platbu.");
      setRedirecting(null);
    }
  };

  const handleBuyCredits = async (packId: string) => {
    if (redirecting) return;
    setRedirecting(packId);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Chyba při vytváření platby.");
        setRedirecting(null);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError("Nepodařilo se spustit platbu.");
      setRedirecting(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Nepodařilo se otevřít správu předplatného.");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError("Nepodařilo se otevřít správu předplatného.");
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlanId = subscription?.planId;
  const creditsRemaining = subscription?.creditsRemaining ?? 0;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString("cs-CZ")
    : null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-white shadow-soft">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Předplatné</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vyberte plán, který vyhovuje vašim potřebám.</p>
        </div>
      </div>

      {successParam && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Platba proběhla úspěšně. Váš plán bude aktivován během pár sekund.
        </div>
      )}
      {cancelledParam && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Platba byla zrušena. Můžete to zkusit znovu kdykoliv.
        </div>
      )}
      {topupParam && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Platba proběhla úspěšně. Kredity budou přičteny během pár sekund.
        </div>
      )}

      {/* Stav kreditů */}
      {subscription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aktuální stav</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Plán</p>
              <p className="font-semibold">{subscription.plan?.name ?? currentPlanId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Zbývající kredity</p>
              <p className="font-semibold text-primary">{creditsRemaining}</p>
            </div>
            {periodEnd && (
              <div>
                <p className="text-muted-foreground">Obnovení</p>
                <p className="font-semibold">{periodEnd}</p>
              </div>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Zrušit / upravit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-soft">
          {error}
        </div>
      )}

      {/* Přikoupení kreditů – POUZE pro aktivní předplatné */}
      {subscription?.status === "active" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Přikoupit kredity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Došly vám kredity dřív, než se předplatné obnoví? Dokupte si je jednorázově.
              Přičtou se k vašim stávajícím kreditům.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack) => {
                const pricePerCredit = (pack.priceCzk / pack.credits).toFixed(2).replace(".", ",");
                return (
                  <div
                    key={pack.id}
                    className={`relative flex flex-col rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${pack.popular ? "border-navy ring-2 ring-navy/15 shadow-lifted" : "border-border/60 shadow-xs"}`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-navy px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground shadow-soft">
                        Nejoblíbenější
                      </span>
                    )}
                    <p className="text-lg font-bold text-foreground">{pack.credits} kreditů</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{pack.priceCzk} Kč</span>
                      <span> · {pricePerCredit} Kč / kredit</span>
                    </p>
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      variant={pack.popular ? "default" : "outline"}
                      disabled={redirecting !== null}
                      onClick={() => handleBuyCredits(pack.id)}
                    >
                      {redirecting === pack.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Koupit
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plány */}
      <div className="grid gap-6 md:grid-cols-3">
        {(() => {
          const starterPlan = plans.find((p) => p.id === "starter");
          const basePricePerCredit = starterPlan && starterPlan.creditsPerMonth
            ? starterPlan.priceCzk / starterPlan.creditsPerMonth
            : 99 / 30;
          return plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const features = PLAN_FEATURES[plan.id] ?? [];
          const discount = PlanDiscount(plan, basePricePerCredit);
          const pricePerCredit = plan.creditsPerMonth
            ? (plan.priceCzk / plan.creditsPerMonth).toFixed(2).replace(".", ",")
            : null;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all hover:-translate-y-1 hover:shadow-lifted ${isCurrent ? "border-navy ring-2 ring-navy/20 shadow-lifted" : ""}`}
            >
              {/* Aktivní badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-navy px-3 py-0.5 text-xs font-medium text-primary-foreground shadow-soft">
                    Aktivní
                  </span>
                </div>
              )}
              {/* Sleva badge (pouze ne-Starter plány) */}
              {!isCurrent && discount && (
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-medium text-white">
                    Ušetříte {discount} %
                  </span>
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <PlanIcon planId={plan.id} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                </div>

                {/* Cena */}
                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{plan.priceCzk}</span>
                    <span className="text-lg font-semibold text-foreground">Kč</span>
                    <span className="text-sm text-muted-foreground">/ měsíc</span>
                  </div>
                  {plan.creditsPerMonth && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{plan.creditsPerMonth} kreditů</span>
                      {pricePerCredit && (
                        <span> · {pricePerCredit} Kč / kredit</span>
                      )}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-4">
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2 flex flex-col gap-2">
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Aktuální plán
                    </Button>
                  ) : subscription ? (
                    <Button
                      className="w-full"
                      variant="default"
                      disabled={portalLoading}
                      onClick={handlePortal}
                    >
                      {portalLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Přejít na {plan.name}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={redirecting !== null}
                      onClick={() => handleSelect(plan.id)}
                    >
                      {redirecting === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Předplatit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        });
        })()}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Platba probíhá bezpečně přes Stripe. Kredity se automaticky obnovují každý měsíc.
        SMS = 1 kredit, VAPI hovor = 5 kreditů.
      </p>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionPageInner />
    </Suspense>
  );
}
