import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next, erreur } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Connexion</h1>
      <p className="mt-1 text-sm text-slate-500">Accédez à l&apos;espace de votre entreprise.</p>
      {erreur === "lien" && (
        <div className="mt-4">
          <Alert tone="error">Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien.</Alert>
        </div>
      )}
      <LoginForm next={next ?? ""} />
      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="text-brand-600 hover:underline">
          Mot de passe oublié ?
        </Link>
        <p className="text-slate-500">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-brand-600 hover:underline">
            Inscrire mon entreprise
          </Link>
        </p>
      </div>
    </>
  );
}
