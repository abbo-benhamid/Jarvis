# S1b — Arbitrage de l'orchestrateur (avant la mise en ligne testeurs)

> Sources : `S1b-code.md` (0 BLOQUANT, 6 MAJEUR), `S1b-securite.md` (3 BLOQUANT, 7 MAJEUR), `S1b-ux.md` (0 BLOQUANT, 17 MAJEUR).
> Ces décisions forment le sprint **S1c « Corrections avant mise en ligne »**.

## Règle

- Tous les points **BLOQUANT** et **MAJEUR** sont corrigés dans S1c.
- Les points **MINEUR** sont corrigés s'ils coûtent moins de 30 minutes. Sinon, ils vont au backlog (`docs/revues/backlog.md`).

## Décisions de produit (choix de l'orchestrateur)

| # | Sujet | Décision |
|---|---|---|
| A1 | Missions d'un accompagnant suspendu ou refusé | Ses missions passent en **SUSPENDUE**. Ses visites futures sont annulées. La famille reçoit une notification, et sa demande redevient OUVERTE avec un nouveau choix de profils. Ses propositions en cours (EN_ATTENTE et PROPOSEE_FAMILLE) sont annulées. `chooseProfile` vérifie que le profil est VALIDE |
| A2 | Nom de la formule gratuite | « Lakou » désigne seulement le cercle familial. La formule gratuite s'appelle **« Libre »**. La grille devient Libre 0 € / Kozé 39 € / Sérénité dès 149 € |
| A3 | Coût total | Chaque formule payante affiche un **exemple de coût mensuel total** : abonnement + heures, avec le crédit d'impôt appliqué aux heures. Par exemple : 4 visites de 2 h. Le prix apparaît aussi sur la page d'accueil |
| A4 | Revenu de l'accompagnant | Le profil et chaque proposition affichent un **revenu net estimé** selon le statut. Cette valeur est indicative [À VÉRIFIER] |
| A5 | Bouton « L'aîné a confirmé » côté famille | Il est **retiré de l'espace famille**. La confirmation reste dans l'espace opérateur et dans les robots du bac à sable (« Simuler l'appel de l'aîné »). La famille voit seulement le résultat |
| A6 | Proche aidant APA | Un écran permet de rattacher le proche aidant à son aîné : la famille l'invite depuis la fiche de l'aîné. Dans le bac à sable, le robot ne crée plus de demande orpheline |
| A7 | Micro-questions | Elles s'affichent **après** le contenu concerné : sous le Kayé, et après l'ouverture de l'explication de la preuve |
| A8 | Panneau du test | Il est repliable. Par défaut, il prend au plus une ligne et la prochaine étape. Le contenu (Kayé, aîné) passe en premier |
| A9 | Avis | Un écran de fin de scénario demande l'avis (note + 1 question ouverte). Le bouton flottant ne masque plus le contenu |
| A10 | Inscription libre | `/inscription` est **fermée** si `DEMO_MODE` n'est pas `true`. Les testeurs entrent par le bac à sable seulement |
| A11 | Jargon | Un glossaire court s'affiche au survol ou au toucher (« ? ») pour : cercle Lakou, Kayé, Kozé, preuve de visite, CESU, SAAD. Les autres sigles sont remplacés par des mots simples dans l'interface testeur |

## Sécurité : à corriger obligatoirement (B1-B3, M1-M7)

- **Codes testeurs :** aucun code dans le dépôt (`.env.example` et CI utilisent des valeurs factices évidentes, refusées en production). Codes longs et aléatoires. Limite d'essais par IP.
- **Secrets :** au démarrage en production, l'application refuse les valeurs d'exemple de `SESSION_SECRET` et `CRON_SECRET`, ainsi que les secrets trop courts.
- **Région :** `vercel.json` → `"regions": ["fra1"]`.
- **Limites de débit** (stockées en base, compatibles serverless) : connexion, code testeur, avis, événements, offre découverte.
- **Déconnexion :** révocation réelle de la session (version de session en base) et effacement du cookie de reprise.
- **Conservation des données :**
  - contacts « visite découverte » : 6 mois ;
  - avis et événements : jusqu'à la fin du test + 6 mois ;
  - retrait du consentement possible par un lien.
- **Date de fin du test :** variable `TEST_END_DATE`, affichée dans les CGU et la page de confidentialité.
- **Mentions légales :** ajouter Neon comme sous-traitant (adresse). Déclarer la collecte de l'user-agent.

## Fournis par le fondateur (non bloquants pour le code)

Identité de l'éditeur, adresse, e-mail de contact, directeur de la publication, date de fin du test.
