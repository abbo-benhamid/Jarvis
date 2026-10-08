# L1 — Arbitrage des revues (code, sécurité-RGPD, UX)

> Sources : `L1-code.md` (1 BLOQUANT, 7 MAJEUR), `L1-securite.md` (1 BLOQUANT, 7 MAJEUR), `L1-ux.md` (3 BLOQUANT, 14 MAJEUR).
> Règle : tous les BLOQUANT et MAJEUR sont corrigés dans le sprint **L1d**. Les MINEUR à moins de 30 min aussi. Le reste va dans `backlog-pilote.md`.

## Décisions de l'orchestrateur

| # | Sujet | Décision |
|---|---|---|
| D1 | Sécu S1 : `KOUDMEN_MODE=essai` en production | En production stricte, `essai` est un **problème bloquant** de config-check (page 503), pas un avertissement. Même règle pour `KOUDMEN_OPERATEUR_CONFIRME` et `DEMO_MODE=true` |
| D2 | Sécu M1 + 503 actuel : clés QR et adresse | Les clés sont exigées **seulement si** `realDataAllowed()` est vrai. Les clés de développement du dépôt sont refusées dès que `NODE_ENV=production` et que les données réelles sont ouvertes (Preview, Clever Cloud compris). Longueur et entropie minimales vérifiées |
| D3 | Sécu M2 : coordonnées du domicile en clair | Coordonnées précises chiffrées avec l'adresse. En clair : seulement le centre de la commune |
| D4 | Sécu M3 : rejeu du QR avec position fabriquée | Risque **accepté en préinscription** (aucune visite réelle). Avant `DONNEES_REELLES_AUTORISEES=true` : appel « tapez 1 » de l'aîné (Twilio) obligatoire pour `VALIDEE`. Ajouté au backlog pilote (P1 bis). En attendant, QR + position = « Présence probable », la famille peut contester 48 h |
| D5 | Code M4 / Sécu M4 : opérateur | Aucun e-mail ni lien de réinitialisation pour un compte opérateur. `resetPassword` refuse le rôle OPERATEUR. Limite par adresse sur tous les chemins |
| D6 | Sécu M5 : faux e-mails | Prénom filtré (lettres, espaces, tirets, apostrophes ; 40 caractères ; pas d'URL). Limite de 3 e-mails / 24 h par adresse visée, tous chemins confondus |
| D7 | Code M3 / Sécu M6 : position après expiration | Effacement paresseux à chaque lecture ou écriture de trajet + purge de nuit. Le texte de confidentialité dit la vérité : « effacée à l'arrivée, au plus tard la nuit suivante » |
| D8 | Sécu M7 / Code M2 : retrait ou refus de l'accord | Retrait → missions suspendues, carte QR révoquée, code de secours changé, trajets arrêtés, Kayé bloqués. Fiche sans accord après 30 jours, ou refusée : effacée |
| D9 | Code M1 : Kayé et visites de l'app | Toutes les routes de l'app qui touchent des données d'aîné passent par `realDataAllowed()` et l'accord. Un Kayé refusé n'est **pas** gardé en brouillon en préinscription |
| D10 | Code M5 : purge des comptes sans e-mail confirmé | Pas de purge des comptes non confirmés quand aucun service d'e-mail n'est configuré, ni pour un compte validé par l'opérateur |
| D11 | Code M6 / Sécu : personne désignée | Elle est choisie **par l'aîné** pendant l'appel d'accord ; l'opérateur l'enregistre. Défaut : l'employeur |
| D12 | Code M7 : reprise | La migration passe en `ACCORD_RECUEILLI` seulement les aînés avec `consentGiven = true` ; les autres en `EN_ATTENTE_ACCORD` (nouvelle migration, l'ancienne ne change pas) |
| D13 | Code BLOQUANT : contrats | Les contrats serveur font foi. L'app supprime `contrats-l1/` et utilise la copie synchronisée. CI verte obligatoire |
| D14 | UX B1, B2 | Fiche sans accord : « Accord de l'aîné : en attente de l'appel ». Formulaire d'accord : aucune réponse cochée par défaut, 3 réponses (oui / non / rappeler plus tard), personne désignée (D11) |
| D15 | UX B3 | L'accompagnante fait son orientation et sa demande de vérification **dans l'app** (écran simple) ; l'opérateur voit une file « Accompagnants à appeler » |
| D16 | UX majeurs | Tous corrigés : restes « simulé / testeurs / démonstration » cachés en lancement ; marques [À VÉRIFIER] jamais visibles du public (elles restent dans les commentaires du code) ; plus d'impasse « Ajouter un aîné » en préinscription ; téléphone obligatoire pour une demande de rappel, choix d'un créneau, rappel possible sans formule payante ; fautes ; carte en français, boutons ≥ 44 px, message si les tuiles ne chargent pas ; heures avec le fuseau (« 14 h 30, heure de Martinique » + heure locale du lecteur si différente) ; files du lancement sur le tableau de bord opérateur ; tableaux lisibles à 390 px ; texte « Koudmen ne vous suit pas » corrigé pendant un trajet |

## Répartition L1d

| Agent | Périmètre |
|---|---|
| F1 `dev-backend` | Serveur : D1-D12, D15 côté serveur, mineurs serveur (courses inscription/position, `confirmVisitAction`) |
| F2 `dev-frontend` (web) | Interface web : D14, D16, D15 côté opérateur |
| F3 `dev-frontend` (app) | `mobile/**` : D13, D15 côté app, textes UX app |
