/**
 * Générateur de QR code, SANS dépendance externe (arbitrage V1 X3 : code du domicile en QR).
 * Fichier pur : utilisable côté serveur et côté client.
 *
 * Portée volontairement réduite : mode « octets » (UTF-8), correction d'erreur M (15 %), versions 1 à 10
 * (jusqu'à 213 octets : largement assez pour `koudmen:domicile:<code>`). Masque choisi par le score de
 * pénalité de la norme ISO/IEC 18004. Algorithme : adaptation du « QR Code generator » de Project Nayuki (MIT).
 */

/** Codewords de correction par bloc, niveau M, index = version (1 à 10). */
const ECC_PAR_BLOC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** Nombre de blocs, niveau M, index = version (1 à 10). */
const BLOCS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Bits du niveau M dans l'information de format. */
const FORMAT_M = 0;
export const QR_VERSION_MAX = 10;

function modulesDonneesBruts(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function codewordsDonnees(ver: number): number {
  return Math.floor(modulesDonneesBruts(ver) / 8) - ECC_PAR_BLOC_M[ver]! * BLOCS_M[ver]!;
}

function bit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

// ─────────────── Reed-Solomon sur GF(2^8), polynôme 0x11D ───────────────

function mulGf(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function diviseurRs(degre: number): number[] {
  const r = new Array<number>(degre).fill(0);
  r[degre - 1] = 1;
  let racine = 1;
  for (let i = 0; i < degre; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mulGf(r[j]!, racine);
      if (j + 1 < r.length) r[j] = r[j]! ^ r[j + 1]!;
    }
    racine = mulGf(racine, 0x02);
  }
  return r;
}

function resteRs(donnees: number[], diviseur: number[]): number[] {
  const r = new Array<number>(diviseur.length).fill(0);
  for (const b of donnees) {
    const facteur = b ^ r.shift()!;
    r.push(0);
    for (let i = 0; i < r.length; i++) r[i] = r[i]! ^ mulGf(diviseur[i]!, facteur);
  }
  return r;
}

// ─────────────── Encodage ───────────────

/** Matrice du QR code (true = module sombre), sans la zone calme. Lève une erreur si le texte est trop long. */
export function qrMatrix(texte: string): boolean[][] {
  const octets = [...new TextEncoder().encode(texte)];
  let ver = 1;
  for (; ver <= QR_VERSION_MAX; ver++) {
    const bitsCompte = ver <= 9 ? 8 : 16;
    if (4 + bitsCompte + octets.length * 8 <= codewordsDonnees(ver) * 8) break;
  }
  if (ver > QR_VERSION_MAX) throw new Error("Texte trop long pour le QR code.");

  // Flux de bits : mode octets (0100), longueur, données, terminateur, octets de bourrage.
  const bits: number[] = [];
  const ajouter = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  ajouter(0b0100, 4);
  ajouter(octets.length, ver <= 9 ? 8 : 16);
  for (const o of octets) ajouter(o, 8);
  const capacite = codewordsDonnees(ver) * 8;
  ajouter(0, Math.min(4, capacite - bits.length));
  ajouter(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacite; pad ^= 0xec ^ 0x11) ajouter(pad, 8);
  const donnees: number[] = [];
  for (let i = 0; i < bits.length; i += 8) donnees.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Blocs, correction d'erreur, entrelacement.
  const nbBlocs = BLOCS_M[ver]!;
  const eccBloc = ECC_PAR_BLOC_M[ver]!;
  const bruts = Math.floor(modulesDonneesBruts(ver) / 8);
  const nbCourts = nbBlocs - (bruts % nbBlocs);
  const longCourt = Math.floor(bruts / nbBlocs);
  const div = diviseurRs(eccBloc);
  const blocs: number[][] = [];
  for (let i = 0, k = 0; i < nbBlocs; i++) {
    const dat = donnees.slice(k, k + longCourt - eccBloc + (i < nbCourts ? 0 : 1));
    k += dat.length;
    const ecc = resteRs(dat, div);
    if (i < nbCourts) dat.push(0);
    blocs.push(dat.concat(ecc));
  }
  const final: number[] = [];
  for (let i = 0; i < blocs[0]!.length; i++) {
    for (let j = 0; j < blocs.length; j++) {
      if (i !== longCourt - eccBloc || j >= nbCourts) final.push(blocs[j]![i]!);
    }
  }

  // Motifs fixes.
  const taille = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: taille }, () => new Array<boolean>(taille).fill(false));
  const fixe: boolean[][] = Array.from({ length: taille }, () => new Array<boolean>(taille).fill(false));
  const poser = (x: number, y: number, sombre: boolean) => {
    mod[y]![x] = sombre;
    fixe[y]![x] = true;
  };
  for (let i = 0; i < taille; i++) {
    poser(6, i, i % 2 === 0);
    poser(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [taille - 4, 3],
    [3, taille - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < taille && y >= 0 && y < taille) poser(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const alignements: number[] = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const pas = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    alignements.push(6);
    for (let pos = taille - 7; alignements.length < n; pos -= pas) alignements.splice(1, 0, pos);
  }
  const na = alignements.length;
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) poser(alignements[i]! + dx, alignements[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  const poserFormat = (masque: number) => {
    const d = (FORMAT_M << 3) | masque;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) poser(8, i, bit(b, i));
    poser(8, 7, bit(b, 6));
    poser(8, 8, bit(b, 7));
    poser(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) poser(taille - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) poser(8, taille - 15 + i, bit(b, i));
    poser(8, taille - 8, true);
  };
  poserFormat(0); // réserve les zones de format (valeur finale posée après le choix du masque)
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = taille - 11 + (i % 3);
      const c = Math.floor(i / 3);
      poser(a, c, bit(b, i));
      poser(c, a, bit(b, i));
    }
  }

  // Données en zigzag.
  let n = 0;
  for (let droite = taille - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let v = 0; v < taille; v++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j;
        const montant = ((droite + 1) & 2) === 0;
        const y = montant ? taille - 1 - v : v;
        if (!fixe[y]![x] && n < final.length * 8) {
          mod[y]![x] = bit(final[n >>> 3]!, 7 - (n & 7));
          n++;
        }
      }
    }
  }

  const appliquerMasque = (m: number) => {
    for (let y = 0; y < taille; y++) {
      for (let x = 0; x < taille; x++) {
        if (fixe[y]![x]) continue;
        const inv =
          m === 0
            ? (x + y) % 2 === 0
            : m === 1
              ? y % 2 === 0
              : m === 2
                ? x % 3 === 0
                : m === 3
                  ? (x + y) % 3 === 0
                  : m === 4
                    ? (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
                    : m === 5
                      ? ((x * y) % 2) + ((x * y) % 3) === 0
                      : m === 6
                        ? (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
                        : (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        if (inv) mod[y]![x] = !mod[y]![x];
      }
    }
  };

  let meilleur = 0;
  let minPenalite = Infinity;
  for (let m = 0; m < 8; m++) {
    appliquerMasque(m);
    poserFormat(m);
    const p = penalite(mod);
    if (p < minPenalite) {
      minPenalite = p;
      meilleur = m;
    }
    appliquerMasque(m); // annule (XOR)
  }
  appliquerMasque(meilleur);
  poserFormat(meilleur);
  return mod;
}

/** Score de pénalité (ISO/IEC 18004 § 7.8.3) : suites, carrés 2×2, motifs de repère, équilibre. */
function penalite(m: boolean[][]): number {
  const t = m.length;
  let p = 0;
  const ligne = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= t; i++) {
      if (i < t && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) p += 3 + (run - 5);
        run = 1;
      }
    }
    // Motif 1:1:3:1:1 avec 4 modules clairs d'un côté (hors de la matrice = clair).
    const at = (i: number) => (i >= 0 && i < t ? get(i) : false);
    for (let i = -4; i < t; i++) {
      const motif = [true, false, true, true, true, false, true];
      if (!motif.every((v, k) => at(i + k) === v)) continue;
      const avant = [1, 2, 3, 4].every((k) => !at(i - k));
      const apres = [7, 8, 9, 10].every((k) => !at(i + k));
      if (avant || apres) p += 40;
    }
  };
  for (let y = 0; y < t; y++) ligne((i) => m[y]![i]!);
  for (let x = 0; x < t; x++) ligne((i) => m[i]![x]!);
  for (let y = 0; y < t - 1; y++) {
    for (let x = 0; x < t - 1; x++) {
      const c = m[y]![x];
      if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) p += 3;
    }
  }
  let sombres = 0;
  for (const r of m) for (const c of r) if (c) sombres++;
  const total = t * t;
  p += (Math.ceil(Math.abs(sombres * 20 - total * 10) / total) - 1) * 10;
  return p;
}

/**
 * Chemin SVG (attribut `d`) des modules sombres, zone calme comprise (`marge` modules autour).
 * `taille` = côté de la vue (viewBox) en modules.
 */
export function qrSvgPath(texte: string, marge = 4): { d: string; taille: number } {
  const m = qrMatrix(texte);
  const parts: string[] = [];
  m.forEach((r, y) =>
    r.forEach((c, x) => {
      if (c) parts.push(`M${x + marge} ${y + marge}h1v1h-1z`);
    }),
  );
  return { d: parts.join(""), taille: m.length + marge * 2 };
}

/** Contenu du QR du domicile (arbitrage X3) : même code que la saisie, lu par l'app (« Scanner »). */
export function contenuQrDomicile(code: string): string {
  return `koudmen:domicile:${code.trim().toUpperCase()}`;
}
