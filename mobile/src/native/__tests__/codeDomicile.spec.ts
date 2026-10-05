import { expect, test } from '@playwright/test';
import { contenuQrDomicile, lireQrDomicile, MESSAGES_QR, normaliserCode } from '../codeDomicile';

/** Tests unitaires (sans navigateur) du décodage du QR du domicile. */

test.describe('lireQrDomicile', () => {
  test('code seul (QR actuels) : lisible, en majuscules', () => {
    expect(lireQrDomicile('KDM482')).toEqual({ ok: true, format: 'lisible', code: 'KDM482' });
    expect(lireQrDomicile('  kdm482 \n')).toEqual({ ok: true, format: 'lisible', code: 'KDM482' });
  });

  test('format v1 koudmen:domicile:<code>', () => {
    expect(lireQrDomicile('koudmen:domicile:AB12CD')).toEqual({ ok: true, format: 'lisible', code: 'AB12CD' });
    expect(lireQrDomicile('KOUDMEN:DOMICILE:ab12cd')).toEqual({ ok: true, format: 'lisible', code: 'AB12CD' });
  });

  test('futur jeton signé s1 : reconnu, pas transformé en code', () => {
    const r = lireQrDomicile('koudmen:domicile:s1:eyJhbGciOiJFZERTQSJ9.eyJkIjoiMSJ9.c2ln');
    expect(r).toEqual({ ok: true, format: 'signe', version: 's1', jeton: 'eyJhbGciOiJFZERTQSJ9.eyJkIjoiMSJ9.c2ln' });
  });

  test('version signée inconnue : demande une mise à jour', () => {
    expect(lireQrDomicile('koudmen:domicile:s2:abc')).toMatchObject({ ok: false, raison: 'VERSION_INCONNUE' });
  });

  test('contenus refusés', () => {
    for (const brut of ['https://exemple.com', 'AB', 'koudmen:domicile:', 'koudmen:domicile:AB 12', 'koudmen:domicile:s1:', 'koudmen:aine:AB12CD', 'ABCDEFGHIJKLM']) {
      expect(lireQrDomicile(brut), brut).toMatchObject({ ok: false, raison: 'INCONNU', message: MESSAGES_QR.INCONNU });
    }
    expect(lireQrDomicile('   ')).toMatchObject({ ok: false, raison: 'VIDE' });
  });

  test('aller-retour : contenuQrDomicile puis lireQrDomicile', () => {
    expect(contenuQrDomicile('ab-12 cd')).toBe('koudmen:domicile:AB12CD');
    expect(lireQrDomicile(contenuQrDomicile('kdm482'))).toEqual({ ok: true, format: 'lisible', code: 'KDM482' });
    expect(normaliserCode(' k-d m482 ')).toBe('KDM482');
  });
});
