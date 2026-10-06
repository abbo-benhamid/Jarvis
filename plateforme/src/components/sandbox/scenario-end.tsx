"use client";

import { useEffect, useState } from "react";
import { MessageSquareHeart, PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEEDBACK_SENT_EVENT, openFeedback } from "@/components/feedback/open-feedback";

/**
 * Bouton court « Mon avis » du panneau du test (A9). Icône seule sous 640 px (le nom accessible reste « Mon avis »),
 * icône + texte au-dessus : la barre du test tient sur une ligne de boutons à 360 px.
 */
export function FeedbackShortcut() {
  return (
    <Button variant="quiet" onClick={() => openFeedback()} aria-haspopup="dialog" aria-label="Mon avis" className="max-sm:w-11 max-sm:px-0">
      <MessageSquareHeart aria-hidden="true" className="text-soleil-ink" strokeWidth={1.7} />
      <span className="max-sm:sr-only">Mon avis</span>
    </Button>
  );
}

type ScenarioState = { id: string; title: string; done: boolean };

const STORAGE_KEY = "koudmen-avis-scenarios";

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Stockage indisponible (navigation privée) : l'invitation peut revenir au prochain affichage. Sans gravité.
  }
}

type Prompt = { id: string; title: string; question: string; pagePath: string };

/**
 * Invite de fin de scénario (A9) : quand un scénario est fini, Koudmen propose de donner son avis.
 * Elle s'affiche UNE seule fois : elle est notée « vue » dès son premier affichage (mémoire du navigateur).
 * Petite ligne dans la barre du test (≈ 48 px), jamais une carte en haut de chaque page.
 * « Répondre » ouvre la fenêtre d'avis ; la croix la ferme.
 */
export function ScenarioEndPrompt({ sandboxId, scenarios }: { sandboxId: string; scenarios: ScenarioState[] }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    const seen = readSeen();
    const key = (id: string) => `${sandboxId}:${id}`;
    const allDone = scenarios.length > 0 && scenarios.every((s) => s.done);
    const pending = scenarios.find((s) => s.done && !seen.includes(key(s.id)));
    const finalPending = allDone && !pending && !seen.includes(key("fin"));
    if (!pending && !finalPending) return;
    const p: Prompt = pending
      ? {
          id: key(pending.id),
          title: `Scénario terminé : ${pending.title.replace(/^\d+\.\s*/, "")}`,
          question: "Qu'est-ce qui vous a aidé ou gêné dans ce scénario ?",
          pagePath: `/fin-de-scenario/${pending.id}`,
        }
      : {
          id: key("fin"),
          title: "Démo terminée : merci !",
          question: "En une phrase, que fait Koudmen pour vous ?",
          pagePath: "/fin-de-scenario/fin",
        };
    // Une seule fois : l'invite est marquée vue dès qu'elle apparaît.
    writeSeen([...new Set([...seen, p.id])]);
    setPrompt(p);
    const onSent = (e: Event) => {
      if ((e as CustomEvent<string>).detail === p.id) setPrompt(null);
    };
    window.addEventListener(FEEDBACK_SENT_EVENT, onSent);
    return () => window.removeEventListener(FEEDBACK_SENT_EVENT, onSent);
    // Les scénarios viennent du serveur : leur état « fait » suffit comme dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandboxId, scenarios.map((s) => `${s.id}:${s.done}`).join("|")]);

  if (!prompt) return null;

  return (
    <div role="status" className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm bg-feuille-soft py-1 pr-1 pl-3 text-[14.5px] text-fg">
      <PartyPopper aria-hidden="true" className="size-[18px] shrink-0 text-feuille" strokeWidth={1.7} />
      <p className="min-w-0 flex-1 basis-40 font-semibold">{prompt.title}</p>
      <span className="flex items-center">
        <Button
          variant="link"
          aria-haspopup="dialog"
          onClick={() => openFeedback({ id: prompt.id, title: prompt.title, question: prompt.question, pagePath: prompt.pagePath })}
        >
          Répondre (1 minute)
        </Button>
        <button
          type="button"
          onClick={() => setPrompt(null)}
          aria-label="Plus tard"
          title="Plus tard"
          className="inline-grid size-11 place-items-center rounded-icon text-muted hover:bg-surface hover:text-fg"
        >
          <X aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
        </button>
      </span>
    </div>
  );
}
