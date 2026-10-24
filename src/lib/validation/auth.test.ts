import { describe, expect, it } from "vitest";
import { inviteSchema, setPasswordSchema, signupSchema } from "./auth";

const valid = {
  fullName: "Jean Mbarga",
  companyName: "Mbarga Boissons",
  email: "  Jean@Exemple.CM ",
  phone: "+237 690 12 34 56",
  password: "motdepasse",
  city: "Douala",
  address: "Akwa, rue Joss",
};

describe("signupSchema", () => {
  it("accepte une inscription valide et normalise l'e-mail", () => {
    const r = signupSchema.parse(valid);
    expect(r.email).toBe("jean@exemple.cm");
  });

  it("refuse un téléphone invalide", () => {
    expect(signupSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("refuse un mot de passe trop court", () => {
    const r = signupSchema.safeParse({ ...valid, password: "court" });
    expect(r.success).toBe(false);
  });

  it("refuse les champs vides (espaces seuls)", () => {
    expect(signupSchema.safeParse({ ...valid, companyName: "   " }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("n'autorise pas l'invitation d'un propriétaire", () => {
    expect(inviteSchema.safeParse({ fullName: "Paul", email: "p@x.cm", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ fullName: "Paul", email: "p@x.cm", role: "storekeeper" }).success).toBe(true);
  });
});

describe("setPasswordSchema", () => {
  it("exige deux mots de passe identiques", () => {
    expect(setPasswordSchema.safeParse({ password: "motdepasse", confirm: "autre" }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: "motdepasse", confirm: "motdepasse" }).success).toBe(true);
  });
});
