import { describe, expect, it } from "vitest";
import { packagingCreateSchema, priceGridSchema, productSchema, vehicleSchema } from "./catalog";
import { fcfaAmount } from "./common";

const ID = "6f1c1d1e-3a5b-4c2d-9e8f-0a1b2c3d4e5f";

describe("montants FCFA", () => {
  const amount = fcfaAmount("Prix");

  it("accepte « 1 250 000 » et « 7800 »", () => {
    expect(amount.parse("1 250 000")).toBe(1_250_000);
    expect(amount.parse("1 250 000")).toBe(1_250_000);
    expect(amount.parse("7800")).toBe(7800);
  });

  it("refuse décimales, virgules, négatifs et zéro", () => {
    for (const bad of ["7800,5", "7800.5", "-100", "0", "", "abc"]) {
      expect(amount.safeParse(bad).success, bad).toBe(false);
    }
    expect(fcfaAmount("Consigne", { allowZero: true }).parse("0")).toBe(0);
  });
});

describe("productSchema", () => {
  const base = {
    id: "",
    code: " KOLA65 ",
    name: "Bière Kola 65 cl",
    brand: "",
    category: "Bière",
    volumeCl: "65",
    bottlesPerCase: "12",
    crateTypeId: ID,
    bottleTypeId: "",
    thresholdCases: "5",
    thresholdBottles: "6",
  };

  it("convertit seuil casiers + bouteilles en bouteilles, contenance en ml", () => {
    const p = productSchema.parse(base);
    expect(p).toMatchObject({
      id: null,
      code: "KOLA65",
      brand: null,
      volumeMl: 650,
      bottlesPerCase: 12,
      crateTypeId: ID,
      bottleTypeId: null,
      alertThreshold: 66,
      isActive: true,
    });
  });

  it("accepte une contenance décimale « 37,5 » et un seuil vide", () => {
    const p = productSchema.parse({ ...base, volumeCl: "37,5", thresholdCases: "", thresholdBottles: "" });
    expect(p.volumeMl).toBe(375);
    expect(p.alertThreshold).toBe(0);
  });

  it("refuse 0 bouteille par casier", () => {
    expect(productSchema.safeParse({ ...base, bottlesPerCase: "0" }).success).toBe(false);
  });
});

describe("packagingCreateSchema", () => {
  it("une bouteille vaut toujours 1", () => {
    const p = packagingCreateSchema.parse({
      name: "Bouteille 65 cl",
      kind: "bottle",
      capacity: "",
      depositValue: "200",
    });
    expect(p).toEqual({ name: "Bouteille 65 cl", kind: "bottle", capacity: 1, depositValue: 200 });
  });

  it("un casier exige son nombre de bouteilles", () => {
    expect(
      packagingCreateSchema.safeParse({ name: "Casier", kind: "crate", capacity: "", depositValue: "1200" }).success,
    ).toBe(false);
    expect(
      packagingCreateSchema.parse({ name: "Casier", kind: "crate", capacity: "12", depositValue: "1 200" }).capacity,
    ).toBe(12);
  });
});

describe("priceGridSchema", () => {
  it("exige le prix standard au casier", () => {
    const r = priceGridSchema.safeParse({
      productId: ID,
      rows: [{ category: "", casePrice: "", bottlePrice: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("refuse un prix bouteille sans prix casier pour une catégorie", () => {
    const r = priceGridSchema.safeParse({
      productId: ID,
      rows: [
        { category: "", casePrice: "7800", bottlePrice: "" },
        { category: "bar", casePrice: "", bottlePrice: "700" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("accepte une grille valide", () => {
    const r = priceGridSchema.parse({
      productId: ID,
      rows: [
        { category: "", casePrice: "7 800", bottlePrice: "" },
        { category: "bar", casePrice: "8000", bottlePrice: "700" },
      ],
    });
    expect(r.rows).toEqual([
      { category: null, casePrice: 7800, bottlePrice: null },
      { category: "bar", casePrice: 8000, bottlePrice: 700 },
    ]);
  });
});

describe("vehicleSchema", () => {
  it("met l'immatriculation en majuscules", () => {
    const v = vehicleSchema.parse({
      id: "",
      name: "Tricycle 1",
      kind: "tricycle",
      plateNumber: "lt 123 ab",
      capacityCases: "",
    });
    expect(v).toMatchObject({ plateNumber: "LT 123 AB", capacityCases: null });
  });
});
