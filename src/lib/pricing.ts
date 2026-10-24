/**
 * Prix de vente (FCFA entiers). Prix au casier obligatoire ; prix à la
 * bouteille optionnel, sinon prorata du prix casier arrondi au franc.
 */

export const CLIENT_CATEGORIES = ["bar", "boutique", "revendeur", "particulier"] as const;
export type ClientCategory = (typeof CLIENT_CATEGORIES)[number];

export const CLIENT_CATEGORY_LABELS: Record<ClientCategory, string> = {
  bar: "Bar",
  boutique: "Boutique",
  revendeur: "Revendeur",
  particulier: "Particulier",
};

export type PriceRow = { clientCategory: ClientCategory | null; casePrice: number; bottlePrice: number | null };

/** Prix casier ÷ bouteilles par casier, arrondi au franc (demi vers le haut), en entiers. */
export function proratedBottlePrice(casePrice: number, bottlesPerCase: number): number {
  if (!Number.isSafeInteger(casePrice) || casePrice < 0) throw new RangeError("Prix invalide.");
  if (!Number.isInteger(bottlesPerCase) || bottlesPerCase <= 0) throw new RangeError("Bouteilles par casier invalide.");
  return Math.floor((2 * casePrice + bottlesPerCase) / (2 * bottlesPerCase));
}

/**
 * Prix applicable à une catégorie de client : prix de la catégorie s'il existe,
 * sinon prix standard. Renvoie null si le produit n'a pas encore de prix.
 */
export function resolvePrice(
  prices: readonly PriceRow[],
  category: ClientCategory | null,
  bottlesPerCase: number,
): { casePrice: number; bottlePrice: number; bottlePriceIsProrated: boolean } | null {
  const row =
    (category && prices.find((p) => p.clientCategory === category)) ?? prices.find((p) => p.clientCategory === null);
  if (!row) return null;
  return {
    casePrice: row.casePrice,
    bottlePrice: row.bottlePrice ?? proratedBottlePrice(row.casePrice, bottlesPerCase),
    bottlePriceIsProrated: row.bottlePrice === null,
  };
}
