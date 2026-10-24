# DistribuGuard — demandes à donner à Claude, phase par phase

Mets `SPEC.md`, `CLAUDE.md` et ce fichier à la racine du projet.
Copie une demande, attends la fin, **teste toi-même dans le navigateur**, puis passe à la suivante.

---

## Phase 0 — Fondations
> Lis CLAUDE.md et SPEC.md. Réalise la phase 0 : initialise le projet Next.js + TypeScript + Tailwind + Supabase, la structure de dossiers, lint, typecheck et tests. Crée les migrations pour organisations, membres, rôles, paramètres, abonnements et audit_logs, avec RLS. Implémente l'inscription (création atomique de l'organisation, du propriétaire, du dépôt principal et de l'abonnement en essai), la connexion, l'invitation d'un employé et la mise en page (sidebar + menu mobile). Écris les tests d'isolation entre organisations. Donne-moi les étapes de configuration Supabase que je dois faire moi-même.

**Je vérifie** : je crée deux comptes d'entreprise, chacun ne voit que ses données ; j'invite un magasinier.

## Phase 1 — Catalogue, emballages, dépôts, véhicules
> Phase 1 de SPEC.md : types d'emballage avec valeur de consigne, produits (unité de base bouteille, bouteilles par casier, emballage associé), grille de prix par catégorie client, dépôts, véhicules, fiches chauffeurs, fournisseurs. Saisie et affichage en casiers + bouteilles. Assistant de démarrage avec étapes sautables. Respecte les permissions par rôle.

**Je vérifie** : je crée 5 produits, 2 types de casiers, un tricycle ; le magasinier ne peut pas changer un prix.

## Phase 2 — Moteur de stock
> Phase 2 : stock_movements et packaging_movements, emplacements (dépôts, véhicules, virtuels), validation transactionnelle avec verrouillage et idempotence, annulation par mouvement inverse, coût moyen pondéré. Réception fournisseur avec vides rendus sur le même bon (solde fournisseur d'emballages + dette fournisseur). Casse. Inventaire avec validation. Stock initial et soldes d'emballages initiaux. Tests : double clic, concurrence, coût moyen, annulation.

**Je vérifie** : je reçois 100 casiers de la brasserie en rendant 80 vides ; le stock, le coût moyen et le solde « casiers dus à la brasserie » sont justes.

## Phase 3 — Clients et tournées
> Phase 3 : clients, préparation de tournée, chargement (Dépôt → Véhicule), écran de retour de tournée (livré, refusé, casiers laissés, vides récupérés, paiements, invendus, casse, argent remis), rapprochement marchandises / argent / emballages, clôture qui génère mouvements, factures numérotées et encaissements. Vente comptoir. Factures PDF imprimables. C'est l'écran le plus important : il doit être rapide à saisir sur ordinateur.

**Je vérifie** : je simule une vraie tournée avec 5 clients, dont un qui ne paie qu'une partie et un qui ne rend pas ses casiers ; je provoque volontairement un écart d'argent.

## Phase 4 — Argent et consignes
> Phase 4 : encaissements répartis sur plusieurs factures, avances clients, créances par ancienneté, limite de crédit, paiements fournisseur, consigne payée (client et fournisseur), casiers perdus, dépenses avec justificatif. Fiche client avec solde dû et solde d'emballages, historique.

**Je vérifie** : un client paie 3 anciennes factures en une fois ; un client paie la consigne de 2 casiers ; les soldes restent cohérents.

## Phase 5 — Tableau de bord, rapports, alertes, abonnements
> Phase 5 : tableau de bord avec les définitions exactes de SPEC.md §9, graphiques, exports Excel/CSV, centre d'alertes avec commentaire et résolution. Espace super-admin et gestion des abonnements de SPEC.md §10, mode lecture seule en cas de suspension. Script seed:demo. Vérifie que le tableau de bord correspond exactement au jeu de démo.

**Je vérifie** : je lance le seed, je recalcule 2 chiffres à la main ; je suspends une organisation de test.

---

## Phase 6 — Espace chauffeur hors-ligne (après le pilote seulement)
Ne la lance que si le pilote montre que la saisie au dépôt ne suffit pas.
> Phase 6 : comptes chauffeur, application web installable (PWA) « Mes tournées » : voir son chargement, saisir par client livré / refusé / casiers / paiement, photo ou code de confirmation. Fonctionnement hors connexion avec file d'attente locale et synchronisation idempotente au retour du réseau, gestion des conflits. L'écran de retour de tournée au dépôt reprend les saisies du chauffeur et le magasinier les contrôle avant clôture.
