/**
 * Crée un compte OPÉRATEUR réel (D1 : pas de démo publique de l'espace opérateur).
 *
 *   pnpm ops:create-operator --email prenom@koudmen.fr --prenom Prénom --nom Nom
 *
 * - Le mot de passe est GÉNÉRÉ et affiché une seule fois. Transmets-le par un canal sûr.
 * - Option : variable OPERATOR_PASSWORD (12 caractères minimum) pour imposer un mot de passe.
 * - Relancer la commande avec le même email remet un nouveau mot de passe.
 * - En production : lance la commande avec la DATABASE_URL de production (jamais dans le dépôt).
 */
import { PrismaClient } from "@prisma/client";
import { upsertOperatorAccount } from "../src/server/ops/operator-account";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const firstName = arg("prenom");
  const lastName = arg("nom");
  if (!email || !firstName || !lastName) {
    console.error("Usage : pnpm ops:create-operator --email <email> --prenom <prénom> --nom <nom>");
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const r = await upsertOperatorAccount(prisma, { email, firstName, lastName, password: process.env.OPERATOR_PASSWORD || undefined });
    console.log(r.created ? "Compte opérateur créé." : "Compte opérateur existant : nouveau mot de passe.");
    console.log(`  Email        : ${r.email}`);
    console.log(`  Mot de passe : ${r.password}`);
    console.log("ATTENTION : ce mot de passe ne s'affiche qu'une fois. Transmettez-le par un canal sûr.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
