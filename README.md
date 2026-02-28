# Real Estate Viewing Automator

Aplikace pro makléře: účty, registrace, automatizace prohlídek přes SMS a Google Kalendář. PropTech vzhled (námořnická modrá, bílá, smaragdová zelená).

## Stack

- **Framework:** Next.js 14 (App Router) – více stránek, ne SPA
- **Frontend:** React, Tailwind CSS, Shadcn UI (Radix)
- **Auth / DB:** Supabase (registrace, přihlášení, tabulky)
- **Integrace:** Google Calendar API, Twilio (SMS)

## Rychlý start

```bash
npm install
cp .env.local.example .env.local
# Vyplň NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Aplikace poběží na **http://localhost:3000**. Stránky: `/` (přesměrování), `/login`, `/register`, `/dashboard`, `/settings`.

## Nastavení

### 1. Supabase

1. Vytvoř projekt na [supabase.com](https://supabase.com).
2. V **Authentication → URL Configuration** přidej Redirect URL: `http://localhost:8080` (a produkční URL).
3. V **SQL Editor** spusť skript `supabase/schema.sql` (vytvoří tabulky a RLS).
4. Do `.env.local` doplň `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Google přihlášení a Kalendář

1. V [Google Cloud Console](https://console.cloud.google.com/) vytvoř projekt (nebo použij stávající).
2. **APIs & Services → Library:** zapni **Google Calendar API**.
3. **Credentials → Create OAuth 2.0 Client ID:** typ „Web application“, Authorized redirect URIs přidej z Supabase Dashboard (Authentication → Providers → Google – tam je uvedený redirect URL).
4. V **Supabase Dashboard → Authentication → Providers → Google** vyplň Client ID a Client Secret.
5. Pro přístup ke kalendáři musíš u Google OAuth přidat scope `https://www.googleapis.com/auth/calendar.readonly` (v Supabase se to nastavuje u Google providera, pokud to rozhraní umožňuje; jinak budeš kalendář načítat přes vlastní backend/Edge Function s refresh tokenem).

### 3. Twilio (SMS)

1. Založ účet na [twilio.com](https://www.twilio.com).
2. Získej **Account SID**, **Auth Token** a **Twilio číslo** (odkud se posílají SMS).
3. V aplikaci v **Nastavení** vyplň tyto údaje a šablonu SMS. Odesílání SMS by mělo probíhat na serveru (Supabase Edge Function nebo vlastní API), aby Auth Token nebyl v klientovi – frontend jen ukládá nastavení do Supabase.

### 4. Formát události v kalendáři

Aby aplikace našla prohlídky a vytáhla telefon a adresu, používej v popisu/názvu události jednotný formát, např.:

```
#prohlidka Tel: +420123456789 Adresa: Václavské náměstí 1, Praha
```

- **Klíčové slovo** (např. `#prohlidka`) nastavíš v Nastavení.
- **Tel:** telefonní číslo klienta.
- **Adresa:** adresa nemovitosti.

## Funkce

- **Přihlášení:** Google OAuth přes Supabase Auth.
- **Nastavení:** klíčové slovo, Twilio údaje, šablona SMS, počet hodin před prohlídkou (např. odeslat 2 h před).
- **Dashboard:** seznam nadcházejících a minulých prohlídek se stavy: Čeká, SMS odeslána, Potvrzeno, Zrušeno.
- **Synchronizace kalendáře:** načtení událostí z Google Calendar s klíčovým slovem a parsování Tel/Adresa – realizuje se přes **Supabase Edge Function** nebo vlastní API (volání Google Calendar API s tokenem uživatele). Frontend zobrazuje data z tabulky `viewings`.
- **SMS a odpovědi:** odeslání SMS (2 h před) a zpracování odpovědi „YES“ by mělo běžet na serveru (Edge Function + Twilio, případně webhook pro příchozí SMS). Server aktualizuje stav v `viewings` a může poslat notifikaci makléři (email/push).

## Skripty

- `npm run dev` – vývoj
- `npm run build` – build
- `npm run preview` – náhled buildu
- `npm run lint` – ESLint

## Tipy

- **Google API:** Client ID a nastavení OAuth děláš v Google Cloud Console; Supabase pak použije svůj redirect pro Google provider.
- **SMS brána:** Pro reálné SMS potřebuješ účet u Twilia (nebo MessageBird); aplikace připraví UI a ukládání nastavení, samotné volání Twilia patří na backend.
- **Formát události:** Doporuč makléřům jeden formát (např. `#prohlidka Tel: … Adresa: …`) v popisu nebo v názvu události.
