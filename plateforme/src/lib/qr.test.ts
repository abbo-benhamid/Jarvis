import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { QR_VERSION_MAX, contenuQrDomicile, qrMatrix, qrSvgPath } from "./qr";

/**
 * QR code sans dépendance (arbitrage V1 X3).
 * Vérification de lecture faite avec un décodeur ZXing (zxing-wasm) sur les versions 1, 2, 4, 7, 9 et 10 :
 * voir le rapport du sprint V1c. Ici : structure de la norme + empreinte figée (anti-régression).
 */
const empreinte = (m: boolean[][]) => createHash("sha256").update(m.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("\n")).digest("hex");

describe("QR code du domicile", () => {
  it("contenu : koudmen:domicile:<code> en majuscules (même format que l'app)", () => {
    expect(contenuQrDomicile(" lkw7q3 ")).toBe("koudmen:domicile:LKW7Q3");
  });

  it("taille = 4 × version + 17 ; version 2 pour un code du domicile", () => {
    expect(qrMatrix(contenuQrDomicile("LKW7Q3"))).toHaveLength(25);
    expect(qrMatrix("A")).toHaveLength(21);
    for (const r of qrMatrix(contenuQrDomicile("LKW7Q3"))) expect(r).toHaveLength(25);
  });

  it("3 motifs de repère (7 × 7) aux coins, motif de synchronisation alterné, module sombre fixe", () => {
    const m = qrMatrix(contenuQrDomicile("LKW7Q3"));
    const t = m.length;
    const repere = (x0: number, y0: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
          expect(m[y0 + y]![x0 + x]).toBe(d !== 2);
        }
      }
    };
    repere(0, 0);
    repere(t - 7, 0);
    repere(0, t - 7);
    for (let i = 8; i < t - 8; i++) {
      expect(m[6]![i]).toBe(i % 2 === 0);
      expect(m[i]![6]).toBe(i % 2 === 0);
    }
    expect(m[t - 8]![8]).toBe(true);
  });

  it("les 2 copies de l'information de format sont identiques", () => {
    const m = qrMatrix(contenuQrDomicile("V7EAS8"));
    const t = m.length;
    const a: boolean[] = [];
    const b: boolean[] = [];
    for (let i = 0; i <= 5; i++) a.push(m[i]![8]!);
    a.push(m[7]![8]!, m[8]![8]!, m[8]![7]!);
    for (let i = 9; i < 15; i++) a.push(m[8]![14 - i]!);
    for (let i = 0; i < 8; i++) b.push(m[8]![t - 1 - i]!);
    for (let i = 8; i < 15; i++) b.push(m[t - 15 + i]![8]!);
    expect(a).toEqual(b);
  });

  it("déterministe (empreinte figée, vérifiée au lecteur ZXing)", () => {
    expect(empreinte(qrMatrix(contenuQrDomicile("LKW7Q3")))).toBe(empreinte(qrMatrix("koudmen:domicile:LKW7Q3")));
    expect(empreinte(qrMatrix(contenuQrDomicile("LKW7Q3")))).toBe("a3752bcbf4d7cf96cae709b7d1e2dd86f5d671fb0c82c3355dba51b065098866");
  });

  it("refuse un texte trop long ; accepte jusqu'à la version 10", () => {
    expect(qrMatrix("a".repeat(200))).toHaveLength(QR_VERSION_MAX * 4 + 17);
    expect(() => qrMatrix("a".repeat(300))).toThrow(/trop long/);
  });

  it("SVG : zone calme de 4 modules, un carré par module sombre", () => {
    const { d, taille } = qrSvgPath("A");
    expect(taille).toBe(29);
    const sombres = qrMatrix("A").flat().filter(Boolean).length;
    expect(d.match(/M/g)).toHaveLength(sombres);
    expect(d.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
});
