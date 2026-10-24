# Configuration Supabase — à faire vous-même

Durée : environ 20 minutes. À faire une fois par environnement (test, puis production).

## 1. Créer le projet

1. Sur <https://supabase.com/dashboard>, **New project**.
2. Nom : `distribuguard-test` (créez un second projet `distribuguard-prod` plus tard).
3. Région : la plus proche du Cameroun disponible (ex. _West EU (Paris)_ ou _Central EU (Frankfurt)_).
4. Notez le **mot de passe de la base** dans un gestionnaire de mots de passe.

## 2. Appliquer les migrations

**Option A — Supabase CLI (recommandée)**

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>   # le ref est dans l'URL du dashboard
npx supabase db push                              # applique supabase/migrations/* dans l'ordre
```

**Option B — à la main** : _SQL Editor_ → coller et exécuter chaque fichier de `supabase/migrations/`,
**dans l'ordre des noms** (`…0001…`, puis `…0002…`, etc.).

> Ne jamais exécuter `supabase/tests/supabase_stub.sql` sur Supabase : il ne sert qu'aux tests locaux.

Vérification : _Table Editor_ doit montrer `organizations`, `members`, `organization_settings`, `depots`,
`plans` (3 lignes), `subscriptions`, `invitations`, `audit_logs`, toutes avec le badge **RLS enabled**.

## 3. Authentification

_Authentication → Sign In / Providers_ :

- **Email** activé, **Confirm email** activé.
- Longueur minimale du mot de passe : **8**.

_Authentication → URL Configuration_ :

- **Site URL** : `http://localhost:3000` (en production : l'URL réelle, ex. `https://app.distribuguard.cm`).
- **Redirect URLs** : ajouter `http://localhost:3000/**` (et `https://<votre-domaine>/**` en production).

## 4. Modèles d'e-mails (obligatoire)

_Authentication → Emails → Templates_. Les modèles par défaut ne fonctionnent pas avec l'application :
remplacez le contenu de ces trois modèles par celui des fichiers du dossier `supabase/templates/` :

| Modèle Supabase  | Sujet conseillé                          | Fichier à copier                     |
| ---------------- | ---------------------------------------- | ------------------------------------ |
| Confirm signup   | Confirmez votre inscription à DistribuGuard | `supabase/templates/confirmation.html` |
| Invite user      | Vous êtes invité sur DistribuGuard        | `supabase/templates/invite.html`       |
| Reset Password   | Réinitialisation de votre mot de passe   | `supabase/templates/recovery.html`     |

## 5. Envoi des e-mails (SMTP)

Le service d'e-mail intégré de Supabase n'envoie qu'aux adresses **des membres de votre équipe Supabase**
et seulement quelques e-mails par heure. Pour inviter un vrai employé, configurez un SMTP :
_Project Settings → Authentication → SMTP Settings_ (ex. Brevo, Resend, Mailjet, ou le SMTP de votre hébergeur).

- Expéditeur : `noreply@<votre-domaine>`, nom : `DistribuGuard`.

Pour un tout premier essai sans SMTP, utilisez comme adresses (propriétaire et employé) des e-mails
ajoutés comme membres de votre organisation Supabase.

## 6. Clés pour l'application

_Project Settings → API Keys_ (ou _API_ sur les anciens projets). Créez `.env.local` à partir de `.env.example` :

```bash
cp .env.example .env.local
```

| Variable                        | Où la trouver                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | _Project URL_                                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **anon** / **publishable** (publique)                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | clé **service_role** / **secret** — **SECRÈTE**, jamais commitée ni partagée     |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` en local, l'URL réelle en production                     |

En production (ex. Vercel), saisissez ces variables dans les paramètres d'environnement de l'hébergeur.

## 7. Lancer et vérifier

```bash
npm install
npm run dev     # http://localhost:3000
```

Vérification de la phase 0 :

1. `/inscription` → créez l'entreprise A → cliquez le lien reçu par e-mail → tableau de bord avec
   « Dépôt principal » et abonnement « Essai ».
2. Dans une fenêtre de navigation privée, créez l'entreprise B → elle ne voit ni l'entreprise A ni ses membres.
3. Avec A : **Équipe** → invitez un magasinier → il reçoit l'e-mail, choisit son mot de passe, arrive sur
   le tableau de bord de A, sans menu « Équipe ».
