import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatFCFA } from "./format";

const normalize = (s: string) => s.replace(/[  ]/g, " ");

describe("formatFCFA", () => {
  it("affiche 1 250 000 FCFA", () => {
    expect(normalize(formatFCFA(1_250_000))).toBe("1 250 000 FCFA");
  });
  it("gère zéro, les petits montants et les négatifs", () => {
    expect(normalize(formatFCFA(0))).toBe("0 FCFA");
    expect(normalize(formatFCFA(950))).toBe("950 FCFA");
    expect(normalize(formatFCFA(-12_500))).toBe("-12 500 FCFA");
  });
  it("accepte les bigint au-delà de Number.MAX_SAFE_INTEGER", () => {
    expect(normalize(formatFCFA(BigInt("9007199254740993")))).toBe("9 007 199 254 740 993 FCFA");
  });
  it("utilise des espaces insécables (pas de retour à la ligne au milieu d'un montant)", () => {
    expect(formatFCFA(1000)).toBe("1 000 FCFA");
  });
});

describe("formatDate", () => {
  it("affiche jj/mm/aaaa", () => {
    expect(formatDate("2026-10-24T10:00:00Z")).toBe("24/10/2026");
  });
  it("utilise le fuseau Africa/Douala (UTC+1)", () => {
    // 23 h 30 UTC = 0 h 30 le lendemain à Douala.
    expect(formatDate("2026-10-24T23:30:00Z")).toBe("25/10/2026");
    expect(formatDateTime("2026-10-24T13:05:00Z")).toBe("24/10/2026 14:05");
  });
});
