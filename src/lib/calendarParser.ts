import type { ParsedCalendarEvent } from "@/types"

/**
 * Parse event title/description/location for trigger keyword and extract:
 * - Tel: +420123456789
 * - Adresa: Václavské náměstí 1, Praha
 * - Client name from event summary (title) if present
 *
 * Recommended format in calendar:
 * #prohlidka Tel: +420123456789 Adresa: Václavské náměstí 1, Praha
 */
const TEL_REGEX = /Tel:\s*([+\d\s\-()]+)/i
const ADRESA_REGEX = /Adresa:\s*(.+?)(?=\s+Tel:|\s+Adresa:|$)/is

export function eventMatchesTrigger(
  summary: string,
  description: string,
  triggerKeyword: string
): boolean {
  const normalizedKeyword = triggerKeyword.trim().toLowerCase()
  if (!normalizedKeyword) return false
  const text = `${summary ?? ""} ${description ?? ""}`.toLowerCase()
  return text.includes(normalizedKeyword)
}

export function parseCalendarEvent(
  id: string,
  summary: string,
  description: string,
  location: string,
  start: string,
  end: string,
  triggerKeyword: string
): ParsedCalendarEvent | null {
  const fullText = [summary, description, location].filter(Boolean).join(" ")
  if (!eventMatchesTrigger(summary, description, triggerKeyword)) return null

  const telMatch = fullText.match(TEL_REGEX)
  const adresaMatch = fullText.match(ADRESA_REGEX)

  let clientPhone = telMatch ? telMatch[1].trim() : ""
  let address = adresaMatch ? adresaMatch[1].trim() : (location || "").trim()

  // Fallback: title like "Jiří Novák, Adresa, 123 456 789, #prohlidka"
  if (!clientPhone || !address) {
    const keyword = triggerKeyword.trim().toLowerCase()
    const parts = (summary || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => (keyword ? !p.toLowerCase().includes(keyword) : true))

    if (!clientPhone) {
      const phonePart =
        parts.find((p) => p.replace(/\D/g, "").length >= 9) || ""
      if (phonePart) clientPhone = phonePart
    }

    if (!address) {
      const addressPart = parts.find((p) => p !== clientPhone) || ""
      if (addressPart) address = addressPart
    }
  }

  const clientName = (summary || "").trim() || "Klient"

  if (!address && !clientPhone) return null

  return {
    id,
    summary: summary || "",
    description: description || "",
    location: location || "",
    start,
    end,
    address: address || "—",
    clientPhone: clientPhone || "—",
    clientName,
  }
}
