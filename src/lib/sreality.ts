/**
 * S Reality – tahání klientských poptávek přes partnerské API.
 * Zatím bez oficiální dokumentace/přístupu -> běží v mock režimu (viz getMockInquiries),
 * dokud nebudou k dispozici skutečné API klíče a base URL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SrealityInquiry {
  srealityInquiryId: string;
  listingId?: string;
  listingTitle?: string;
  listingUrl?: string;
  listingType?: "sale" | "rent";
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  message?: string;
  raw: unknown;
}

// MOCK DATA — odstranit / přestat volat, jakmile bude zapojené skutečné S Reality API.
function getMockInquiries(): SrealityInquiry[] {
  return [
    {
      srealityInquiryId: "mock-1",
      listingId: "mock-listing-1",
      listingTitle: "Byt 2+kk, Praha 5 - Smíchov",
      listingUrl: "https://www.sreality.cz/detail/prodej/byt/2+kk/mock-1",
      listingType: "sale",
      clientName: "Jana Nováková",
      clientPhone: "+420601234567",
      clientEmail: "jana.novakova@example.com",
      message: "Dobrý den, mám zájem o prohlídku bytu. Kdy by to bylo možné?",
      raw: { mock: true },
    },
    {
      srealityInquiryId: "mock-2",
      listingId: "mock-listing-2",
      listingTitle: "Pronájem 1+1, Brno - Královo Pole",
      listingUrl: "https://www.sreality.cz/detail/pronajem/byt/1+1/mock-2",
      listingType: "rent",
      clientName: "Petr Svoboda",
      clientPhone: "+420777123456",
      clientEmail: "petr.svoboda@example.com",
      message: "Zdravím, je byt stále k dispozici? Rád bych se přišel podívat tento týden.",
      raw: { mock: true },
    },
  ];
}

/**
 * Skutečné volání S Reality partnerského API.
 * TODO: implementovat podle dokumentace, jakmile bude k dispozici (endpoint, auth, stránkování).
 * Tohle je jediná funkce, kterou bude potřeba přepsat - zbytek pipeline (sync route, DB, UI) zůstane beze změny.
 */
async function callSrealityApi(
  apiKey: string,
  apiBaseUrl: string,
  since?: string
): Promise<SrealityInquiry[]> {
  const params = new URLSearchParams();
  if (since) params.set("since", since);

  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/inquiries?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`S Reality API chyba: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : data.items ?? [];

  return items.map((item) => {
    const i = item as Record<string, unknown>;
    return {
      srealityInquiryId: String(i.id ?? i.inquiryId),
      listingId: i.listingId != null ? String(i.listingId) : undefined,
      listingTitle: typeof i.listingTitle === "string" ? i.listingTitle : undefined,
      listingUrl: typeof i.listingUrl === "string" ? i.listingUrl : undefined,
      listingType: i.listingType === "rent" ? "rent" : i.listingType === "sale" ? "sale" : undefined,
      clientName: typeof i.clientName === "string" ? i.clientName : undefined,
      clientPhone: typeof i.clientPhone === "string" ? i.clientPhone : undefined,
      clientEmail: typeof i.clientEmail === "string" ? i.clientEmail : undefined,
      message: typeof i.message === "string" ? i.message : undefined,
      raw: item,
    };
  });
}

export async function fetchSrealityInquiries(opts: {
  apiKey: string | null;
  apiBaseUrl: string | null;
  since?: string;
}): Promise<SrealityInquiry[]> {
  if (!opts.apiKey || !opts.apiBaseUrl) {
    return getMockInquiries();
  }
  return callSrealityApi(opts.apiKey, opts.apiBaseUrl, opts.since);
}

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
}

/**
 * Stáhne poptávky ze S Reality a upsertne je do sreality_leads podle sreality_inquiry_id.
 * Aktualizuje pouze zdrojová pole (listing/klient/zpráva) - status, viewing_at, reaction,
 * notes a converted_contact_id nastavené adminem se při re-syncu nikdy nepřepíšou.
 */
export async function syncSrealityLeads(
  admin: SupabaseClient,
  config: { apiKey: string | null; apiBaseUrl: string | null }
): Promise<SyncResult> {
  const inquiries = await fetchSrealityInquiries(config);

  let created = 0;
  let updated = 0;

  for (const inquiry of inquiries) {
    const { data: existing } = await admin
      .from("sreality_leads")
      .select("id")
      .eq("sreality_inquiry_id", inquiry.srealityInquiryId)
      .maybeSingle();

    const { error } = await admin.from("sreality_leads").upsert(
      {
        sreality_inquiry_id: inquiry.srealityInquiryId,
        listing_id: inquiry.listingId ?? null,
        listing_title: inquiry.listingTitle ?? null,
        listing_url: inquiry.listingUrl ?? null,
        listing_type: inquiry.listingType ?? null,
        client_name: inquiry.clientName ?? null,
        client_phone: inquiry.clientPhone ?? null,
        client_email: inquiry.clientEmail ?? null,
        message: inquiry.message ?? null,
        raw_payload: inquiry.raw as object,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "sreality_inquiry_id" }
    );

    if (error) throw new Error(error.message);
    if (existing) updated++;
    else created++;
  }

  return { fetched: inquiries.length, created, updated };
}
