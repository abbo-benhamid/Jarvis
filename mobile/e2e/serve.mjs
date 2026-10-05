// Serveur statique minimal pour l'export web (`dist/`), avec repli SPA sur index.html.
// Usage : node e2e/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4319);
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

createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let fichier = join(racine, chemin);
  try {
    if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html');
  } catch {
    fichier = join(racine, 'index.html');
  }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': types[extname(fichier)] ?? 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
}).listen(port, () => console.log(`Export web servi sur http://localhost:${port}`));
