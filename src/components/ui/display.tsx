import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./form";

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">Actif</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactif</span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" }) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    brand: "bg-brand-50 text-brand-800",
    warn: "bg-amber-50 text-amber-800",
  }[tone];
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", styles)}>{children}</span>;
}

/** État vide utile : explique quoi faire, avec l'action si elle est permise. */
export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
      <p className="text-sm text-slate-600">{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const styles = {
    primary: "bg-brand-800 text-white hover:bg-brand-700",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-brand-800 hover:bg-brand-50",
  }[variant];
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
        styles,
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Tableau simple et lisible, défilant horizontalement sur mobile. */
export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const th = "px-5 py-2 font-semibold whitespace-nowrap";
export const td = "px-5 py-3 align-top";
