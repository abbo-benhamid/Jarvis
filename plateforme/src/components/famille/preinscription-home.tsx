import Link from "next/link";
import { ArrowRight, Compass, PhoneCall } from "lucide-react";
import { Card, CardLink, MadrasLine, SectionHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { libelleRang } from "@/lib/preinscription";
import { CallbackRequest, type CreneauOption } from "./callback-request";
import { PrepareChecklist } from "./prepare-checklist";
import { InviteShare } from "./invite-share";

export type PreinscriptionHomeProps = {
  /** Rang sur la liste d'ouverture (null : compte hors liste, ex. démo). */
  rang: number | null;
  /** « Ouverture prévue en mars 2027. » ou « Ouverture : bientôt. » */
  ouverture: string;
  /** Territoire ouvert : nom (« Guadeloupe ») et nom avec préposition (« en Guadeloupe »). */
  territoire: { nom: string; enNom: string };
  /** Dernière demande d'appel ouverte. */
  demande: { createdAt: string; creneau: string | null } | null;
  phone: string | null;
  creneaux: CreneauOption[];
  inviteUrl: string;
};

/**
 * P1 : accueil famille en PRÉINSCRIPTION (R1 : Koudmen n'enregistre rien sur le parent).
 * 1. La place sur la liste d'ouverture et la prochaine étape. 2. L'appel d'un conseiller (et son état).
 * 3. « Découvrir Koudmen » (visite guidée). 4. « Préparer l'arrivée » (liste locale). 5. « Inviter un proche ».
 */
export function PreinscriptionHome({ rang, ouverture, territoire, demande, phone, creneaux, inviteUrl }: PreinscriptionHomeProps) {
  return (
    <div className="flex flex-col">
      {/* 1. La place sur la liste */}
      <section aria-labelledby="ma-place" className="kd-appear overflow-hidden rounded-hero bg-surface shadow-card" data-testid="place-liste">
        <MadrasLine thick />
        <div className="px-[22px] pt-5 pb-5">
          <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-mer uppercase">Liste d&apos;ouverture · {territoire.nom}</p>
          {rang ? (
            <>
              <p aria-hidden="true" className="num mt-3 font-display text-[64px] leading-[0.95] font-normal tracking-[-.03em] text-mer">
                {libelleRang(rang)}
              </p>
              <h2 id="ma-place" className="mt-3 font-sans text-[19px] leading-snug font-semibold tracking-normal text-balance">
                Vous êtes {libelleRang(rang)} sur la liste d&apos;ouverture {territoire.enNom}.
              </h2>
            </>
          ) : (
            <h2 id="ma-place" className="mt-3 font-display text-[28px] leading-[1.1] font-normal tracking-[-.02em] text-balance">
              Vous êtes sur la liste d&apos;ouverture {territoire.enNom}.
            </h2>
          )}
          <p className="mt-1 text-[15px] text-muted" data-testid="ouverture-prevue">
            {ouverture} Nous vous prévenons dès l&apos;ouverture.
          </p>
        </div>
        <div className="border-t border-line bg-surface-2/50 px-[22px] py-4">
          <p className="text-sm font-semibold text-muted">Prochaine étape</p>
          <p className="mt-0.5 text-base leading-snug font-semibold" data-testid="prochaine-etape">
            {demande ? "Un conseiller vous appelle sur votre créneau." : "Parlez à un conseiller : il répond à vos questions."}
          </p>
        </div>
      </section>

      {/* 2. L'appel d'un conseiller */}
      <section aria-labelledby="appel-titre" id="appel" className="scroll-mt-4">
        <SectionHeader id="appel-titre" title="Votre appel avec un conseiller" />
        <Card className="flex flex-col gap-3" data-testid="etat-appel">
          {demande ? (
            <div className="flex gap-3.5">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-feuille-soft text-feuille">
                <PhoneCall className="size-5" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="text-base leading-snug font-semibold">Demande envoyée le {demande.createdAt}</p>
                <p className="mt-0.5 text-[15px] leading-[1.45] text-muted">
                  {demande.creneau ? `Un conseiller vous appelle sur votre créneau : ${demande.creneau}.` : "Un conseiller vous appelle."}
                </p>
                <LinkButton href="/famille/formule#rappel" variant="link" className="mt-1 min-h-11 px-0 text-[15px]">
                  Voir ou changer ma demande
                </LinkButton>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-[1.45] text-muted">
                Un conseiller Koudmen vous appelle. Il explique le service et les prix. C&apos;est gratuit. Vous ne vous engagez à rien.
              </p>
              <CallbackRequest plan="QUESTION" label="Demander un appel" defaultPhone={phone} creneaux={creneaux} emphasis />
            </>
          )}
        </Card>
      </section>

      {/* 3. Découvrir Koudmen */}
      <SectionHeader title="Découvrir Koudmen" />
      <CardLink href="/famille/decouvrir" className="bg-mer-soft shadow-none" data-testid="lien-decouvrir">
        <span className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-surface text-mer">
            <Compass className="size-6" strokeWidth={1.6} />
          </span>
          <span className="min-w-0">
            <b className="block text-[17px] font-semibold">Ce que vous recevrez</b>
            <span className="block text-[15px] leading-[1.4] text-muted">Le Kayé, le trajet, la carte domicile, les prix. 5 écrans, 2 minutes.</span>
          </span>
        </span>
      </CardLink>

      {/* 4. Préparer l'arrivée */}
      <section aria-labelledby="preparer-titre" id="preparer" className="scroll-mt-4">
        <SectionHeader id="preparer-titre" title="Préparer l'arrivée" />
        <PrepareChecklist headingId="preparer-titre" />
      </section>

      {/* 5. Inviter un proche */}
      <section aria-labelledby="inviter-titre" id="inviter" className="scroll-mt-4">
        <SectionHeader id="inviter-titre" title="Inviter un proche" />
        <Card className="flex flex-col gap-3">
          <p className="text-[15px] leading-[1.45] text-muted">
            Frères, sœurs, cousins : chacun crée son compte. À l&apos;ouverture, vous lisez ensemble les nouvelles de votre parent. Koudmen ne demande
            pas leur adresse e-mail.
          </p>
          <InviteShare url={inviteUrl} />
        </Card>
      </section>

      <p className="mx-0.5 mt-6 flex flex-col items-start text-sm leading-[1.45] text-muted">
        Pour l&apos;instant, Koudmen n&apos;enregistre aucune information sur votre parent.
        <Link href="/confidentialite" className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
          Vos données
          <ArrowRight aria-hidden="true" className="ml-1 size-4" strokeWidth={1.8} />
        </Link>
      </p>
    </div>
  );
}
