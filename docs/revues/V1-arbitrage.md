# V1 — Arbitrage de l'orchestrateur (sprint V1c « corrections avant mise en ligne »)

> Sources : `V1-code.md` (0 BLOQUANT, 9 MAJEUR), `V1-securite.md` (démo : 0 BLOQUANT, 3 MAJEUR ; pilote : 2 BLOQUANT, 5 MAJEUR), `V1-ux.md` (0 BLOQUANT, 9 MAJEUR).

## Règle
- Tous les MAJEUR « code », « UX » et « avant démo » sont corrigés dans V1c.
- Les points « avant pilote » faciles sont corrigés maintenant. Les autres vont dans `docs/revues/backlog-pilote.md`.

## Décisions
| # | Sujet | Décision |
|---|---|---|
| X1 | Rotation des jetons sans délai de grâce (code M7) | **Délai de grâce de 30 s** : un jeton de rafraîchissement réutilisé dans les 30 s par le même appareil renvoie la même nouvelle paire. Au-delà, rejeu = révocation de la famille de jetons |
| X2 | Titre des push (sécurité PB1) | **Titre générique dès maintenant**, sans prénom ni « à surveiller » : « Koudmen · Nouvelles de votre proche », « Koudmen · Nouvelle proposition ». Le journal console ne contient plus de prénom. L'adaptateur `expo` reste bloqué en production tant que le DPO n'a pas validé |
| X3 | Code du domicile (UX M6) | **Un seul code par domicile**, affiché en clair ET en QR sur la même feuille. L'app propose « Scanner » ou « Saisir », les deux pour le même code. Les données de démo web et app utilisent le même code. Le QR signé et tournant (sécurité PB2) va au backlog pilote |
| X4 | Mots des preuves (UX M4) | Un seul vocabulaire partout : « Position à l'arrivée », « Code du domicile », « Confirmation de l'aîné ». Un seul compteur : « 2 preuves sur 3 ». Même échelle d'humeur web/app (de « Très bien » à « Pas bien »), même libellé d'envoi « Envoyer le Kayé » |
| X5 | Déconnexion avec envois en attente (code M5) | Avertir : « 2 envois ne sont pas partis. Les envoyer d'abord / Se déconnecter quand même ». Pas d'effacement silencieux |
| X6 | Démo partagée (sécurité D1, D2) | Comptes démo : « déconnexion partout » refusée ; SOS limités à 3 par heure et par compte ; SOS d'un compte démo jamais envoyés aux opérateurs réels (journal de démo) |
| X7 | Mentions dans l'app (sécurité D3) | Écran « À propos et confidentialité » dans l'app (Profil) ; `/confidentialite` complétée (app, push, Expo, stockage chiffré) |
| X8 | Mode test (UX M2) | Sur les écrans de travail (fiche visite, Kayé), le panneau du test se réduit à une pastille ; une seule mention « Mode test » par écran |
| X9 | Purges (code M8, sécurité PM4) | Brancher sur la purge nocturne : jetons expirés, `AppEvent` > 30 j, `KayeDraft` > 7 j ou publié, appareils push révoqués |
