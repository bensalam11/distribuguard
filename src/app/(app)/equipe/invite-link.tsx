"use client";

import { useState } from "react";
import { Button } from "@/components/ui/form";

/** Lien d'invitation à transmettre : copie ou envoi par WhatsApp. Affiché une seule fois. */
export function InviteLink({ link, organizationName }: { link: string; organizationName: string }) {
  const [copied, setCopied] = useState(false);
  const message =
    `Bonjour, voici votre accès à ${organizationName} sur DistribuGuard. ` +
    `Ouvrez ce lien pour choisir votre mot de passe (lien personnel, valable 24 h, utilisable une fois) : ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-accent-500/30 bg-accent-50 p-3">
      <label className="block">
        <span className="sr-only">Lien d&apos;invitation</span>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700"
          aria-label="Lien d'invitation"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={copy}>
          {copied ? "Lien copié ✓" : "Copier le lien"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
        >
          Envoyer par WhatsApp
        </a>
      </div>
      <p className="text-xs text-slate-600">
        Lien personnel, valable 24 h et utilisable une seule fois : ne le partagez qu&apos;avec cet employé. Il ne sera
        plus affiché ; en cas de besoin, utilisez « Nouveau lien » dans la liste des membres.
      </p>
    </div>
  );
}
