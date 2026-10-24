import { describe, expect, it } from "vitest";
import { FORBIDDEN_ERROR, GENERIC_ERROR, dbErrorMessage } from "./errors";

describe("dbErrorMessage", () => {
  it("affiche le message métier (P0001), le doublon, le refus de droits", () => {
    expect(dbErrorMessage({ code: "P0001", message: "Limite atteinte." })).toBe("Limite atteinte.");
    expect(dbErrorMessage({ code: "23505", message: "duplicate key" }, { duplicate: "Ce code existe déjà." })).toBe(
      "Ce code existe déjà.",
    );
    expect(dbErrorMessage({ code: "42501", message: "new row violates row-level security" })).toBe(FORBIDDEN_ERROR);
  });

  it("ne montre jamais un détail technique", () => {
    expect(dbErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(
      GENERIC_ERROR,
    );
    expect(dbErrorMessage({ code: "XX000", message: "internal" })).toBe(GENERIC_ERROR);
  });
});
