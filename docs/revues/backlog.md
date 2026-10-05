# Backlog des revues (après S1c)

> Source : `S1b-code.md`, `S1b-securite.md`, arbitrage `S1b-arbitrage.md`.
> Règle : un point MINEUR va ici s'il coûte plus de 30 minutes. Les points « pilote » restent ici jusqu'au pilote.
> Volet SERVEUR + SÉCURITÉ. Le volet INTERFACE (S1b-ux) a son propre agent.

## Faits dans S1c (volet serveur) — pour mémoire

| Point | État |
|---|---|
| B1, B3, M2, M1 (inscription), M3, M4, M5 (limites), M6, M7 | Fait |
| B2 côté données (TEST_END_DATE, Neon, user-agent) | Fait. Valeurs à fournir par le fondateur (identité, adresse, date) |
| Code M1 à M6 (D10, A6, A1, annulation, rétention) | Fait |
| Mineurs code m1, m2, m5, m6, m7, m8 ; m3 (2 lectures GPS au plus) | Fait |
| Mineurs sécurité m1 (temps constant), m4 (user-agent, « pseudonyme »), m5 (`auth.login_failed`) | Fait |

## À faire

| # | Origine | Gravité | Quand | Sujet | Proposition |
|---|---|---|---|---|---|
| BL-1 | code m4 | MINEUR | Avant pilote | `markCheckIn` et `recordProof` : deux écritures séparées ; `refreshVisitStatus` lit puis écrit sans verrou (double message `VISITE_VALIDEE` possible) | Une transaction « check-in + preuve + statut » ; notification seulement si `updateMany({ where: { id, status: ancien } })` change une ligne |
| BL-2 | sécu m2 | MINEUR | Avant pilote | CSP avec `script-src 'unsafe-inline'` | CSP à nonce posée par le middleware Next.js |
| BL-3 | sécu m3 | MINEUR | Avant pilote | Lien de reprise : jeton dans le chemin, jamais renouvelé, connexion forcée possible | Bouton « Générer un nouveau lien » ; page de confirmation avant de rouvrir |
| BL-4 | sécu M3 (suite) | MINEUR | Avant testeurs (interface) | Bouton « Oublier ce test sur cet appareil » sur `/tester` | Server Action qui efface `koudmen_bac_a_sable` (la déconnexion le fait déjà) |
| BL-5 | sécu m6 | MINEUR | Avant testeurs | `pnpm audit --prod` : `postcss` (via next), `deepmerge-ts` (via prisma) | Mettre à jour `next` et `prisma` ; `pnpm.overrides` pour `postcss` |
| BL-6 | sécu m7 | MINEUR | Avant testeurs (configuration) | Dépôt public : anciens mots de passe et codes connus | Activer le « secret scanning » GitHub ; envisager un dépôt privé. Les anciens codes sont refusés en production (liste `PUBLIC_TESTER_CODES`) |
| BL-7 | sécu m8 | MINEUR | Avant pilote | Tout membre du cercle crée des invitations Lakou et lit les jetons actifs | Invitation réservée au payeur ; ne pas renvoyer `token` aux non-payeurs (change l'écran Cercle) |
| BL-8 | sécu M5 | MAJEUR | Avant pilote | Pas de 2FA opérateur ; pas de verrouillage progressif | TOTP opérateur. La limite d'essais en base (S1c) et la session opérateur de 12 h sont en place |
| BL-9 | sécu M5 | — | Avant testeurs (configuration) | Règle Vercel Firewall (WAF) sur `POST /tester`, `/connexion`, `/api/evenements` | En plus des limites en base. [À VÉRIFIER : offre Vercel du projet] |
| BL-10 | sécu M6 | MINEUR | Avant pilote | Comptes `/inscription` déjà créés (monde réel) et journal d'audit du monde réel : pas de purge | `/inscription` est fermée hors démo (S1c). Ajouter une purge « fin du test » des comptes réels non opérateurs, et une durée pour l'audit |
| BL-11 | code M6 | MINEUR | Avant pilote | Bouton opérateur « Effacer ce contact » (retrait d'accord reçu par email) | Server Action opérateur auditée sur `DiscoveryRequest` (le testeur a déjà le lien et le bouton, S1c) |
| BL-12 | sécu B1 | MINEUR | Avant testeurs | `MAX_SANDBOXES_PER_CODE` = 200 | Avec un code par testeur, descendre à 5 à 10 (ou variable d'environnement) |
| BL-13 | A1 | MINEUR | Avant pilote | Réactivation d'un accompagnant : ses missions restent SUSPENDUE | Décision produit : la famille choisit de reprendre ou non (nouvelle proposition) |
| BL-14 | A1 | MINEUR | Interface | Libellés « Suspendue » (mission) et message à la famille sur la demande rouverte | Volet interface : afficher la demande rouverte et le statut de la mission |
| BL-15 | P1 | MAJEUR | Avant pilote | `canAccessAine` : accès pour toujours après une mission TERMINEE | Mission active + 30 jours |
| BL-16 | P2 | MAJEUR | Avant pilote | Code domicile fixe | Code à usage unique par visite, ou code tournant |
| BL-17 | P3 | BLOQUANT pilote | Avant pilote | Données de santé possibles (Kayé, alertes) hors HDS | HDS, AIPD, DPO (S1-juridique P4) |
| BL-18 | P4 | MAJEUR | Avant pilote | Cloisonnement seulement applicatif | RLS PostgreSQL (ADR 0003 § 3) |
| BL-19 | P5 | MAJEUR | Avant pilote | Pas de réinitialisation de mot de passe ni d'écran « Mes données » | Écran « Mes données » (export, suppression) ; incrémenter `sessionVersion` au changement de mot de passe |
| BL-20 | sécu M7 | MINEUR | Avant pilote | Compte démo partagé : la déconnexion d'un visiteur ferme les sessions des autres (version de session commune) | Acceptable en démo. Sinon : version de session par appareil |
