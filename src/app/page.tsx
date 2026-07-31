import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { NavbarAuth } from "@/components/NavbarAuth";
import {
  CalendarDays,
  MessageSquare,
  Phone,
  Send,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  RefreshCw,
  Bell,
} from "lucide-react";

export default async function HomePage() {
  // Přihlášený uživatel → rovnou na dashboard
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) redirect("/dashboard");
  } catch {
    // chybějící env – pokračovat na landing page
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      {/* pastelový mesh gradient přes celou stránku */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-50 via-white to-violet-100" />
      <div className="pointer-events-none fixed -left-32 -top-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-violet-400/50 blur-[100px]" />
      <div className="pointer-events-none fixed -right-24 -top-16 -z-10 h-[28rem] w-[28rem] rounded-full bg-sky-300/50 blur-[100px]" />
      <div className="pointer-events-none fixed right-1/4 bottom-0 -z-10 h-80 w-80 rounded-full bg-pink-300/40 blur-[100px]" />
      <div className="pointer-events-none fixed left-1/4 bottom-0 -z-10 h-80 w-80 rounded-full bg-purple-300/40 blur-[100px]" />
      <div className="pointer-events-none fixed left-1/2 top-1/3 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-100/30 blur-[100px]" />

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-soft">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-navy">
              Renote
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <NavbarAuth />
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28 sm:py-36">
        {/* lesklá iridescentní koule */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full sm:h-80 sm:w-80"
          style={{
            backgroundImage:
              "conic-gradient(from 210deg at 40% 35%, #ddd6fe, #bfdbfe, #fbcfe8, #fef9c3, #ddd6fe)",
            boxShadow:
              "inset -24px -24px 50px rgba(30,20,60,0.25), inset 18px 18px 40px rgba(255,255,255,0.65), 0 30px 60px -15px rgba(109,40,217,0.35)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 3px, transparent 4px, transparent 14px)",
              mixBlendMode: "overlay",
            }}
          />
          <div className="absolute left-[18%] top-[14%] h-10 w-16 rounded-full bg-white/70 blur-md" />
        </div>

        <div className="container relative text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-4 py-1.5 text-sm text-muted-foreground shadow-soft backdrop-blur-sm">
            <CalendarDays className="h-4 w-4 text-navy" />
            Automatizace prohlídek nemovitostí
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Nikdy nezapomeňte připomenout{" "}
            <span className="bg-gradient-to-r from-navy to-accent-blue bg-clip-text text-transparent">
              prohlídku
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Renote propojí váš Google Kalendář s SMS notifikacemi a AI hovory.
            Klienti dostanou automatické připomínky – vy se soustředíte na prodej.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-7 py-3.5 text-base font-semibold text-white shadow-lifted transition-all hover:brightness-110 hover:shadow-glow"
            >
              Začít zdarma
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 shadow-soft transition-all hover:bg-slate-50"
            >
              Přihlásit se
            </Link>
          </div>
        </div>
      </section>

      {/* ── Jak to funguje ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-navy">
              Jak Renote funguje?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tři kroky a prohlídky se řídí samy.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                icon: CalendarDays,
                title: "Propojte Google Kalendář",
                desc: "Přidejte do události klíčové slovo (např. #prohlidka) a zadejte tel. číslo a adresu klienta. Renote si vše automaticky načte.",
                color: "bg-navy",
              },
              {
                step: "2",
                icon: MessageSquare,
                title: "SMS jdou samy",
                desc: "2 hodiny a 1 hodinu před prohlídkou odešle systém SMS s potvrzením. Klient odpoví ANO nebo NE – vy vidíte status v dashboardu.",
                color: "bg-accent-blue",
              },
              {
                step: "3",
                icon: Phone,
                title: "AI hovor 30 minut před",
                desc: "Volitelně zavolá AI asistent klientovi 30 minut před prohlídkou. Automaticky, bez vaší účasti.",
                color: "bg-navy",
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-all hover:-translate-y-1 hover:shadow-lifted">
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${item.color} text-white shadow-soft transition-transform group-hover:scale-110`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="absolute right-6 top-6 font-display text-5xl font-bold text-muted-foreground/15 select-none">
                  {item.step}
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-navy">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funkce ───────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-navy">
              Vše na jednom místě
            </h2>
            <p className="mt-3 text-muted-foreground">
              Komplexní řešení pro makléře i realitní kanceláře.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: RefreshCw,
                title: "Sync z Google Kalendáře",
                desc: "Automatický import prohlídek každý večer. Stačí správně zapsat událost.",
              },
              {
                icon: MessageSquare,
                title: "SMS 2h a 1h před",
                desc: "Šablona zprávy s adresou a časem, odeslaná přes SMSbrána.cz.",
              },
              {
                icon: CheckCircle2,
                title: "Potvrzení od klienta",
                desc: "AI analyzuje odpověď klienta (ANO / NE / nejasné) a aktualizuje status.",
              },
              {
                icon: Phone,
                title: "AI telefonní hovor",
                desc: "VAPI asistent zavolá klientovi 30 minut před prohlídkou.",
              },
              {
                icon: Send,
                title: "Telegram notifikace",
                desc: "Vy dostanete zprávu na Telegram při každém odeslání SMS nebo odpovědi klienta.",
              },
              {
                icon: Bell,
                title: "Vlastní notifikace",
                desc: "Přidejte libovolný počet připomínek – SMS nebo hovor v čase, který si nastavíte.",
              },
              {
                icon: LayoutDashboard,
                title: "Přehledný dashboard",
                desc: "Seznam a kalendářový pohled na všechny prohlídky se stavy v reálném čase.",
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lifted">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-blue/10">
                  <f.icon className="h-5 w-5 text-accent-blue" />
                </div>
                <div>
                  <h3 className="font-medium text-navy">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white/60 px-6 py-16 text-center shadow-lifted backdrop-blur-xl sm:py-20">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-accent-blue/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Připraveni automatizovat prohlídky?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Zaregistrujte se a propojte svůj Google Kalendář. Nastavení trvá méně než 5 minut.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-8 py-3.5 text-base font-semibold text-white shadow-lifted transition-all hover:brightness-110 hover:shadow-glow"
                >
                  Začít zdarma
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-soft transition-all hover:bg-slate-50"
                >
                  Mám účet – přihlásit se
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border/70 py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-navy" />
            <span className="font-display font-semibold text-navy">Renote</span>
          </div>
          <p>© {new Date().getFullYear()} Renote. Všechna práva vyhrazena.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Přihlásit se</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Registrovat se</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
