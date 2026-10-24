const TIME_ZONE = "Africa/Douala";

/** Espace insécable utilisée comme séparateur de milliers. */
const GROUP = "\u00a0";

/** 1250000 → « 1 250 000 FCFA ». Les montants sont des entiers (francs). */
export function formatFCFA(amount: number | bigint): string {
  const value = typeof amount === "bigint" ? amount : BigInt(Math.trunc(amount));
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  return `${negative ? "-" : ""}${grouped} FCFA`;
}

/** Date affichée au format 24/10/2026, dans le fuseau de Douala. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Date et heure : 24/10/2026 14:05. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${formatDate(d)} ${time}`;
}
