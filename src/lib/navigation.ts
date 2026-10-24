import { can, type MemberRole, type Permission } from "@/lib/roles";

export type NavIcon = "home" | "team";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Permission requise pour afficher l'entrée (sinon visible par tous). */
  permission?: Permission;
};

/**
 * Entrées de navigation. Une entrée n'est ajoutée que lorsque la page existe
 * et fonctionne (pas de lien décoratif) : chaque phase complète cette liste.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/tableau-de-bord", label: "Accueil", icon: "home" },
  { href: "/equipe", label: "Équipe", icon: "team", permission: "team.manage" },
];

export function navForRole(role: MemberRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}
