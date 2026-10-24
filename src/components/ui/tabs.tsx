"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./form";

/** Onglets de navigation entre pages sœurs (ex. Dépôts / Véhicules / Chauffeurs). */
export function Tabs({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
              active
                ? "border-accent-600 text-brand-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
