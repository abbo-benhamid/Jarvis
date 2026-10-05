import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, messageErreur, type Moi } from '@/api';
import { retirerAppareilPush } from '@/push';

type Etat =
  /** Au démarrage : reprise de la connexion gardée sur l'appareil. */
  | { statut: 'demarrage' }
  | { statut: 'connecte'; moi: Moi }
  /** `message` : pourquoi l'accompagnant doit se (re)connecter (jeton révoqué, réseau absent au démarrage). */
  | { statut: 'deconnecte'; message: string | null; reprisePossible: boolean };

type SessionValue = {
  etat: Etat;
  /** Le compte connecté, ou `null`. */
  session: Moi | null;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  connecterDemo: () => Promise<void>;
  deconnecter: () => Promise<void>;
  /** Relance la reprise de connexion (après une coupure réseau au démarrage). */
  reprendre: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Session de l'accompagnant (lot M2).
 * - Jetons gérés par `@/api` (accès en mémoire, renouvellement dans expo-secure-store).
 * - Au démarrage : reprise silencieuse si un jeton de renouvellement est gardé.
 * - Jeton refusé ou réutilisé : retour à l'écran de connexion, avec un message clair.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ statut: 'demarrage' });

  const reprendre = useCallback(async () => {
    setEtat({ statut: 'demarrage' });
    try {
      const moi = await api.restaurer();
      setEtat(moi ? { statut: 'connecte', moi } : { statut: 'deconnecte', message: null, reprisePossible: false });
    } catch (e) {
      // Connexion fermée (expirée, rejeu détecté, compte refusé) : on garde l'explication, sans « Réessayer » (revue m7).
      const finSession = e instanceof ApiError && ['JETON_INVALIDE', 'JETON_REUTILISE', 'ACCES_REFUSE'].includes(e.code);
      setEtat({ statut: 'deconnecte', message: messageErreur(e), reprisePossible: !finSession });
    }
  }, []);

  useEffect(() => {
    void reprendre();
    return api.surSessionPerdue((message) => setEtat({ statut: 'deconnecte', message, reprisePossible: false }));
  }, [reprendre]);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const moi = await api.connecter(email, motDePasse);
    setEtat({ statut: 'connecte', moi });
  }, []);

  const connecterDemo = useCallback(async () => {
    const moi = await api.connecterDemo();
    setEtat({ statut: 'connecte', moi });
  }, []);

  const deconnecter = useCallback(async () => {
    // Lot N1 : retirer l'appareil AVANT de fermer la connexion (le jeton d'accès sert encore).
    await retirerAppareilPush();
    await api.deconnecter();
    setEtat({ statut: 'deconnecte', message: null, reprisePossible: false });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ etat, session: etat.statut === 'connecte' ? etat.moi : null, connecter, connecterDemo, deconnecter, reprendre }),
    [etat, connecter, connecterDemo, deconnecter, reprendre],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession doit être utilisé dans <SessionProvider>.');
  return v;
}
