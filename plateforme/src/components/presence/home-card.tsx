import { qrSvgPath } from "@/lib/qr";
import { communeLabel } from "@/lib/communes";
import { formatDate, initialWithDot } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { HomeCardActions } from "./home-card-actions";

export type HomeCardProps = {
  aineId: string;
  firstName: string;
  lastInitial: string | null;
  commune: string;
  code: string;
  version: number;
  issuedAt: Date;
  qrContent: string;
  canRegenerate: boolean;
};

/** QR signé de la carte domicile, en SVG (aucune image externe). Toujours noir sur blanc (lecteurs de QR). */
export function SignedHomeQr({ content, code, size = 220 }: { content: string; code: string; size?: number }) {
  const { d, taille } = qrSvgPath(content);
  return (
    <svg
      role="img"
      aria-label={`QR code signé du domicile. Code de secours écrit dessous : ${code.split("").join(" ")}`}
      viewBox={`0 0 ${taille} ${taille}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-md bg-white"
      data-qr-contenu={content}
    >
      <rect width={taille} height={taille} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}

/**
 * L1-B (L9) : carte domicile à imprimer. Une seule carte valable par domicile : la dernière version.
 * À l'impression (CSS `.kd-print-card`), seule la carte sort, sans les boutons.
 */
export function HomeCard(props: HomeCardProps) {
  const name = `${props.firstName} ${initialWithDot(props.lastInitial)}`.trim();
  return (
    <div className="flex flex-col gap-4">
      <Card aria-labelledby="home-card-title" className="kd-print-card flex flex-col items-center gap-4 text-center">
        <div className="flex w-full flex-col gap-1">
          <p className="text-[13px] font-semibold tracking-[.12em] text-mer uppercase">Koudmen · Carte domicile</p>
          <h2 id="home-card-title" className="font-display text-[28px] leading-[1.1] font-normal tracking-[-.02em]">
            Chez {name}
          </h2>
          <p className="text-[15px] text-muted" data-print-muted>
            {communeLabel(props.commune)}
          </p>
        </div>

        <SignedHomeQr content={props.qrContent} code={props.code} />

        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] text-muted" data-print-muted>
            Code de secours
          </p>
          <p className="font-mono text-[34px] leading-none font-semibold tracking-[.25em]">
            <span className="sr-only">Code, lettre par lettre : {props.code.split("").join(" ")}</span>
            <span aria-hidden="true">{props.code}</span>
          </p>
        </div>

        <ol className="m-0 flex w-full list-decimal flex-col gap-1 pl-5 text-left text-[15px] leading-[1.45]">
          <li>Gardez cette carte près de la porte, à l&apos;intérieur.</li>
          <li>À chaque visite, l&apos;accompagnant scanne le QR code avec l&apos;app Koudmen.</li>
          <li>Si le QR ne marche pas, il saisit le code de secours.</li>
          <li>Ne donnez pas cette carte à une autre personne. Carte perdue ? La famille en crée une nouvelle.</li>
        </ol>

        <p className="text-[13px] text-muted" data-print-muted>
          Version {props.version} · créée le {formatDate(props.issuedAt)}
        </p>
      </Card>

      <HomeCardActions aineId={props.aineId} firstName={props.firstName} canRegenerate={props.canRegenerate} />
    </div>
  );
}
