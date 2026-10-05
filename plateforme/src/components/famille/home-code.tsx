import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { contenuQrDomicile, qrSvgPath } from "@/lib/qr";

/** QR code du domicile en SVG (aucune dépendance, aucune image externe). Contenu : `koudmen:domicile:<code>`. */
export function HomeCodeQr({ code, size = 168 }: { code: string; size?: number }) {
  const { d, taille } = qrSvgPath(contenuQrDomicile(code));
  return (
    <svg
      role="img"
      aria-label={`QR code du domicile. Il contient le même code : ${code.split("").join(" ")}`}
      viewBox={`0 0 ${taille} ${taille}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-md bg-white"
      data-qr-contenu={contenuQrDomicile(code)}
    >
      {/* Toujours noir sur blanc, même en thème sombre : un lecteur de QR en a besoin. */}
      <rect width={taille} height={taille} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}

/**
 * Code du domicile (arbitrage V1 X3) : UN seul code par domicile, en clair ET en QR sur la même feuille.
 * L'app propose « Scanner » ou « Saisir » : les deux donnent le même code. C'est une des 3 preuves de visite.
 */
export function HomeCode({ code, aineFirstName }: { code: string; aineFirstName: string }) {
  return (
    <Card aria-labelledby="home-code-title" className="flex flex-col gap-3">
      <h2 id="home-code-title" className="inline-flex items-center gap-2 font-sans text-[17px] font-semibold tracking-normal">
        <KeyRound aria-hidden="true" className="size-[18px] text-mer" strokeWidth={1.6} />
        Code du domicile
      </h2>
      <div className="flex flex-col items-center gap-3 rounded-md bg-surface-2 px-3 py-4">
        <p className="text-center font-mono text-[40px] leading-none font-semibold tracking-[.25em] break-all">
          <span className="sr-only">Code, lettre par lettre : {code.split("").join(" ")}</span>
          <span aria-hidden="true">{code}</span>
        </p>
        <HomeCodeQr code={code} />
        <p className="text-center text-[15px] text-muted">Le code et le QR code donnent la même preuve.</p>
      </div>
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-[1.45] text-muted">
        <li>Imprimez cette fiche, ou recopiez le code en grand sur une feuille.</li>
        <li>Affichez la feuille chez {aineFirstName}, près de la porte.</li>
        <li>
          À chaque visite, l&apos;accompagnant scanne le QR code ou saisit le code. C&apos;est la preuve « Code du domicile ».
        </li>
      </ol>
    </Card>
  );
}
