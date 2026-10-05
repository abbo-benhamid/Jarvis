"use client";

import { useEffect, useState } from "react";
import { MessageSquareHeart, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEEDBACK_SENT_EVENT, openFeedback } from "@/components/feedback/open-feedback";

/** Bouton court « Mon avis » du panneau du test : toujours en haut de l'écran, sans rien masquer (A9). */
export function FeedbackShortcut() {
  return (
    <Button variant="soleil" onClick={() => openFeedback()} aria-haspopup="dialog">
      <MessageSquareHeart aria-hidden="true" className="size-4" />
      Mon avis
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
    // Stockage indisponible (navigation privée) : l'invitation revient au prochain affichage. Sans gravité.
  }
}

/**
 * Écran de fin de scénario (A9) : quand un scénario est fini, Koudmen demande l'avis (note + 1 question ouverte).
 * Une invitation à la fois. « Plus tard » ou un avis envoyé la retire (mémoire du navigateur seulement).
 */
export function ScenarioEndPrompt({ sandboxId, scenarios }: { sandboxId: string; scenarios: ScenarioState[] }) {
  const [seen, setSeen] = useState<string[] | null>(null);

  useEffect(() => {
    setSeen(readSeen());
    const onSent = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id !== "string") return;
      const next = [...new Set([...readSeen(), id])];
      writeSeen(next);
      setSeen(next);
    };
    window.addEventListener(FEEDBACK_SENT_EVENT, onSent);
    return () => window.removeEventListener(FEEDBACK_SENT_EVENT, onSent);
  }, []);

  if (seen === null) return null;
  const allDone = scenarios.length > 0 && scenarios.every((s) => s.done);
  const key = (id: string) => `${sandboxId}:${id}`;
  const pending = scenarios.find((s) => s.done && !seen.includes(key(s.id)));
  const finalPending = allDone && !pending && !seen.includes(key("fin"));
  if (!pending && !finalPending) return null;

  const prompt = pending
    ? {
        id: key(pending.id),
        title: `Scénario terminé : ${pending.title.replace(/^\d+\.\s*/, "")}`,
        text: "Bravo ! Votre avis sur ce scénario : une note et une question. 1 minute.",
        question: "Qu'est-ce qui vous a aidé ou gêné dans ce scénario ?",
        pagePath: `/fin-de-scenario/${pending.id}`,
      }
    : {
        id: key("fin"),
        title: "Test terminé : merci !",
        text: "Vous avez fini les 3 scénarios. Une dernière note et une dernière question.",
        question: "En une phrase, que fait Koudmen pour vous ?",
        pagePath: "/fin-de-scenario/fin",
      };

  const dismiss = () => {
    const next = [...new Set([...seen, prompt.id])];
    writeSeen(next);
    setSeen(next);
  };

  return (
    <div role="status" className="mt-2 flex flex-col gap-2 rounded-xl border-2 border-feuille bg-surface p-3">
      <p className="flex items-start gap-2 font-bold">
        <PartyPopper aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-feuille" />
        {prompt.title}
      </p>
      <p className="text-sm">{prompt.text}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          aria-haspopup="dialog"
          onClick={() => openFeedback({ id: prompt.id, title: prompt.title, question: prompt.question, pagePath: prompt.pagePath })}
        >
          Répondre (1 minute)
        </Button>
        <Button variant="secondary" onClick={dismiss}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
