import { describe, expect, it } from "vitest";
import { proratedBottlePrice, resolvePrice, type PriceRow } from "./pricing";

describe("prix à la bouteille au prorata", () => {
  it("arrondit au franc, demi vers le haut, sans flottant", () => {
    expect(proratedBottlePrice(7800, 12)).toBe(650);
    expect(proratedBottlePrice(7810, 12)).toBe(651); // 650,83
    expect(proratedBottlePrice(7806, 12)).toBe(651); // 650,5
    expect(proratedBottlePrice(7805, 12)).toBe(650); // 650,42
    expect(proratedBottlePrice(1000, 3)).toBe(333);
  });

  it("refuse les entrées invalides", () => {
    expect(() => proratedBottlePrice(7800, 0)).toThrow();
    expect(() => proratedBottlePrice(-1, 12)).toThrow();
    expect(() => proratedBottlePrice(10.5, 12)).toThrow();
  });
});

describe("prix applicable selon la catégorie de client", () => {
  const prices: PriceRow[] = [
    { clientCategory: null, casePrice: 7800, bottlePrice: null },
    { clientCategory: "bar", casePrice: 8000, bottlePrice: 700 },
  ];

  it("utilise le prix de la catégorie s'il existe", () => {
    expect(resolvePrice(prices, "bar", 12)).toEqual({
      casePrice: 8000,
      bottlePrice: 700,
      bottlePriceIsProrated: false,
    });
  });

  it("retombe sur le prix standard, avec prix bouteille au prorata", () => {
    expect(resolvePrice(prices, "boutique", 12)).toEqual({
      casePrice: 7800,
      bottlePrice: 650,
      bottlePriceIsProrated: true,
    });
    expect(resolvePrice(prices, null, 12)?.casePrice).toBe(7800);
  });

  it("renvoie null sans prix standard", () => {
    expect(resolvePrice([], "bar", 12)).toBeNull();
  });
});
