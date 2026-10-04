"use client";

import { useActionState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { microAnswerAction } from "@/server/sandbox/actions";
import { initialActionState } from "@/lib/action-result";
import type { MicroQuestion } from "@/lib/measure";
import { SubmitButton } from "@/components/ui/submit-button";

/** Une question, un clic. Pas de texte libre. */
export function MicroQuestionForm({ question, path }: { question: MicroQuestion; path: string }) {
  const [state, action] = useActionState(microAnswerAction, initialActionState);
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl border border-feuille bg-feuille-soft p-3 text-sm font-semibold">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} aria-label="Question rapide" className="flex flex-col gap-2 rounded-xl border border-soleil bg-soleil-soft p-4">
      <input type="hidden" name="questionKey" value={question.key} />
      <input type="hidden" name="path" value={path} />
      <p className="flex items-center gap-2 font-bold">
        <MessageCircleQuestion aria-hidden="true" className="size-5" />
        Question rapide : {question.question}
      </p>
      <div className="flex flex-wrap gap-2">
        {question.choices.map((c) => (
          <SubmitButton key={c.value} name="answer" value={c.value} variant="secondary" size="md" pendingLabel="…">
            {c.label}
          </SubmitButton>
        ))}
      </div>
      {!state.ok && state.error ? <p className="text-sm font-semibold text-hibiscus">{state.error}</p> : null}
    </form>
  );
}
