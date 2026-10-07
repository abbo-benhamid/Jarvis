#!/usr/bin/env node
/**
 * Copie les contrats Zod de l'API v1 dans l'app (ADR 0008 § 3, lot M2).
 *
 * Source : plateforme/src/contracts/v1/**  →  Cible : mobile/src/contracts/**
 * - Les fichiers `*.test.ts` ne sont PAS copiés.
 * - La cible est vidée avant la copie (un contrat supprimé disparaît aussi de l'app).
 * - Chaque fichier copié reçoit un en-tête « GÉNÉRÉ, ne pas modifier ».
 *
 * Usage : `npm run sync:contracts` (depuis mobile/).
 * Contrôle : `npm run sync:contracts -- --check` échoue si la copie n'est plus à jour.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(ici, '../../plateforme/src/contracts/v1');
const CIBLE = resolve(ici, '../src/contracts');
const verifier = process.argv.includes('--check');

const ENTETE =
  '// GÉNÉRÉ par mobile/scripts/sync-contracts.mjs depuis plateforme/src/contracts/v1. Ne pas modifier ici.\n';

/** Liste récursive des fichiers .ts, sans les tests. */
function lister(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...lister(chemin));
    else if (nom.endsWith('.ts') && !nom.endsWith('.test.ts')) out.push(chemin);
  }
  return out;
}

if (!existsSync(SOURCE)) {
  console.error(`Contrats introuvables : ${SOURCE}`);
  process.exit(1);
}

const fichiers = lister(SOURCE).map((f) => ({
  rel: relative(SOURCE, f),
  contenu: ENTETE + readFileSync(f, 'utf8'),
}));

/**
 * L1 : contrats PROVISOIRES dans `src/contrats-l1/` (hors de la cible, jamais écrasés).
 * Le script dit quand les contrats serveur L1 (inscription § 2.1, trajet § 2.2, QR § 2.3) sont arrivés :
 * il faut alors brancher l'app sur les copies générées et supprimer `src/contrats-l1/`.
 */
const toutLeServeur = fichiers.map((f) => f.contenu).join('\n');
const l1Serveur = {
  inscription: /inscription/i.test(toutLeServeur),
  trajet: /trajet/i.test(toutLeServeur),
  qrSigne: /qr\s*:/.test(toutLeServeur),
};
const l1Manquants = Object.entries(l1Serveur).filter(([, ok]) => !ok).map(([k]) => k);
if (l1Manquants.length) {
  console.log(`Note L1 : contrats serveur absents (${l1Manquants.join(', ')}). L'app utilise src/contrats-l1/ (provisoires).`);
} else {
  console.log('Note L1 : les contrats serveur L1 sont là. Remplacez src/contrats-l1/ par les copies générées.');
}

if (verifier) {
  const ecarts = fichiers.filter(({ rel, contenu }) => {
    const cible = join(CIBLE, rel);
    return !existsSync(cible) || readFileSync(cible, 'utf8') !== contenu;
  });
  const enTrop = existsSync(CIBLE)
    ? lister(CIBLE)
        .map((f) => relative(CIBLE, f))
        .filter((rel) => !fichiers.some((x) => x.rel === rel))
    : [];
  if (ecarts.length || enTrop.length) {
    console.error('Contrats pas à jour. Lancez : npm run sync:contracts');
    for (const e of ecarts) console.error(`  modifié : ${e.rel}`);
    for (const e of enTrop) console.error(`  en trop : ${e}`);
    process.exit(1);
  }
  console.log(`Contrats à jour (${fichiers.length} fichiers).`);
  process.exit(0);
}

rmSync(CIBLE, { recursive: true, force: true });
for (const { rel, contenu } of fichiers) {
  const cible = join(CIBLE, rel);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
}
console.log(`${fichiers.length} contrats copiés dans src/contracts/ :`);
for (const { rel } of fichiers) console.log(`  ${rel}`);
