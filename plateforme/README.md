# Koudmen — plateforme MVP

Application web Next.js full-stack (App Router, Server Actions, Prisma, PostgreSQL).

> ATTENTION : version de test. Utilise uniquement des **données fictives**. Aucun paiement réel. Aucun message réel.

- Spécification : [`../docs/tech/specification-mvp.md`](../docs/tech/specification-mvp.md)
- Lots de travail et propriété des fichiers : [`../docs/tech/lots.md`](../docs/tech/lots.md)
- Décisions : [`../docs/tech/adr/`](../docs/tech/adr/)

## 1. Prérequis

- Node.js 22 (20.18 minimum) et pnpm 10.
- PostgreSQL 16 en local.

## 2. Lancer en local (première fois)

1. Démarre PostgreSQL :
   ```bash
   service postgresql start
   ```
2. Crée le rôle et la base (une seule fois) :
   ```bash
   su postgres -c "psql -c \"CREATE ROLE koudmen WITH LOGIN PASSWORD 'koudmen' CREATEDB;\""
   su postgres -c "psql -c \"CREATE DATABASE koudmen OWNER koudmen;\""
   ```
3. Copie la configuration, puis change `SESSION_SECRET` :
   ```bash
   cp .env.example .env
   openssl rand -base64 48   # colle la valeur dans SESSION_SECRET
   ```
4. Installe, migre, remplis la base :
   ```bash
   pnpm install
   pnpm db:migrate    # applique prisma/migrations
   pnpm db:seed       # EFFACE puis recrée les données de démo
   ```
5. Lance l'application :
   ```bash
   pnpm dev           # http://localhost:3000
   ```

## 3. Tester, démo, opérateur

- **Testeurs :** page d'accueil → « Tester Koudmen » → code de `TESTER_INVITE_CODES` → bac à sable personnel (monde fictif, robots, « Simuler la suite », lien de reprise). Voir ADR 0003.
- **Démo partagée (fondateur, en direct) :** `/connexion` → « Démo partagée : Famille / Accompagnant » si `DEMO_MODE=true`. Mot de passe des comptes seedés : `DEMO_PASSWORD`. Aucun compte démo « Opérateur » (D1).
- **Opérateur :** vrai compte seulement. Local : `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` (créé par le seed). Production : `pnpm ops:create-operator --email … --prenom … --nom …`.

| Rôle | Email | Contenu |
|---|---|---|
| Famille (diaspora, Paris) | `famille@demo.koudmen.test` | Sandrine, aînée Léonie (Fort-de-France), formule Sérénité, 6 visites, 3 Kayé |
| Accompagnant | `accompagnant@demo.koudmen.test` | Josiane, salariée de la famille (CESU), 1 mission, 1 proposition choisie par la famille |
| Opérateur (réel, local) | `operateur@koudmen.test` | 1 accompagnant à valider, 1 demande à matcher |

## 4. Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` / `pnpm start` | Migrations (`migrate deploy`) + build ; serveur de production. `pnpm build:local` : build sans migration |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict (`tsc --noEmit`) |
| `pnpm test` | Tests unitaires Vitest (`src/**/*.test.ts(x)`) |
| `pnpm e2e` | Tests Playwright (`e2e/`). Fais `pnpm build` avant. Lance `next start` sur le port 3100 |
| `pnpm db:migrate` | Crée/applique une migration (dev) |
| `pnpm db:deploy` | Applique les migrations (CI, prod) |
| `pnpm db:seed` | Recrée les données de démo (refuse si `DEMO_MODE` != `true`) |
| `pnpm ops:create-operator` | Crée un vrai compte opérateur (mot de passe généré, affiché une fois) |
| `pnpm ops:purge-sandboxes` | Purge les bacs à sable de plus de 30 jours |
| `pnpm db:reset` | Remet la base à zéro + seed |

Playwright en local : Chromium est déjà installé. Exporte `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Ne lance pas `playwright install`.

## 5. Déployer pour les testeurs (Vercel + Neon, région UE)

1. Crée une base Neon en région UE. Note l'URL **poolée** (`DATABASE_URL`) et l'URL **directe** (`DIRECT_URL`).
2. Crée le projet Vercel avec le dossier racine `plateforme`. Le build (`pnpm build`) applique les migrations puis construit.
3. Déclare les variables (liste commentée dans `.env.example`) : `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET`, `TESTER_INVITE_CODES`, `DEMO_MODE=false`, `NEXT_PUBLIC_TEST_MODE=true`, `APP_URL`, `EDITEUR_NOM`, `EDITEUR_ADRESSE`, `EDITEUR_EMAIL`, `DIRECTEUR_PUBLICATION`.
4. Déploie. `vercel.json` déclare le cron nocturne de purge.
5. Crée les opérateurs depuis ton poste : `DATABASE_URL=<url directe> pnpm ops:create-operator --email … --prenom … --nom …`.
6. Ne lance **jamais** `pnpm db:seed` sur la base des testeurs (il efface tout).
7. Vérifie : `/` (un seul bouton), `/tester` avec un code, `/mentions-legales` (identité complète), `/operateur` refusé sans compte opérateur.

## 6. Arborescence

```
plateforme/
├── prisma/            schéma complet, migrations, seed
├── e2e/               tests Playwright
└── src/
    ├── app/
    │   ├── (public)/        accueil, connexion, inscription, mentions (socle)
    │   ├── (famille)/       Lot A
    │   ├── invitation/      Lot A (page publique)
    │   ├── (accompagnant)/  Lot B
    │   └── (operateur)/     Lot C
    ├── components/ui/       composants accessibles (socle)
    ├── lib/                 libellés, communes, formats (client + serveur)
    └── server/              domaine partagé : db, auth, audit, outbox, règles, preuve de visite
```
