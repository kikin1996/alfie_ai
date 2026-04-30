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

export function normalizePhone(phone: string): string {
  const p = phone.trim()
  if (!p || p === "—" || p === "-") return p
  // Already has country code
  if (p.startsWith("+")) return p
  // Czech local format starting with 0 (e.g. 0123456789)
  if (p.startsWith("0")) return "+420" + p.slice(1)
  // 9-digit number without prefix
  const digits = p.replace(/\D/g, "")
  if (digits.length === 9) return "+420" + digits
  return p
}

const NAME_PLACEHOLDERS = ["klient", "—", "-", "client", "test", "unknown", "neznámý", "jméno", "name", "kontakt"]

function toTitleCase(s: string): string {
  return s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
}

/**
 * Zkontroluje jméno klienta.
 * - suspicious: true + fixedName → drobná chyba, oprav automaticky
 * - suspicious: true, bez fixedName → nejasná chyba, upozorni makléře
 * - suspicious: false → vše ok
 */
export function isSuspiciousClientName(name: string): { suspicious: boolean; reason?: string; fixedName?: string } {
  const n = name.trim()

  // Zástupný symbol – nelze opravit, upozornit
  if (!n || NAME_PLACEHOLDERS.includes(n.toLowerCase())) {
    return { suspicious: true, reason: "vypadá jako zástupný symbol" }
  }
  // Příliš krátké – nelze opravit, upozornit
  if (n.replace(/\s/g, "").length < 3) {
    return { suspicious: true, reason: "příliš krátké" }
  }
  // Číslice – nelze opravit, upozornit
  if (/\d/.test(n)) {
    return { suspicious: true, reason: "obsahuje číslice" }
  }
  // E-mail – nelze opravit, upozornit
  if (n.includes("@")) {
    return { suspicious: true, reason: "vypadá jako e-mail" }
  }

  // Celé velkými písmeny → opravit na Title Case
  if (n.length > 3 && n === n.toUpperCase() && /[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(n)) {
    return { suspicious: true, reason: "celé velkými písmeny", fixedName: toTitleCase(n) }
  }
  // Celé malými písmeny → opravit na Title Case
  if (n.length > 3 && n === n.toLowerCase() && /[a-záčďéěíňóřšťúůýž]/.test(n)) {
    return { suspicious: true, reason: "začíná malým písmenem", fixedName: toTitleCase(n) }
  }
  // Některé slovo začíná malým písmenem (např. "Petr mazal") → opravit
  if (/\s[a-záčďéěíňóřšťúůýž]/.test(n)) {
    return { suspicious: true, reason: "slovo začíná malým písmenem", fixedName: toTitleCase(n) }
  }
  // Opakující se znaky (překlep) → odstranit duplikáty
  if (/(.)\1+/.test(n)) {
    const fixed = toTitleCase(n.replace(/(.)\1+/g, "$1"))
    if (fixed !== n) {
      return { suspicious: true, reason: "obsahuje opakující se znaky", fixedName: fixed }
    }
  }

  return { suspicious: false }
}

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

  let clientPhone = telMatch ? normalizePhone(telMatch[1].trim()) : ""
  let address = adresaMatch ? adresaMatch[1].trim() : (location || "").trim()

  // Fallback: title like "Revoluční 2, Příbor, Petr Komárek, 777 726 001, #prohlidka"
  const keyword = triggerKeyword.trim().toLowerCase()
  const summaryParts = (summary || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => (keyword ? !p.toLowerCase().includes(keyword) : true))

  // Phone = part with 9+ digits
  const phoneIdx = summaryParts.findIndex((p) => p.replace(/\D/g, "").length >= 9)
  const phonePart = phoneIdx >= 0 ? summaryParts[phoneIdx] : ""
  if (!clientPhone && phonePart) clientPhone = normalizePhone(phonePart)

  // Name = part immediately before phone (format: [addr parts...], name, phone, keyword)
  // Fallback when no phone: last part without digits, preferably 2+ words
  let nameCandidate = ""
  if (phoneIdx > 0) {
    nameCandidate = summaryParts[phoneIdx - 1]
  } else if (phoneIdx < 0) {
    const noDigits = summaryParts.filter((p) => !/\d/.test(p))
    nameCandidate = noDigits.find((p) => p.split(" ").length >= 2) || noDigits[noDigits.length - 1] || ""
  }

  if (!address) {
    if (phoneIdx > 1) {
      // Address = parts before the name candidate
      address = summaryParts.slice(0, phoneIdx - 1).join(", ")
    } else if (phoneIdx === 1 || phoneIdx === 0) {
      // Only one part before phone — it's the address, not a name
      address = summaryParts.slice(0, phoneIdx).join(", ")
      if (!nameCandidate) nameCandidate = ""
    } else {
      // No phone in title
      address = summaryParts.filter((p) => p !== nameCandidate).join(", ")
    }
  }

  const clientName = nameCandidate || (summary || "").trim() || "Klient"

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
