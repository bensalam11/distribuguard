import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Inscrire mon entreprise</h1>
      <p className="mt-1 text-sm text-slate-500">Essai gratuit. Un « Dépôt principal » est créé automatiquement.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
