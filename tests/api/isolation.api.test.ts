/**
 * Isolation vérifiée via l'API REST (PostgREST, le même moteur que Supabase
 * utilise derrière supabase-js), avec de vrais JWT signés.
 */
import { PostgrestClient } from "@supabase/postgrest-js";
import { beforeAll, describe, expect, it } from "vitest";
import { clientFor, postgrestUrl, signJwt } from "../setup/api";
import { inviteMember, signupOrganization } from "../setup/db";

describe.skipIf(!postgrestUrl)("isolation entre organisations (via l'API)", () => {
  let a: Awaited<ReturnType<typeof signupOrganization>>;
  let b: Awaited<ReturnType<typeof signupOrganization>>;

  beforeAll(async () => {
    a = await signupOrganization({ company_name: "API A" });
    b = await signupOrganization({ company_name: "API B" });
  });

  it("chaque organisation ne lit que ses propres données", async () => {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const api = clientFor(self.userId);
      const orgs = await api.from("organizations").select("id, name");
      expect(orgs.error).toBeNull();
      expect(orgs.data).toEqual([{ id: self.orgId, name: self.meta.company_name }]);

      const depots = await api.from("depots").select("organization_id");
      expect(depots.data?.map((d) => d.organization_id)).toEqual([self.orgId]);

      const members = await api.from("members").select("organization_id").eq("organization_id", other.orgId);
      expect(members.data).toEqual([]);

      const subs = await api.from("subscriptions").select("organization_id");
      expect(subs.data).toEqual([{ organization_id: self.orgId }]);
    }
  });

  it("A ne peut pas modifier l'organisation de B ni y créer un dépôt", async () => {
    const api = clientFor(a.userId);
    const upd = await api.from("organizations").update({ name: "Piraté" }).eq("id", b.orgId).select();
    expect(upd.data).toEqual([]);

    const ins = await api.from("depots").insert({ organization_id: b.orgId, name: "Intrus" });
    expect(ins.error?.code).toBe("42501");
  });

  it("A ne peut pas inviter dans B (la fonction utilise toujours l'organisation de l'appelant)", async () => {
    const { userId: bCashier } = await inviteMember(b.userId, "cashier");
    const res = await clientFor(bCashier).rpc("create_invitation", {
      p_email: "x@test.local",
      p_full_name: "X",
      p_role: "cashier",
    });
    expect(res.error?.message).toMatch(/Seul le propriétaire/);
  });

  it("un visiteur sans compte est refusé", async () => {
    const res = await clientFor(null).from("organizations").select("id");
    expect(res.error?.code).toBe("42501");
  });

  it("un JWT falsifié est rejeté", async () => {
    const forged = signJwt({ sub: a.userId, role: "authenticated" }).replace(/.$/, "x");
    const api = new PostgrestClient(postgrestUrl!, { headers: { Authorization: `Bearer ${forged}` } });
    const res = await api.from("organizations").select("id");
    expect(res.error).not.toBeNull();
    expect(res.data).toBeNull();
  });

  it("les fonctions du schéma private ne sont pas exposées", async () => {
    const res = await clientFor(a.userId).rpc("create_organization_for_user", {});
    expect(res.error).not.toBeNull();
  });
});
