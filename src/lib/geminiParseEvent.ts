/**
 * Volá Gemini textový model na rozbor zprávy (název/popis události)
 * a vrátí strukturovaně: jméno klienta, adresa, telefon.
 */

const GEMINI_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    clientName: {
      type: "string",
      description: "Jméno klienta nebo kontaktní osoby",
    },
    address: {
      type: "string",
      description: "Adresa nemovitosti nebo místa prohlídky",
    },
    clientPhone: {
      type: "string",
      description: "Telefonní číslo klienta v libovolném formátu",
    },
  },
  required: ["clientName", "address", "clientPhone"],
} as const;

export type GeminiExtract = {
  clientName: string;
  address: string;
  clientPhone: string;
};

const SYSTEM_PROMPT = `Jsi asistent pro realitní kancelář. Z textu události (prohlídka nemovitosti) vyber:
- clientName: jméno klienta / kontaktní osoby
- address: adresa nemovitosti (ulice, město)
- clientPhone: telefonní číslo klienta (i s mezerami nebo bez předvolby)

Pokud něco v textu není, doplň prázdný řetězec "". Odpověz pouze platným JSON podle schématu.`;

/**
 * Rozbor textu události přes Gemini. Vrátí null pokud API klíč chybí nebo volání selže.
 */
export async function geminiParseEvent(
  fullText: string
): Promise<GeminiExtract | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !fullText.trim()) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `${SYSTEM_PROMPT}\n\nText události:\n${fullText.trim()}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_EXTRACT_SCHEMA as object,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as GeminiExtract;
    if (
      typeof parsed.clientName !== "string" ||
      typeof parsed.address !== "string" ||
      typeof parsed.clientPhone !== "string"
    ) {
      return null;
    }
    return {
      clientName: (parsed.clientName || "Klient").trim(),
      address: (parsed.address || "").trim(),
      clientPhone: (parsed.clientPhone || "").trim(),
    };
  } catch {
    return null;
  }
}
