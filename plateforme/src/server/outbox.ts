import "server-only";
import type { Channel } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import { renderTemplate, type TemplateKey } from "./notification-templates";

export type NotificationInput = {
  channel: Channel;
  /** Téléphone ou email affiché (fictif en test). */
  to: string;
  recipientUserId?: string | null;
  template: TemplateKey;
  vars: Record<string, string | number>;
  related?: { type: string; id: string };
  /** Bac à sable d'origine (D2). Null ou absent = monde réel. */
  sandboxId?: string | null;
};

/**
 * Ajoute une notification à la boîte d'envoi (Outbox).
 * MVP : RIEN n'est envoyé. Le message est marqué ENVOYE_SIMULE et visible par l'opérateur.
 * Plus tard : un worker lira les messages EN_ATTENTE et appellera WhatsApp / SMS / email.
 */
export async function enqueueNotification(input: NotificationInput, client: DbClient = db) {
  const { subject, body } = renderTemplate(input.template, input.vars);
  return client.outboxMessage.create({
    data: {
      channel: input.channel,
      to: input.to,
      recipientUserId: input.recipientUserId ?? null,
      template: input.template,
      subject,
      body,
      status: "ENVOYE_SIMULE",
      sentAt: new Date(),
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
      sandboxId: input.sandboxId ?? null,
    },
  });
}

/** Notifie un utilisateur par son canal par défaut (WhatsApp si téléphone, sinon email). */
export async function notifyUser(
  userId: string,
  template: TemplateKey,
  vars: Record<string, string | number>,
  related?: { type: string; id: string },
  client: DbClient = db,
) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, sandboxId: true } });
  if (!user) return null;
  return enqueueNotification(
    {
      channel: user.phone ? "WHATSAPP" : "EMAIL",
      to: user.phone ?? user.email,
      recipientUserId: userId,
      template,
      vars,
      related,
      sandboxId: user.sandboxId,
    },
    client,
  );
}

/** Notifie tous les membres du cercle Lakou d'un aîné. */
export async function notifyLakou(
  aineId: string,
  template: TemplateKey,
  vars: Record<string, string | number>,
  related?: { type: string; id: string },
  client: DbClient = db,
) {
  const members = await client.lakouMember.findMany({ where: { aineId }, select: { userId: true } });
  for (const m of members) await notifyUser(m.userId, template, vars, related, client);
  return members.length;
}
