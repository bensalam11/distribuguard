import { describe, expect, it } from "vitest";
import { adminQuery, as, createAuthUser, hasDatabase, signupOrganization, uniqueEmail } from "../setup/db";

describe.skipIf(!hasDatabase)("inscription (SQL)", () => {
  it("crée en une fois organisation, propriétaire, paramètres, dépôt principal et abonnement en essai", async () => {
    const { userId, orgId, meta, email } = await signupOrganization();

    const [org] = await adminQuery("select * from public.organizations where id = $1", [orgId]);
    expect(org).toMatchObject({ name: meta.company_name, city: "Douala", email });

    const members = await adminQuery("select user_id, role, full_name from public.members where organization_id = $1", [
      orgId,
    ]);
    expect(members).toEqual([{ user_id: userId, role: "owner", full_name: meta.full_name }]);

    const settings = await adminQuery(
      "select allow_negative_stock, currency from public.organization_settings where organization_id = $1",
      [orgId],
    );
    expect(settings).toEqual([{ allow_negative_stock: false, currency: "XAF" }]);

    const depots = await adminQuery("select name, is_main from public.depots where organization_id = $1", [orgId]);
    expect(depots).toEqual([{ name: "Dépôt principal", is_main: true }]);

    const [sub] = await adminQuery<{ plan_code: string; status: string; days: number }>(
      `select plan_code, status, current_period_end - (now() at time zone 'Africa/Douala')::date as days
       from public.subscriptions where organization_id = $1`,
      [orgId],
    );
    const [plan] = await adminQuery<{ code: string; trial_days: number }>(
      "select code, trial_days from public.plans where is_trial_default",
    );
    expect(sub).toEqual({ plan_code: plan.code, status: "essai", days: plan.trial_days });

    const audit = await adminQuery("select action from public.audit_logs where organization_id = $1", [orgId]);
    expect(audit).toEqual([{ action: "organizations.create" }]);
  });

  it("est atomique : si une donnée est invalide, ni compte ni organisation ne sont créés", async () => {
    const email = uniqueEmail("broken");
    const before = await adminQuery<{ n: string }>("select count(*) as n from public.organizations");

    await expect(
      createAuthUser(email, {
        signup_kind: "organization",
        full_name: "Jean",
        company_name: "", // invalide
        phone: "+237690000000",
        city: "Douala",
        address: "Akwa",
      }),
    ).rejects.toThrow();

    expect(await adminQuery("select id from auth.users where email = $1", [email])).toEqual([]);
    const after = await adminQuery<{ n: string }>("select count(*) as n from public.organizations");
    expect(after[0].n).toBe(before[0].n);
  });

  it("un utilisateur créé sans métadonnées n'appartient à aucune organisation", async () => {
    const userId = await createAuthUser(uniqueEmail("orphan"), {});
    expect(await as(userId).query("select id from public.organizations")).toEqual([]);
    expect(await as(userId).query("select id from public.members")).toEqual([]);
  });
});
