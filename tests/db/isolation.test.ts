import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, hasDatabase, inviteMember, signupOrganization } from "../setup/db";

/** Tables métier exposées : chacune doit être filtrée par organisation. */
const ORG_TABLES = [
  { table: "organizations", orgColumn: "id" },
  { table: "organization_settings", orgColumn: "organization_id" },
  { table: "members", orgColumn: "organization_id" },
  { table: "depots", orgColumn: "organization_id" },
  { table: "subscriptions", orgColumn: "organization_id" },
  { table: "audit_logs", orgColumn: "organization_id" },
  { table: "invitations", orgColumn: "organization_id" },
  { table: "packaging_types", orgColumn: "organization_id" },
  { table: "products", orgColumn: "organization_id" },
  { table: "product_prices", orgColumn: "organization_id" },
  { table: "vehicles", orgColumn: "organization_id" },
  { table: "drivers", orgColumn: "organization_id" },
  { table: "suppliers", orgColumn: "organization_id" },
] as const;

/** Une ligne dans chaque table du catalogue, pour ne pas tester des tables vides. */
async function seedCatalog(userId: string, orgId: string) {
  const s = as(userId);
  const [crate] = await s.query<{ id: string }>(
    "insert into public.packaging_types (organization_id, name, kind, capacity, deposit_value) values ($1, 'Casier 12', 'crate', 12, 1200) returning id",
    [orgId],
  );
  const [product] = await s.query<{ id: string }>(
    "insert into public.products (organization_id, code, name, bottles_per_case, crate_type_id) values ($1, 'KOLA65', 'Bière Kola 65 cl', 12, $2) returning id",
    [orgId, crate.id],
  );
  await s.query("insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, 7800)", [
    orgId,
    product.id,
  ]);
  await s.query("insert into public.vehicles (organization_id, name, kind) values ($1, 'Tricycle 1', 'tricycle')", [
    orgId,
  ]);
  await s.query("insert into public.drivers (organization_id, full_name) values ($1, 'Paul Ndjock')", [orgId]);
  await s.query("insert into public.suppliers (organization_id, name) values ($1, 'Brasserie Kola')", [orgId]);
}

describe.skipIf(!hasDatabase)("isolation entre organisations (SQL direct, RLS)", () => {
  let a: Awaited<ReturnType<typeof signupOrganization>>;
  let b: Awaited<ReturnType<typeof signupOrganization>>;

  beforeAll(async () => {
    a = await signupOrganization({ company_name: "Entreprise A" });
    b = await signupOrganization({ company_name: "Entreprise B" });
    // Invitations et journal non vides des deux côtés, pour ne pas tester des tables vides.
    await inviteMember(a.userId, "cashier");
    await inviteMember(b.userId, "cashier");
    await seedCatalog(a.userId, a.orgId);
    await seedCatalog(b.userId, b.orgId);
  });

  for (const { table, orgColumn } of ORG_TABLES) {
    it(`${table} : A ne voit que ses lignes, jamais celles de B`, async () => {
      const rows = await as(a.userId).query<{ org: string }>(`select ${orgColumn}::text as org from public.${table}`);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.org))).toEqual(new Set([a.orgId]));

      const leaked = await as(a.userId).query(`select 1 from public.${table} where ${orgColumn} = $1`, [b.orgId]);
      expect(leaked).toEqual([]);
    });

    it(`${table} : un visiteur non connecté ne lit rien`, async () => {
      await expect(anon().query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    });
  }

  it("A ne peut pas modifier l'organisation de B", async () => {
    const rows = await as(a.userId).query(
      "update public.organizations set name = 'Piraté' where id = $1 returning id",
      [b.orgId],
    );
    expect(rows).toEqual([]);
    const settings = await as(a.userId).query(
      "update public.organization_settings set allow_negative_stock = true where organization_id = $1 returning 1",
      [b.orgId],
    );
    expect(settings).toEqual([]);
  });

  it("A ne peut pas créer de dépôt dans B", async () => {
    await expect(
      as(a.userId).query("insert into public.depots (organization_id, name) values ($1, 'Intrus')", [b.orgId]),
    ).rejects.toThrow(/row-level security/);
  });

  it("A ne peut pas déplacer son dépôt vers B (colonne organization_id non modifiable)", async () => {
    await expect(as(a.userId).query("update public.depots set organization_id = $1", [b.orgId])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("personne ne peut s'ajouter directement comme membre d'une autre organisation", async () => {
    await expect(
      as(a.userId).query(
        "insert into public.members (organization_id, user_id, full_name, email, role) values ($1, $2, 'x', 'x@x.cm', 'owner')",
        [b.orgId, a.userId],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("A ne peut pas modifier un membre de B via la fonction update_member", async () => {
    const [bOwner] = await as(b.userId).query<{ id: string }>("select id from public.members where user_id = $1", [
      b.userId,
    ]);
    await expect(as(a.userId).query("select public.update_member($1, 'cashier', true)", [bOwner.id])).rejects.toThrow(
      /Membre introuvable/,
    );
  });

  it("aucun accès direct au journal d'audit en écriture", async () => {
    await expect(
      as(a.userId).query("insert into public.audit_logs (organization_id, action, entity_type) values ($1, 'x', 'x')", [
        a.orgId,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it("les fonctions internes (schéma private) ne sont pas appelables pour créer une organisation", async () => {
    await expect(
      as(a.userId).query("select private.create_organization_for_user($1, 'x@x.cm', '{}'::jsonb)", [a.userId]),
    ).rejects.toThrow(/permission denied/);
  });
});
