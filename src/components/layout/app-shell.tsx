import { Logo } from "@/components/brand";
import { navForRole } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppContext } from "@/lib/server/session";
import { BottomNavLinks, SidebarLinks } from "./nav-links";

function LogoutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/deconnexion" method="post">
      <button type="submit" className={className}>
        Se déconnecter
      </button>
    </form>
  );
}

export function AppShell({ context, children }: { context: AppContext; children: React.ReactNode }) {
  const items = navForRole(context.member.role);
  const roleLabel = ROLE_LABELS[context.member.role];

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar — ordinateur */}
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 px-4 py-6 md:fixed md:inset-y-0 md:flex">
        <div className="px-2">
          <Logo inverted />
        </div>
        <p
          className="mt-6 truncate px-3 text-xs font-semibold tracking-wide text-brand-100 uppercase"
          title={context.organization.name}
        >
          {context.organization.name}
        </p>
        <div className="mt-3 flex-1">
          <SidebarLinks items={items} />
        </div>
        <div className="border-t border-white/10 px-3 pt-4">
          <p className="truncate text-sm font-medium text-white">{context.member.fullName}</p>
          <p className="text-xs text-brand-100">{roleLabel}</p>
          <LogoutButton className="mt-3 text-xs font-medium text-brand-100 hover:text-white" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        {/* En-tête — mobile */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-brand-900 px-4 py-3 md:hidden">
          <div className="min-w-0">
            <Logo inverted />
            <p className="mt-0.5 truncate text-xs text-brand-100">
              {context.organization.name} · {roleLabel}
            </p>
          </div>
          <LogoutButton className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand-100 hover:bg-white/10" />
        </header>

        <main className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">{children}</main>
      </div>

      <BottomNavLinks items={items} />
    </div>
  );
}
