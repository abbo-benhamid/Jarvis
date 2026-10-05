import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Code domicile en très grand : à recopier et afficher chez l'aîné (près de la porte). C'est une des 3 preuves. */
export function HomeCode({ code, aineFirstName }: { code: string; aineFirstName: string }) {
  return (
    <Card aria-labelledby="home-code-title" className="flex flex-col gap-3">
      <h2 id="home-code-title" className="inline-flex items-center gap-2 font-sans text-[17px] font-semibold tracking-normal">
        <KeyRound aria-hidden="true" className="size-[18px] text-mer" strokeWidth={1.6} />
        Code du domicile
      </h2>
      <p className="rounded-md bg-surface-2 px-3 py-4 text-center font-mono text-[40px] leading-none font-semibold tracking-[.25em] break-all">
        <span className="sr-only">Code, lettre par lettre : {code.split("").join(" ")}</span>
        <span aria-hidden="true">{code}</span>
      </p>
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-[1.45] text-muted">
        <li>Écrivez ce code en grand sur une feuille.</li>
        <li>Affichez la feuille chez {aineFirstName}, près de la porte.</li>
        <li>À chaque visite, l&apos;accompagnant saisit ce code. C&apos;est une des 3 preuves de visite.</li>
      </ol>
    </Card>
  );
}
