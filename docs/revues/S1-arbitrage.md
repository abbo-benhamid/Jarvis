# S1 — Arbitrage de l'orchestrateur

> Sources : `S1-produit.md`, `S1-juridique.md`. Ces décisions alimentent le sprint **S1b « Prêt pour les testeurs »**. Ce sprint commence après la fusion des lots A, B et C.

## Décisions

| # | Sujet | Décision | Source |
|---|---|---|---|
| D1 | Démo opérateur public (T1, BLOQUANT) | Supprimer le bouton public « Opérateur ». Le mot de passe démo passe dans une variable d'environnement. Les comptes démo sont refusés si `DEMO_MODE=false` | Juridique |
| D2 | Comptes partagés | **Un bac à sable par testeur**, créé à la volée : une famille, un aîné, des accompagnants et un opérateur « robots ». Lien de reprise. Purge après 30 jours | Produit + Juridique |
| D3 | Accès | Accès sur **code d'invitation testeur**. Toutes les pages en `noindex` | Juridique |
| D4 | Documents (T2-T4, BLOQUANT) | Mentions légales, politique de confidentialité et **CGU de test**. Les champs d'identité de l'éditeur restent vides tant que le fondateur ne les a pas fournis | Juridique |
| D5 | Offre affichée | Une seule grille : **Lakou** (0 €), **Kozé** (39 €/mois, appel hebdomadaire et alertes ; « Veyé » est réservé à Veyé Siklòn), **Sérénité** (dès 149 €/mois). Mention « Offre en test, non commercialisée ». Le terme « vérifiés » est remplacé par « vérifications déclarées (test) » | Les deux |
| D6 | Subordination | Nouveau flux : **Koudmen propose 1 à 3 profils, la famille choisit, l'accompagnant accepte.** Un champ `employeur` est ajouté (l'aîné ou son représentant) | Juridique |
| D7 | Proche aidant APA | Il n'est proposé qu'à **sa propre famille** | Juridique |
| D8 | SAAD | Il s'affiche comme « Structure partenaire », pas comme une personne | Juridique |
| D9 | Formation Koudmen | **Obligatoire pour tous les statuts.** La sécurité des aînés passe avant la fluidité de l'inscription | Arbitrage (docs 01 et 08 se contredisent) |
| D10 | Tarif d'un salarié CESU | Le tarif reste libre, avec un **plancher** : le SMIC et le minimum de la convention IDCC 3239. Le formulaire bloque en dessous | Juridique |
| D11 | Auto-entrepreneur au niveau 1 | Le MVP a raison : l'auto-entrepreneur est **exclu**. `docs/08` est corrigé | Juridique |
| D12 | CESU | Koudmen fournit un **relevé d'heures**, la famille déclare elle-même. `docs/00` est corrigé | Juridique |
| D13 | Page d'accueil | Elle est refaite dans cet ordre : douleur → exemple de Kayé → 3 promesses → un seul bouton « Tester Koudmen » | Produit |
| D14 | « Simuler la suite » | Un bouton fait avancer le scénario : l'opérateur propose, puis l'accompagnant accepte, visite et publie un Kayé. Il y a 3 scénarios guidés | Produit |
| D15 | Mesure | Code testeur, événements d'usage, 4 micro-questions dans l'application, offre factice « visite découverte » **avec consentement explicite** au recueil du contact | Produit + Juridique |

## Reporté avant le pilote réel (NO-GO tant que ce n'est pas fait)

- Formule Sérénité réelle et ses conditions de remplacement.
- Consentement réel de l'aîné : procédure humaine et trace.
- Hébergement HDS et analyse d'impact (AIPD).
- Prix loyaux (art. L111-7 II du Code de la consommation).
- Rôle CESU validé par un rescrit.
- Avocat : 6 nouvelles questions (`S1-juridique.md`).

## Besoin du fondateur

Pour les mentions légales, il faut :
- le nom de l'éditeur, en personne physique ou en société ;
- une adresse ;
- un e-mail de contact ;
- le directeur de la publication.
