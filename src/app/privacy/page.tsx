import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Ochrana osobních údajů | Renote",
  description: "Zásady ochrany osobních údajů aplikace Renote.",
};

export default function PrivacyPage() {
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
          Zásady ochrany osobních údajů
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Platné od 28. 9. 2026
        </p>

        <div className="prose prose-slate mt-10 max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold text-navy">1. Kdo jsme</h2>
            <p>
              Renote je aplikace pro realitní makléře, která automatizuje připomínky prohlídek
              nemovitostí formou SMS a hlasových hovorů. Provozovatelem je{" "}
              <strong>Renote</strong>, kontaktní e-mail:{" "}
              <a href="mailto:renote.mail.cz@gmail.com" className="text-accent-blue hover:underline">
                renote.mail.cz@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">2. Jaká data zpracováváme</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Registrační údaje uživatele (e-mail, jméno) při vytvoření účtu přes Google přihlášení.</li>
              <li>Události z Google Kalendáře uživatele obsahující klíčové slovo prohlídky (datum, čas, adresa, telefonní číslo klienta) – pouze pro účely automatizace připomínek.</li>
              <li>Telefonní čísla a jména klientů zadaná makléřem pro účely odeslání SMS a AI hovorů.</li>
              <li>U administrátorského účtu: e-maily z Gmailové schránky makléře obsahující poptávky ze S Reality – pouze za účelem automatického vytěžení kontaktních údajů zájemců o prohlídku.</li>
              <li>Technické záznamy (logy) o odeslaných SMS, hovorech a doručení pro účely diagnostiky.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">3. Přístup k datům Google účtu</h2>
            <p>
              Renote využívá Google OAuth pro přihlášení a pro následující oprávnění:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Google Kalendář</strong> (rozsah <code>calendar.events</code>) – čtení
                a čas od času úprava událostí označených jako prohlídka, aby mohla aplikace
                naplánovat SMS a hovory.
              </li>
              <li>
                <strong>Gmail</strong> (rozsah <code>gmail.readonly</code>) – pouze pro
                administrátorský účet makléře, výhradně pro automatické vyhledání a načtení
                e-mailových poptávek ze S Reality. Toto oprávnění se netýká běžných uživatelů
                aplikace.
              </li>
            </ul>
            <p>
              Data z Google účtu nejsou nikdy prodávána, sdílena s třetími stranami pro
              marketingové účely ani používána k trénování AI/ML modelů. Používáme je výhradně
              k funkcím popsaným výše, v souladu s{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-accent-blue hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , včetně požadavků na omezené použití (Limited Use).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">4. Komu data předáváme</h2>
            <p>Pro zajištění funkčnosti služby spolupracujeme s těmito zpracovateli:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Supabase – databáze a autentizace</li>
              <li>SMSbrána.cz – odesílání SMS zpráv</li>
              <li>VAPI.ai – automatizované hlasové hovory</li>
              <li>Telegram – interní notifikace makléře</li>
              <li>Google – přihlášení, kalendář, e-mail (viz výše)</li>
              <li>Anthropic (Claude) – automatická klasifikace odpovědí klientů na SMS</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">5. Doba uchování dat</h2>
            <p>
              Údaje o prohlídkách a související komunikaci uchováváme po dobu trvání účtu a
              následně po omezenou dobu pro účetní a právní účely. Uživatel může kdykoliv
              požádat o smazání účtu a souvisejících dat.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">6. Odvolání souhlasu</h2>
            <p>
              Přístup Renote ke svému Google účtu můžete kdykoliv odebrat v nastavení{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-accent-blue hover:underline"
              >
                Google účtu
              </a>
              . Zrušení propojení kdykoliv vyžádáte také napsáním na kontaktní e-mail níže.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-navy">7. Kontakt</h2>
            <p>
              Dotazy ke zpracování osobních údajů směřujte na{" "}
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
            <Link href="/terms" className="hover:text-foreground transition-colors">Podmínky užití</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Hlavní stránka</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
