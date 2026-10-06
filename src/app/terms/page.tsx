import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Podmínky užití | Renote",
  description: "Podmínky užití aplikace Renote.",
};

export default function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">

      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Renote" width={54} height={54} className="h-[54px] w-[54px]" priority />
            <span className="font-display text-lg font-bold tracking-tight text-navy">Renote</span>
          </Link>
          <nav>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Zpět na hlavní stránku
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-3xl py-16">
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          Podmínky užití
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Platné od 28. 9. 2026
        </p>

        <div className="prose prose-slate mt-10 max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold text-navy">1. O službě</h2>
            <p>
              Renote je webová aplikace, která realitním makléřům automatizuje připomínky
              prohlídek nemovitostí prostřednictvím SMS zpráv a hlasových hovorů, na základě
              událostí v jejich Google Kalendáři.
            </p>
            <p>
              Službu poskytuje <strong>Lazy Duck s.r.o.</strong>, IČO 23505842, se sídlem 28. října 810/246,
              Mariánské Hory, 709 00 Ostrava, zapsaná v obchodním rejstříku vedeném Krajským soudem
              v Ostravě, spisová značka C 100223.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">2. Registrace a účet</h2>
            <p>
              Pro použití aplikace je nutné se přihlásit přes Google účet. Uživatel odpovídá za
              zabezpečení svého přihlášení a za pravdivost údajů, které do aplikace vloží
              (zejména telefonní čísla a adresy klientů).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">3. Propojení s Google účtem</h2>
            <p>
              Aplikace vyžaduje přístup ke Google Kalendáři pro čtení a synchronizaci událostí
              prohlídek. U administrátorského účtu makléře může být navíc povoleno čtení Gmailu
              výhradně za účelem automatického načítání poptávek ze S Reality. Rozsah použití
              těchto dat popisují{" "}
              <Link href="/privacy" className="text-accent-blue hover:underline">
                Zásady ochrany osobních údajů
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">4. Odpovědnost</h2>
            <p>
              Renote se snaží zajistit spolehlivé doručování SMS a hovorů, ale nemůže garantovat
              stoprocentní dostupnost třetích stran (SMSbrána.cz, VAPI.ai, Google, Telegram),
              na kterých služba závisí. Aplikace je poskytována „tak jak je", bez záruky
              nepřetržité dostupnosti.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">5. Zrušení účtu</h2>
            <p>
              Uživatel může svůj účet kdykoliv zrušit a požádat o výmaz dat napsáním na kontaktní
              e-mail níže. Přístup aplikace ke svému Google účtu může kdykoliv odebrat v{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-accent-blue hover:underline"
              >
                nastavení Google účtu
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">6. Změny podmínek</h2>
            <p>
              Tyto podmínky můžeme čas od času upravit. O podstatných změnách budeme uživatele
              informovat e-mailem nebo oznámením v aplikaci.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">7. Kontakt</h2>
            <p>
              Dotazy k těmto podmínkám směřujte na{" "}
              <a href="mailto:renote.mail.cz@gmail.com" className="text-accent-blue hover:underline">
                renote.mail.cz@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/70 py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Renote. Všechna práva vyhrazena.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Ochrana osobních údajů</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Hlavní stránka</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
