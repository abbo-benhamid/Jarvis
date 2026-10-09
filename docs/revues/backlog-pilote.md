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

## Ajouts L1 (arbitrage `L1-arbitrage-revues.md`)

| # | Origine | Gravité | Sujet | Proposition |
|---|---|---|---|---|
| P1 bis | Sécu L1 M3 | BLOQUANT données réelles | QR rejouable avec une position fabriquée | Appel « tapez 1 » de l'aîné (Twilio) obligatoire pour `VALIDEE` |
| P16 | Sécu L1 mineurs | MINEUR | `/api/sante` trop bavard, jetons d'e-mail dans l'URL, preuve serveur de l'accord trajet, rayon de départ fixe, tuiles appelées depuis le navigateur, rotation des clés | Voir `L1-securite.md` |
| P17 | Juridique L1 | [À VÉRIFIER AVEC UN AVOCAT] | CGU, confidentialité, conditions accompagnants, mention crédit d'impôt | Relecture avocat |

## Ajouts L2 (revue `L2-securite.md`, sprint L2b)

Corrigés dans L2b : B1, M1 à M7, m1, m2, m4, m6, m10, m11, m12 (voir `docs/tech/L2b-notes.md`). Reste :

| # | Origine | Gravité | Sujet | Proposition |
|---|---|---|---|---|
| P18 | Sécu L2 m3 | MINEUR (avant données réelles) | PDF non aplati (JavaScript, pièces jointes, métadonnées) ; pas d'antivirus ; JPEG mal formé gardé tel quel ; CSP de l'aperçu PDF sans `sandbox` | Refuser un PDF avec `/JS`, `/JavaScript`, `/EmbeddedFile`, `/Launch` ; refuser un JPEG non analysable ; ClamAV ; `sandbox` dans la CSP |
| P19 | Sécu L2 m4 (reste) | MINEUR | Aperçu d'un document en GET (lien piégé = fausse ligne d'accès) ; 2FA opérateur absente | Aperçu en POST avec jeton anti-CSRF ou page intermédiaire ; TOTP opérateur |
| P20 | Sécu L2 m5 | MINEUR | Une ligne `AuditLog` par webhook non signé (journal inondable) | Compteur agrégé par minute |
| P21 | Sécu L2 m7 | MINEUR | Clé maîtresse des documents sans identifiant de version ; adresse de l'accompagnant chiffrée avec `DOCUMENT_ENC_KEY` | Format `k<version>:<idClé>:…`, liste de clés actives ; clé dédiée à l'adresse |
| P22 | Sécu L2 m8 | MINEUR | `User.phone` et `PhoneChallenge.phoneE164` en clair (étude § 7.1 : `phoneEnc`) | Chiffrer, ou corriger l'étude et l'AIPD |
| P23 | Sécu L2 m9 | MINEUR | Stripe : pas d'empreinte de pièce (pas de détection de compte en double) | Avec Stripe : élément `A_REVOIR` (décision humaine) |
| P24 | Sécu L2 m13 | MINEUR | Dépôt API : corps lu en entier sans `content-length` | Lecture du flux avec un compteur, coupure à 5 Mo + marge |
| P25 | L2b (M1) | MINEUR | Éléments hors L2 (casier B3, références…) : refus proposé par la fiche accompagnant, mais pas d'écran pour ANNULER ce refus proposé | Ajouter l'annulation à deux opérateurs sur la fiche |
| P26 | L2b (M3) | [À VÉRIFIER] | Veriff : en-tête d'horodatage signé dans l'API récente ? | Si oui : l'exiger (fenêtre de 5 minutes), comme Stripe |
| P27 | L2b (M5) | MINEUR | Fermeture du dossier `DOSSIER_INCOMPLET_90J` (étude § 6.6) : l'élément revient « à faire », le dossier n'est pas fermé | Fermeture à deux opérateurs ou fermeture sans refus, avec e-mail |
| P28 | L2b (M6) | MINEUR | Rotation de la clé HMAC : la recherche « une pièce = un compte » utilise l'empreinte calculée par l'adaptateur (clé courante seulement) | Adaptateur : renvoyer les empreintes de toutes les clés actives pendant la rotation |
| P29 | Sécu L2 M4 / RGPD | [À VÉRIFIER DPO] | Retrait du consentement biométrique : suppression anticipée chez le prestataire sur demande | Bouton « retirer mon accord » → ligne `ProviderRedaction` immédiate |
| P30 | Sécu L2 M1 point 3 | [À VÉRIFIER fondateur] | Élément passé par `A_REVOIR` avec un code de risque (`RISQUE`, `COMPTE_EN_DOUBLE`, `MINEUR`) : `VALIDE` à deux opérateurs ? | Décision produit |

## Ajouts T1

| # | Origine | Gravité | Sujet | Proposition |
|---|---|---|---|---|
| P31 | Vérification orchestrateur (T1) | MINEUR | Avec `KOUDMEN_DB_TESTS=1`, la suite complète sur UNE base échoue sur 2 tests (L2b M4, push m1) : ils comptent des lignes globales créées par d'autres fichiers en parallèle. Seuls, ils passent | Filtrer ces comptes par les identifiants du test, ou lancer les tests base avec `--no-file-parallelism` |
