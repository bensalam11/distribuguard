/**
 * Rôles fixes (SPEC §3). Cette table sert à l'affichage (masquer ce qui n'est
 * pas autorisé) ; les vraies vérifications sont faites en base (RLS et fonctions).
 */
export type MemberRole = "owner" | "manager" | "storekeeper" | "cashier";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  storekeeper: "Magasinier",
  cashier: "Caissier",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Tout, y compris utilisateurs, paramètres et annulations.",
  manager: "Tout sauf utilisateurs, paramètres et abonnement.",
  storekeeper: "Produits (sans prix), réceptions, chargements, retours de tournée, casse, inventaires.",
  cashier: "Encaissements, dépenses, paiements fournisseur, consultation des créances.",
};

export type Permission = "team.manage" | "settings.manage" | "audit.read" | "depots.manage";

const PERMISSIONS: Record<Permission, readonly MemberRole[]> = {
  "team.manage": ["owner"],
  "settings.manage": ["owner"],
  "audit.read": ["owner", "manager"],
  "depots.manage": ["owner", "manager"],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}
