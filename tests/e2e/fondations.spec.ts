import { expect, test, type Browser, type Page } from "@playwright/test";
import { hasMailbox, waitForLink } from "./mailbox";

const PASSWORD = "motdepasse123";

test("une page protégée redirige vers la connexion", async ({ page }) => {
  await page.goto("/equipe");
  await expect(page).toHaveURL(/\/connexion\?next=%2Fequipe$/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("un lien de confirmation invalide affiche un message clair", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=faux&type=email");
  await expect(page.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
});

async function signupAndConfirm(browser: Browser, company: string, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/inscription");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Nom du responsable : 2 caractères minimum.")).toBeVisible();

  const since = Date.now();
  await page.getByLabel("Nom du responsable").fill("Jean Mbarga");
  await page.getByLabel("Nom de l'entreprise").fill(company);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Téléphone").fill("+237 690 12 34 56");
  await page.getByLabel("Ville").fill("Douala");
  await page.getByLabel("Adresse").fill("Akwa, rue Joss");
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Compte créé.")).toBeVisible();

  await page.goto(await waitForLink(email, since));
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(page.getByText("Dépôt principal")).toBeVisible();
  await expect(page.getByText("Essai", { exact: true })).toBeVisible();
  return page;
}

test.describe("parcours complet (Supabase Auth + boîte e-mail de test)", () => {
  test.skip(!hasMailbox, "E2E_MAILPIT_URL ou E2E_MAIL_DIR requis");

  test("inscription, invitation d'un magasinier, isolation entre deux entreprises", async ({ browser }) => {
    const stamp = Date.now();
    const ownerA = `proprio.a.${stamp}@test.local`;
    const ownerB = `proprio.b.${stamp}@test.local`;
    const storekeeper = `magasinier.${stamp}@test.local`;

    const a = await signupAndConfirm(browser, "Boissons Akwa", ownerA);

    // Invitation
    await a.goto("/equipe");
    const since = Date.now();
    await a.getByLabel("Nom complet").fill("Paul Magasinier");
    await a.getByLabel("E-mail").fill(storekeeper);
    await a.getByLabel("Rôle", { exact: true }).selectOption("storekeeper");
    await a.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(a.getByText(`Invitation envoyée à ${storekeeper}.`)).toBeVisible();

    // Le magasinier active son compte sur mobile
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const s = await mobile.newPage();
    await s.goto(await waitForLink(storekeeper, since));
    await expect(s).toHaveURL(/\/mot-de-passe$/);
    await s.getByLabel("Nouveau mot de passe").fill("magasin123");
    await s.getByLabel("Confirmer le mot de passe").fill("magasin123");
    await s.getByRole("button", { name: "Enregistrer" }).click();
    await expect(s).toHaveURL(/\/tableau-de-bord$/);
    await expect(s.locator("header")).toContainText("Boissons Akwa · Magasinier");
    await expect(s.getByRole("link", { name: "Équipe" })).toHaveCount(0);
    expect((await s.goto("/equipe"))?.status()).toBe(404);

    // Une deuxième entreprise ne voit rien de la première
    const b = await signupAndConfirm(browser, "Dépôt Bonabéri", ownerB);
    await b.goto("/equipe");
    await expect(b.getByRole("heading", { name: "Membres (1)" })).toBeVisible();
    await expect(b.locator("main")).not.toContainText(ownerA);
    await expect(b.locator("main")).not.toContainText(storekeeper);
    await expect(b.locator("body")).not.toContainText("Boissons Akwa");
  });
});
