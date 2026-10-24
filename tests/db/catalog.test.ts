import { beforeEach, describe, expect, it } from "vitest";
import { adminQuery, as, hasDatabase, inviteMember, signupOrganization } from "../setup/db";

type Org = Awaited<ReturnType<typeof signupOrganization>>;

async function createCrate(userId: string, orgId: string, name = "Casier 12", capacity = 12, value = 1200) {
  const [row] = await as(userId).query<{ id: string }>(
    `insert into public.packaging_types (organization_id, name, kind, capacity, deposit_value)
     values ($1, $2, 'crate', $3, $4) returning id`,
    [orgId, name, capacity, value],
  );
  return row.id;
}

async function createBottle(userId: string, orgId: string, name = "Bouteille 65 cl", value = 200) {
  const [row] = await as(userId).query<{ id: string }>(
    `insert into public.packaging_types (organization_id, name, kind, capacity, deposit_value)
     values ($1, $2, 'bottle', 1, $3) returning id`,
    [orgId, name, value],
  );
  return row.id;
}

async function createProduct(
  userId: string,
  orgId: string,
  opts: { code?: string; bottlesPerCase?: number; crateId?: string | null; bottleId?: string | null } = {},
) {
  const [row] = await as(userId).query<{ id: string }>(
    `insert into public.products (organization_id, code, name, bottles_per_case, crate_type_id, bottle_type_id)
     values ($1, $2, 'Bière Kola 65 cl', $3, $4, $5) returning id`,
    [orgId, opts.code ?? "KOLA65", opts.bottlesPerCase ?? 12, opts.crateId ?? null, opts.bottleId ?? null],
  );
  return row.id;
}

describe.skipIf(!hasDatabase)("catalogue : produits, emballages, prix (SQL)", () => {
  let org: Org;

  beforeEach(async () => {
    org = await signupOrganization();
  });

  it("le propriétaire crée casier, bouteille, produit consigné et son prix standard", async () => {
    const crate = await createCrate(org.userId, org.orgId);
    const bottle = await createBottle(org.userId, org.orgId);
    const product = await createProduct(org.userId, org.orgId, { crateId: crate, bottleId: bottle });

    await as(org.userId).query(
      "insert into public.product_prices (organization_id, product_id, case_price, bottle_price) values ($1, $2, 7800, 700)",
      [org.orgId, product],
    );
    const prices = await as(org.userId).query("select case_price::int, bottle_price::int from public.product_prices");
    expect(prices).toEqual([{ case_price: 7800, bottle_price: 700 }]);
  });

  it("un casier doit avoir le même nombre de bouteilles que le produit", async () => {
    const crate = await createCrate(org.userId, org.orgId, "Casier 24", 24);
    await expect(createProduct(org.userId, org.orgId, { crateId: crate, bottlesPerCase: 12 })).rejects.toThrow(
      /contient 24 bouteilles/,
    );
  });

  it("une bouteille ne peut pas servir de casier (et inversement)", async () => {
    const crate = await createCrate(org.userId, org.orgId);
    const bottle = await createBottle(org.userId, org.orgId);
    await expect(createProduct(org.userId, org.orgId, { crateId: bottle })).rejects.toThrow(/n'est pas un casier/);
    await expect(createProduct(org.userId, org.orgId, { bottleId: crate })).rejects.toThrow(/n'est pas une bouteille/);
  });

  it("un produit non consigné (canette) n'a pas d'emballage", async () => {
    const id = await createProduct(org.userId, org.orgId, { code: "CAN33", bottlesPerCase: 24 });
    const [p] = await adminQuery("select crate_type_id, bottle_type_id from public.products where id = $1", [id]);
    expect(p).toEqual({ crate_type_id: null, bottle_type_id: null });
  });

  it("code produit unique dans l'organisation (sans tenir compte de la casse)", async () => {
    await createProduct(org.userId, org.orgId, { code: "KOLA65" });
    await expect(createProduct(org.userId, org.orgId, { code: "kola65" })).rejects.toThrow(/duplicate key/);
  });

  it("un seul prix standard et un seul prix par catégorie de client", async () => {
    const product = await createProduct(org.userId, org.orgId);
    const insert = (category: string | null, price: number) =>
      as(org.userId).query(
        "insert into public.product_prices (organization_id, product_id, client_category, case_price) values ($1, $2, $3, $4)",
        [org.orgId, product, category, price],
      );
    await insert(null, 7800);
    await insert("bar", 8000);
    await expect(insert(null, 7500)).rejects.toThrow(/duplicate key/);
    await expect(insert("bar", 8100)).rejects.toThrow(/duplicate key/);
  });

  it("les montants sont des entiers positifs (pas de prix nul ou négatif, pas de décimales)", async () => {
    const product = await createProduct(org.userId, org.orgId);
    await expect(
      as(org.userId).query(
        "insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, 0)",
        [org.orgId, product],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(org.userId).query(
        // Valeur transmise comme par l'API (texte) : pas d'arrondi silencieux.
        "insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, $3)",
        [org.orgId, product, "7800.5"],
      ),
    ).rejects.toThrow(/invalid input syntax|bigint/);
  });

  it("le type et la capacité d'un emballage ne sont plus modifiables après création", async () => {
    const crate = await createCrate(org.userId, org.orgId);
    await expect(
      as(org.userId).query("update public.packaging_types set capacity = 24 where id = $1", [crate]),
    ).rejects.toThrow(/permission denied/);
  });

  it("aucune suppression de produit, d'emballage, de véhicule ou de fournisseur", async () => {
    const crate = await createCrate(org.userId, org.orgId);
    const product = await createProduct(org.userId, org.orgId, { crateId: crate });
    await expect(as(org.userId).query("delete from public.products where id = $1", [product])).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(org.userId).query("delete from public.packaging_types where id = $1", [crate])).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(org.userId).query("delete from public.vehicles")).rejects.toThrow(/permission denied/);
    await expect(as(org.userId).query("delete from public.suppliers")).rejects.toThrow(/permission denied/);
  });

  it("le prix standard ne peut pas être supprimé ; un prix par catégorie oui", async () => {
    const product = await createProduct(org.userId, org.orgId);
    await as(org.userId).query(
      "insert into public.product_prices (organization_id, product_id, client_category, case_price) values ($1, $2, null, 7800), ($1, $2, 'bar', 8000)",
      [org.orgId, product],
    );
    const deleted = await as(org.userId).query("delete from public.product_prices returning client_category");
    expect(deleted).toEqual([{ client_category: "bar" }]);
    const [{ n }] = await adminQuery<{ n: number }>(
      "select count(*)::int as n from public.product_prices where product_id = $1",
      [product],
    );
    expect(n).toBe(1);
  });

  it("toute modification de prix est enregistrée dans le journal d'audit (avant / après)", async () => {
    const product = await createProduct(org.userId, org.orgId);
    await as(org.userId).query(
      "insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, 7800)",
      [org.orgId, product],
    );
    await as(org.userId).query("update public.product_prices set case_price = 8200 where product_id = $1", [product]);

    const logs = await adminQuery<{ action: string; actor_user_id: string; before: unknown; after: unknown }>(
      `select action, actor_user_id, before->>'case_price' as before, after->>'case_price' as after
       from public.audit_logs where entity_type = 'product_prices' and organization_id = $1 order by id`,
      [org.orgId],
    );
    expect(logs).toEqual([
      { action: "product_prices.insert", actor_user_id: org.userId, before: null, after: "7800" },
      { action: "product_prices.update", actor_user_id: org.userId, before: "7800", after: "8200" },
    ]);
  });
});

describe.skipIf(!hasDatabase)("permissions par rôle sur le catalogue (SQL)", () => {
  let org: Org;
  let product: string;

  beforeEach(async () => {
    org = await signupOrganization();
    const crate = await createCrate(org.userId, org.orgId);
    product = await createProduct(org.userId, org.orgId, { crateId: crate });
    await as(org.userId).query(
      "insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, 7800)",
      [org.orgId, product],
    );
  });

  it("le magasinier ne peut pas changer un prix, ni en créer un", async () => {
    const { userId } = await inviteMember(org.userId, "storekeeper");
    const updated = await as(userId).query("update public.product_prices set case_price = 1 returning 1");
    expect(updated).toEqual([]);
    await expect(
      as(userId).query(
        "insert into public.product_prices (organization_id, product_id, client_category, case_price) values ($1, $2, 'bar', 1)",
        [org.orgId, product],
      ),
    ).rejects.toThrow(/row-level security/);

    const [{ case_price }] = await adminQuery<{ case_price: string }>(
      "select case_price from public.product_prices where product_id = $1",
      [product],
    );
    expect(Number(case_price)).toBe(7800);
  });

  it("le magasinier ne voit pas les prix", async () => {
    const { userId } = await inviteMember(org.userId, "storekeeper");
    expect(await as(userId).query("select * from public.product_prices")).toEqual([]);
  });

  it("le magasinier crée et modifie un produit (hors prix)", async () => {
    const { userId } = await inviteMember(org.userId, "storekeeper");
    await createProduct(userId, org.orgId, { code: "EAU150", bottlesPerCase: 6 });
    const renamed = await as(userId).query(
      "update public.products set name = 'Bière Kola 65 cl (nouveau)', alert_threshold = 60 where id = $1 returning id",
      [product],
    );
    expect(renamed).toHaveLength(1);
  });

  it("le magasinier ne peut pas changer la valeur de consigne ni créer un véhicule", async () => {
    const { userId } = await inviteMember(org.userId, "storekeeper");
    expect(await as(userId).query("update public.packaging_types set deposit_value = 1 returning 1")).toEqual([]);
    await expect(
      as(userId).query(
        "insert into public.vehicles (organization_id, name, kind) values ($1, 'Tricycle 1', 'tricycle')",
        [org.orgId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("le caissier voit les prix mais ne peut ni les modifier ni créer de produit", async () => {
    const { userId } = await inviteMember(org.userId, "cashier");
    const prices = await as(userId).query<{ case_price: string }>("select case_price from public.product_prices");
    expect(prices.map((p) => Number(p.case_price))).toEqual([7800]);
    expect(await as(userId).query("update public.product_prices set case_price = 1 returning 1")).toEqual([]);
    await expect(createProduct(userId, org.orgId, { code: "X1" })).rejects.toThrow(/row-level security/);
  });

  it("le gérant modifie un prix, crée un véhicule, un chauffeur et un fournisseur", async () => {
    const { userId } = await inviteMember(org.userId, "manager");
    const updated = await as(userId).query("update public.product_prices set case_price = 8000 returning 1");
    expect(updated).toHaveLength(1);
    await as(userId).query(
      "insert into public.vehicles (organization_id, name, kind, plate_number) values ($1, 'Tricycle 1', 'tricycle', 'LT 123 AB')",
      [org.orgId],
    );
    await as(userId).query(
      "insert into public.drivers (organization_id, full_name, phone) values ($1, 'Paul Ndjock', '690000001')",
      [org.orgId],
    );
    await as(userId).query("insert into public.suppliers (organization_id, name) values ($1, 'Brasserie Kola')", [
      org.orgId,
    ]);
    const [{ n }] = await adminQuery<{ n: number }>(
      `select (select count(*) from public.vehicles where organization_id = $1)
            + (select count(*) from public.drivers where organization_id = $1)
            + (select count(*) from public.suppliers where organization_id = $1) as n`,
      [org.orgId],
    );
    expect(Number(n)).toBe(3);
  });
});

describe.skipIf(!hasDatabase)("dépôts : limite du plan et dépôt principal (SQL)", () => {
  let org: Org;

  beforeEach(async () => {
    org = await signupOrganization();
  });

  it("la limite de dépôts du plan est appliquée (plan pilote : 2)", async () => {
    const [{ max_depots }] = await adminQuery<{ max_depots: number }>(
      "select p.max_depots from public.subscriptions s join public.plans p on p.code = s.plan_code where s.organization_id = $1",
      [org.orgId],
    );
    for (let i = 1; i < max_depots; i++) {
      await as(org.userId).query("insert into public.depots (organization_id, name) values ($1, $2)", [
        org.orgId,
        `Dépôt ${i}`,
      ]);
    }
    await expect(
      as(org.userId).query("insert into public.depots (organization_id, name) values ($1, 'Dépôt de trop')", [
        org.orgId,
      ]),
    ).rejects.toThrow(/Limite de dépôts/);
  });

  it("réactiver un dépôt compte dans la limite", async () => {
    const [{ id }] = await as(org.userId).query<{ id: string }>(
      "insert into public.depots (organization_id, name) values ($1, 'Dépôt Bonabéri') returning id",
      [org.orgId],
    );
    await as(org.userId).query("update public.depots set is_active = false where id = $1", [id]);
    await as(org.userId).query("insert into public.depots (organization_id, name) values ($1, 'Dépôt Ndokoti')", [
      org.orgId,
    ]);
    await expect(as(org.userId).query("update public.depots set is_active = true where id = $1", [id])).rejects.toThrow(
      /Limite de dépôts/,
    );
  });

  it("le dépôt principal ne peut pas être désactivé", async () => {
    await expect(as(org.userId).query("update public.depots set is_active = false where is_main")).rejects.toThrow(
      /dépôt principal/,
    );
  });
});

describe.skipIf(!hasDatabase)("assistant de démarrage (SQL)", () => {
  it("le propriétaire marque des étapes faites ou sautées ; le magasinier ne peut pas", async () => {
    const org = await signupOrganization();
    await as(org.userId).query("select public.set_onboarding_step('depots', 'done')");
    await as(org.userId).query("select public.set_onboarding_step('vehicles', 'skipped')");
    await as(org.userId).query("select public.finish_onboarding()");

    const [settings] = await as(org.userId).query<{ onboarding_steps: unknown; finished: boolean }>(
      "select onboarding_steps, onboarding_finished_at is not null as finished from public.organization_settings",
    );
    expect(settings).toEqual({ onboarding_steps: { depots: "done", vehicles: "skipped" }, finished: true });

    const { userId } = await inviteMember(org.userId, "storekeeper");
    await expect(as(userId).query("select public.set_onboarding_step('catalog', 'done')")).rejects.toThrow(
      /Seuls le propriétaire et le gérant/,
    );
    await expect(as(org.userId).query("select public.set_onboarding_step('stock', 'done')")).rejects.toThrow(
      /Étape inconnue/,
    );
  });
});

describe.skipIf(!hasDatabase)("catalogue : isolation entre organisations (SQL)", () => {
  it("A ne peut pas lier son produit à un emballage de B, ni fixer un prix sur un produit de B", async () => {
    const a = await signupOrganization();
    const b = await signupOrganization();
    const crateB = await createCrate(b.userId, b.orgId);
    const productB = await createProduct(b.userId, b.orgId);

    await expect(createProduct(a.userId, a.orgId, { crateId: crateB })).rejects.toThrow(/foreign key/);
    await expect(
      as(a.userId).query(
        "insert into public.product_prices (organization_id, product_id, case_price) values ($1, $2, 1)",
        [a.orgId, productB],
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      as(a.userId).query(
        "insert into public.products (organization_id, code, name, bottles_per_case) values ($1, 'X', 'Intrus', 12)",
        [b.orgId],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await as(a.userId).query("update public.products set name = 'Piraté' where id = $1 returning 1", [productB]),
    ).toEqual([]);
  });
});

describe.skipIf(!hasDatabase)("grille de prix : save_product_prices (SQL)", () => {
  it("enregistre, modifie et retire des prix par catégorie en une fois", async () => {
    const org = await signupOrganization();
    const product = await createProduct(org.userId, org.orgId);
    const save = (userId: string, prices: unknown) =>
      as(userId).query("select public.save_product_prices($1, $2::jsonb)", [product, JSON.stringify(prices)]);

    await save(org.userId, [
      { category: null, case_price: 7800, bottle_price: 700 },
      { category: "bar", case_price: 8000, bottle_price: null },
      { category: "revendeur", case_price: 7500, bottle_price: null },
    ]);
    await save(org.userId, [
      { category: null, case_price: 7900, bottle_price: null },
      { category: "bar", case_price: 8100, bottle_price: 720 },
      { category: "revendeur", case_price: null, bottle_price: null },
    ]);

    const rows = await as(org.userId).query(
      "select client_category, case_price::int, bottle_price::int from public.product_prices order by client_category nulls first",
    );
    expect(rows).toEqual([
      { client_category: null, case_price: 7900, bottle_price: null },
      { client_category: "bar", case_price: 8100, bottle_price: 720 },
    ]);
  });

  it("refuse une grille sans prix standard, et refuse le magasinier", async () => {
    const org = await signupOrganization();
    const product = await createProduct(org.userId, org.orgId);
    await expect(
      as(org.userId).query("select public.save_product_prices($1, $2::jsonb)", [
        product,
        JSON.stringify([{ category: "bar", case_price: 8000 }]),
      ]),
    ).rejects.toThrow(/prix standard au casier est obligatoire/);

    const { userId } = await inviteMember(org.userId, "storekeeper");
    await expect(
      as(userId).query("select public.save_product_prices($1, $2::jsonb)", [
        product,
        JSON.stringify([{ category: null, case_price: 1 }]),
      ]),
    ).rejects.toThrow(/Seuls le propriétaire et le gérant/);
  });

  it("une erreur au milieu de la grille n'enregistre rien (transaction)", async () => {
    const org = await signupOrganization();
    const product = await createProduct(org.userId, org.orgId);
    await expect(
      as(org.userId).query("select public.save_product_prices($1, $2::jsonb)", [
        product,
        JSON.stringify([
          { category: null, case_price: 7800 },
          { category: "bar", case_price: -5 },
        ]),
      ]),
    ).rejects.toThrow(/check constraint/);
    expect(await adminQuery("select 1 from public.product_prices where product_id = $1", [product])).toEqual([]);
  });

  it("A ne peut pas fixer les prix d'un produit de B", async () => {
    const a = await signupOrganization();
    const b = await signupOrganization();
    const productB = await createProduct(b.userId, b.orgId);
    await expect(
      as(a.userId).query("select public.save_product_prices($1, $2::jsonb)", [
        productB,
        JSON.stringify([{ category: null, case_price: 1 }]),
      ]),
    ).rejects.toThrow(/Produit introuvable/);
  });
});

describe.skipIf(!hasDatabase)("création d'un produit avec son prix : create_product (SQL)", () => {
  it("crée la fiche et le prix standard en une fois", async () => {
    const org = await signupOrganization();
    const crate = await createCrate(org.userId, org.orgId);
    const [{ create_product: id }] = await as(org.userId).query<{ create_product: string }>(
      "select public.create_product(p_code => 'KOLA65', p_name => 'Bière Kola 65 cl', p_bottles_per_case => 12, p_crate_type_id => $1, p_case_price => 7800)",
      [crate],
    );
    const prices = await as(org.userId).query(
      "select client_category, case_price::int from public.product_prices where product_id = $1",
      [id],
    );
    expect(prices).toEqual([{ client_category: null, case_price: 7800 }]);
  });

  it("si le prix est refusé (magasinier), le produit n'est pas créé non plus", async () => {
    const org = await signupOrganization();
    const { userId } = await inviteMember(org.userId, "storekeeper");
    await expect(
      as(userId).query(
        "select public.create_product(p_code => 'EAU150', p_name => 'Eau Source 1,5 L', p_bottles_per_case => 6, p_case_price => 3000)",
      ),
    ).rejects.toThrow(/Seuls le propriétaire et le gérant/);
    expect(await adminQuery("select 1 from public.products where organization_id = $1", [org.orgId])).toEqual([]);

    // Sans prix, le magasinier crée bien la fiche.
    await as(userId).query(
      "select public.create_product(p_code => 'EAU150', p_name => 'Eau Source 1,5 L', p_bottles_per_case => 6)",
    );
    expect(await adminQuery("select 1 from public.products where organization_id = $1", [org.orgId])).toHaveLength(1);
  });
});
