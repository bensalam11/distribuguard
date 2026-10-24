/**
 * Quantités : stockées en bouteilles (unité de base), saisies et affichées en
 * « casiers + bouteilles » selon le nombre de bouteilles par casier du produit.
 */

export type CasesBottles = { cases: number; bottles: number };

/** 12 casiers + 5 bouteilles, 12 btl/casier → 149 bouteilles. */
export function toBottles(cases: number, bottles: number, bottlesPerCase: number): number {
  assertPositiveInt(bottlesPerCase, "bottlesPerCase");
  if (!Number.isInteger(cases) || !Number.isInteger(bottles) || cases < 0 || bottles < 0) {
    throw new RangeError("Quantité invalide.");
  }
  return cases * bottlesPerCase + bottles;
}

/** 149 bouteilles, 12 btl/casier → { cases: 12, bottles: 5 }. */
export function splitBottles(total: number, bottlesPerCase: number): CasesBottles {
  assertPositiveInt(bottlesPerCase, "bottlesPerCase");
  if (!Number.isInteger(total)) throw new RangeError("Quantité invalide.");
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  return { cases: sign * Math.floor(abs / bottlesPerCase), bottles: sign * (abs % bottlesPerCase) };
}

/** « 12 casiers 5 btl », « 1 casier », « 7 btl », « 0 btl ». */
export function formatCasesBottles(total: number, bottlesPerCase: number): string {
  const { cases, bottles } = splitBottles(Math.abs(total), bottlesPerCase);
  const parts: string[] = [];
  if (cases > 0) parts.push(`${cases} ${cases > 1 ? "casiers" : "casier"}`);
  if (bottles > 0 || cases === 0) parts.push(`${bottles} btl`);
  return `${total < 0 ? "-" : ""}${parts.join(" ")}`;
}

function assertPositiveInt(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} doit être un entier positif.`);
}
