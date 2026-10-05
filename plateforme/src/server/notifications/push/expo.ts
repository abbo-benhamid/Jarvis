import type { MessagePush, PushPort, ResultatPush } from "./port";

/**
 * Adaptateur Expo Push API (lot N1).
 * Doc : https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * - POST https://exp.host/--/api/v2/push/send, 100 messages au plus par requête.
 * - Réponse : `{ data: Ticket[] }`, un ticket par message, dans le même ordre.
 * - Ticket en erreur `DeviceNotRegistered` → l'appareil est mort : on retire le jeton.
 * - `EXPO_ACCESS_TOKEN` (facultatif) : seulement si la « sécurité renforcée des push » est active sur le projet Expo.
 *
 * [À VÉRIFIER] Les reçus (`/getReceipts`, 15 min plus tard) ne sont pas encore lus : une erreur APNs/FCM
 * tardive (ex. jeton expiré) n'est vue qu'au prochain envoi.
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TAILLE_LOT = 100;
const DELAI_MS = 5_000;

type Ticket =
  | { status: "ok"; id?: string }
  | { status: "error"; message?: string; details?: { error?: string } };

export type OptionsExpo = {
  jetonAcces?: string | null;
  fetch?: typeof fetch;
  url?: string;
  delaiMs?: number;
};

export function creerPushExpo(opts: OptionsExpo = {}): PushPort {
  const f = opts.fetch ?? fetch;
  const url = opts.url ?? EXPO_PUSH_URL;

  async function envoyerLot(lot: MessagePush[]): Promise<ResultatPush[]> {
    const corps = lot.map((m) => ({
      to: m.jeton,
      title: m.titre,
      body: m.corps,
      data: m.donnees,
      sound: "default",
      priority: "high",
      channelId: "default",
    }));
    const entetes: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (opts.jetonAcces) entetes.Authorization = `Bearer ${opts.jetonAcces}`;

    const echecLot = (erreur: string): ResultatPush[] => lot.map(() => ({ ok: false, appareilMort: false, erreur }));
    let res: Response;
    try {
      res = await f(url, { method: "POST", headers: entetes, body: JSON.stringify(corps), signal: AbortSignal.timeout(opts.delaiMs ?? DELAI_MS) });
    } catch {
      return echecLot("RESEAU");
    }
    if (!res.ok) return echecLot(`HTTP_${res.status}`);
    const json = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
    const tickets = Array.isArray(json?.data) ? json.data : null;
    if (!tickets || tickets.length !== lot.length) return echecLot("REPONSE_INVALIDE");
    return tickets.map((t): ResultatPush => {
      if (t.status === "ok") return { ok: true, idFournisseur: t.id };
      const code = t.details?.error ?? "ERREUR";
      return { ok: false, appareilMort: code === "DeviceNotRegistered", erreur: code };
    });
  }

  return {
    nom: "expo",
    async envoyer(messages: MessagePush[]): Promise<ResultatPush[]> {
      const out: ResultatPush[] = [];
      for (let i = 0; i < messages.length; i += TAILLE_LOT) out.push(...(await envoyerLot(messages.slice(i, i + TAILLE_LOT))));
      return out;
    },
  };
}
