/**
 * Phase 1 via l'API REST (PostgREST + vrais JWT) : permissions sur les prix.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { clientFor, postgrestUrl } from "../setup/api";
import { adminQuery, as, inviteMember, signupOrganization } from "../setup/db";

describe.skipIf(!postgrestUrl)("catalogue et prix (via l'API)", () => {
  let org: Awaited<ReturnType<typeof signupOrganization>>;
  let productId: string;
  let storekeeperId: string;

  beforeAll(async () => {
    org = await signupOrganization({ company_name: "API Catalogue" });
    const [p] = await as(org.userId).query<{ id: string }>(
      "insert into public.products (organization_id, code, name, bottles_per_case) values ($1, 'EAU150', 'Eau Source 1,5 L', 6) returning id",
      [org.orgId],
    );
    productId = p.id;
    await as(org.userId).query("select public.save_product_prices($1, $2::jsonb)", [
      productId,
      JSON.stringify([{ category: null, case_price: 3000, bottle_price: null }]),
    ]);
    storekeeperId = (await inviteMember(org.userId, "storekeeper")).userId;
  });

  it("le magasinier voit les produits mais aucun prix", async () => {
    const api = clientFor(storekeeperId);
    const products = await api.from("products").select("id");
    expect(products.data).toEqual([{ id: productId }]);
    const prices = await api.from("product_prices").select("case_price");
    expect(prices.error).toBeNull();
    expect(prices.data).toEqual([]);
  });

  it("le magasinier ne peut pas changer un prix (ni directement, ni par la fonction)", async () => {
    const api = clientFor(storekeeperId);
    const updated = await api.from("product_prices").update({ case_price: 1 }).eq("product_id", productId).select();
    expect(updated.data ?? []).toEqual([]);

    const rpc = await api.rpc("save_product_prices", {
      p_product_id: productId,
      p_prices: [{ category: null, case_price: 1, bottle_price: null }],
    });
    expect(rpc.error?.message).toMatch(/Seuls le propriétaire et le gérant/);

    const [{ case_price }] = await adminQuery<{ case_price: string }>(
      "select case_price from public.product_prices where product_id = $1",
      [productId],
    );
    expect(Number(case_price)).toBe(3000);
  });

  it("un prix décimal envoyé par l'API est refusé (pas d'arrondi silencieux)", async () => {
    const api = clientFor(org.userId);
    const res = await api.from("product_prices").update({ case_price: 3000.5 }).eq("product_id", productId).select();
    expect(res.error).not.toBeNull();
  });

  it("le propriétaire modifie le prix", async () => {
    const api = clientFor(org.userId);
    const res = await api.rpc("save_product_prices", {
      p_product_id: productId,
      p_prices: [{ category: null, case_price: 3200, bottle_price: 550 }],
    });
    expect(res.error).toBeNull();
    const prices = await api.from("product_prices").select("case_price, bottle_price");
    expect(prices.data).toEqual([{ case_price: 3200, bottle_price: 550 }]);
  });
});
