import { KeyRound } from "lucide-react";

/** Code domicile en très grand : à recopier et afficher chez l'aîné (près de la porte). */
export function HomeCode({ code, aineFirstName }: { code: string; aineFirstName: string }) {
  return (
    <section aria-labelledby="home-code-title" className="flex flex-col gap-3 rounded-2xl border-2 border-mer bg-mer-soft p-5">
      <h2 id="home-code-title" className="inline-flex items-center gap-2 text-xl font-bold">
        <KeyRound aria-hidden="true" className="size-5 text-mer" />
        Code du domicile
      </h2>
      <p className="text-center font-mono text-5xl font-bold tracking-[0.3em] break-all sm:text-6xl">
        <span className="sr-only">Code, lettre par lettre : {code.split("").join(" ")}</span>
        <span aria-hidden="true">{code}</span>
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Écrivez ce code en grand sur une feuille.</li>
        <li>Affichez la feuille chez {aineFirstName}, près de la porte.</li>
        <li>À chaque visite, l&apos;accompagnant saisit ce code. C&apos;est une des 3 preuves de visite.</li>
      </ol>
    </section>
  );
}
