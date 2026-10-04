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

## 3. Comptes de démonstration

Sur la page d'accueil, clique sur « Essayer en tant que… » (si `DEMO_MODE=true`).
Connexion classique possible avec le mot de passe `demo-koudmen-2026`.

| Rôle | Email | Contenu |
|---|---|---|
| Famille (diaspora, Paris) | `famille@demo.koudmen.test` | Sandrine, aînée Léonie (Fort-de-France), formule Sérénité, 6 visites, 3 Kayé |
| Accompagnant | `accompagnant@demo.koudmen.test` | Josiane, salariée de la famille (CESU), 1 mission, 1 proposition en attente |
| Opérateur | `operateur@demo.koudmen.test` | Équipe Koudmen : 1 accompagnant à valider, 1 demande à matcher |

Autres comptes seedés (même mot de passe) : `frederic.joseph@…`, `patrick.bellance@…`, `marie-claire.rosemond@…`, `kevin.marie-sainte@…`, `nadege.rosemond@…`, `germaine.celestine@…`, `mylene.berard@…`, `steeve.larcher@…` (domaine `demo.koudmen.test`).

## 4. Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` / `pnpm start` | Build et serveur de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict (`tsc --noEmit`) |
| `pnpm test` | Tests unitaires Vitest (`src/**/*.test.ts(x)`) |
| `pnpm e2e` | Tests Playwright (`e2e/`). Fais `pnpm build` avant. Lance `next start` sur le port 3100 |
| `pnpm db:migrate` | Crée/applique une migration (dev) |
| `pnpm db:deploy` | Applique les migrations (CI, prod) |
| `pnpm db:seed` | Recrée les données de démo |
| `pnpm db:reset` | Remet la base à zéro + seed |

Playwright en local : Chromium est déjà installé. Exporte `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Ne lance pas `playwright install`.

## 5. Déployer pour les testeurs (Vercel + Postgres UE)

1. Crée une base Postgres managée en région UE (ex. Neon `eu-central-1`).
2. Crée le projet Vercel avec le dossier racine `plateforme`.
3. Déclare les variables : `DATABASE_URL`, `SESSION_SECRET` (nouvelle valeur), `DEMO_MODE=true`, `NEXT_PUBLIC_TEST_MODE=true`, `APP_URL`.
4. Applique les migrations et le seed depuis ton poste : `DATABASE_URL=… pnpm db:deploy && DATABASE_URL=… pnpm db:seed`.
5. Déploie. Vérifie la connexion démo des 3 rôles.

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
