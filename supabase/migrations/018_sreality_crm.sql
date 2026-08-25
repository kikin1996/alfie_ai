-- S Reality CRM (admin-only) – poptávky ze S Reality + trvalé kontakty
-- Spravuje výhradně administrátor, přístup pouze přes service role (admin API, cron).

-- Globální konfigurace S Reality API (klíč, base URL) – singleton řádek jako app_config
CREATE TABLE IF NOT EXISTS public.sreality_config (
  id           smallint PRIMARY KEY DEFAULT 1,
  api_key      text,
  api_base_url text,
  enabled      boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sreality_config_single_row CHECK (id = 1)
);

ALTER TABLE public.sreality_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sreality_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Poptávky (leads) stažené ze S Reality
CREATE TABLE IF NOT EXISTS public.sreality_leads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sreality_inquiry_id  text NOT NULL,
  listing_id           text,
  listing_title        text,
  listing_url          text,
  listing_type         text CHECK (listing_type IS NULL OR listing_type IN ('sale', 'rent')),
  client_name          text,
  client_phone         text,
  client_email         text,
  message              text,
  status               text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'scheduled', 'done', 'archived')),
  viewing_at           timestamptz,
  reaction             text CHECK (reaction IS NULL OR reaction IN
                         ('interested', 'not_interested', 'no_show', 'thinking')),
  notes                text,
  converted_contact_id uuid,
  raw_payload          jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sreality_inquiry_id)
);

CREATE INDEX IF NOT EXISTS idx_sreality_leads_status ON public.sreality_leads (status);
CREATE INDEX IF NOT EXISTS idx_sreality_leads_viewing_at ON public.sreality_leads (viewing_at);

ALTER TABLE public.sreality_leads ENABLE ROW LEVEL SECURITY;

-- Trvalé kontakty – ručně spravovaný seznam, volitelně navázaný na zdrojovou poptávku
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  phone          text,
  email          text,
  notes          text,
  source_lead_id uuid REFERENCES public.sreality_leads (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_name ON public.crm_contacts (name);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sreality_leads
  ADD CONSTRAINT sreality_leads_converted_contact_id_fkey
  FOREIGN KEY (converted_contact_id) REFERENCES public.crm_contacts (id) ON DELETE SET NULL;
