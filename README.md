# DistribuGuard

Logiciel de gestion pour distributeurs de boissons au Cameroun : stock, tournées, encaissements et consignes.

- Spécification : [`SPEC.md`](SPEC.md) · Règles de travail : [`CLAUDE.md`](CLAUDE.md) · Phases : [`PHASES.md`](PHASES.md)
- Configuration Supabase : [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) · Zod · Vitest · Playwright.

## Structure

```
src/
  app/(auth)/          pages publiques : connexion, inscription, mot de passe
  app/(app)/           pages de l'application (sidebar + menu mobile)
  app/auth/            liens des e-mails (confirm) et déconnexion
  components/          interface (ui/, layout/)
  lib/server/          logique serveur (auth, équipe, session) — jamais importée côté navigateur
  lib/supabase/        clients Supabase (session utilisateur ; admin = serveur uniquement)
  lib/validation/      schémas Zod partagés client/serveur
  middleware.ts        session + protection des pages
supabase/
  migrations/          schéma SQL versionné (RLS sur toutes les tables)
  templates/           modèles d'e-mails à copier dans Supabase
  tests/               imitation de l'environnement Supabase pour les tests locaux
tests/
  db/                  tests SQL directs (RLS, inscription, rôles)
  api/                 tests via l'API REST (PostgREST) avec de vrais JWT
  e2e/                 parcours Playwright
```

## Scripts

| Commande                | Rôle                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `npm run dev`           | serveur de développement                                   |
| `npm run build`         | build de production                                        |
| `npm run lint`          | ESLint                                                     |
| `npm run typecheck`     | vérification TypeScript                                    |
| `npm test`              | tests unitaires, base de données et API (Vitest)           |
| `npm run test:e2e`      | parcours navigateur (Playwright, application lancée)       |
| `npm run db:test:reset` | recrée la base de test locale                              |
| `npm run format`        | mise en forme (Prettier)                                   |

## Tests

### Base de données et API (`npm test`)

Les tests d'isolation tournent sur une base PostgreSQL locale, effacée et recréée à chaque lancement :
imitation du schéma `auth` de Supabase (`supabase/tests/supabase_stub.sql`) puis toutes les migrations.

1. PostgreSQL 15+ local.
2. Pour les tests « via l'API », le binaire [PostgREST](https://github.com/PostgREST/postgrest/releases) (v12 ou plus récent ; v16 testée sur Mac Intel).
3. Fichier `.env.test.local` :

   ```
   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/distribuguard_test
   POSTGREST_BIN=/chemin/vers/postgrest
   ```

Sans `TEST_DATABASE_URL`, ces tests sont **ignorés** (un avertissement s'affiche) : seuls les tests unitaires tournent.

### Parcours navigateur (`npm run test:e2e`)

L'application doit tourner (`npm run build && npm start`) et pointer vers un Supabase de test dont les
modèles d'e-mails sont configurés. Pour lire les e-mails :

- `E2E_MAILPIT_URL=http://127.0.0.1:54324` avec `supabase start` (Mailpit) ;
- ou `E2E_MAIL_DIR=<dossier>` si un serveur SMTP de test dépose des fichiers `.eml`.

Sans boîte e-mail, seuls les tests sans e-mail tournent.

## Avancement

- [x] Phase 0 — Fondations
- [ ] Phase 1 — Catalogue, emballages, dépôts, véhicules
- [ ] Phase 2 — Moteur de stock
- [ ] Phase 3 — Clients et tournées
- [ ] Phase 4 — Argent et consignes
- [ ] Phase 5 — Tableau de bord, rapports, alertes, abonnements
