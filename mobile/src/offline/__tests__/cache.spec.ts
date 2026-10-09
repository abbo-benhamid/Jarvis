import { expect, test } from '@playwright/test';
import type { ReponseVisite, Visite } from '../../contracts';
import { creerCache, DUREE_CACHE_VISITES_MS, estDuJour } from '../cache';
import { stockageMemoire } from '../memoire';

/** Cache de lecture hors ligne (lot M3) : visites du jour seulement, 24 h, contrat vérifié. */

function visite(id: string, debut: Date, minutes = 90): Visite {
  return {
    id,
    debut: debut.toISOString(),
    fin: new Date(debut.getTime() + minutes * 60_000).toISOString(),
    statut: 'PREVUE',
    fuseau: 'America/Guadeloupe',
    aine: { territoire: 'GUADELOUPE', prenom: 'Léonie', initialeNom: 'B.', commune: 'SAINTE_ANNE_GP', communeLibelle: 'Sainte-Anne', adresseApproximative: null, interets: [] },
    demande: { niveau: 1, frequence: 'HEBDOMADAIRE', dureeMinutes: minutes, consignes: 'Marché, puis courrier.' },
    preuve: { score: 0, seuil: 2, facteursValides: [], checkInA: null, checkOutA: null, horlogeSuspecte: false },
    kayePublie: false,
    actions: { checkIn: true, checkOut: false, kaye: false },
  };
}

const aujourdhui = (h: number) => {
  const d = new Date(2026, 9, 5, h, 0, 0, 0);
  return d;
};

test('garde seulement les visites du jour', async () => {
  const maintenant = aujourdhui(10).getTime();
  const cache = creerCache(stockageMemoire(), () => maintenant);
  const hier = visite('hier', new Date(2026, 9, 4, 9));
  const tard = visite('nuit', new Date(2026, 9, 4, 23, 30), 60); // finit après minuit : du jour
  const matin = visite('matin', aujourdhui(9));
  const soir = visite('soir', aujourdhui(17));
  const demain = visite('demain', new Date(2026, 9, 6, 9));
  expect(await cache.garderVisites([hier, tard, matin, soir, demain])).toHaveLength(3);
  expect((await cache.lireVisites())?.map((v) => v.id)).toEqual(['nuit', 'matin', 'soir']);
  expect(estDuJour(demain, maintenant)).toBe(false);
});

test('fiche : gardée si du jour, oubliée sinon ; expirée après 24 h', async () => {
  let maintenant = aujourdhui(10).getTime();
  const cache = creerCache(stockageMemoire(), () => maintenant);
  const fiche: ReponseVisite = { ...visite('matin', aujourdhui(9)), brouillonKaye: { note: 'à finir' } };
  await cache.garderVisite(fiche);
  await cache.garderVisite({ ...visite('demain', new Date(2026, 9, 6, 9)), brouillonKaye: null });
  expect(await cache.lireVisite('matin')).toMatchObject({ id: 'matin', brouillonKaye: { note: 'à finir' } });
  expect(await cache.lireVisite('demain')).toBeNull();

  maintenant += DUREE_CACHE_VISITES_MS + 1;
  expect(await cache.lireVisite('matin')).toBeNull();
});

test('une donnée hors contrat est ignorée', async () => {
  const stockage = stockageMemoire();
  const cache = creerCache(stockage, () => aujourdhui(10).getTime());
  await stockage.ecrireCache('visites', { valeur: JSON.stringify([{ id: 'x', telephone: '0696' }]), enregistreA: aujourdhui(10).getTime() });
  expect(await cache.lireVisites()).toBeNull();
});
