export const aed = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");

export function aedShort(n: number) {
  if (n >= 1e9) return `AED ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `AED ${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e3) return `AED ${Math.round(n / 1e3)}K`;
  return aed(n);
}

export const num = (n: number) => Math.round(n).toLocaleString("en-US");

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const signedPct = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;

export const bedroomLabel = (b: number) => (b === 0 ? "Studio" : `${b} BR`);

export const typeLabel = (t: string, plural = false) =>
  t === "Villa" ? (plural ? "Villas" : "Villa") : plural ? "Apartments" : "Apartment";

export function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "short" });
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
