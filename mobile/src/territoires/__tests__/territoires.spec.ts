import { expect, test } from '@playwright/test';
import {
  explicationBientot,
  fuseauDe,
  ORDRE_TERRITOIRES,
  territoire,
  territoireCompte,
  territoireDe,
  TERRITOIRES,
  trouverCommune,
} from '..';
import { domicileRepli } from '../../trajet/textes';

/** T1 : le territoire est une donnée (arbitrage Guadeloupe). Module pur. */

test('configuration : Guadeloupe seule ouverte, fuseaux IANA, ordre d’ouverture', () => {
  expect(ORDRE_TERRITOIRES).toEqual(['GUADELOUPE', 'MARTINIQUE', 'GUYANE', 'HEXAGONE']);
  expect(ORDRE_TERRITOIRES.filter((c) => TERRITOIRES[c].etat === 'OUVERT')).toEqual(['GUADELOUPE']);
  expect(ORDRE_TERRITOIRES.map((c) => TERRITOIRES[c].fuseau)).toEqual(['America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Europe/Paris']);
  expect(territoire(null).code).toBe('GUADELOUPE');
  expect(territoire('ATLANTIDE').code).toBe('GUADELOUPE');
  expect(explicationBientot('HEXAGONE')).toBe(
    'Koudmen ouvre d’abord en Guadeloupe. Les visites dans l’Hexagone arrivent plus tard. Inscrivez-vous sur la liste d’attente : nous vous prévenons à l’ouverture.',
  );
});

test('communes : 32 en Guadeloupe (sans Saint-Martin ni Saint-Barthélemy), 34 en Martinique, zones complètes', () => {
  const g = TERRITOIRES.GUADELOUPE;
  expect(g.communes).toHaveLength(32);
  expect(new Set(g.communes.map((c) => c.code)).size).toBe(32);
  expect(g.communes.map((c) => c.label)).not.toContain('Saint-Martin');
  expect(g.communes.map((c) => c.label)).not.toContain('Saint-Barthélemy');
  expect(TERRITOIRES.MARTINIQUE.communes).toHaveLength(34);
  for (const t of [g, TERRITOIRES.MARTINIQUE]) {
    const dansZones = t.zones.flatMap((z) => z.codes);
    expect([...dansZones].sort()).toEqual(t.communes.map((c) => c.code).sort());
    // Centres dans la boîte du territoire.
    for (const c of t.communes) {
      expect(Math.abs(c.lat - t.carte.latitude)).toBeLessThan(t.carte.delta);
      expect(Math.abs(c.lng - t.carte.longitude)).toBeLessThan(t.carte.delta);
    }
  }
  // Même code, deux territoires : le territoire décide.
  expect(trouverCommune('SAINTE_ANNE')?.lat).toBeGreaterThan(16);
  expect(trouverCommune('SAINTE_ANNE', 'MARTINIQUE')?.lat).toBeLessThan(15);
  expect(trouverCommune('FORT_DE_FRANCE')).toBeUndefined();
  expect(domicileRepli('POINTE_A_PITRE')).toEqual({ latitude: 16.2411, longitude: -61.5331, approximatif: true });
  expect(domicileRepli('FORT_DE_FRANCE', 'MARTINIQUE')?.approximatif).toBe(true);
});

test('territoire d’une visite : champ du serveur, puis fuseau, puis commune, puis Guadeloupe', () => {
  expect(territoireDe({ territoire: 'GUYANE', aine: { commune: 'POINTE_A_PITRE' } }).code).toBe('GUYANE');
  expect(territoireDe({ aine: { territoire: 'MARTINIQUE', commune: 'SAINTE_ANNE' } }).code).toBe('MARTINIQUE');
  expect(territoireDe({ fuseau: 'Europe/Paris', aine: { commune: 'X' } }).code).toBe('HEXAGONE');
  // Ancien serveur (sans territoire) : la commune décide, territoires ouverts d'abord.
  expect(territoireDe({ aine: { commune: 'FORT_DE_FRANCE' } }).code).toBe('MARTINIQUE');
  expect(territoireDe({ aine: { commune: 'SAINTE_ANNE' } }).code).toBe('GUADELOUPE');
  expect(territoireDe({ aine: { commune: 'INCONNUE' } }).code).toBe('GUADELOUPE');
  // Fuseau : celui du serveur d'abord, sinon celui du territoire.
  expect(fuseauDe({ fuseau: 'America/Cayenne', territoire: 'GUADELOUPE' })).toBe('America/Cayenne');
  expect(fuseauDe({ territoire: 'HEXAGONE' })).toBe('Europe/Paris');
  expect(fuseauDe({ aine: { commune: 'LAMENTIN' } })).toBe('America/Guadeloupe');
  // Compte : champ provisoire de GET /me, sinon Guadeloupe.
  expect(territoireCompte({ territoire: 'MARTINIQUE' }).code).toBe('MARTINIQUE');
  expect(territoireCompte({ prenom: 'Josiane' }).code).toBe('GUADELOUPE');
  expect(territoireCompte(null).code).toBe('GUADELOUPE');
});
