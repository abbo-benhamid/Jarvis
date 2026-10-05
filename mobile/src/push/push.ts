import type { KoudmenApi } from '@/api/client';
import type { MemoirePush, PushNatif } from './types';

/**
 * Logique du push dans l'app (lot N1). Sans import natif : testable avec des faux.
 *
 * Moment de la demande (guide Apple et Google : jamais au premier lancement) :
 * 1. l'accompagnant fait une action utile (accepte une proposition, publie un Kayé) ;
 * 2. l'app explique en une phrase pourquoi (fenêtre Koudmen, « Plus tard » possible) ;
 * 3. seulement s'il dit oui : la fenêtre du système.
 * L'invitation Koudmen est montrée UNE fois par appareil. Un refus du système n'est jamais redemandé.
 */
export type DepsPush = {
  api: Pick<KoudmenApi, 'enregistrerAppareil' | 'retirerAppareil'>;
  natif: PushNatif;
  memoire: MemoirePush;
  /** Fenêtre Koudmen avant celle du système. true = « Activer ». */
  confirmer: () => Promise<boolean>;
};

export type ResultatEnregistrement = 'enregistre' | 'indisponible' | 'sans_permission' | 'sans_jeton' | 'erreur';

export function creerPush(d: DepsPush) {
  async function enregistrerSiAccorde(): Promise<ResultatEnregistrement> {
    if (!d.natif.disponible || !d.natif.plateforme) return 'indisponible';
    try {
      if ((await d.natif.permission()) !== 'accordee') return 'sans_permission';
      const jeton = await d.natif.jeton();
      if (!jeton) return 'sans_jeton';
      const { id } = await d.api.enregistrerAppareil(jeton, d.natif.plateforme);
      await d.memoire.ecrire('appareil', id);
      return 'enregistre';
    } catch {
      // Réseau coupé, session perdue : on réessaiera à la prochaine ouverture.
      return 'erreur';
    }
  }

  /** Après une action réussie. Renvoie true si le push est actif à la fin. */
  async function proposerApresAction(): Promise<boolean> {
    if (!d.natif.disponible) return false;
    const etat = await d.natif.permission().catch(() => 'refusee' as const);
    if (etat === 'accordee') return (await enregistrerSiAccorde()) === 'enregistre';
    if (etat === 'refusee') return false;
    if (await d.memoire.lire('invite')) return false;
    await d.memoire.ecrire('invite', new Date().toISOString());
    if (!(await d.confirmer())) return false;
    if (!(await d.natif.demanderPermission().catch(() => false))) return false;
    return (await enregistrerSiAccorde()) === 'enregistre';
  }

  /** Avant la déconnexion : le serveur n'envoie plus rien à cet appareil. Ne lève jamais. */
  async function retirer(): Promise<void> {
    const id = await d.memoire.lire('appareil').catch(() => null);
    if (!id) return;
    try {
      await d.api.retirerAppareil(id);
    } catch {
      // Hors réseau : le serveur révoque aussi l'appareil quand la connexion est fermée.
    }
    await d.memoire.effacer('appareil');
  }

  return { enregistrerSiAccorde, proposerApresAction, retirer };
}

export type Push = ReturnType<typeof creerPush>;
