#!/usr/bin/env node
/**
 * Serveur de DÉVELOPPEMENT pour l'export web (lot M2) : sert `dist/` ET relaie `/api/*` vers `plateforme/`.
 *
 * Pourquoi : l'API v1 n'envoie pas d'en-têtes CORS (elle sert une app native, pas un autre site).
 * Un navigateur bloque donc les appels de http://localhost:4320 vers http://localhost:3000.
 * Avec ce relais, la page et l'API ont la MÊME origine : plus de CORS, et `plateforme/` ne change pas.
 * L'app native (iOS / Android) n'en a pas besoin : elle appelle l'API directement.
 *
 * Usage (depuis mobile/) :
 *   EXPO_PUBLIC_API_URL=/ npx expo export -p web       # l'app appelle /api/v1 sur sa propre origine
 *   node scripts/proxy-dev.mjs --port 4320 --api http://localhost:3000 [--dist dist]
 *
 * Ne pas utiliser en production.
 */
import { createServer, request as requeteHttp } from 'node:http';
import { request as requeteHttps } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function option(nom, defaut) {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

const ici = fileURLToPath(new URL('.', import.meta.url));
const port = Number(option('port', process.env.PORT ?? 4320));
const racine = resolve(ici, '..', option('dist', 'dist'));
const cible = new URL(option('api', process.env.API_CIBLE ?? 'http://localhost:3000'));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

/** Relais vers l'API. L'en-tête Host est réécrit ; X-Forwarded-For garde l'IP (limites de débit). */
function relayer(req, res) {
  const envoyer = cible.protocol === 'https:' ? requeteHttps : requeteHttp;
  const amont = envoyer(
    {
      protocol: cible.protocol,
      hostname: cible.hostname,
      port: cible.port || (cible.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: cible.host, 'x-forwarded-for': req.socket.remoteAddress ?? '' },
    },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  amont.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ erreur: { code: 'ERREUR_INTERNE', message: 'Le serveur Koudmen ne répond pas.' } }));
  });
  req.pipe(amont);
}

async function servirFichier(req, res) {
  const chemin = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let fichier = join(racine, chemin);
  try {
    if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html');
  } catch {
    fichier = join(racine, 'index.html'); // repli SPA
  }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': types[extname(fichier)] ?? 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
}

createServer((req, res) => {
  if ((req.url ?? '').startsWith('/api/')) relayer(req, res);
  else void servirFichier(req, res);
}).listen(port, () => console.log(`Export web sur http://localhost:${port} · /api → ${cible.origin}`));
