"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Settings, LayoutDashboard, LogOut, ShieldCheck, Coins, CreditCard, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Předplatné", icon: CreditCard, path: "/subscription" },
  { label: "Nastavení", icon: Settings, path: "/settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = adminEmail && user?.email === adminEmail;

  useEffect(() => {
    if (!user) return;
    fetch("/api/subscription")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setCredits(data.creditsRemaining ?? null); })
      .catch(() => {});
  }, [user]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/logo.png"
            alt="Renote"
            width={54}
            height={54}
            className="h-[54px] w-[54px] transition-transform group-hover:scale-105"
            priority
          />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Renote
          </span>
        </Link>

        <div className="flex items-center gap-2">
        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const isSubscription = item.path === "/subscription";
            const lowCredits = credits !== null && credits < 5;
            const medCredits = credits !== null && credits >= 5 && credits < 15;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 border-b-2 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {isSubscription && credits !== null && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                    lowCredits
                      ? "bg-destructive text-destructive-foreground"
                      : medCredits
                      ? "bg-pending-bg0 text-white"
                      : isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-emerald-bg text-emerald"
                  }`}>
                    <Coins className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                    {credits}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-2 border-b-2 py-2 text-sm font-medium transition-colors ${
                pathname === "/admin"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Odhlásit</span>
        </Button>
        </div>
      </div>
    </header>
  );
}
