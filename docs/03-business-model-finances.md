# 03 — Modèle économique & finances

> **Rôle** : CFO / stratège marketplaces. **Date** : octobre 2026.
> **Périmètre** : plateforme de mise en relation familles ↔ « accompagnants de vie » indépendants (présence, courses, aide administrative légère, accompagnement aux rendez-vous, organisation du quotidien). Pilote Outre-mer. **Mise à jour T1 (2026-10-09) : Guadeloupe d'abord, puis Martinique, Guyane et Hexagone.** Les scénarios du §5 ont été calculés avec La Réunion en premier territoire : relis-les avec la note du §5.1.
> **Convention** : 🔎 = fait sourcé (URL en fin de section ou en ligne) ; 🧮 = hypothèse de modélisation ; ⚠️ = incertitude ou point à faire valider par un juriste ou un expert-comptable.

---

## 0. Synthèse exécutive : ce qu'il faut retenir

1. **Le modèle initial a deux failles structurelles.**
   - **Faille fiscale.** Le cœur de l'offre (« compagnie », aide personnelle, accompagnement hors domicile de personnes âgées ou handicapées) relève des activités SAP qui, pour ce public, exigent une **autorisation** (mode prestataire, délivrée par le département) ou un **agrément** (mode mandataire, délivré par la préfecture/DREETS) (article D7231-1 du Code du travail). Un micro-entrepreneur sans autorisation ne peut pas ouvrir le **crédit d'impôt de 50 %** pour ces activités. À l'inverse, une famille qui **emploie directement** la même personne en CESU y a droit. Résultat : sur le cœur de métier, **le rail « micro-entrepreneur » coûte jusqu'à deux fois plus cher à la famille que l'emploi direct**. C'est le premier moteur de désintermédiation, avant même la commission.
   - **Faille juridique.** Prélever 12 à 20 % ou un abonnement sur les accompagnants, c'est faire payer des travailleurs précaires pour accéder au travail. Cela fait fuir l'offre et alimente le risque de requalification. La directive européenne 2024/2831 sur le travail de plateforme, à transposer avant le **2 décembre 2026**, instaure une présomption de salariat.
2. **Modèle recommandé : « Plateforme à double rail, payée par la demande ».**
   - **Rail A.** Micro-entrepreneurs déclarés SAP (NOVA) pour les activités relevant de la simple déclaration : courses, aide administrative, préparation de repas, entretien, assistance informatique. Avance immédiate du crédit d'impôt.
   - **Rail B.** Emploi direct outillé (CESU+), puis mandataire agréé dès le 9e à 12e mois, pour la compagnie et l'aide aux personnes âgées ou handicapées. Crédit d'impôt garanti.
   - **Accompagnant : 0 € de commission, 0 € d'abonnement.** Les revenus viennent des familles (abonnement + frais de service dégressifs), de la diaspora (« Veille sur mes parents »), du B2B2C (caisses de retraite, mutuelles, assisteurs, employeurs d'aidants), du B2G (CFPPA, départements, ARS) et de services complémentaires (téléassistance, adaptation du logement).
3. **Unit economics (scénario central)** : 46 € HT de revenu par famille locale et par mois (take rate effectif d'environ 15 %), marge contributive de 18 à 28 €, churn de 6 % par mois, LTV contributive de 305 à 465 €, CAC mixte de 110 €, payback de 4 à 6 mois.
4. **P&L 36 mois (central)** : CA de 95 k€, puis 457 k€, puis 1,05 M€. GMV de 4,6 M€ en année 3. **Point mort mensuel vers le 34e mois.** Besoin de financement cumulé d'environ **370 k€**, soit **environ 460 k€ avec la marge de sécurité**, à couvrir pour moitié en non dilutif.
5. **Moat à 5 ans** : ce n'est pas l'application. C'est la combinaison de rails réglementaires (agrément, avance immédiate, référencements institutionnels), d'un réseau d'accompagnants fidélisé par des avantages que seule la plateforme finance, d'un carnet de liaison qui devient le « système d'exploitation du domicile » partagé par la famille, la diaspora et les soignants, et d'un ancrage créole et insulaire difficile à copier depuis Paris.

---

## 1. La désintermédiation : le problème n°1, analysé à fond

### 1.1 Pourquoi c'est pire ici que chez Uber ou Malt

| Facteur | Uber (VTC) | Malt (freelance) | Notre cas (accompagnement à domicile) |
|---|---|---|---|
| Récurrence avec la **même** personne | Faible | Moyenne | **Très forte** : la famille veut *la même* personne chaque semaine |
| Relation de confiance interpersonnelle | Nulle | Moyenne | **Maximale** (intimité, domicile, personne vulnérable) |
| Coût de recherche d'un remplaçant | Nul | Moyen | Élevé (confiance, habitudes, langue créole) |
| Échange de numéros | Inutile | Fréquent | **Inévitable dès la 1re mission** |
| Montant économisé en contournant | Faible | 5 à 10 % | Fort si le rail fiscal est défavorable (voir 1.2) |
| Densité locale (île, bouche-à-oreille) | — | — | Très forte : « tout le monde se connaît », ce qui facilite le contournement |

🔎 Malt applique une commission dégressive : 10 % au départ, 5 % au-delà de 6 mois de relation, 2 % si le freelance amène son propre client. Le marché a donc déjà intégré que **la valeur de l'intermédiation décroît avec la durée de la relation**. [help.malt.com](https://help.malt.com/hc/en-150/articles/29539691425938-How-does-the-Malt-commission-work-for-freelancers)

### 1.2 L'arithmétique de la fuite : le vrai concurrent, c'est le CESU

Prenons une famille réunionnaise avec **20 h par mois** de présence pour sa mère de 82 ans.

| Option | Coût brut / mois | Crédit d'impôt 50 % | **Reste à charge / h** | Charge mentale pour la famille |
|---|---|---|---|---|
| (a) Plateforme, accompagnant micro **non autorisé** pour une activité « compagnie / aide personnelle » | ~503 € TTC | ❌ (activité non éligible sans autorisation ⚠️) | **~25,1 €** | Faible |
| (b) Plateforme, Rail A, activité **déclarative** (courses, aide administrative, repas) | ~503 € TTC | ✅ via avance immédiate | **~12,6 €** | Faible |
| (c) **Emploi direct CESU**, hors plateforme, même personne payée 16 € net de l'heure congés payés compris | ~460 € 🧮 | ✅ | **~11,5 €** | **Forte** : la famille devient employeur (arrêts maladie, remplacement, fin de contrat) |
| (d) Plateforme, Rail B (emploi direct outillé ou mandataire) | ~530 € 🧮 | ✅ | **~13,2 €** | Faible |

🧮 Hypothèses : tarif de l'accompagnant 22 €/h. En (a) et (b), abonnement « Sérénité » à 19,90 € plus 9 % de frais de service. En (c), coût employeur d'environ 23 €/h après l'exonération partielle de cotisations patronales pour les employeurs de 70 ans et plus ⚠️ (montant à valider avec un expert-comptable). En (d), on ajoute 2,50 €/h de frais de gestion.

**Conclusions :**
- Si on reste sur l'option (a), **on perd la famille au deuxième mois** : elle divise sa facture par deux en passant au CESU. **C'est la faille majeure du modèle initial.**
- En (b) et (d), l'écart avec le CESU direct n'est plus que de **1 à 2 €/h, soit 20 à 35 € par mois**. La plateforme doit donc apporter, de façon visible, **plus de 35 € par mois de valeur perçue** que le CESU seul. C'est l'objectif chiffré de tous les mécanismes ci-dessous.
- Côté accompagnant, l'emploi direct n'est pas forcément plus attractif. En CESU, il perçoit environ 16 € net avec protection chômage, mais devient dépendant d'un seul employeur âgé (décès, entrée en EHPAD). La plateforme lui apporte un **flux de familles et le paiement garanti**. **La fuite se décide surtout côté famille.**

🔎 Le crédit d'impôt couvre 50 % des dépenses dans la limite de 12 000 € par an (majorations possibles jusqu'à 15 000 €). L'avance immédiate est ouverte depuis le 14 juin 2022 aux particuliers qui passent par des organismes SAP : prestataires, mandataires et plateformes de mise en relation. [lafinancepourtous.com](https://www.lafinancepourtous.com/2022/06/15/services-a-la-personne-via-un-intermediaire-extension-du-credit-dimpot-instantane/) · [legifiscal.fr](https://www.legifiscal.fr/impots-taxes-entreprise/credits-reductions-impot/avance-immediate-credit-impot-service-personne.html)

🔎 Activités soumises à agrément ou autorisation : notamment l'assistance aux personnes âgées ou handicapées, la conduite de leur véhicule personnel et leur accompagnement hors du domicile. En mode mandataire auprès de publics fragiles, l'agrément est délivré par le préfet. [code.travail.gouv.fr — D7231-1](https://code.travail.gouv.fr/code-du-travail/d7231-1) · [creerentreprise.fr](https://www.creerentreprise.fr/creer-activite-services-a-la-personne-statut/)

🔎 La **loi de finances 2026** précise que les services rendus **hors du domicile**, pour être éligibles au crédit d'impôt, ne doivent pas dépasser **50 % du prix** facturé par un même prestataire. Les accompagnements aux rendez-vous doivent donc être **regroupés avec des heures au domicile**. C'est une contrainte de conception du produit. [fiscaloo.fr](https://www.fiscaloo.fr/12154-credit-dimpot-service-a-la-personne/) · [senat.fr amendement I-1844](https://www.senat.fr/enseance/2025-2026/138/Amdt_I-1844.html)

⚠️ Pour la **diaspora** : le crédit d'impôt revient normalement au foyer fiscal qui bénéficie du service, ici le parent. Les dépenses engagées au domicile d'un ascendant **bénéficiaire de l'APA** peuvent, sous conditions, être déduites par le descendant (article 199 sexdecies du CGI). À faire valider. Les retraités non imposables touchent aussi le crédit, puisqu'il est remboursable.

### 1.3 Quinze mécanismes de rétention de valeur, chiffrés et classés

**Principe directeur : on ne retient pas avec des clauses, on retient avec un coût de sortie fait de valeur perdue.** Chaque mécanisme est évalué selon sa valeur perçue par la famille ou l'accompagnant et son coût pour la plateforme.

| # | Mécanisme | Pour qui | Valeur perçue / mois 🧮 | Coût plateforme / famille / mois 🧮 | Priorité |
|---|---|---|---|---|---|
| 1 | **Avance immédiate du crédit d'impôt** et facturation automatique : la famille ne paie que 50 %, sans avance de trésorerie ni paperasse | Famille | 30 à 60 € (trésorerie + temps) | ~0,5 € (API URSSAF) | 🔴 MVP |
| 2 | **« Zéro statut d'employeur »** (Rail A) ou employeur sans charge mentale (Rail B : contrats, déclarations, fin de contrat gérés) | Famille | Élevée (peur de l'URSSAF, des prud'hommes, des arrêts) | Inclus | 🔴 |
| 3 | **Remplacement garanti sous 24 à 48 h** (maladie, congés de l'accompagnant) avec un remplaçant déjà présenté (« binôme de secours ») | Famille | **La valeur n°1** pour une personne dépendante | 1 à 2 € (prime de 3 €/h au remplaçant) | 🔴 |
| 4 | **Rapports de visite** (photo, note vocale en créole ou en français, humeur, alimentation, signaux faibles) envoyés à toute la famille, y compris dans l'Hexagone | Famille, diaspora | 20 à 40 € (tranquillité) | ~0,3 € | 🔴 |
| 5 | **Assurance incluse** : RC pro de l'accompagnant, dommages au domicile, accident de trajet | Les deux | 10 à 15 € | ~1 € (contrat groupe) | 🔴 |
| 6 | **Paiement garanti à J+2** pour l'accompagnant, qui n'a plus à relancer, même quand la famille paie en retard | Accompagnant | Fort (trésorerie) | Risque d'impayé ~0,5 % du GMV | 🔴 |
| 7 | **Frais de service dégressifs selon l'ancienneté** (9 %, puis 6 % après 6 mois, puis 4 % après 12 mois) : l'incitation à partir baisse au moment où le risque monte | Famille | 10 à 20 € économisés | Baisse de marge assumée | 🟠 M6 |
| 8 | **Programme « Socle » pour l'accompagnant** : prévoyance et indemnités journalières négociées et cofinancées, prime de fidélité de 2 % des heures annuelles versée en décembre, formation certifiante gratuite. **Tout est perdu s'il sort de la plateforme** | Accompagnant | 40 à 80 € | 2 à 4 % du GMV de l'accompagnant | 🟠 M6 |
| 9 | **Carnet de liaison partagé** (famille, accompagnant, infirmier, médecin traitant, CCAS), historique, agenda des rendez-vous | Écosystème | Fort (coûts de changement) | Tech | 🟠 |
| 10 | **Coordinateur de vie nommé**, humain et créolophone, avec un point mensuel | Famille | Fort (confiance) | ~10 à 19 € (gros poste) | 🔴 |
| 11 | **Mode « Passerelle »** : la famille veut employer directement ? Elle paie un forfait transparent de 290 € et la plateforme met en place le CESU, puis propose un « abonnement outil » à 9,90 €/mois (rapports, remplacement payant). **La fuite devient un revenu** | Famille | — | — | 🟠 |
| 12 | **Pack Aidant** : répit de l'aidant principal, bilan des droits (APA, PCH, aides des caisses de retraite, MaPrimeAdapt'), montage des dossiers | Famille | 50 à 300 € (aides débloquées) | 15 à 30 min de coordinateur | 🟠 |
| 13 | **Facturation centralisée multi-intervenants** (ménage, accompagnement, téléassistance) sur une seule facture et une seule attestation fiscale | Famille | Moyen | Faible | 🟢 Y2 |
| 14 | **Contrats B2B2C** : l'heure est financée par la caisse de retraite, la mutuelle ou l'employeur. **La famille ne peut pas contourner une heure qu'elle ne paie pas** | Famille | Très fort | Commercial | 🔴 |
| 15 | **Détection de signaux faibles** (perte d'appétit, chutes, isolement) avec une alerte au proche, puis une orientation vers la téléassistance ou le médecin | Diaspora | Fort | Tech (règles simples, puis modèle) | 🟢 Y2 |

**Ce que nous déconseillons** :
- Une clause de non-sollicitation avec pénalité imposée à un consommateur : risque de clause abusive, très mauvaise image et pas exécutable en pratique.
- Masquer les coordonnées : naïf, la relation est physique.
- Un abonnement payé par l'accompagnant : risque juridique et fuite de l'offre, voir 2.3.

🧮 **KPI de pilotage de la fuite** :
- « Taux de silence » : famille active avec 0 heure facturée pendant 30 jours **mais** un accompagnant toujours actif dans la même commune.
- Heures moyennes par famille au 6e mois rapportées au 2e mois.
- Taux d'adoption du mode Passerelle.
- Cible : moins de 15 % de fuite à 12 mois.

---

## 2. Comparaison des modèles de revenus

### 2.1 Tableau comparatif chiffré (régime de croisière, année 3, scénario central)

| # | Modèle | Mécanique | Potentiel annuel A3 🧮 | Marge brute | Risque juridique ou éthique | Effet sur la désintermédiation | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Commission sur l'accompagnant** (12 à 20 %) | Prélevée sur ses honoraires | ~470 k€ | Élevée | 🔴 Fort : présomption de salariat, image « Uber du grand âge » | 🔴 Pousse l'accompagnant à fuir | ❌ À abandonner |
| 2 | **Frais de service famille** (dégressifs de 9 à 4 %, 18 % sans abonnement) | Ajoutés à la facture, éligibles au crédit d'impôt si l'organisme est déclaré ⚠️ | ~250 k€ | Élevée | 🟢 | 🟠 Neutre si dégressifs | ✅ Socle |
| 3 | **Abonnement famille** « Sérénité » (19,90 à 39 €/mois) | Valeur continue : remplacement, rapports, coordinateur | ~220 k€ | Élevée | 🟢 | 🟢 Fidélise | ✅ Socle |
| 4 | **Abonnement accompagnant** (29 à 49 €/mois) | Payer pour accéder aux missions | ~100 k€ | Élevée | 🔴 Faire payer l'accès au travail ; sensible en cas de requalification (art. L5321-3 du Code du travail, aucune rétribution exigible des personnes cherchant un emploi pour un service de placement ⚠️) | 🔴 | ❌ Remplacé par un pack Pro **optionnel** et des commissions d'assureurs |
| 5 | **Diaspora « Veille sur mes parents »** (39 à 89 €/mois) | Payé depuis l'Hexagone | ~100 k€ (central) à 300 k€ (ambitieux) | Très élevée | 🟢 | 🟢 Le payeur est loin et ne peut pas « s'arranger » | ✅ **Différenciateur** |
| 6 | **B2B2C** : caisses de retraite complémentaire, mutuelles, assisteurs, employeurs d'aidants | Heures préfinancées et forfait par bénéficiaire | ~240 k€ | Moyenne (5 à 7 €/h) | 🟢 Exige de la qualité (référencement) | 🟢🟢 Payeur institutionnel | ✅ **Moteur** |
| 7 | **B2G** : CFPPA, départements, CCAS, ARS (répit, lutte contre l'isolement) | Marchés, appels à projets, conventions | ~200 k€ | Moyenne | 🟢 Dépendance politique et budgétaire | 🟢 | ✅ Accélérateur, à plafonner à 25 % du CA |
| 8 | **Places de marché complémentaires** : téléassistance, adaptation du logement (MaPrimeAdapt'), portage de repas | Commission ou apport d'affaires | ~36 k€ (A3), plus ensuite | Très élevée | 🟠 Neutralité du conseil (orienter vers le meilleur, pas vers le plus rémunérateur) | 🟢 Plus de services, plus d'ancrage | ✅ À partir du M10 |
| 9 | **SaaS pour SAAD** existants | Licence de carnet de liaison et rapports de visite (5 à 10 €/bénéficiaire/mois) | Faible en DROM | Élevée | 🟢 | — | 🟡 Option en A3, en marque blanche ; conflit avec notre propre activité |
| 10 | **Formation certifiante payante** | Parcours accompagnant, préparation au titre ADVF | 20 à 50 k€ | Moyenne | 🟠 Qualiopi requis pour le CPF ; **ne pas en faire une barrière payante à l'entrée** | 🟢 Fidélise l'offre | 🟡 Gratuite pour nos accompagnants (financée FSE+ ou OPCO), payante pour les tiers |
| 11 | **Données agrégées anonymisées** | Observatoire de l'isolement et de la fragilité | <20 k€ | — | 🔴 Données de santé (hébergement HDS, RGPD), confiance | 🔴 Si cela se sait | 🟡 **Jamais vendues** : publiées en bien commun, financées par subvention ou CIS |

### 2.2 Benchmarks utiles

- 🔎 Marché français des SAP : **22,8 Md€ de CA en 2024**, **82 776 organismes** au 1er janvier 2025. [observatoiredelafranchise.fr](https://www.observatoiredelafranchise.fr/indiscretions-actualite/PETITS-FILS-les-chiffres-cles-de-laide-a-domicile-un-secteur-en-pleine-expansion-84540.htm)
- 🔎 **Tarif socle national APA/PCH : 24,58 €/h** (2025), à comparer avec un **coût de revient d'environ 32 €/h** estimé par les opérateurs. Les SAAD perdent de l'argent sur l'APA, d'où une opportunité sur le « hors plan d'aide ». [lemediasocial.fr / Fedesap](https://lemediasocial.fr/hulkStatic/EL/ELI/2025/01/f58369fff-0e99-4db6-92e1-9cbb4574212c/sharp_/ANX/fedesap-augmentation-apa-sad.pdf)
- 🔎 Agirc-Arrco : **aide à domicile momentanée** (jusqu'à 10 h sur 6 semaines, gratuite, mise en place en 48 h) et **Sortir Plus** (accompagnement aux sorties et rendez-vous). C'est exactement notre cœur de métier : **il faut viser le référencement**. [pour-les-personnes-agees.gouv.fr](https://www.pour-les-personnes-agees.gouv.fr/vivre-a-domicile/aides-financieres/laide-a-domicile-momentanee-pour-les-retraites-agirc-arrco)
- 🔎 Offres pour salariés aidants : **Ma Bonne Fée** à partir de **3 500 €/an** par entreprise ; **Responsage** avec plus de 70 entreprises clientes et 150 000 ayants droit. Ces acteurs font du conseil, **pas d'exécution terrain en DROM**. Nous pouvons être leur bras opérationnel ultramarin. [pwnparis.springly.org](https://pwnparis.springly.org/articles/99812-delphine-cochet-fondatrice-de-ma-bonne-fee) · [bnpparibas](https://personal-finance.bnpparibas/fr/presse/tilia-responsage)
- 🔎 Téléassistance : **24,90 à 31,90 €/mois** chez Présence Verte (tarifs 2026). [generations-mouvement.org](https://charente.generations-mouvement.org/wp-content/uploads/2025/11/Presence-verte-accord-2026.pdf)
- 🔎 Concurrents SAAD « tech » : Ouihelp (3 M€ levés auprès de XAnge, plus de 2 500 auxiliaires, salaire horaire affiché de 13,90 € brut) ; Petits-fils (réseau de franchises, 15,33 à 18,40 € brut de l'heure). [frenchweb.fr](https://www.frenchweb.fr/ouihelp-leve-3-millions-deuros-pour-ameliorer-laide-a-domicile-aux-personnes-agees/313984)

### 2.3 Le point juridique qui conditionne tout le modèle

- 🔎 La **directive (UE) 2024/2831** (travail de plateforme), à transposer avant le **2 décembre 2026**, crée une **présomption de salariat** lorsque des indices de contrôle existent. [assemblee-nationale.fr](https://www.assemblee-nationale.fr/dyn/17/textes/l17b3187_proposition-resolution.pdf) · [QE n° 14781](https://questions.assemblee-nationale.fr/q17/17-14781QE.htm)
- **Conséquences pour la conception** :
  - L'accompagnant **fixe son prix** (dans une fourchette indicative), **choisit** ses missions et peut refuser sans sanction algorithmique.
  - Aucune exclusivité.
  - La plateforme **ne facture rien à l'accompagnant**.
  - Les avantages du programme « Socle » sont rattachés au volume d'activité et non à l'obéissance. Ils relèvent de la responsabilité sociale des plateformes (articles L7342-1 et suivants du Code du travail).
- ⚠️ Le détail réglementaire (agrément mandataire, autorisation SAAD) relève du document juridique du projet. **Ici, on en tire seulement les conséquences économiques.**

### 2.4 Recommandation : le modèle hybride « Double rail, payé par la demande »

```
                 ┌───────────────────── PAYEURS ─────────────────────┐
  Familles locales   Diaspora (Hexagone)   Caisses/mutuelles/assisteurs/employeurs   Départements/CFPPA/ARS
   abonnement +        « Veille » 39-89€      heures préfinancées 29-32€ HT            marchés & AAP
   frais dégressifs                           + forfaits/bénéficiaire
                 └───────────────┬───────────────────────────────────┘
                                 ▼
                     PLATEFORME (SAS, organisme SAP déclaré)
        ┌──────────────────────────┴───────────────────────────┐
   RAIL A : micro-entrepreneurs SAP déclarés          RAIL B : emploi direct outillé (CESU+) → mandataire agréé (M9-12)
   activités déclaratives (courses, aide admin,       compagnie / aide personnelle / sorties des 60+ et
   repas, entretien, numérique)                       personnes handicapées → crédit d'impôt garanti
        └──────────────────────────┬───────────────────────────┘
                                   ▼
             ACCOMPAGNANTS : 0 € de commission, paiement J+2, programme « Socle »
                                   ▼
     Option A3 : autorisation SAAD prestataire (ou partenariat avec un SAAD autorisé) pour les heures APA/PCH
```

**Pourquoi c'est le modèle le plus puissant :**
1. **Il supprime la raison économique de partir.** Le crédit d'impôt est préservé sur tous les rails, ce qui ramène l'écart avec le CESU direct à 1 ou 2 €/h, largement compensé par la valeur continue.
2. **Il aligne l'offre** : on recrute les meilleurs accompagnants des SAAD parce qu'ils gagnent 45 à 75 % de plus et ne paient rien.
3. **Il diversifie les payeurs.** En année 3 (central), les familles pèsent environ 45 % du CA, la diaspora environ 10 %, le B2B2C environ 23 %, le B2G environ 19 % et les services complémentaires environ 3 %. Le payeur institutionnel est le meilleur antidote à la fuite.
4. **Il est défendable devant un juge et un financeur public** : modèle d'impact, travailleurs non ponctionnés, conformité SAP.

---

## 3. Grille tarifaire proposée

### 3.1 Familles locales (Réunion, Guadeloupe, Martinique)

⚠️ TVA de 8,5 % sur les frais de la plateforme dans ces trois DROM, 0 % en Guyane et à Mayotte (à valider). Les accompagnants micro-entrepreneurs sont en franchise de TVA.

| Formule | Prix | Frais de service (sur le montant de la prestation) | Inclus | Cible |
|---|---|---|---|---|
| **Libre** | 0 €/mois | 18 % HT | Paiement sécurisé, assurance, attestation fiscale, avance immédiate | Besoin ponctuel (moins de 6 h/mois) |
| **Sérénité** ⭐ | 19,90 € TTC/mois | 9 % HT, puis 6 % après 6 mois, puis 4 % après 12 mois | + remplacement garanti 48 h, rapports de visite, coordinateur nommé, bilan des droits | 6 à 30 h/mois (cœur de cible) |
| **Sérénité Intégral** | 39 € TTC/mois | 6 % HT, puis 4 % | + remplacement 24 h, binôme fixe, réunion de famille trimestrielle, Pack Aidant | Plus de 30 h/mois |

**Tarif horaire de l'accompagnant** : fixé librement par lui, avec une fourchette indicative de **20 à 26 €/h** et un plancher recommandé de 20 €. Majoration conseillée de 25 % le dimanche et les jours fériés.

**Exemple (Sérénité, 20 h à 22 €, Rail A, activité éligible)** :

| Poste | Montant |
|---|---|
| Prestations accompagnant (20 h × 22 €) | 440,00 € |
| Abonnement Sérénité | 19,90 € TTC |
| Frais 9 % (39,60 € HT) | 42,97 € TTC |
| **Total facturé** | **502,87 €** |
| Avance immédiate du crédit d'impôt (50 %) | −251,43 € |
| **Reste à charge réel** | **251,43 €/mois, soit 12,57 €/h** |

À comparer :
- 🔎 avec le coût de revient d'un SAAD (environ 32 €/h, soit 16 €/h après crédit d'impôt). **Nous sommes environ 20 % moins chers pour la famille** tout en payant mieux l'intervenant ;
- avec le **même cas sans crédit d'impôt** (activité non éligible) : 25,14 €/h. Cela montre l'importance du double rail.

### 3.2 Diaspora : « Veille sur mes parents » (payé depuis l'Hexagone)

🔎 En 2008, déjà 365 000 natifs des DOM vivaient en métropole : 117 000 Martiniquais, 115 400 Guadeloupéens, 108 000 Réunionnais. Leur nombre a doublé depuis 1975. [maire-info.com / Insee](https://www.maire-info.com/en-2008-un-antillais-sur-quatre-et-un-reunionnais-sur-sept-vivent-en-metropole-article2-14538) · [Insee Première 1389](https://www.insee.fr/fr/statistiques/fichier/version-html/1281122/ip1389.pdf)

| Formule | Prix TTC/mois | Inclus |
|---|---|---|
| **Veille** | 39 € | Tableau de bord, rapports de chaque visite, alertes de signaux faibles, coordinateur joignable sur WhatsApp, paiement par carte depuis l'Hexagone, gestion du crédit d'impôt au nom du parent. Heures facturées en plus, avec 6 % de frais |
| **Veille+** ⭐ | 89 € | Veille + **2 visites de lien de 1 h par mois incluses** + gestion de l'agenda médical et des rendez-vous + visio accompagnée mensuelle avec le parent |
| **Veille Intégrale** | 189 € | Veille+ + 1 visite par semaine incluse + présence à 1 rendez-vous médical par mois (dans la limite des 50 % hors domicile, LF 2026) + compte rendu écrit |

🧮 ARPU diaspora modélisé : **55 € HT/mois** en moyenne.

### 3.3 B2B et B2G

| Client | Offre | Prix indicatif 🧮 | Notre marge |
|---|---|---|---|
| Caisses de retraite (Agirc-Arrco, CGSS via son action sociale), mutuelles | Heures d'aide momentanée, retour d'hospitalisation, sorties | **29 à 32 € HT/h** tout compris (l'accompagnant reçoit 22 €) | 5 à 7 €/h nets après coordination |
| Assisteurs (IMA, Europ Assistance, Mondial…), qui manquent de réseau dans les DROM ⚠️ | Exécution de garanties « aide au retour à domicile » sous 48 h | 30 à 34 € HT/h + 20 € de frais de déclenchement | 6 à 9 €/h |
| Employeurs d'aidants (CHU, collectivités, banques, EDF, compagnies aériennes, grande distribution) | Programme aidants : ligne coordinateur, bilan des droits, X heures de répit par salarié aidant | Forfait de **3 à 6 € par salarié et par mois**, ou de **5 000 à 25 000 €/an**, + heures à 29 € | 60 % sur le forfait |
| Départements, CCAS, CFPPA (axe 6 « lutte contre l'isolement »), ARS (répit) | Programme « Lien » : visites hebdomadaires à des personnes isolées, repérage de fragilités, évaluation d'impact | **400 à 900 € par bénéficiaire et par an**, ou appel à projets de 30 à 150 k€ | 25 à 35 % |

🔎 La Commission des financeurs de la prévention de la perte d'autonomie de La Réunion a lancé son appel à projets 2026 (publication le 24/12/2025, dépôt avant le 23/01/2026). Un **axe 6 « lutte contre l'isolement »** a été créé par la loi de 2024. Le calendrier est annuel : **il faut être prêt pour la session de fin 2026**. [departement974.fr](https://www.departement974.fr/sites/default/files/cahier_des_charges.pdf)

### 3.4 Ce que gagne l'accompagnant : nettement mieux qu'en SAAD

🔎 Cotisations des micro-entrepreneurs en prestations de services BIC : **21,2 % en 2026** (taux inchangé ; seuls les BNC augmentent). [lecoindesentrepreneurs.fr](https://www.lecoindesentrepreneurs.fr/taux-cotisations-sociales-2026-micro-entrepreneur/)
🔎 SMIC : 12,02 € brut/h au 1er janvier 2026. [info.gouv.fr](https://www.info.gouv.fr/actualite/le-smic-revalorise-au-1er-janvier-2026)
🔎 Auxiliaire de vie B1 (convention collective de la branche de l'aide à domicile) : environ **1 933 € brut/mois** à temps plein en 2026, soit environ 12,75 € brut/h. [travail-industrie.com](https://travail-industrie.com/outils/conventions-collectives/aide-a-domicile-services-personne-idcc-2941)

| Par heure facturée | Accompagnant plateforme (22 €/h) | Accompagnant plateforme (25 €/h) | Salarié SAAD (B1) |
|---|---|---|---|
| Brut | 22,00 € | 25,00 € | ~12,75 € |
| Cotisations (21,2 % + 0,1 % de contribution formation) | −4,69 € | −5,33 € | ~−2,80 € (salariales) |
| Frais professionnels (carburant, téléphone) 🧮 | −1,50 € | −1,50 € | (déplacements indemnisés) |
| **Net « en poche »** | **15,81 €** | **18,17 €** | **~9,95 €** |
| Net « équivalent salarié » (÷1,10 pour les congés non payés) | 14,37 € | 16,52 € | 9,95 € (congés payés inclus) |
| **Écart avec le SAAD** | **+44 %** (+59 % en poche) | **+66 %** (+83 % en poche) | — |
| Commission prélevée par la plateforme | **0 €** | **0 €** | — |

⚠️ Le micro-entrepreneur n'a **ni chômage, ni congés payés, ni indemnités journalières significatives**. Le programme « Socle » est là pour combler ce trou :
- prévoyance de groupe négociée ;
- prime de fidélité de 2 % des heures annuelles ;
- formation gratuite.

C'est ce qui rend la proposition **éthiquement solide** et **fidélisante**.

🧮 **Revenu mensuel type** : 90 h facturées à 22 €, soit environ **1 420 € net**. C'est l'équivalent d'un SMIC net à temps plein, pour environ 25 h hebdomadaires. Un accompagnant SAAD à 25 h par semaine gagne environ 1 080 € net.

---

## 4. Unit economics détaillés (scénario central)

### 4.1 Hypothèses explicites 🧮

| Paramètre | Prudent | **Central** | Ambitieux | Justification |
|---|---|---|---|---|
| Heures / famille locale / mois | 12 | **14** | 16 | 3 à 4 visites de 1 h par semaine ; les besoins augmentent avec l'âge |
| Tarif horaire moyen de l'accompagnant | 22 € | **22 €** | 23 € | Milieu de la fourchette 20 à 26 € |
| GMV / famille / mois | 264 € | **308 €** | 368 € | |
| Take rate effectif (abonnement + frais) / GMV | 14 % | **15 %** | 16 % | Mix Libre, Sérénité et Intégral (voir 3.1) |
| **Revenu net / famille locale / mois** | 37 € | **46 € HT** | 59 € | |
| ARPU diaspora | 50 € | **55 € HT** | 60 € | Veille, Veille+ et Veille Intégrale |
| Churn mensuel, familles locales | 7,5 % | **6 %** | 5 % | Fort churn structurel : décès, entrée en EHPAD, hospitalisation, fuite |
| Churn mensuel, diaspora | 5 % | **4 %** | 3,5 % | Payeur moins volatil |
| Marge B2B2C par heure | 7 € | **7 €** | 7 € | 29 € facturés, 22 € reversés |
| Familles par coordinateur (ETP) | 150 | **150, puis 300 avec l'outil** | 150 à 300 | Coût chargé d'un coordinateur en DROM ≈ 2 900 €/mois |
| Frais de paiement | 1,5 % du GMV | 1,5 % | 1,5 % | Stripe, SEPA, intermédiation |
| Assurance (contrat groupe) | 1 € / famille / mois + 6 k€/an | idem | idem | ⚠️ à négocier |

### 4.2 Contribution par famille locale (par mois)

| Poste | Démarrage (A1 à A2) | Régime de croisière (A3+) |
|---|---|---|
| Revenu net | 46,2 € | 46,2 € |
| Paiement (1,5 % de 308 €) | −4,6 € | −4,6 € |
| Assurance | −1,0 € | −1,0 € |
| Vérifications et intégration des accompagnants (amorties) | −1,5 € | −1,0 € |
| Primes de remplacement | −1,5 € | −1,5 € |
| Coordination humaine | −19,3 € (150 familles par ETP) | −9,7 € (300 familles par ETP grâce à l'automatisation) |
| **Marge contributive** | **18,3 € (40 %)** | **28,4 € (61 %)** |

### 4.3 CAC par canal 🧮 (fondés sur des benchmarks de services aux seniors ; à mesurer pendant le pilote)

| Canal | CAC estimé | Part des acquisitions (central) | Commentaire |
|---|---|---|---|
| Prescripteurs : assistantes sociales hospitalières (CHU), CCAS, pharmacies, médecins, infirmiers libéraux | 60 à 120 € | 35 % | Le meilleur canal : confiance immédiate. Coût = temps terrain + supports |
| Parrainage par une famille (crédit de 2 h offert) | 40 à 50 € | 20 % | Très fort sur une île |
| Accompagnants qui amènent leurs propres clients (bonus) | 30 € | 10 % | Ils captent l'existant |
| Meta / Facebook local + radio de proximité (Freedom, RCI…) | 120 à 200 € | 20 % | CPM bas en DROM, cycle de conversion long |
| B2B2C : bénéficiaire orienté par une caisse ou une mutuelle | 0 à 30 € par famille (+ coût de vente du contrat : 8 à 15 k€ par contrat) | 15 % | Le meilleur à l'échelle |
| **Moyenne pondérée locale** | **~110 €** | | |
| Diaspora (Meta ciblé « originaires de… », associations, influenceurs créoles, ambassadeurs) | 170 à 230 € | — | 200 € en central |

### 4.4 LTV, LTV/CAC, payback

| Indicateur | Famille locale (démarrage) | Famille locale (croisière) | Diaspora | B2B2C (par contrat de 2 000 h/an) |
|---|---|---|---|---|
| Durée de vie moyenne (1 / churn) | 16,7 mois | 20 mois (churn 5 %) | 25 mois | 3 ans (contrat) |
| Marge contributive mensuelle | 18,3 € | 28,4 € | ~26 € | ~830 € (5 €/h × 167 h) |
| **LTV contributive** | **305 €** | **570 €** | **650 €** | **~30 k€** |
| CAC | 110 € | 90 € | 200 € | 8 à 15 k€ |
| **LTV / CAC** | **2,8** | **6,3** | **3,3** | **2 à 3,7** |
| **Payback** | **6,0 mois** | **3,2 mois** | **7,7 mois** | 10 à 18 mois |

**Lecture CFO** : la marketplace devient saine (LTV/CAC supérieur à 3) **seulement** si la coordination humaine est outillée au point de doubler le portefeuille par coordinateur, et si le churn hors décès est ramené sous 5 %. **Ce sont les deux KPI à piloter chaque semaine.** Le churn « naturel » (décès, entrée en EHPAD) est incompressible, de l'ordre de 2 à 3 % par mois chez les 80 ans et plus 🧮. Toute la marge de manœuvre porte donc sur la fuite et l'insatisfaction.

### 4.5 Besoin en accompagnants (contrainte d'offre)
- 🧮 Central, 36e mois : 1 271 familles × 14 h + 4 000 h B2B, soit **environ 22 000 h/mois**. À raison de 80 h/mois par accompagnant actif, il en faut **environ 275 actifs** (et environ 400 inscrits).
- Ratio cible : **1 accompagnant pour 4 à 5 familles**. Le pilote démarre avec 15 à 20 accompagnants sur 2 ou 3 communes, la densité primant sur la couverture.

---

## 5. P&L prévisionnel 36 mois : trois scénarios

### 5.1 Hypothèses structurantes 🧮

> **Note T1.** Le fondateur lance en **Guadeloupe** (380 400 habitants, 2ᵉ région la plus âgée). Remplace « Réunion » par « Guadeloupe » et « Guadeloupe » par « Martinique » dans les scénarios ci-dessous. Le marché local de la Guadeloupe est environ 2,3 fois plus petit que celui de La Réunion, mais sa diaspora est plus grande (1 natif sur 4 en Hexagone, contre 1 sur 7). Effet attendu : moins de familles locales, plus de familles diaspora (panier plus élevé). **[À VÉRIFIER : relancer `annexes/modele-pl.py` avec le paramètre territoire = Guadeloupe et une part diaspora de 25 à 35 %.]** Ordre cible : Guadeloupe (M0), Martinique (M7-M9 si critères atteints), Guyane (M18-M24), Hexagone (M24+).

- **Territoires (calcul v1)** :
  - Prudent : Réunion, puis Guadeloupe au 25e mois.
  - Central : Réunion, puis Guadeloupe au 13e mois, puis Martinique au 19e mois.
  - Ambitieux : Réunion, Guadeloupe au 10e mois, Martinique au 13e mois, puis renforcement (diaspora et Guyane) au 25e mois.
- **Nouvelles familles par mois et par territoire** : rampe linéaire (central : 6, puis +2 par mois, plafond 45), pondérée par la taille du territoire. Les familles diaspora représentent 15 % des nouvelles familles locales en central (10 % en prudent, 22 % en ambitieux).
- **B2B2C** (heures/mois) : central 250 au 12e mois, 1 500 au 24e, 4 000 au 36e. Revenu comptabilisé en net : 7 €/h.
- **B2G** (contrats de prestation, comptés en CA) : central 40 k€, puis 120 k€, puis 200 k€. **Les subventions d'investissement et les aides à la création sont exclues du P&L** (voir section 6).
- **Équipe** :
  - Fondateurs non rémunérés du 1er au 6e mois, puis 4 k€/mois chargés au total, puis 8 k€ en A2 et 10 k€ en A3.
  - Développeur ou CTO à partir du 13e mois (central).
  - Responsable croissance et partenariats à partir du 13e mois.
  - Un responsable par territoire ouvert.
  - En A3 : un profil produit et un temps partiel administratif et financier.
  - Coordinateurs : 1 ETP pour 150 familles.
- **Tech** : no-code (environ 300 €/mois) en A1, puis application mobile externalisée (60 k€ répartis sur 6 mois à partir du 10e mois en central), hébergement et outils à 1,5 k€, puis 3 k€ par mois.
- **Structure variable** : 8 % du CA (support, commerciaux B2B, comptabilité).
- **Hors modèle** : impôt sur les sociétés (déficits reportables), amortissements, BFR. Le BFR est quasi nul : l'avance immédiate URSSAF règle sous quelques jours et la famille est prélevée à la prestation.

### 5.2 Scénario CENTRAL (k€)

| | **Année 1** | **Année 2** | **Année 3** |
|---|---|---|---|
| Familles locales actives (fin de période) | 161 | 581 | 1 078 |
| Familles diaspora actives | 26 | 98 | 193 |
| Heures B2B2C / mois (fin de période) | 250 | 1 500 | 4 000 |
| **GMV (volume transité)** | **327** | **1 873** | **4 620** |
| CA familles locales | 40,4 | 203,5 | 473,1 |
| CA diaspora | 7,6 | 40,4 | 98,5 |
| CA B2B2C (net) | 5,3 | 77,9 | 239,8 |
| CA B2G (prestations) | 40,0 | 120,0 | 200,0 |
| CA services complémentaires | 1,5 | 15,4 | 36,1 |
| **Chiffre d'affaires net** | **94,7** | **457,1** | **1 047,5** |
| Coûts variables (paiement, assurance, vérifications) | −14,7 | −48,9 | −104,6 |
| Coordination humaine | −25,2 | −113,7 | −276,8 |
| Acquisition (CAC + marque) | −40,6 | −104,2 | −163,5 |
| **Marge contributive** | **14,2** | **190,3** | **502,6** |
| Frais fixes (équipe, tech, application, administration, structure) | −93,9 | −406,1 | −569,8 |
| **EBITDA** | **−79,6** | **−215,6** | **−67,1** |
| Trésorerie cumulée consommée (hors financement) | −79,6 | −295,3 | −362,4 |

**Trajectoire mensuelle (central)** :

| Mois | M3 | M6 | M12 | M18 | M24 | M30 | M36 |
|---|---|---|---|---|---|---|---|
| Familles locales | 23 | 59 | 161 | 335 | 581 | 833 | 1 078 |
| Familles diaspora | 3 | 9 | 26 | 56 | 98 | 145 | 193 |
| CA mensuel (k€) | 4,6 | 6,6 | 14,5 | 35,8 | 54,8 | 85,3 | 108,9 |
| EBITDA mensuel (k€) | −2,7 | −2,1 | −18,5 | −17,2 | −12,1 | −6,5 | **+4,0** |
| Cumul (k€) | −8,3 | −15,3 | −79,6 | −206,3 | −295,3 | −359,4 | −362,4 |

➡️ **Point mort mensuel au 34e mois environ. Creux de trésorerie d'environ −369 k€.** Le pilote (du 1er au 4e mois) correspond à 23 à 40 familles et 300 à 500 h/mois, soit **plus de 100 missions**, ce qui est cohérent avec l'objectif de 50 à 100 missions.

### 5.3 Scénario PRUDENT (k€)

| | Année 1 | Année 2 | Année 3 |
|---|---|---|---|
| Familles locales / diaspora (fin) | 103 / 11 | 249 / 30 | 386 / 49 |
| GMV | 185 | 831 | 1 624 |
| CA familles + diaspora | 24,9 | 94,1 | 168,3 |
| CA B2B2C + B2G + services complémentaires | 33,8 | 119,0 | 231,5 |
| **Chiffre d'affaires** | **58,6** | **213,1** | **399,7** |
| Variables + coordination + acquisition | −66,9 | −144,9 | −231,2 |
| **Marge contributive** | **−8,3** | **68,2** | **168,6** |
| Frais fixes (équipe réduite, pas de responsable croissance) | −57,5 | −246,0 | −302,0 |
| **EBITDA** | **−65,7** | **−177,8** | **−133,4** |
| Cumul | −65,7 | −243,5 | −377,0 |

➡️ **Pas de point mort à 36 mois.** Les règles de pivot à appliquer dans ce cas sont détaillées en 5.6.

### 5.4 Scénario AMBITIEUX (k€)

| | Année 1 | Année 2 | Année 3 |
|---|---|---|---|
| Familles locales / diaspora (fin) | 267 / 62 | 1 118 / 269 | 2 264 / 569 |
| GMV | 624 | 4 246 | 11 084 |
| CA familles | 78,3 | 489,0 | 1 228,2 |
| CA diaspora | 18,3 | 118,3 | 309,0 |
| CA B2B2C | 12,3 | 155,8 | 479,5 |
| CA B2G | 60,0 | 180,0 | 300,0 |
| CA services complémentaires | 3,4 | 41,1 | 104,0 |
| **Chiffre d'affaires** | **172,2** | **984,2** | **2 420,7** |
| Variables + coordination + acquisition | −111,5 | −494,2 | −1 109,4 |
| **Marge contributive** | **60,6** | **490,0** | **1 311,3** |
| Frais fixes (équipe renforcée : +9 k€/mois au 13e mois, +16 k€/mois au 25e) | −163,2 | −563,6 | −1 027,7 |
| **EBITDA** | **−102,6** | **−73,6** | **+283,7** |
| Cumul | −102,6 | −176,2 | +107,4 |

➡️ Point mort mensuel durable vers le **22e à 24e mois**. Creux de trésorerie d'environ −204 k€ au 18e mois. **Attention** : ce scénario suppose une exécution commerciale B2B forte. Dans la réalité, on lèverait davantage (600 k€ à 1 M€) pour **accélérer**, pas pour survivre.

### 5.5 Besoins de financement

| | Prudent | **Central** | Ambitieux |
|---|---|---|---|
| Creux de trésorerie (modèle) | −377 k€ (non atteint à 36 mois) | **−369 k€** | −204 k€ |
| Marge de sécurité (+25 %) et BFR | +95 k€ | **+90 k€** | +50 k€ (+ accélération) |
| **Besoin total sur 36 mois** | **~470 k€ + pivot** | **~460 k€** | **~250 k€ (lever 0,6 à 1 M€ pour accélérer)** |
| Dont non dilutif visé (voir section 6) | ~250 k€ | **~230 k€** | ~250 k€ |
| Dont fonds propres | ~220 k€ | **~230 k€ (seed au 9e à 12e mois)** | 0,4 à 0,8 M€ |

### 5.6 Sensibilités et règles de pilotage

| Levier (central) | Variation | Impact sur le creux de trésorerie |
|---|---|---|
| Churn familles | 6 % → 8 % | ≈ −120 k€ (point mort reporté au-delà du 36e mois) |
| Familles par coordinateur | 150 → 250 | ≈ +110 k€ |
| Heures par famille | 14 → 18 | ≈ +90 k€ |
| B2B2C au 36e mois | 4 000 → 1 500 h/mois | ≈ −70 k€ |
| CAC | 110 → 160 € | ≈ −60 k€ |

**Règles de décision (go / no-go)** :
- **Au 4e mois** : au moins 30 familles actives, au moins 60 % des familles encore actives au 3e mois, NPS famille d'au moins 50. Si ce n'est pas le cas, il faut revoir l'offre avant d'investir dans l'application.
- **Au 12e mois** : au moins 1 contrat B2B2C signé et au moins 1 financement CFPPA ou B2G. Si ce n'est pas le cas, il faut basculer vers un modèle « opérateur pour institutions » (B2B2C prioritaire), sans dépense marketing B2C.
- **Au 18e mois** : au moins 250 familles par coordinateur. Sans automatisation suffisante, il ne faut pas ouvrir de troisième territoire.

---

## 6. Financement : sources et ordre recommandé

| Ordre | Période | Source | Montant indicatif | Nature | Commentaire |
|---|---|---|---|---|---|
| 1 | M−2 à M0 | **Apport des fondateurs et love money** | 20 à 40 k€ | Fonds propres | Sert d'effet de levier pour tout le reste (les prêts d'honneur et la BPI exigent des fonds propres) |
| 2 | M−2 à M2 | **Incubateur** : **ZEBOX Caraïbes** (Jarry, Guadeloupe), French Tech Guadeloupe, Initiative Guadeloupe [À VÉRIFIER] ; plus tard : équivalents en Martinique ; Technopole de La Réunion (hors feuille de route) | 0 à 10 k€ + accompagnement | Accompagnement | Crédibilité auprès de la BPI et de la Région, réseau de mentors |
| 3 | M0 à M3 | **Prêt d'honneur Initiative Réunion Entreprendre** (innovation : jusqu'à environ 25 k€ à 0 %, sur 5 ans maximum, sans garantie) | 25 à 50 k€ (2 fondateurs) | Quasi-fonds propres personnels | 🔎 [les-aides.fr](https://les-aides.fr/aide/QRlf3w/initiative-reunion-entreprendre.pret-d-honneur-innovation.pdf) |
| 4 | M0 à M3 | **Réseau Entreprendre** (antennes Outre-mer ⚠️ à vérifier) | 15 à 50 k€ ⚠️ | Prêt d'honneur + mentorat | Mentorat de chefs d'entreprise locaux : précieux pour le B2B |
| 5 | M1 à M4 | **Bourse French Tech (Bpifrance)** : 30 k€ de plafond standard (jusqu'à 70 % des dépenses éligibles) ; variante Émergence jusqu'à 90 k€ pour les deep tech | 30 k€ | Subvention | 🔎 [hayot-expertise.fr](https://hayot-expertise.fr/blog/bourse-french-tech-bpifrance-conditions). L'innovation doit être démontrée : moteur de remplacement, détection de signaux faibles, rails fiscaux automatisés |
| 6 | M2 à M6 | **Prêt bancaire** adossé aux prêts d'honneur (effet de levier de ×3 à ×5) + **garantie France Active** | 50 à 100 k€ | Dette | France Active garantit et accompagne les entreprises à impact (ESUS) ⚠️ conditions à vérifier |
| 7 | M3 à M9 | **CFPPA (CNSA via le département)**, axe 6 isolement + actions collectives | 30 à 80 k€ par an | Prestation ou subvention | 🔎 calendrier annuel (dépôt en janvier) [departement974.fr](https://www.departement974.fr/sites/default/files/cahier_des_charges.pdf) |
| 8 | M4 à M12 | **FSE+** (Région ou État selon le volet) : formation et insertion d'accompagnants (demandeurs d'emploi, femmes de plus de 45 ans) ; **FEDER** : volet numérique et innovation | 50 à 200 k€ | Subvention (préfinancement nécessaire) | ⚠️ Versement tardif (12 à 24 mois) : prévoir un préfinancement bancaire ou France Active. Taux de cofinancement élevés dans les régions ultrapériphériques |
| 9 | M6 à M12 | **ARS / plateformes de répit** (aidants), **CNSA appels à projets aidants**, conférences ou commissions départementales | 20 à 100 k€ | Prestation ou subvention | Positionner le « relais » de courte durée, hors soins |
| 10 | M9 à M15 | **Seed à impact** : France Active Investissement, Citizen Capital, Phitrust (⚠️ vérifier leurs thèses et tickets actuels), business angels de La Réunion et des Antilles, family offices locaux | 300 à 800 k€ | Fonds propres | Thèse : silver économie + Outre-mer + travail décent. **Coupler avec un prêt d'amorçage Bpifrance** (environ 1:1 ⚠️) |
| 11 | M9 à M15 | **Réduction d'impôt pour souscription au capital de PME (IR-PME)**, avec un taux majoré possible pour les entreprises ultramarines ⚠️ | — | Incitation pour les investisseurs | Argument pour les business angels locaux |
| 12 | M24 et au-delà | **Contrat à impact social (CIS)** avec un département ou l'État : « réduction de l'isolement et report de l'entrée en institution » | 0,5 à 2 M€ sur 3 à 5 ans | Préfinancement par des investisseurs, remboursé si les objectifs sont atteints | Nécessite 18 à 24 mois de données d'impact : **instrumenter l'impact dès le premier jour** (échelle UCLA de solitude, hospitalisations évitées) |
| 13 | M24 et au-delà | **Série A** (extension DROM + Hexagone, diaspora et aidants) | 2 à 4 M€ | Fonds propres | Si les métriques de l'année 2 sont atteintes |
| — | — | **AFD** | Faible pertinence directe | — | En DROM, l'AFD finance surtout les collectivités et le secteur public. Intérêt **indirect** : financer les programmes d'un département dont nous sommes l'opérateur |
| — | — | **Girardin** | ❌ Non adapté | — | Vise l'investissement productif physique (matériel, logement social), pas une plateforme de services immatérielle ⚠️ |

**Séquence recommandée (central, environ 460 k€)** :
1. **Avant le pilote (environ 125 à 190 k€)** : apport de 30 k€, prêts d'honneur de 25 à 50 k€, Réseau Entreprendre (15 à 50 k€ ⚠️, voir ligne 4), Bourse French Tech de 30 k€ et prêt bancaire de 50 k€. Cela finance le pilote et la première année. Les contrats CFPPA et B2G sont déjà comptés dans le chiffre d'affaires.
2. **Du 9e au 12e mois** : seed à impact de 300 à 350 k€, avec un prêt d'amorçage Bpifrance. Cela finance l'application, la consolidation en Guadeloupe et l'ouverture de la Martinique.
3. **Le FSE+ ou le FEDER (50 à 150 k€)** arrive vers le 18e à 24e mois. C'est un coussin de sécurité ; on ne bâtit pas le plan dessus.

---

## 7. Moats : avantages concurrentiels défendables à 5 ans

| # | Moat | Mécanisme | Pourquoi c'est difficile à copier | Indicateur |
|---|---|---|---|---|
| 1 | **Rails réglementaires et fiscaux** | Déclaration SAP, agrément mandataire, raccordement à l'avance immédiate (API Tiers de prestation), contrats B2B2C référencés, éventuellement autorisation SAAD | 12 à 24 mois de démarches et d'historique de conformité ; une start-up parisienne ne le fera pas pour 4 îles | Part du CA éligible au crédit d'impôt (> 90 %) |
| 2 | **Liquidité locale dense** | Accompagnants fidélisés par le programme « Socle » (prévoyance, prime annuelle, formation, paiement J+2) **financé par la plateforme** | Effets de réseau **par commune** : le premier qui atteint la densité gagne ; partir signifie perdre ses avantages | Délai de remplacement < 24 h ; rétention des accompagnants à 12 mois > 70 % |
| 3 | **« OS du domicile »** | Carnet de liaison partagé (famille, diaspora, infirmier, médecin, CCAS) : historique, signaux faibles, droits, rendez-vous | Coûts de changement : 2 ans d'historique d'un parent ne se migrent pas | Intervenants tiers actifs par foyer |
| 4 | **Payeurs institutionnels** | Caisses de retraite, mutuelles, assisteurs, employeurs, départements | Cycles de vente de 6 à 18 mois, exigences de reporting et d'impact déjà satisfaites | Part du CA B2B2C et B2G (cible 40 à 50 %) |
| 5 | **Données d'impact propriétaires** (jamais vendues) | Mesure de l'isolement et des fragilités, hospitalisations évitées | Seule base longitudinale ultramarine de ce type ; condition d'accès aux contrats à impact et aux appels d'offres | Publications et rapports d'impact |
| 6 | **Ancrage culturel** | Coordinateurs et accompagnants créolophones, marque locale, communautés diaspora | La confiance des familles créoles ne s'achète pas en publicité Meta | NPS > 60 ; part du parrainage > 30 % |
| 7 | **Savoir-faire insulaire réplicable** | Playbook « ouvrir une île en 90 jours », réplicable vers Mayotte, la Guyane, la Polynésie, puis les zones rurales de l'Hexagone (mêmes problématiques de désert de services) | Expérience d'exécution, pas de la technologie | Délai d'ouverture d'un territoire |
| 8 | **Coût du capital réduit** | Financements publics et à impact (FSE+, CFPPA, CIS) inaccessibles aux plateformes purement lucratives | Les concurrents « Uber-like » ne sont pas éligibles | Part non dilutive du financement > 40 % |

**Contexte démographique** :
- 🔎 Insee : en 2030, 36 % de 60 ans et plus en Martinique et 34 % en Guadeloupe ; la Martinique deviendrait le département le plus âgé de France en 2050. [outremers360.com](https://outremers360.com/bassin-atlantique-appli/vieillissement-un-scenario-catastrophe-pour-la-martinique-selon-un-rapport-interministeriel)
- 🔎 À La Réunion, le nombre de personnes de 75 ans et plus serait multiplié par 3 entre 2018 et 2050. [insee.fr](https://www.insee.fr/fr/statistiques/3254355)

---

## 8. Incertitudes majeures à lever (avant tout engagement financier)

1. ⚠️ **Éligibilité exacte au crédit d'impôt** de chaque activité du catalogue selon le rail (micro déclaré, emploi direct, mandataire). Demander un **rescrit** à la DGFiP et l'avis de la DREETS.
2. ⚠️ **Accès de la plateforme à l'API Tiers de prestation de l'URSSAF** (avance immédiate) en tant qu'intermédiaire, et éligibilité des frais de plateforme au crédit d'impôt.
3. ⚠️ **Texte de transposition de la directive 2024/2831** (attendu fin 2026) : critères de la présomption de salariat.
4. ⚠️ **Exonérations de cotisations patronales** pour les employeurs de 70 ans et plus ou bénéficiaires de l'APA en emploi direct : elles déterminent l'écart de prix avec le CESU (section 1.2).
5. ⚠️ **TVA en DROM** sur les frais de plateforme (8,5 % en Réunion, Guadeloupe et Martinique ; 0 % en Guyane et à Mayotte) et régime de franchise des accompagnants.
6. ⚠️ **CAC réels** : tous les CAC sont des estimations. Le pilote doit les mesurer par canal (suivi UTM et code prescripteur dans Airtable).
7. ⚠️ **Statuts, tickets et thèses** de Réseau Entreprendre Outre-mer, des incubateurs antillais et des fonds à impact cités : à vérifier un par un.

---

### Sources principales
- Cotisations micro 2026 : https://www.lecoindesentrepreneurs.fr/taux-cotisations-sociales-2026-micro-entrepreneur/
- Avance immédiate et intermédiaires : https://www.lafinancepourtous.com/2022/06/15/services-a-la-personne-via-un-intermediaire-extension-du-credit-dimpot-instantane/ · https://www.legifiscal.fr/impots-taxes-entreprise/credits-reductions-impot/avance-immediate-credit-impot-service-personne.html
- Article D7231-1 du Code du travail : https://code.travail.gouv.fr/code-du-travail/d7231-1 · https://www.creerentreprise.fr/creer-activite-services-a-la-personne-statut/
- LF 2026 et crédit d'impôt SAP : https://www.fiscaloo.fr/12154-credit-dimpot-service-a-la-personne/ · https://www.senat.fr/enseance/2025-2026/138/Amdt_I-1844.html
- Tarif socle APA et coût de revient des SAAD : https://lemediasocial.fr/hulkStatic/EL/ELI/2025/01/f58369fff-0e99-4db6-92e1-9cbb4574212c/sharp_/ANX/fedesap-augmentation-apa-sad.pdf
- SMIC 2026 : https://www.info.gouv.fr/actualite/le-smic-revalorise-au-1er-janvier-2026
- Convention collective de l'aide à domicile (IDCC 2941) : https://travail-industrie.com/outils/conventions-collectives/aide-a-domicile-services-personne-idcc-2941
- Agirc-Arrco, aide à domicile momentanée : https://www.pour-les-personnes-agees.gouv.fr/vivre-a-domicile/aides-financieres/laide-a-domicile-momentanee-pour-les-retraites-agirc-arrco
- Commission Malt : https://help.malt.com/hc/en-150/articles/29539691425938-How-does-the-Malt-commission-work-for-freelancers
- Marché SAP : https://www.observatoiredelafranchise.fr/indiscretions-actualite/PETITS-FILS-les-chiffres-cles-de-laide-a-domicile-un-secteur-en-pleine-expansion-84540.htm · Ouihelp : https://www.frenchweb.fr/ouihelp-leve-3-millions-deuros-pour-ameliorer-laide-a-domicile-aux-personnes-agees/313984
- Directive plateformes : https://www.assemblee-nationale.fr/dyn/17/textes/l17b3187_proposition-resolution.pdf · https://questions.assemblee-nationale.fr/q17/17-14781QE.htm
- Démographie : https://www.insee.fr/fr/statistiques/3254355 · https://outremers360.com/bassin-atlantique-appli/vieillissement-un-scenario-catastrophe-pour-la-martinique-selon-un-rapport-interministeriel · https://www.maire-info.com/en-2008-un-antillais-sur-quatre-et-un-reunionnais-sur-sept-vivent-en-metropole-article2-14538
- Financement : https://hayot-expertise.fr/blog/bourse-french-tech-bpifrance-conditions · https://les-aides.fr/aide/QRlf3w/initiative-reunion-entreprendre.pret-d-honneur-innovation.pdf · https://www.departement974.fr/sites/default/files/cahier_des_charges.pdf
- Aidants en entreprise : https://pwnparis.springly.org/articles/99812-delphine-cochet-fondatrice-de-ma-bonne-fee · https://personal-finance.bnpparibas/fr/presse/tilia-responsage
- Téléassistance : https://charente.generations-mouvement.org/wp-content/uploads/2025/11/Presence-verte-accord-2026.pdf

*Le modèle de calcul (script Python, hypothèses paramétrables) a servi à produire les tableaux de la section 5. Les chiffres sont arrondis et doivent être recalés sur les données réelles du pilote au 4e mois.*
