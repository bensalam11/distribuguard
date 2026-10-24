# DistribuGuard — Spécification v1

Logiciel web (SaaS) de gestion pour **distributeurs de boissons au Cameroun**.
Promesse : *savoir ce qui sort du dépôt, ce qui est livré, ce qui est encaissé, combien de casiers sont dehors, et ce qui reste à justifier.*

Langue : français. Devise : FCFA (XAF). Fuseau : Africa/Douala.

---

## 1. Périmètre

### Dans la v1
1. Espace entreprise, utilisateurs, rôles fixes
2. Catalogue boissons + emballages consignés
3. Dépôts et véhicules (comme emplacements de stock)
4. Moteur de stock par mouvements (réceptions, chargements, retours, casse, inventaire)
5. Clients, livraisons/tournées, retour de tournée, factures
6. Encaissements, créances clients, dettes fournisseur
7. Consignes : soldes d'emballages côté clients **et** côté fournisseur (brasserie)
8. Dépenses simples
9. Tableau de bord, rapports, exports, alertes de base
10. Gestion des abonnements de DistribuGuard (pour l'éditeur)

### Hors v1 (ne pas coder, ne pas afficher de boutons pour ces fonctions)
- Carburant, kilométrage, entretien des véhicules
- Espace chauffeur mobile et mode hors-ligne (prévu en phase 6, après le pilote)
- Commerciaux terrain, géolocalisation
- Intégration Mobile Money / paiement en ligne
- Sessions de caisse (ouverture/clôture)
- Rôles personnalisables, un utilisateur dans plusieurs entreprises
- Comptabilité générale

---

## 2. Stack technique

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase : PostgreSQL, Auth, Storage (bucket privé pour les justificatifs)
- Zod pour la validation (client **et** serveur)
- Vitest pour les tests unitaires/intégration, Playwright pour 2–3 parcours critiques
- Migrations SQL versionnées dans `supabase/migrations`

Règles :
- Aucune clé `service_role` côté navigateur.
- Montants en FCFA stockés en **entier** (`bigint`, francs). Coûts unitaires moyens en `numeric(14,2)`. Jamais de `float` pour l'argent.
- Quantités stockées dans l'**unité de base** du produit (la bouteille), en entier.

---

## 3. Espace entreprise et accès

### Inscription
Nom du responsable, nom de l'entreprise, e-mail, téléphone, mot de passe, ville, adresse.
À l'inscription, une fonction serveur crée en une transaction : l'organisation, le membre propriétaire, les paramètres par défaut, un dépôt « Dépôt principal », et un abonnement en statut `essai`.

### Assistant de démarrage (étapes sautables)
Profil entreprise → dépôt(s) → véhicules → produits et emballages → employés → stock initial et soldes initiaux de casiers (fournisseur et clients).

### Rôles fixes
| Rôle | Peut faire |
|---|---|
| Propriétaire | Tout, y compris utilisateurs, paramètres, annulations |
| Gérant | Tout sauf utilisateurs, paramètres et abonnement |
| Magasinier | Produits (sans prix), réceptions, chargements, retours de tournée, casse, inventaires |
| Caissier | Encaissements, dépenses, paiements fournisseur, consultation des créances |
| Chauffeur | Aucun accès en v1 (existe comme fiche pour l'affectation aux tournées) |

Un employé est invité par e-mail. Le chauffeur est une simple fiche (nom, téléphone) sans compte en v1.

### Isolation
- Toute table métier a `organization_id` non nul.
- RLS activée sur **toutes** les tables métier : un utilisateur n'accède qu'aux lignes de son organisation, selon son rôle.
- Les permissions sont vérifiées côté serveur **et** par RLS, jamais seulement dans l'interface.

---

## 4. Catalogue et emballages

### Produit
Code, nom, marque, catégorie, contenance (ex. 65 cl), unité de base = bouteille, nombre de bouteilles par casier/pack, prix de vente par casier, coût moyen (calculé), seuil d'alerte, type d'emballage associé (ou aucun pour les produits non consignés : canettes, PET), actif/inactif.

Saisie et affichage en **casiers + bouteilles** (ex. « 12 casiers 5 btl »), stockage en bouteilles.

### Grille de prix
Prix standard par produit + prix optionnel par catégorie de client (bar, boutique, revendeur, particulier). Une remise ponctuelle nécessite le rôle gérant ou propriétaire.

### Type d'emballage
Nom (ex. « Casier 12 × 65 cl », « Bouteille vide 65 cl »), valeur de consigne en FCFA (configurable), équivalence casier/bouteilles.

Un casier plein = **produit** (le liquide, vendu) + **emballage** (consigné, prêté). Les deux sont suivis séparément.

---

## 5. Moteur de stock

### Emplacements
- Dépôts
- Véhicules (tricycles, camionnettes) : emplacement de stock « en tournée »
- Emplacements virtuels : Fournisseur, Clients, Casse/Perte, Ajustement

### Règle d'or
Le stock n'est **jamais** modifié directement. Tout passe par `stock_movements` (source → destination, produit, quantité, coût unitaire, document, utilisateur, statut).
- Brouillon : n'affecte pas le stock.
- Validé : affecte le stock, n'est plus modifiable ni supprimable. Correction = mouvement d'annulation lié, traçable.
- Stock négatif interdit (paramètre désactivable par le propriétaire).
- Validation dans une transaction avec verrouillage, pour empêcher deux sorties simultanées dépassant le stock.
- Chaque soumission porte une clé d'idempotence (pas de double validation sur double clic).

### Décisions fixées (ne pas changer sans demander)
| Opération | Mouvement |
|---|---|
| Réception fournisseur | Fournisseur → Dépôt |
| Chargement tournée | Dépôt → Véhicule |
| Livraison validée au client | Véhicule → Clients (c'est ici que la vente naît) |
| Vente comptoir (client enlève au dépôt) | Dépôt → Clients |
| Retour de tournée (invendus) | Véhicule → Dépôt |
| Casse constatée | Dépôt ou Véhicule → Casse |
| Ajustement d'inventaire validé | Dépôt ↔ Ajustement |

Valorisation : **coût moyen pondéré**, recalculé à chaque réception validée.

### Inventaire
Comptage par dépôt : stock théorique, stock compté, écart en quantité et en FCFA, motif, compté par, validé par (gérant ou propriétaire). La validation génère les ajustements.

---

## 6. Consignes (emballages)

Les emballages ont leur propre registre `packaging_movements`, distinct des boissons. On suit trois soldes par type d'emballage :

1. **Stock d'emballages au dépôt**, séparé en pleins (implicite via le stock produit) et vides.
2. **Solde de chaque client** : casiers qu'il détient et doit rendre.
3. **Solde envers chaque fournisseur (brasserie)** : casiers que le distributeur détient et doit rendre ou payer.

Plus le solde en cours de chaque véhicule pendant une tournée.

### Flux
- **Réception brasserie** : pleins reçus ; vides rendus à la brasserie saisis sur le même bon. Le solde fournisseur bouge de (reçus − rendus).
- **Livraison client** : casiers laissés, vides récupérés. Le solde client bouge de (laissés − récupérés).
- **Consigne payée** : un client peut payer la consigne au lieu de rendre. Le montant est encaissé et le solde d'emballages diminue. Même logique côté fournisseur.
- **Casier perdu ou cassé** : mouvement vers Perte, avec motif.
- **Retour de tournée** : vides rapportés par le véhicule → dépôt.

La valeur de consigne vient du type d'emballage et n'est jamais codée en dur.

---

## 7. Clients, livraisons, factures

### Client
Nom, catégorie (bar, boutique, revendeur, particulier), téléphone, quartier, ville, repère, limite de crédit (optionnelle), solde dû (calculé), solde d'emballages (calculé).

### Tournée (flux principal)
1. **Préparer** : date, véhicule, chauffeur, lignes livrées prévues (client, produits, quantités). On peut aussi charger du stock « libre » sans client défini (vente sur la route).
2. **Charger** : le magasinier valide le chargement → Dépôt → Véhicule.
3. **Retour de tournée** (écran central de la v1, saisi au dépôt par le magasinier ou le caissier, à partir de ce que le chauffeur déclare) :
   - par client : quantités livrées, refusées, casiers laissés, vides récupérés, montant payé et mode de paiement ;
   - invendus remis au dépôt, casse, vides rapportés ;
   - argent remis par le chauffeur.
4. **Contrôle** : l'écran affiche le rapprochement :
   - **marchandises** : chargé = livré + retourné + cassé → écart ?
   - **argent** : attendu (encaissements déclarés) vs remis → écart ?
   - **emballages** : sortis + récupérés vs rentrés → écart ?
5. **Clôturer** : génère les mouvements, une facture par client livré, les encaissements. Les écarts non nuls exigent un commentaire et créent une alerte. Le libellé dit « écart à justifier », jamais « vol ».

### Facture
Numéro unique par organisation (ex. `F-2026-000123`), client, lignes, prix appliqués, remise, total, consigne facturée éventuelle, statut de paiement (impayée, partielle, payée). Imprimable et téléchargeable en PDF, partageable par WhatsApp (lien ou PDF).

---

## 8. Argent

### Encaissements
Mode : espèces, Mobile Money (saisie manuelle avec référence de transaction), virement, autre. Un encaissement peut être réparti sur plusieurs factures ; une facture peut recevoir plusieurs encaissements (`payment_allocations`). Un encaissement non affecté reste en avance client.

### Créances
Solde client = factures validées − encaissements affectés. **Calculé**, jamais saisi. Vue par ancienneté : 0–7 j, 8–30 j, + 30 j. Alerte au dépassement de la limite de crédit lors de la préparation d'une livraison (bloquant ou non selon un paramètre).

### Fournisseurs
Dette fournisseur = réceptions validées (montant) − paiements fournisseur. Paiement saisi par le caissier.

### Dépenses
Catégorie (configurable : manutention, réparation, loyer, autre), montant, date, justificatif photo optionnel.

---

## 9. Tableau de bord et rapports

Filtres : période, dépôt.

Définitions (à respecter et à afficher en info-bulle) :
- **Chiffre d'affaires** = total des factures validées sur la période (pas les encaissements).
- **Encaissé** = encaissements validés sur la période.
- **Créances** = solde total dû par les clients à date.
- **Valeur du stock** = quantité × coût moyen, par dépôt et véhicules.
- **Marge brute estimée** = CA − coût moyen des quantités vendues. Toujours libellée « estimée ». Jamais « bénéfice ».
- **Casiers dehors** = somme des soldes clients ; **casiers dus à la brasserie** = solde fournisseur ; valeur en FCFA de chacun.

Cartes : CA, encaissé, créances, valeur du stock, marge brute estimée, casiers dehors, casiers dus, écarts ouverts.
Graphiques : ventes par jour, top produits, top clients.
Rapports exportables en Excel/CSV : ventes, créances par client, mouvements de stock, soldes d'emballages, écarts de tournée.

### Alertes (centre de notifications)
Stock sous seuil, rupture, tournée non clôturée la veille, écart de tournée, écart d'inventaire, créance > 30 jours, limite de crédit dépassée. Chaque alerte montre attendu / déclaré / différence et peut être commentée puis résolue.

---

## 10. Abonnements DistribuGuard

- Table `subscriptions` : organisation, plan (`pilote`, `standard`, `pro`), statut (`essai`, `actif`, `en_retard`, `suspendu`), date de fin de période.
- Un **espace super-admin** (réservé à l'éditeur, protégé par un rôle distinct en base) liste les organisations, l'usage (nombre de factures du mois, utilisateurs) et permet d'activer ou prolonger un abonnement après réception d'un paiement Mobile Money.
- Organisation suspendue : lecture seule et export de ses données, plus de création d'opérations. Les données ne sont jamais supprimées.
- Limites par plan lues depuis une table de configuration (nombre de dépôts, d'utilisateurs), pas codées en dur.

---

## 11. Traçabilité et sécurité

- `audit_logs` : qui, quoi, quand, avant/après, pour toute validation, annulation, modification de prix, changement de rôle.
- Justificatifs dans un bucket privé, chemin préfixé par `organization_id`, accès par URL signée.
- Aucune suppression en cascade sur des données financières ou de stock.
- Erreurs affichées sans détails techniques ni secrets.

---

## 12. Interface

- Sidebar sur ordinateur, menu en bas sur mobile.
- Bleu foncé, blanc, accents verts. Sobre, lisible.
- Formulaires de saisie rapides : sélection produit au clavier, quantités en casiers + bouteilles.
- États vides utiles (« Aucun produit — ajoutez votre premier produit »).
- Pas de bouton décoratif : toute action visible fonctionne.
- Montants affichés `1 250 000 FCFA`, dates `24/10/2026`.

---

## 13. Données de démonstration

Script `npm run seed:demo` qui crée une organisation de démo séparée : marques fictives (ex. « Bière Kola 65 cl », « Eau Source 1,5 L », « Soda Tropic 33 cl »), une brasserie fictive, 2 dépôts, 2 tricycles, 15 clients, 2 semaines de tournées. Jamais lancé automatiquement, jamais mélangé à une organisation réelle.

---

## 14. Tests obligatoires

- Une organisation ne voit jamais les données d'une autre (test RLS direct en SQL et via l'API).
- Un magasinier ne peut pas modifier un prix ni valider un inventaire.
- Une réception validée augmente le stock une seule fois et met à jour le coût moyen.
- Un chargement transfère vers le véhicule sans réduire deux fois le dépôt.
- Une clôture de tournée : livré réduit le stock véhicule, invendus reviennent au dépôt, écarts calculés juste.
- Double clic sur « Valider » = un seul mouvement.
- Deux sorties simultanées ne peuvent pas rendre le stock négatif.
- Soldes d'emballages client et fournisseur corrects après livraison, retour de vides et consigne payée.
- Paiement partiel puis complément = solde client correct.
- Annulation d'une opération validée = mouvement inverse + trace dans l'audit.
- Les chiffres du tableau de bord correspondent aux opérations du jeu de démo.
