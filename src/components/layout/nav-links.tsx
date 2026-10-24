"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/form";
import { isNavItemActive, type NavIcon, type NavItem } from "@/lib/navigation";

function Icon({ name, className }: { name: NavIcon; className?: string }) {
  const paths: Record<NavIcon, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
    box: (
      <>
        <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
        <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
      </>
    ),
    warehouse: (
      <>
        <path d="M3 9.5 12 4l9 5.5V20H3V9.5Z" />
        <path d="M7 20v-7h10v7M7 16.5h10" />
      </>
    ),
    supplier: (
      <>
        <path d="M3 20V10l5 3V10l5 3V6h4l1 14H3Z" />
        <path d="M7 17h2M12 17h2" />
      </>
    ),
    building: (
      <>
        <path d="M5 21V4h10v17M15 9h4v12" />
        <path d="M8 8h4M8 12h4M8 16h4M3 21h18" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17 14.5c2.4 0 4.1 1.5 4.5 4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/** Point animé affiché dès le clic, pendant le chargement de la page. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cx(
        "h-1.5 w-1.5 rounded-full bg-accent-500 transition-opacity md:ml-auto",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
}

/** Navigation latérale (ordinateur). */
export function SidebarLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-white/10 text-white" : "text-brand-100 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon name={item.icon} className={cx("h-5 w-5", active && "text-accent-500")} />
            {item.label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu en bas d'écran (mobile). */
export function BottomNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigation principale"
    >
      <ul className="flex">
        {items
          .filter((item) => !item.desktopOnly)
          .map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center gap-0.5 py-2 text-xs font-medium",
                    active ? "text-brand-800" : "text-slate-500",
                  )}
                >
                  <Icon name={item.icon} className={cx("h-6 w-6", active && "text-accent-600")} />
                  {item.label}
                  <PendingDot />
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
