import { describe, expect, it } from "vitest";
import { navForRole } from "./navigation";
import { can } from "./roles";
import { isPublicPath, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it("garde les chemins internes", () => {
    expect(safeNextPath("/equipe")).toBe("/equipe");
  });
  it("refuse les redirections vers un autre site", () => {
    expect(safeNextPath("https://pirate.example")).toBe("/tableau-de-bord");
    expect(safeNextPath("//pirate.example")).toBe("/tableau-de-bord");
    expect(safeNextPath("/\\pirate.example")).toBe("/tableau-de-bord");
    expect(safeNextPath(null)).toBe("/tableau-de-bord");
  });
});

describe("isPublicPath", () => {
  it("distingue pages publiques et protégées", () => {
    expect(isPublicPath("/connexion")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/equipe")).toBe(false);
    expect(isPublicPath("/connexion-piege")).toBe(false);
    expect(isPublicPath("/mot-de-passe")).toBe(false);
  });
});

describe("rôles et navigation", () => {
  it("seul le propriétaire gère l'équipe", () => {
    expect(can("owner", "team.manage")).toBe(true);
    expect(can("manager", "team.manage")).toBe(false);
    expect(navForRole("owner").map((i) => i.href)).toContain("/equipe");
    expect(navForRole("storekeeper").map((i) => i.href)).not.toContain("/equipe");
  });
});
