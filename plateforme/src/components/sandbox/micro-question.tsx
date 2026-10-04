import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/guards";
import { MICRO_QUESTIONS, type MicroQuestionKey } from "@/lib/measure";
import { MicroQuestionForm } from "./micro-question-form";

/**
 * Micro-question contextuelle (D15). Affichée une seule fois, aux testeurs (bac à sable) seulement.
 */
export async function MicroQuestion({ user, questionKey, path }: { user: CurrentUser; questionKey: MicroQuestionKey; path: string }) {
  if (!user.sandboxId) return null;
  const answered = await db.microAnswer.findUnique({ where: { userId_questionKey: { userId: user.id, questionKey } }, select: { id: true } });
  if (answered) return null;
  return <MicroQuestionForm question={MICRO_QUESTIONS[questionKey]} path={path} />;
}
