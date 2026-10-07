import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";
import { NavbarAuth } from "@/components/NavbarAuth";

const features = [
  {
    title: "Sync z Google Kalendáře",
    desc: "Prohlídky se načtou automaticky každý večer. Stačí správně zapsat událost.",
  },
  {
    title: "SMS 2 hodiny a 1 hodinu předem",
    desc: "Šablona s adresou a časem, odeslaná přes SMSbrána.cz.",
  },
  {
    title: "Potvrzení od klienta",
    desc: "AI vyhodnotí odpověď klienta jako ano, ne nebo nejasné a aktualizuje stav.",
  },
  {
    title: "AI telefonní hovor",
    desc: "VAPI asistent zavolá klientovi 30 minut před prohlídkou.",
  },
  {
    title: "Telegram notifikace",
    desc: "Při každém odeslání SMS nebo odpovědi klienta dostanete zprávu.",
  },
  {
    title: "Vlastní připomínky",
    desc: "Přidejte libovolný počet připomínek, SMS nebo hovor v čase, který si nastavíte.",
  },
  {
    title: "Přehled prohlídek",
    desc: "Seznam i kalendářový pohled se stavy, které se mění v reálném čase.",
  },
];

const timeline = [
  { at: "15:00", what: "SMS: připomínka dvě hodiny předem", state: "Odesláno" },
  { at: "16:00", what: "SMS: připomínka hodinu předem", state: "Odesláno" },
  { at: "16:30", what: "AI hovor klientovi", state: "Potvrzeno" },
  { at: "17:00", what: "Prohlídka", state: "Klient potvrdil" },
];

export default async function HomePage() {
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
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Renote" width={44} height={44} className="h-11 w-11" priority />
            <span className="font-display text-2xl font-medium text-foreground">Renote</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#jak-to-funguje" className="hover:text-foreground transition-colors">Jak to funguje</a>
            <a href="#funkce" className="hover:text-foreground transition-colors">Funkce</a>
          </nav>
          <nav className="flex items-center gap-3">
            <NavbarAuth />
          </nav>
        </div>
      </header>

      <section className="container grid items-center gap-16 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div>
          <p className="text-base font-medium text-primary">Software pro realitní makléře</p>
          <h1 className="mt-3 font-display text-5xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Klienti dostanou připomínku prohlídky. Vy na ni nemusíte myslet.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Renote hlídá váš Google Kalendář a sám posílá klientům SMS i telefonické
            připomínky před každou prohlídkou nemovitosti. Vy v přehledu vidíte, kdo potvrdil.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Začít zdarma
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-2 py-3 text-base font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              Už mám účet
            </Link>
          </div>
        </div>

        <figure className="rounded-lg border border-border bg-card p-6 sm:p-8">
          <figcaption className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
            <span className="font-display text-xl font-medium">Prohlídka, Korunní 42</span>
            <span className="text-sm text-muted-foreground">středa 17:00</span>
          </figcaption>

          <ol className="relative mt-6 space-y-6 border-l border-border pl-6">
            {timeline.map((step) => (
              <li key={step.at} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-foreground" aria-hidden />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm tabular-nums text-muted-foreground">{step.at}</span>
                  <span className="text-sm font-medium text-emerald">{step.state}</span>
                </div>
                <p className="mt-1 text-base">{step.what}</p>
              </li>
            ))}
          </ol>
        </figure>
      </section>

      <section id="jak-to-funguje" className="border-t border-border py-20">
        <div className="container">
          <h2 className="font-display text-3xl font-medium tracking-tight">Jak to funguje</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Zapíšete prohlídku do kalendáře",
                desc: "Do události v Google Kalendáři přidáte adresu a telefon klienta. Renote si ji každý večer sám načte.",
              },
              {
                n: "2",
                title: "Renote pošle připomínky",
                desc: "Klientovi odejde SMS dvě a jednu hodinu předem, volitelně i AI hovor 30 minut před prohlídkou.",
              },
              {
                n: "3",
                title: "Vidíte, kdo potvrdil",
                desc: "AI vyhodnotí odpověď klienta a stav prohlídky se v dashboardu aktualizuje sám.",
              },
            ].map((step) => (
              <li key={step.n}>
                <span className="font-display text-sm text-primary">Krok {step.n}</span>
                <h3 className="mt-2 text-lg font-medium text-foreground">{step.title}</h3>
                <p className="mt-2 text-muted-foreground">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="funkce" className="border-t border-border py-20">
        <div className="container grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-3xl font-medium tracking-tight">Co všechno Renote umí</h2>
            <p className="mt-3 max-w-sm text-muted-foreground">
              Celý postup od zapsání prohlídky po potvrzení klientem bez ruční práce.
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {features.map((f) => (
              <li key={f.title} className="grid gap-2 py-6 sm:grid-cols-[1fr_1.4fr] sm:gap-10">
                <h3 className="font-medium text-foreground">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-primary py-20 text-primary-foreground">
        <div className="container flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Nastavení trvá méně než pět minut.
            </h2>
            <p className="mt-3 max-w-xl text-primary-foreground/80">
              Zaregistrujte se, propojte Google Kalendář a první prohlídka se připomene sama.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-background px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-background/90"
          >
            Začít zdarma
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
            <span className="font-display font-medium text-foreground">Renote</span>
          </div>
          <p>© {new Date().getFullYear()} Renote</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Ochrana osobních údajů</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Podmínky užití</Link>
            <Link href="/login" className="transition-colors hover:text-foreground">Přihlásit se</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
