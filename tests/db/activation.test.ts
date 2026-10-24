import { describe, expect, it } from "vitest";
import { adminQuery, as, hasDatabase, inviteMember, signupOrganization } from "../setup/db";

const activated = async (userId: string) => {
  const [row] = await adminQuery<{ activated: boolean }>(
    "select activated_at is not null as activated from public.members where user_id = $1",
    [userId],
  );
  return row.activated;
};

describe.skipIf(!hasDatabase)("activation des comptes invités par lien (SQL)", () => {
  it("le propriétaire est actif dès l'inscription ; l'invité seulement après avoir choisi son mot de passe", async () => {
    const org = await signupOrganization();
    expect(await activated(org.userId)).toBe(true);

    const { userId } = await inviteMember(org.userId, "cashier");
    expect(await activated(userId)).toBe(false);

    // Le propriétaire voit qu'un nouveau lien est possible.
    const pending = await as(org.userId).query("select id from public.members where activated_at is null");
    expect(pending).toHaveLength(1);

    await as(userId).query("select public.mark_password_set()");
    expect(await activated(userId)).toBe(true);
  });

  it("mark_password_set n'active que son propre compte, et personne ne modifie activated_at directement", async () => {
    const org = await signupOrganization();
    const a = await inviteMember(org.userId, "cashier");
    const b = await inviteMember(org.userId, "storekeeper");

    await as(a.userId).query("select public.mark_password_set()");
    expect(await activated(a.userId)).toBe(true);
    expect(await activated(b.userId)).toBe(false);

    await expect(
      as(org.userId).query("update public.members set activated_at = now() where user_id = $1", [b.userId]),
    ).rejects.toThrow(/permission denied/);
  });
});
