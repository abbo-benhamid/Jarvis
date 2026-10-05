import { useCallback, useEffect, useRef, useState } from 'react';

type Etat<T> =
  | { statut: 'chargement'; donnees?: T; erreur?: undefined }
  | { statut: 'pret'; donnees: T; erreur?: undefined }
  | { statut: 'erreur'; donnees?: T; erreur: Error };

/** Charge une donnée asynchrone. `recharger()` relance l'appel en gardant l'ancienne valeur. */
export function useAsync<T>(charger: () => Promise<T>, deps: readonly unknown[]) {
  const [etat, setEtat] = useState<Etat<T>>({ statut: 'chargement' });
  const monte = useRef(true);
  const chargerRef = useRef(charger);
  chargerRef.current = charger;

  const recharger = useCallback(async () => {
    setEtat((e) => ({ statut: 'chargement', donnees: e.donnees }));
    try {
      const d = await chargerRef.current();
      if (monte.current) setEtat({ statut: 'pret', donnees: d });
    } catch (err) {
      if (monte.current) setEtat((e) => ({ statut: 'erreur', donnees: e.donnees, erreur: err as Error }));
    }
  }, []);

  useEffect(() => {
    monte.current = true;
    void recharger();
    return () => {
      monte.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...etat, recharger, setDonnees: (d: T) => setEtat({ statut: 'pret', donnees: d }) };
}
