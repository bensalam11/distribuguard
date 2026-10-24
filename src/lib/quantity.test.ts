import { describe, expect, it } from "vitest";
import { formatCasesBottles, splitBottles, toBottles } from "./quantity";

describe("quantités casiers + bouteilles", () => {
  it("convertit en bouteilles", () => {
    expect(toBottles(12, 5, 12)).toBe(149);
    expect(toBottles(0, 7, 24)).toBe(7);
    expect(toBottles(3, 0, 6)).toBe(18);
  });

  it("accepte plus de bouteilles qu'un casier (saisie libre) et refuse les négatifs ou décimales", () => {
    expect(toBottles(1, 14, 12)).toBe(26);
    expect(() => toBottles(-1, 0, 12)).toThrow();
    expect(() => toBottles(1.5, 0, 12)).toThrow();
    expect(() => toBottles(1, 0, 0)).toThrow();
  });

  it("découpe en casiers + bouteilles", () => {
    expect(splitBottles(149, 12)).toEqual({ cases: 12, bottles: 5 });
    expect(splitBottles(12, 12)).toEqual({ cases: 1, bottles: 0 });
    expect(splitBottles(-14, 12)).toEqual({ cases: -1, bottles: -2 });
  });

  it("affiche « 12 casiers 5 btl »", () => {
    expect(formatCasesBottles(149, 12)).toBe("12 casiers 5 btl");
    expect(formatCasesBottles(12, 12)).toBe("1 casier");
    expect(formatCasesBottles(7, 12)).toBe("7 btl");
    expect(formatCasesBottles(0, 12)).toBe("0 btl");
    expect(formatCasesBottles(-14, 12)).toBe("-1 casier 2 btl");
  });
});
