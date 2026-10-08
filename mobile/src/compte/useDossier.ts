import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError, messageErreur } from '@/api';
import type { DossierVerification, ElementVerification, TypeElement } from '@/contracts';

/**
 * L2 : dossier de vérification (GET /accompagnant/verifications), relu à chaque retour sur l'écran.
 * `absent` : serveur sans les routes L2 (404). L'app garde alors le parcours D15 seul, sans impasse.
 */
export function useDossier() {
  const [dossier, setDossier] = useState<DossierVerification | null>(null);
  const [absent, setAbsent] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const dernier = useRef(0);

  const recharger = useCallback(async () => {
    const n = ++dernier.current;
    setChargement(true);
    try {
      const d = await api.lireDossier();
      if (n !== dernier.current) return d;
      setDossier(d);
      setAbsent(false);
      setErreur(null);
      return d;
    } catch (e) {
      if (n !== dernier.current) return null;
      if (e instanceof ApiError && e.code === 'INTROUVABLE') setAbsent(true);
      else setErreur(messageErreur(e));
      return null;
    } finally {
      if (n === dernier.current) setChargement(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void recharger();
    }, [recharger]),
  );

  const element = useCallback((t: TypeElement): ElementVerification | null => dossier?.items.find((i) => i.type === t) ?? null, [dossier]);

  return { dossier, absent, chargement, erreur, recharger, element };
}
