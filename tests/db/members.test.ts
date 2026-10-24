import { beforeEach, describe, expect, it } from "vitest";
import {
  adminQuery,
  as,
  createAuthUser,
  hasDatabase,
  inviteMember,
  signupOrganization,
  uniqueEmail,
} from "../setup/db";

describe.skipIf(!hasDatabase)("invitations et rôles (SQL)", () => {
  let org: Awaited<ReturnType<typeof signupOrganization>>;

  // Organisation neuve à chaque test : la limite d'utilisateurs du plan s'applique.
  beforeEach(async () => {
    org = await signupOrganization();
  });

  it("le propriétaire invite un magasinier : le compte créé est rattaché avec le bon rôle", async () => {
    const { userId, invitationId } = await inviteMember(org.userId, "storekeeper");

    const [member] = await adminQuery("select organization_id, role from public.members where user_id = $1", [userId]);
    expect(member).toEqual({ organization_id: org.orgId, role: "storekeeper" });

    const [inv] = await adminQuery("select status from public.invitations where id = $1", [invitationId]);
    expect(inv).toEqual({ status: "accepted" });

    // Le magasinier voit son organisation…
    const orgs = await as(userId).query<{ id: string }>("select id from public.organizations");
    expect(orgs.map((o) => o.id)).toEqual([org.orgId]);
    // …mais pas le journal d'audit ni les invitations.
    expect(await as(userId).query("select id from public.audit_logs")).toEqual([]);
    expect(await as(userId).query("select id from public.invitations")).toEqual([]);
  });

  it("un magasinier ne peut ni inviter, ni changer un rôle, ni modifier les paramètres", async () => {
    const { userId } = await inviteMember(org.userId, "storekeeper");
    const [self] = await as(userId).query<{ id: string }>("select id from public.members where user_id = $1", [userId]);

    await expect(as(userId).query("select public.create_invitation('x@test.local', 'X', 'cashier')")).rejects.toThrow(
      /Seul le propriétaire/,
    );
    await expect(as(userId).query("select public.update_member($1, 'manager', true)", [self.id])).rejects.toThrow(
      /Seul le propriétaire/,
    );

    const updated = await as(userId).query(
      "update public.organization_settings set allow_negative_stock = true returning 1",
    );
    expect(updated).toEqual([]);
    const renamed = await as(userId).query("update public.organizations set name = 'Autre' returning 1");
    expect(renamed).toEqual([]);
  });

  it("un gérant ne peut pas inviter, mais peut créer un dépôt", async () => {
    const { userId } = await inviteMember(org.userId, "manager");
    await expect(as(userId).query("select public.create_invitation('y@test.local', 'Y', 'cashier')")).rejects.toThrow(
      /Seul le propriétaire/,
    );
    const rows = await as(userId).query(
      "insert into public.depots (organization_id, name) values ($1, 'Dépôt Bonabéri') returning name",
      [org.orgId],
    );
    expect(rows).toEqual([{ name: "Dépôt Bonabéri" }]);
  });

  it("un caissier ne peut pas créer de dépôt", async () => {
    const { userId } = await inviteMember(org.userId, "cashier");
    await expect(
      as(userId).query("insert into public.depots (organization_id, name) values ($1, 'Dépôt caisse')", [org.orgId]),
    ).rejects.toThrow(/row-level security/);
  });

  it("on ne peut pas inviter une adresse qui a déjà un compte", async () => {
    await expect(
      as(org.userId).query("select public.create_invitation($1, 'Moi', 'cashier')", [org.email]),
    ).rejects.toThrow(/déjà utilisée/);
  });

  it("une invitation ne peut pas être utilisée avec une autre adresse e-mail", async () => {
    const [{ create_invitation: id }] = await as(org.userId).query<{ create_invitation: string }>(
      "select public.create_invitation($1, 'Paul', 'cashier')",
      [uniqueEmail("paul")],
    );
    await expect(createAuthUser(uniqueEmail("intrus"), { invitation_id: id })).rejects.toThrow(/Invitation invalide/);
  });

  it("une invitation révoquée ne peut plus être utilisée", async () => {
    const email = uniqueEmail("revoked");
    const [{ create_invitation: id }] = await as(org.userId).query<{ create_invitation: string }>(
      "select public.create_invitation($1, 'Rita', 'cashier')",
      [email],
    );
    await as(org.userId).query("select public.cancel_invitation($1)", [id]);
    await expect(createAuthUser(email, { invitation_id: id })).rejects.toThrow(/Invitation invalide/);
  });

  it("respecte la limite d'utilisateurs du plan (lue depuis la table plans)", async () => {
    const small = await signupOrganization();
    await adminQuery(
      "insert into public.plans (code, name, max_depots, max_users) values ('mini_test', 'Mini', 1, 2) on conflict do nothing",
    );
    await adminQuery("update public.subscriptions set plan_code = 'mini_test' where organization_id = $1", [
      small.orgId,
    ]);

    await inviteMember(small.userId, "cashier"); // 2e utilisateur : OK
    await expect(inviteMember(small.userId, "cashier")).rejects.toThrow(/Limite d'utilisateurs/);
  });

  it("changement de rôle par le propriétaire : appliqué et journalisé (avant/après)", async () => {
    const { userId } = await inviteMember(org.userId, "cashier");
    const [m] = await adminQuery<{ id: string }>("select id from public.members where user_id = $1", [userId]);

    await as(org.userId).query("select public.update_member($1, 'manager', true)", [m.id]);

    const [after] = await adminQuery("select role from public.members where id = $1", [m.id]);
    expect(after).toEqual({ role: "manager" });

    const [log] = await adminQuery<{ actor_user_id: string; before: { role: string }; after: { role: string } }>(
      "select actor_user_id, before, after from public.audit_logs where entity_id = $1 and action = 'members.update'",
      [m.id],
    );
    expect(log.actor_user_id).toBe(org.userId);
    expect(log.before.role).toBe("cashier");
    expect(log.after.role).toBe("manager");
  });

  it("un membre désactivé perd immédiatement l'accès", async () => {
    const { userId } = await inviteMember(org.userId, "cashier");
    const [m] = await adminQuery<{ id: string }>("select id from public.members where user_id = $1", [userId]);
    await as(org.userId).query("select public.update_member($1, 'cashier', false)", [m.id]);
    expect(await as(userId).query("select id from public.organizations")).toEqual([]);
  });

  it("l'entreprise garde toujours au moins un propriétaire actif", async () => {
    const solo = await signupOrganization();
    const [owner] = await adminQuery<{ id: string }>("select id from public.members where user_id = $1", [solo.userId]);
    await expect(as(solo.userId).query("select public.update_member($1, 'manager', true)", [owner.id])).rejects.toThrow(
      /au moins un propriétaire/,
    );
    await expect(as(solo.userId).query("select public.update_member($1, 'owner', false)", [owner.id])).rejects.toThrow(
      /au moins un propriétaire/,
    );
  });
});
