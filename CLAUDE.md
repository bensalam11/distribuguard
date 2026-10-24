# DistribuGuard — règles pour Claude

La spécification complète est dans `SPEC.md`. Lis-la avant toute tâche et respecte-la.

## Méthode
- Travaille **une phase à la fois** (voir `PHASES.md`). Ne commence pas la phase suivante sans validation.
- Avant de coder une phase : résume en quelques lignes ce que tu vas faire et les tables touchées.
- À la fin d'une phase : lance `npm run lint`, `npm run typecheck`, `npm test`. Corrige jusqu'à ce que tout passe.
- Termine par : ce qui fonctionne, ce qui est testé, ce qui reste à faire, ce qui nécessite une action de ma part (clés Supabase, etc.).
- Si la spec est ambiguë ou contradictoire, **pose la question** au lieu de deviner.
- Ne jamais prétendre qu'une fonction marche si elle n'a pas été exécutée.

## Règles non négociables
- `organization_id` sur toute table métier + RLS activée.
- Stock et emballages modifiés uniquement par mouvements validés, en transaction, avec clé d'idempotence.
- Montants en FCFA en entier (`bigint`). Pas de `float` pour l'argent.
- Aucune opération validée supprimée : on annule par un mouvement inverse.
- Aucun secret dans le code ni côté navigateur. Tenir `.env.example` à jour.
- Rien de ce qui est listé « Hors v1 » dans `SPEC.md`.

## Conventions
- Code et noms de tables en anglais, interface en français.
- Une migration par changement de schéma, jamais de modification d'une migration déjà appliquée.
- Logique métier (stock, consignes, rapprochements) dans des fonctions SQL ou des modules serveur testés, pas dans les composants React.
