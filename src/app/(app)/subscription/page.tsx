"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, CreditCard, Zap, Building2, ExternalLink } from "lucide-react";
import type { SubscriptionPlan, UserSubscription } from "@/types";

function PlanIcon({ planId }: { planId: string }) {
  if (planId === "business") return <Building2 className="h-6 w-6" />;
  if (planId === "pro") return <Zap className="h-6 w-6" />;
  return <CreditCard className="h-6 w-6" />;
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["30 kreditů / měsíc", "SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Emailová podpora"],
  pro: ["50 kreditů / měsíc", "SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Prioritní podpora"],
  business: ["100 kreditů / měsíc", "SMS notifikace (1 kredit)", "VAPI hovory (5 kreditů)", "Dedikovaná podpora"],
};

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successParam = searchParams?.get("success");
  const cancelledParam = searchParams?.get("cancelled");

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Předplatné</h1>
        <p className="text-muted-foreground mt-1">Vyberte plán, který vyhovuje vašim potřebám.</p>
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Plány */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const features = PLAN_FEATURES[plan.id] ?? [];
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Aktivní
                  </span>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <PlanIcon planId={plan.id} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription className="text-base font-semibold text-foreground">
                      {plan.priceCzk} Kč / měsíc
                    </CardDescription>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                )}
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
                    /* Uživatel má sub → změna přes portal */
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
                    /* Nový zákazník → Stripe Checkout */
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
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Platba probíhá bezpečně přes Stripe. Kredity se automaticky obnovují každý měsíc.
        SMS = 1 kredit, VAPI hovor = 5 kreditů.
      </p>
    </div>
  );
}
