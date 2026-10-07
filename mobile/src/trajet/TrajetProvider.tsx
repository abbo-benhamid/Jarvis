import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api } from '@/api';
import type { DomicileTrajet } from '@/contrats-l1';
import { natif } from '@/native';
import { useSession } from '@/session/SessionProvider';
import { donnerAccordTrajet, lireAccordTrajet, retirerAccordTrajet, type AccordTrajet } from './accord';
import { creerGestionnaireTrajet, type EtatTrajet, type GestionnaireTrajet, type RaisonFin } from './gestionnaire';

type ValeurTrajet = {
  etat: EtatTrajet;
  /** Accord mémorisé pour ce compte (`undefined` : lecture en cours). */
  accord: AccordTrajet | null | undefined;
  donnerAccord(): Promise<void>;
  /** Révoque l'accord (Profil). Arrête aussi un trajet en cours. */
  retirerAccord(): Promise<void>;
  demarrer(visiteId: string, prenom: string, domicileRepli: DomicileTrajet | null): Promise<void>;
  arreter(raison?: RaisonFin): void;
  oublierFin(): void;
};

const Contexte = createContext<ValeurTrajet | null>(null);

/** Un seul gestionnaire pour toute l'app (un seul trajet à la fois). */
let gestionnaire: GestionnaireTrajet | null = null;
function lireGestionnaire(): GestionnaireTrajet {
  gestionnaire ??= creerGestionnaireTrajet({
    api,
    suivre: (l, e) => natif.suivi.suivre(l, e),
    ecartEnvoiMs: () => natif.suivi.ecartEnvoiMs(),
  });
  return gestionnaire;
}

/**
 * Trajet partagé (L1, L6) : état global, bandeau persistant, arrêts automatiques.
 * - App en arrière-plan → arrêt (premier plan seulement, jamais de suivi caché).
 * - Déconnexion → arrêt local.
 */
export function TrajetProvider({ children }: { children: ReactNode }) {
  const g = lireGestionnaire();
  const { session } = useSession();
  const [etat, setEtat] = useState<EtatTrajet>(() => g.etat());
  const compteId = session?.id ?? null;
  /** Accord lu pour UN compte : changer de compte l'invalide sans effacer l'état dans un effet. */
  const [lu, setLu] = useState<{ compteId: string; accord: AccordTrajet | null } | null>(null);
  const accord = lu && lu.compteId === compteId ? lu.accord : undefined;
  const setAccord = useCallback((a: AccordTrajet | null) => {
    if (compteId) setLu({ compteId, accord: a });
  }, [compteId]);

  useEffect(() => g.abonner(setEtat), [g]);

  useEffect(() => {
    let actif = true;
    if (!compteId) {
      g.arreter('deconnexion');
      return;
    }
    void lireAccordTrajet(compteId).then((a) => {
      if (actif) setLu({ compteId, accord: a });
    });
    return () => {
      actif = false;
    };
  }, [compteId, g]);

  useEffect(() => {
    const ab = AppState.addEventListener('change', (s) => {
      if (s === 'background' && g.etat().statut !== 'inactif') g.arreter('arriere_plan');
    });
    return () => ab.remove();
  }, [g]);

  const donnerAccord = useCallback(async () => {
    if (!compteId) return;
    setAccord(await donnerAccordTrajet(compteId));
  }, [compteId, setAccord]);

  const retirerAccord = useCallback(async () => {
    g.arreter('manuel');
    await retirerAccordTrajet();
    setAccord(null);
  }, [g, setAccord]);

  const valeur = useMemo<ValeurTrajet>(
    () => ({
      etat,
      accord,
      donnerAccord,
      retirerAccord,
      demarrer: (id, prenom, repli) => g.demarrer(id, prenom, repli),
      arreter: (raison) => g.arreter(raison),
      oublierFin: () => g.oublierFin(),
    }),
    [etat, accord, donnerAccord, retirerAccord, g],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useTrajet(): ValeurTrajet {
  const v = useContext(Contexte);
  if (!v) throw new Error('useTrajet doit être utilisé dans <TrajetProvider>.');
  return v;
}
