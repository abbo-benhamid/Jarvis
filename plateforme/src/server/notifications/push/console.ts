import { masquerJeton, type MessagePush, type PushPort, type ResultatPush } from "./port";

/**
 * Adaptateur « console » (lot N1) : aucun envoi, aucune clé.
 * Écrit une ligne par message dans le journal du serveur. Mode par défaut (dev, test, démo).
 * Le jeton est masqué (4 derniers caractères).
 */
export function creerPushConsole(log: (ligne: string) => void = (l) => console.info(l)): PushPort {
  return {
    nom: "console",
    async envoyer(messages: MessagePush[]): Promise<ResultatPush[]> {
      return messages.map((m) => {
        const cible = m.donnees.visiteId ? `${m.donnees.ecran}:${m.donnees.visiteId}` : m.donnees.ecran;
        log(`[push:console] ${m.plateforme} ${masquerJeton(m.jeton)} | ${m.titre} | ${m.corps} | ecran=${cible}`);
        return { ok: true };
      });
    },
  };
}
