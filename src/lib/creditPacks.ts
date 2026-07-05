/**
 * Balíčky kreditů k jednorázovému přikoupení (top-up) k aktivnímu předplatnému.
 * Ceny/objemy klidně uprav – používá se v UI (/subscription) i v checkoutu.
 * Cena se posílá do Stripe inline (price_data), nemusíš tvořit Stripe ceny předem.
 */
export type CreditPack = {
  id: string;
  credits: number;
  priceCzk: number;
  label: string;
  popular?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits_20", credits: 20, priceCzk: 99, label: "20 kreditů" },
  { id: "credits_50", credits: 50, priceCzk: 229, label: "50 kreditů", popular: true },
  { id: "credits_120", credits: 120, priceCzk: 499, label: "120 kreditů" },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
