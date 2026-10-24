import type { Metadata } from "next";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: "Accès impossible" };

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4">
      <div className="mb-6">
        <Logo inverted />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Accès impossible</h1>
        <p className="mt-2 text-sm text-slate-600">
          Votre compte n&apos;est rattaché à aucune entreprise, ou il a été désactivé. Contactez le propriétaire de
          votre entreprise.
        </p>
        <form action="/auth/deconnexion" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
