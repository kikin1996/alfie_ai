/**
 * Krátký 4místný kód prohlídky odvozený deterministicky z jejího UUID.
 * Slouží k jednoznačnému spárování odpovědi klienta se správnou prohlídkou,
 * když má jeden klient více schůzek. Kód je stabilní (nemění se) a nevyžaduje
 * ukládání do DB – počítá se vždy z `viewing.id`.
 */
export function shortCode(viewingId: string): string {
  const hex = (viewingId || "").replace(/[^0-9a-f]/gi, "").slice(0, 8);
  const n = parseInt(hex || "0", 16);
  return String((Number.isFinite(n) ? n : 0) % 10000).padStart(4, "0");
}

/** Přidá kód prohlídky na konec textu SMS/notifikace. */
export function withCode(text: string, code: string): string {
  return `${text} (ID ${code})`;
}
