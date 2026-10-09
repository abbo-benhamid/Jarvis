import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FormPage } from "@/components/layout/form-page";
import { TERRITOIRES_BIENTOT, TERRITOIRES_OUVERTS, isTerritoire, listeNoms, territoire } from "@/lib/territoires";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = { title: "Liste d'attente", robots: { index: false } };

/**
 * T1 (T2) : `/liste-attente?territoire=MARTINIQUE|GUYANE|HEXAGONE` (lien de l'app et de l'encart « Bientôt »).
 * Le paramètre préremplit le territoire. Un territoire inconnu ou ouvert : premier territoire « Bientôt ».
 */
export default async function ListeAttentePage({ searchParams }: { searchParams: Promise<{ territoire?: string }> }) {
  const { territoire: param } = await searchParams;
  const initial = isTerritoire(param) && TERRITOIRES_BIENTOT.includes(param) ? param : TERRITOIRES_BIENTOT[0]!;
  const ouverts = listeNoms(TERRITOIRES_OUVERTS);
  return (
    <FormPage
      eyebrow="Bientôt"
      title={`Koudmen arrive bientôt ${territoire(initial).enNom}`}
      lead={
        <p>
          Koudmen ouvre d&apos;abord {TERRITOIRES_OUVERTS.map((t) => territoire(t).enNom).join(" et ")}. Laissez votre adresse e-mail : nous vous
          prévenons à l&apos;ouverture dans votre territoire. Rien d&apos;autre.
        </p>
      }
      illustration={false}
    >
      <Card className="lg:p-7">
        <WaitlistForm initial={initial} />
      </Card>
      <p className="text-[15px] text-muted">
        Vous êtes en {ouverts}, ou votre parent y vit ?{" "}
        <Link className="font-semibold text-mer underline underline-offset-4" href="/inscription">
          Créez un compte
        </Link>
        .
      </p>
    </FormPage>
  );
}
