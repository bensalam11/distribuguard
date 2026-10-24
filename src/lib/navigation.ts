import { can, type MemberRole, type Permission } from "@/lib/roles";

export type NavIcon = "home" | "team" | "box" | "warehouse" | "supplier" | "building";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Permission requise pour afficher l'entrée (sinon visible par tous). */
  permission?: Permission;
  /** Autres chemins qui rendent l'entrée active (pages sœurs). */
  matches?: readonly string[];
  /** Absente du menu du bas sur mobile (accessible ailleurs). */
  desktopOnly?: boolean;
};

/**
 * Entrées de navigation. Une entrée n'est ajoutée que lorsque la page existe
 * et fonctionne (pas de lien décoratif) : chaque phase complète cette liste.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/tableau-de-bord", label: "Accueil", icon: "home", matches: ["/demarrage"] },
  { href: "/produits", label: "Produits", icon: "box" },
  { href: "/depots", label: "Dépôts", icon: "warehouse", matches: ["/vehicules", "/chauffeurs"] },
  { href: "/fournisseurs", label: "Fournisseurs", icon: "supplier" },
  { href: "/equipe", label: "Équipe", icon: "team", permission: "team.manage" },
  { href: "/entreprise", label: "Entreprise", icon: "building", permission: "settings.manage", desktopOnly: true },
];

export function navForRole(role: MemberRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

export function isNavItemActive(pathname: string, item: Pick<NavItem, "href" | "matches">): boolean {
  return [item.href, ...(item.matches ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Onglets des pages sœurs. */
export const LOGISTICS_TABS = [
  { href: "/depots", label: "Dépôts" },
  { href: "/vehicules", label: "Véhicules" },
  { href: "/chauffeurs", label: "Chauffeurs" },
] as const;

export const CATALOG_TABS = [
  { href: "/produits", label: "Produits" },
  { href: "/produits/emballages", label: "Emballages" },
] as const;
