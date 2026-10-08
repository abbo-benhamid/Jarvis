import Link from "next/link";
import type { ElementVerification, EtatElement } from "@/contracts/v1/verifications";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** L2 : affichage d'un élément du dossier (couleur neutre, texte neutre, jamais « échec »). */
export const ETAT_LABELS: Record<EtatElement, string> = {
  A_FOURNIR: "À faire",
  EN_COURS: "En cours",
  DECLARE: "À montrer en visio",
  A_REVOIR: "L'équipe vérifie",
  VALIDE: "Vérifié",
  REFUSE: "Refusé",
  EXPIRE: "À renouveler",
};

export const ETAT_TONES: Record<EtatElement, BadgeTone> = {
  A_FOURNIR: "soleil",
  EN_COURS: "mer",
  DECLARE: "mer",
  A_REVOIR: "mer",
  VALIDE: "feuille",
  REFUSE: "hibiscus",
  EXPIRE: "soleil",
};

export const L2_PAGES: Record<string, string> = {
  TELEPHONE: "/accompagnant/verifications/telephone",
  IDENTITE: "/accompagnant/verifications/identite",
  ENTREPRISE: "/accompagnant/verifications/entreprise",
  ADRESSE: "/accompagnant/verifications/adresse",
};

export function ElementStatus({ item }: { item: ElementVerification }) {
  return <Badge tone={ETAT_TONES[item.etat]}>{ETAT_LABELS[item.etat]}</Badge>;
}

/** Liste « Mon dossier » : un lien par élément L2. */
export function DossierList({ items }: { items: ElementVerification[] }) {
  return (
    <Card padding="none" className="divide-y divide-line px-[18px]" aria-label="Mon dossier">
      {items.map((i) => (
        <Link key={i.id} href={L2_PAGES[i.type] ?? "/accompagnant/verifications"} className="flex min-h-14 flex-col gap-1 py-3 no-underline">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-mer underline underline-offset-2">{i.libelle}</span>
            <ElementStatus item={i} />
          </span>
          <span className="text-[15px] text-muted">{i.message}</span>
        </Link>
      ))}
    </Card>
  );
}
