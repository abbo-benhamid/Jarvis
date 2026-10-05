# Backlog « avant pilote » (après V1c, volet plateforme)

> Sources : `V1-code.md`, `V1-securite.md`, `V1-ux.md`, arbitrage `V1-arbitrage.md` (X1 à X9).
> Règle de l'arbitrage : les points « avant pilote » faciles sont faits dans V1c ; les autres sont ici.
> Volet PLATEFORME (serveur + web). Le volet APP (mobile/) a son propre agent et son propre suivi.

## Fait dans V1c (plateforme) — pour mémoire

| Point | État |
|---|---|
| Code M1 (réservation `AppEvent` orpheline > 60 s reprise), M2 (push après la réponse, route `/api/cron/push`), M6 (job CI « App mobile »), M8 + X9 (purges nocturnes), M9 (Kayé refusé gardé en brouillon serveur) | Fait |
| X1 (grâce 30 s à la rotation), X2 (titres génériques, journal sans prénom, `expo` refusé sans `PUSH_DPO_VALIDE=true`), X6 (démo : « partout » refusé, SOS 3/h/compte, SOS démo jamais envoyés) | Fait |
| PM1 (`TRUST_PROXY`), PM2 (jeton push d'un autre compte connecté → 409), PM3 côté config (`EXPO_ACCESS_TOKEN` exigé avec `expo` en production), PM4 (purges) | Fait |
| Mineurs code m1 (ENVOYE après succès, 3 essais), m2 (route cron), m3 (horloge suspecte : seulement les preuves acceptées), m9 (accepter idempotent), m11, m12 (index Outbox) | Fait |
| Mineurs sécurité m1 (`visitId` d'autrui non gardé), m3 (retrait d'appareil journalisé), m9 (`lastLoginAt` à l'échange du code) | Fait |
| UX web M1, M2/X8, X3 (code + QR SVG), X4 (web), M7, M9, X7 (`/confidentialite`) | Fait |

## À faire avant le pilote

| # | Origine | Gravité | Sujet | Proposition |
|---|---|---|---|---|
| P1 | Sécurité PB2, arbitrage X3 | BLOQUANT pilote | Preuve de présence déclarative : position et heure envoyées par le client, code du domicile fixe | QR signé et tournant (`koudmen:domicile:s1:…`, format déjà lu par l'app), écart `recuA − survenuA` > 30 min sur un `CHECK_IN` → « À vérifier », refus des positions simulées. Confirmation de l'aîné obligatoire tant que ce n'est pas livré |
| P2 | Sécurité PB1 | BLOQUANT pilote | Passage du push en `expo` | DPA Expo signé, transfert déclaré (DPF ou clauses types), Expo au registre. Puis `PUSH_DPO_VALIDE=true` et `EXPO_ACCESS_TOKEN` (sécurité renforcée Expo) |
| P3 | Sécurité PM2 | MAJEUR | Preuve « même appareil » pour réattribuer un jeton push | Identifiant d'installation gardé en SecureStore, envoyé à `POST /appareils` (champ facultatif du contrat), réattribution permise seulement s'il est identique. Aujourd'hui : 409 tant que l'autre compte est connecté |
| P4 | Sécurité PM1 | MAJEUR | `TRUST_PROXY=clevercloud` : dernière valeur de `X-Forwarded-For` | [À VÉRIFIER] avec la documentation Clever Cloud ; ajouter des limites PAR COMPTE sur `/evenements`, `/appareils`, `/auth/refresh` |
| P5 | Sécurité PM5 | MAJEUR | Rejeu détecté : base locale de l'app gardée | Côté app (agent mobile) : purge du cache et de la file sur `JETON_REUTILISE` / `ACCES_REFUSE` |
| P6 | Code m5 | MINEUR | Erreur après une action validée → le renvoi répond `CONFLIT` | Enregistrer le résultat d'`AppEvent` dans la transaction de l'action, ou `ACCEPTE` sur « déjà fait » du même auteur et même contenu |
| P7 | Code m4 | MINEUR | Brouillon le plus récent choisi avec l'heure brute de l'appareil | Borner `occurredAt` (`effectiveEventTime`) ou départager avec `receivedAt` |
| P8 | Code m13 | MINEUR | Check-in reçu en retard décidé par l'heure de l'appareil (12 h) | Lié à P1 : « À vérifier » si l'écart dépasse la durée de la visite [À VÉRIFIER] produit |
| P9 | Code M2 | MINEUR | Fréquence de `/api/cron/push` | [À VÉRIFIER] offre Vercel (cron horaire ou plus) ; aujourd'hui `after()` + purge nocturne |
| P10 | Sécurité m7 | MINEUR | Pas de durée absolue de connexion de l'app | 90 jours, puis mot de passe |
| P11 | Sécurité m6 | MINEUR | `consignes` (texte libre famille) dans le cache de l'app | Aide à la saisie côté famille (« pas d'information médicale ») |
| P12 | UX m1 à m16 (web) | MINEUR | Finitions : sélecteur de thème doublé, cibles < 44 px, textes < 16 px, « robot (bac à sable) », message doublé sur l'accueil famille, poids des polices | Voir `V1-ux.md` § 3 ; à traiter avec `backlog-ux.md` |
| P13 | UX M2 (point 3) | MINEUR | Invite « Scénario terminé » et questions rapides au milieu du contenu | Les déplacer dans « Détails » ou en fin de page |
| P14 | X3 | MINEUR | Code de démo commun web + app | Seed web : Léonie = `LKW7Q3`. L'app (mode simulé) utilise `KDM482` : à aligner côté mobile |
| P15 | Juridique | [À VÉRIFIER] | Phrase « employeur » de la page Demandes, mentions Expo de `/confidentialite` | Relecture avocat / DPO |
