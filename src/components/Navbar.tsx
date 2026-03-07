"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Settings, LayoutDashboard, LogOut, ShieldCheck, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
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
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <CalendarDays className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">
            Alfie
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/subscription"
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted ${
              credits !== null && credits < 5
                ? "border-destructive/50 bg-destructive/10"
                : credits !== null && credits < 15
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-border bg-muted/60"
            }`}
          >
            <Coins className={`h-4 w-4 ${
              credits !== null && credits < 5 ? "text-destructive" :
              credits !== null && credits < 15 ? "text-amber-600" :
              "text-primary"
            }`} />
            <span className={`font-bold ${
              credits !== null && credits < 5 ? "text-destructive" :
              credits !== null && credits < 15 ? "text-amber-700" :
              "text-foreground"
            }`}>
              {credits ?? 0}
            </span>
            <span className="text-muted-foreground text-xs">kr.</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname === "/admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Odhlásit
          </Button>
        </nav>
      </div>
    </header>
  );
}
