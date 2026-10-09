# 01 — Analyse juridique et réglementaire : plateforme d'« accompagnants de vie » (France / Outre-mer)

> **Statut** : analyse stratégique (octobre 2026). Ce n'est pas une consultation juridique. Tous les points marqués **[À VÉRIFIER]** doivent être validés avec un avocat (droit social / SAP / RGPD) et, idéalement, par un rescrit (DGFiP, DEETS, URSSAF).
>
> **Méthode et limites** : recherches web effectuées en octobre 2026. L'accès direct à Légifrance, BOFiP et servicesalapersonne.gouv.fr était bloqué depuis l'environnement de recherche. Les références d'articles viennent donc de sources secondaires et de la connaissance du droit en vigueur. Elles sont signalées comme telles quand une vérification sur le texte officiel s'impose.

---

## 0. Verdict en une page

**Le modèle « pure mise en relation avec des auto-entrepreneurs (AE) » tel qu'il est conçu ne tient pas pour le cœur de l'offre.** Ce n'est pas un problème de statut de la plateforme, c'est un problème de **nature des activités** :

1. **Ce qui intéresse le plus les familles relève d'un régime d'autorisation ou d'agrément** : la présence et la compagnie auprès d'une personne âgée ou handicapée (« assistance dans les actes quotidiens de la vie ou aide à l'insertion sociale »), l'accompagnement aux rendez-vous hors du domicile et la conduite du véhicule de la personne. En mode prestataire, il faut l'**autorisation du président du conseil départemental** (CTM en Martinique, CTG en Guyane). En mode mandataire, il faut un **agrément** de l'État (DEETS en Outre-mer). Un AE est lui-même prestataire : se déclarer « intermédiaire technique » ne protège ni lui ni la plateforme. Un AE ne peut pas obtenir la déclaration SAP pour ces activités auprès de ce public, et l'autorisation départementale lui est en pratique inaccessible.
2. **Le crédit d'impôt de 50 % et l'Avance immédiate restent accessibles avec des AE**, mais seulement pour les activités relevant de la **simple déclaration** : assistance administrative *à domicile*, préparation de repas à domicile *y compris les commissions*, livraison de courses (dans une « offre globale »), assistance informatique, entretien de la maison, petits travaux, accompagnement de personnes en *invalidité temporaire*, etc. Habiller de la compagnie de personnes âgées dépendantes en « assistance administrative » est une **fraude** (crédit d'impôt indu pour la famille, retrait de la déclaration pour l'AE, complicité possible de la plateforme).
3. **L'APA et la PCH ne peuvent pas payer un AE.** Elles financent l'emploi direct, un service mandataire ou un service prestataire autorisé.
4. **Le risque de requalification en salariat** (jurisprudence Take Eat Easy 2018 et Uber 2020, puis transposition de la directive (UE) 2024/2831 attendue au plus tard le 2 décembre 2026) est réel dès que la plateforme fixe les prix, note, sanctionne ou désactive.

**Montage recommandé** : une plateforme **hybride à deux voies**, qui monte en régulation par paliers.

| Voie | Pour quoi | Statut des intervenants | Crédit d'impôt / Avance immédiate | APA / PCH |
|---|---|---|---|---|
| **A « Coups de main du quotidien »** | Démarches administratives à domicile, repas et commissions, courses (offre globale), numérique, petit entretien | AE **déclarés SAP (NOVA)** sur les seules activités relevant de la déclaration | Oui (50 %), Avance immédiate via l'**API Tiers de prestation** | Non |
| **B « Présence & autonomie »** | Compagnie, aide aux actes de la vie quotidienne, accompagnement aux RDV, sorties | **Salariés du particulier employeur** (la famille ou la personne aidée emploie via **CESU+**). La plateforme fait du **placement** (phase 0), puis devient **mandataire agréé** (phase 1), et enfin **service autorisé (SAD)** ou s'adosse à un SAD partenaire (phase 2) | Oui (50 %), Avance immédiate **native dans CESU+**. Plus l'**exonération de cotisations patronales** pour les employeurs de 70 ans et plus ou bénéficiaires d'APA ou PCH | Oui (emploi direct, mandataire, prestataire autorisé) |

L'argument « 25 €/h payés 12,50 € » est donc **tenable sur les deux voies**, à condition de respecter le bon canal pour chaque activité. Sur la voie B, il est même plus fort : 50 % de crédit d'impôt, exonération de charges patronales et APA cumulables.

---

## 1. Le modèle « pure mise en relation » tient-il ?

### 1.1 Les trois modes légaux d'exercice des SAP

L'article L7232-6 du Code du travail prévoit qu'un organisme de services à la personne peut exercer selon trois modes :

1. **Placement** : il met en relation des travailleurs avec des particuliers employeurs. Le particulier est l'employeur.
2. **Mandataire** : il recrute et gère l'administratif *pour le compte* du particulier employeur, qui reste l'employeur juridique.
3. **Prestataire** : il fournit lui-même la prestation. Il est l'employeur des intervenants ou, pour un AE, il exécute lui-même.

**La « mise en relation avec des AE » n'est aucun des trois.** Juridiquement, l'AE est un **prestataire** (mode 3) et la plateforme est un intermédiaire commercial (opérateur de plateforme au sens du Code de la consommation et du DSA). Il en découle :

- **Les obligations SAP (déclaration, agrément, autorisation) pèsent sur l'AE**, selon l'activité et le public.
- **La plateforme n'a pas besoin d'être déclarée SAP tant qu'elle ne facture aucune prestation SAP elle-même**, et que sa commission est payée par l'AE ou correspond à un service de plateforme distinct.

### 1.2 Quand la plateforme bascule-t-elle ?

| Signal | Bascule vers | Conséquence |
|---|---|---|
| La plateforme **facture la prestation à la famille en son nom propre**, recrute, affecte et remplace l'intervenant, ou garantit la continuité de service | **Prestataire** | Elle est soumise à déclaration, agrément ou autorisation selon l'activité. Avec des AE dans ce schéma, cumul avec le risque de requalification en salariat |
| Elle sélectionne, recrute, rédige le contrat de travail, établit les bulletins ou les déclarations CESU **pour la famille employeur** | **Mandataire** | **Agrément** requis pour les publics PA/PH (personnes âgées, personnes handicapées, pathologies chroniques) |
| Elle met en relation des familles avec des **salariés** (pas des AE) sans plus | **Placement** | Libre, mais **aucun frais ne peut être facturé au travailleur** (L5321-3 C. trav.). Les frais facturés à l'employeur sont permis |
| Elle se contente d'héberger des profils d'AE, de fournir la messagerie, l'agenda, le paiement via un PSP agréé et un outil de facturation **au nom et pour le compte de l'AE** | Intermédiaire / opérateur de plateforme | Pas de régime SAP propre. En revanche : L111-7 C. conso, DSA, P2B, DAC7, précompte URSSAF, directive 2024/2831 |

**Point d'alerte politique** : plusieurs amendements au PLF et au PLFSS 2026 visaient à **exclure de l'Avance immédiate les prestations passant par des plateformes de mise en relation avec des micro-entrepreneurs**, et à encadrer la « captation » du crédit d'impôt par les intermédiaires. Ils n'ont, à notre connaissance, **pas été adoptés**, et la FESP indique que le crédit d'impôt SAP a été maintenu intact (taux de 50 %, plafond de 12 000 €) dans la loi de finances 2026. **Le sujet reviendra dans les PLF et PLFSS 2027.** Il faut le traiter comme un **risque réglementaire majeur** sur la voie A. Sources : [AN amendement AS1102 PLFSS](https://www.assemblee-nationale.fr/dyn/17/amendements/0325/CION-SOC/AS1102.pdf), [AN amendement 1387](https://www.assemblee-nationale.fr/dyn/17/amendements/0325/AN/1387.pdf), [AN amendement I-1142 PLF 2026](https://www.assemblee-nationale.fr/dyn/17/amendements/1906A/AN/1142.pdf), [FESP – victoires PLF 2026](https://www.fesp.fr/credit-dimpot-sap-portage-de-repas-credit-dimpot-famille-les-victoires-de-la-fesp-a-loccasion-du-plf-2026/), [Journal de l'économie](https://www.journaldeleconomie.fr/?p=44041).

### 1.3 Les activités SAP (art. D7231-1 C. trav.) et leur régime

Source de base : article D7231-1 C. trav. (version issue du décret n° 2016-750 du 6 juin 2016) et article L7232-1 C. trav. ; [code.travail.gouv.fr/D7231-1](https://code.travail.gouv.fr/code-du-travail/d7231-1) ; [Bpifrance Création – SAP](https://bpifrance-creation.fr/activites-reglementees/services-a-personne) ; [Banque des territoires – décret 2016-750](https://www.banquedesterritoires.fr/dernier-decret-dapplication-pour-le-volet-aide-domicile-de-la-loi-vieillissement). **[À VÉRIFIER sur Légifrance : le libellé exact et la numérotation des items. L'administration en compte 26, notre reconstitution en donne 27, voir la note sous le tableau.]**

**Légende**
- **D** : simple déclaration (facultative, mais elle ouvre le crédit d'impôt et la TVA réduite).
- **AG** : agrément de l'État (DREETS, DEETS en Outre-mer).
- **AU** : autorisation du conseil départemental (CTM, CTG) au titre du CASF.
- **OG** : activité exercée hors du domicile, éligible au crédit d'impôt seulement si elle fait partie d'une **offre globale** incluant des prestations au domicile.

| # | Activité | Régime | Pertinence pour le projet |
|---|---|---|---|
| 1 | Entretien de la maison et travaux ménagers | D | Moyenne (complément) |
| 2 | Petits travaux de jardinage | D | Faible |
| 3 | Petit bricolage « homme toutes mains » | D | Moyenne |
| 4 | Garde d'enfants de plus de 3 ans à domicile | D | Hors périmètre |
| 5 | Soutien scolaire et cours à domicile | D | Hors périmètre |
| 6 | Soins d'esthétique à domicile pour les personnes dépendantes | D | Faible |
| 7 | **Préparation de repas à domicile, y compris le temps passé aux commissions** | D | **Forte** : couvre une grande partie du besoin « courses + repas » |
| 8 | Livraison de repas à domicile | D (OG) | Moyenne |
| 9 | Collecte et livraison de linge repassé | D (OG) | Faible |
| 10 | **Livraison de courses à domicile** | D (OG) | **Forte** |
| 11 | **Assistance informatique à domicile** | D | **Forte** (fracture numérique) |
| 12 | Soins et promenades d'animaux de compagnie de personnes dépendantes | D | Moyenne |
| 13 | Maintenance et vigilance temporaires de la résidence | D | Faible |
| 14 | **Assistance administrative à domicile** | D | **Forte**. Attention : elle doit être réalisée *au domicile*. L'aide à distance n'est pas éligible |
| 15 | Accompagnement d'enfants de plus de 3 ans hors du domicile | D (OG) | Hors périmètre |
| 16 | Téléassistance et visio-assistance | D | **Intéressante** (brique produit) |
| 17 | Interprète en langue des signes, technicien de l'écrit, codeur LPC | D | Niche |
| 18 | Conduite du véhicule personnel de personnes en **invalidité temporaire** | D (OG) | Moyenne |
| 19 | Accompagnement de personnes en **invalidité temporaire** hors du domicile | D (OG) | Moyenne (sortie d'hospitalisation) |
| 20 | Assistance à domicile aux personnes qui ont **temporairement** besoin d'une aide personnelle (hors soins) | D | Moyenne (convalescence) |
| 21 | Garde-malade, à l'exclusion des soins | D **[À VÉRIFIER : la DEETS peut requalifier en n° 25 si la personne est âgée ou dépendante de façon durable]** | Zone grise |
| 22 | Aide à la mobilité et transport de personnes ayant des difficultés de déplacement | D (OG) | Moyenne |
| 23 | Garde d'enfants de moins de 3 ans (ou de moins de 18 ans handicapés) à domicile | AG | Exclu |
| 24 | Accompagnement de ces enfants hors du domicile | AG | Exclu |
| 25 | **Assistance dans les actes quotidiens de la vie ou aide à l'insertion sociale de personnes âgées, handicapées ou atteintes de pathologies chroniques** (hors actes de soins) | **AG** en mandataire / **AU** en prestataire | **Cœur du besoin** (compagnie, présence, stimulation, aide au lever ou au repas) |
| 26 | **Conduite du véhicule personnel** de ces mêmes personnes (domicile vers travail, vacances, démarches) | **AG / AU** (OG) | Forte |
| 27 | **Accompagnement de ces mêmes personnes dans leurs déplacements hors du domicile** (promenades, aide à la mobilité et au transport, actes de la vie courante) | **AG / AU** (OG) | **Cœur du besoin** (rendez-vous médicaux, sorties) |

*Note sur le décompte* : l'administration présente « 26 activités ». Notre reconstitution en compte 27, car certains intitulés sont fusionnés ou scindés selon les présentations (soutien scolaire et cours, aide à la mobilité). Le décompte n'a pas d'incidence juridique. Ce qui compte, c'est le **régime** de chaque activité.

**À retenir**
- La **compagnie** n'existe pas comme activité autonome. Auprès d'une personne âgée ou handicapée, elle relève du n° 25 (« aide à l'insertion sociale »), donc d'un **régime d'agrément ou d'autorisation**.
- L'**accompagnement aux rendez-vous** d'une personne âgée relève du n° 27 (**AG/AU**). Il ne relève du n° 19 (déclaration) que pour une invalidité *temporaire*, par exemple une sortie d'hôpital ou une fracture.
- Les **courses** relèvent du n° 7 (préparation de repas avec commissions, à domicile) ou du n° 10 (livraison, OG). L'accompagnement *physique* de la personne âgée faire ses courses relève du n° 27.
- **Sanction** de l'exercice sans autorisation d'une activité relevant du CASF : sanctions pénales (art. L313-22 CASF), fermeture, retrait de la déclaration SAP, reprise du crédit d'impôt chez les clients. **[À VÉRIFIER : quantum exact]**

### 1.4 Les trois niveaux de régulation et ce qu'ils impliquent concrètement

| | Déclaration (NOVA) | Agrément (DEETS) | Autorisation (département, CTM, CTG) |
|---|---|---|---|
| Accessible à un AE | **Oui**, gratuit, en ligne | Théoriquement oui, en pratique non (cahier des charges qualité, locaux, procédures) | **Non** en pratique (SAD : cahier des charges national, encadrement, continuité de service) |
| Délai | Quelques jours | 3 mois (accord tacite, sauf avis du département) | Variable, avec un pouvoir d'appréciation du département |
| Durée | Illimitée (suivi trimestriel de l'activité) | 5 ans | 15 ans, avec évaluation |
| Pour la plateforme | Utile si elle facture elle-même des SAP | **Cible de la phase 1** (mandataire PA/PH) | **Cible de la phase 2** (SAD), ou partenariat ou rachat d'un SAAD existant |

Réforme des **services autonomie à domicile (SAD)** : la LFSS 2022 et le décret n° 2023-608 fusionnent SAAD et SSIAD en SAD, avec un cahier des charges national. Les SAAD existants ont dû se mettre en conformité en 2025. **[À VÉRIFIER : calendrier exact, existence d'une procédure d'appel à projets ou d'un moratoire dans chaque DROM ciblé]**

---

## 2. L'enjeu crucial : crédit d'impôt de 50 % et Avance immédiate

### 2.1 Le droit applicable (art. 199 sexdecies CGI)

- **Crédit d'impôt de 50 %** des dépenses de SAP rendus à la résidence (ou à celle d'un ascendant), plafonnées à **12 000 € par an** (majorations possibles jusqu'à 15 000 €, et **20 000 €** si un membre du foyer est titulaire d'une carte d'invalidité ou d'une CMI mention « invalidité »). Il est maintenu à l'identique en 2026. Sources : [fiscaloo 2026](https://www.fiscaloo.fr/12154-credit-dimpot-service-a-la-personne/), [FESP PLF 2026](https://www.fesp.fr/projet-de-loi-de-finances-pour-2026/), [AN question écrite (plafonds)](https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE35123.pdf).
- **Conditions côté prestataire** : être un organisme **déclaré** (art. L7232-1-1 C. trav.) pour l'activité facturée, et exercer dans les conditions de l'activité (au domicile, ou en offre globale).
- **Condition d'activité exclusive (CAE)** : depuis le **1er janvier 2025**, les micro-entrepreneurs et les entreprises de moins de 11 salariés en sont **dispensés** (décret de juillet 2024), sous réserve d'une **comptabilité séparée**. Une source secondaire mentionne un plafond de 30 % du chiffre d'affaires pour les activités non SAP. **[À VÉRIFIER dans le fascicule DGE 2026]** Sources : [Fascicule DGE 2026 – aménagement CAE](https://www.servicesalapersonne.gouv.fr/files/sap/files/documents/2026/fascicule-amenagement-CAE-micro-entrepreneurs-petites-entreprises.pdf), [FAQ DGE dispense CAE](https://www.servicesalapersonne.gouv.fr/files/sap/files/documents/2025/faq-osp-amenagement-dispense-cae.pdf), [lefreelance.fr](https://lefreelance.fr/articles/services-a-la-personne-micro-entreprise/).
- **Obligations de l'AE déclaré** : déclaration NOVA, **états d'activité trimestriels** sur NOVA, **attestation fiscale annuelle** remise au client, factures conformes (mentions SAP, numéro de déclaration, durée, taux horaire). À défaut de suivi NOVA, la déclaration peut être retirée et les clients **perdent** le crédit d'impôt.
- **Contrôle renforcé** : depuis la déclaration de revenus 2025, une **case dédiée (7DB)** demande au contribuable de préciser le mode (emploi direct, organisme, mandataire). La DGFiP et l'URSSAF croisent ces données. Une fraude à l'Avance immédiate de 3 M€ a été détectée. Sources : [consoglobe – case 7DB](https://www.consoglobe.com/declaration-de-revenus-2025-connaissez-vous-cette-nouvelle-obligation-cg), [Aladom – fraude 3 M€](https://www.aladom.fr/actualites/secteur-service/9916/lurssaf-annonce-avoir-detecte-une-fraude-au-credit-dimpots-de-3-millions-deuros/), [Europe 1 – Bercy et le crédit d'impôt SAP](https://www.europe1.fr/economie/plfss-et-fraude-le-ministere-de-leconomie-sattaque-au-credit-dimpot-pour-les-services-a-la-personne-4211793).

### 2.2 Un AE déclaré SAP peut-il faire bénéficier la famille du crédit d'impôt ?

**Oui**, si les conditions suivantes sont toutes remplies :
1. L'AE est **déclaré sur NOVA** pour l'activité exacte facturée.
2. L'activité relève de la **déclaration simple** (§ 1.3). Ce n'est pas le cas des n° 25 à 27 auprès d'un public PA/PH.
3. La prestation est rendue **au domicile** du bénéficiaire, ou en **offre globale** pour les activités hors domicile.
4. Le **bénéficiaire fiscal** est le foyer qui paie : la personne aidée, ou l'enfant qui paie pour son parent. Pour un ascendant, la dépense est éligible si elle est rendue à la résidence de l'ascendant **et** supportée par le contribuable. **[À VÉRIFIER : BOI-IR-RICI-150-10 sur la résidence de l'ascendant et l'articulation avec la déduction de pension alimentaire]**
5. La facture est émise **par l'AE, à son nom**. La plateforme peut l'émettre **au nom et pour le compte** de l'AE (mandat de facturation, art. 289 I-2 CGI).

**Le piège de la commission** : si la plateforme facture à la famille des **frais de service séparés**, ces frais **ne sont pas éligibles** au crédit d'impôt, car la plateforme n'est pas un organisme SAP qui rend la prestation. **Recommandation** : un **prix unique TTC affiché par l'AE**, la commission étant **prélevée auprès de l'AE** (facture de la plateforme à l'AE). Toute la dépense de la famille est alors éligible. **[À VÉRIFIER par rescrit : éligibilité d'éventuels frais d'inscription ou de dossier facturés par un intermédiaire non déclaré]**

### 2.3 L'Avance immédiate (AICI) : fonctionnement et intégration plateforme

**Fonctionnement** (service gratuit de l'URSSAF, généralisé depuis 2022) :
1. Le prestataire, ou son tiers habilité, **inscrit le client** auprès de l'URSSAF. L'URSSAF vérifie l'identité fiscale du client auprès de la DGFiP. Le client doit avoir un compte bancaire en France et avoir déjà fait au moins une déclaration de revenus.
2. Après la prestation, le prestataire **transmet la demande de paiement** (la facture).
3. Le client **valide** dans son espace particulier (48 h, sinon validation tacite). L'URSSAF **prélève 50 %** sur son compte et **verse 100 %** au prestataire.

Deux API URSSAF existent : **API Tiers de prestation** (pour les organismes prestataires et intermédiaires) et **API Tierce déclaration CESU** (pour les mandataires et l'emploi direct). L'habilitation passe par un dossier sur demarche.numerique.gouv.fr (contact : habilitation-api@urssaf.fr). Plusieurs logiciels de facturation pour AE sont déjà habilités (Abby, Evoliz, Sinao, VosFactures, Axonaut, Avance Immédiate Services…). Sources : [data.gouv – API Tiers de prestation](https://www.data.gouv.fr/dataservices/api-tiers-de-prestation/discussions), [Démarche habilitation](https://demarche.numerique.gouv.fr/commencer/api-tiers-de-prestations/dossier_vide), [transformation.gouv – Avance immédiate](https://www.plus.transformation.gouv.fr/experiences/5941483_avance-immediate), [Abby – AICI SAP](https://abby.fr/blog/avance-immediate-sap/), [legifiscal – fiche pratique](https://www.legifiscal.fr/impots-personnels/impot-revenu/reductions-impot/avance-immediate-credit-impot-service-personne.html), [facturation.pro – utiliser l'API](https://support.facturation.pro/hc/fr/articles/6507500947090-Comment-utiliser-l-API-tiers-prestation).

**Une plateforme peut-elle intégrer l'Avance immédiate ? Oui, techniquement et juridiquement**, de deux façons :
- **Option 1, éditeur habilité** : la plateforme demande l'habilitation API Tiers de prestation en qualité d'**éditeur ou intermédiaire** et transmet les demandes **au nom de chaque AE déclaré** (chaque AE reste « prestataire » avec son SIRET et son numéro NOVA). C'est **la cible**.
- **Option 2, logiciel tiers (MVP)** : chaque AE utilise un logiciel déjà habilité (Abby, Avance Immédiate Services…). La plateforme l'**accompagne** dans l'onboarding. Pas de développement, mais une expérience moins fluide.

**Conséquences de conception à anticiper**
- **Le flux d'argent passe par l'URSSAF**, pas par la plateforme : l'URSSAF verse 100 % directement à l'AE. La commission ne peut donc **pas être retenue à la source**. Il faut la **facturer à l'AE** (prélèvement SEPA mensuel via le PSP) ou passer par un compte de cantonnement PSP. **[À VÉRIFIER : l'URSSAF accepte-t-elle de verser sur un IBAN de wallet PSP au nom de l'AE ? Cela permettrait une commission « à la source » sans manipuler soi-même les fonds]**
- **APA et PCH** : les bénéficiaires d'APA ou de PCH sont **exclus de l'Avance immédiate SAP** (le report de leur intégration au **1er juillet 2027** est annoncé). Ils gardent le crédit d'impôt classique, l'année suivante. Source : [Unipros mode d'emploi 2026](https://unipros.coop/wp-content/uploads/2026/01/Unipros_Mode-d-emploi_2026_web.pdf), [AN QE 8357](https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE8357.pdf).
- **Risque politique** : les amendements visant à **exclure l'AICI pour les prestations « plateforme + micro-entrepreneurs »** (§ 1.2) visent exactement ce schéma. Il faut **ne pas bâtir 100 % du business model sur la voie A**.

### 2.4 Voie B : l'emploi direct via CESU+, souvent le meilleur argument

Pour la compagnie et l'accompagnement de personnes âgées, le canal **légal et le plus avantageux** est l'**emploi direct** : la personne aidée (ou son enfant) est **particulier employeur**.
- **Crédit d'impôt de 50 %** sur salaire et cotisations, avec **Avance immédiate intégrée au service CESU+** de l'URSSAF (« Mon avantage fiscal »).
- **Exonération de cotisations patronales** pour les employeurs de **70 ans et plus**, ou titulaires de l'APA, de la PCH, d'une carte d'invalidité… (art. L241-10 CSS) **[À VÉRIFIER : conditions exactes]**
- **APA et PCH utilisables** en emploi direct (et en CESU préfinancé dans certains départements). Sources : [plaquettes APA départementales, ex. Orne](https://orne.fr/sites/default/files/2024-06/3%20volets%20mode%20emploi%20APA.pdf), [AN QE 57121 – CESU et APA](https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE57121.pdf).
- **Aucun flux financier pour la plateforme** (CESU+ prélève et paie), donc aucun sujet d'établissement de paiement.
- **Inconvénient** : la famille est employeur (convention collective IDCC 3239, congés, rupture). C'est **précisément la valeur qu'un mandataire agréé (phase 1) vend** : frais de gestion, eux aussi éligibles au crédit d'impôt.

**Exemple chiffré (ordre de grandeur, à affiner par l'équipe finance)**

| | Voie A (AE déclaré, assistance administrative, 25 €/h) | Voie B (emploi direct CESU+, compagnie, ~13 €/h net) |
|---|---|---|
| Coût brut pour la famille | 25 €/h | Salaire et cotisations, réduits par l'exonération patronale si 70 ans et plus |
| Après Avance immédiate (50 %) | **12,50 €/h** | **~50 % du coût employeur, immédiatement** |
| APA mobilisable | Non | Oui |
| Revenu plateforme | Commission de 12 à 20 % facturée à l'AE | Abonnement famille, frais de placement employeur, puis frais de gestion mandataire (éligibles à 50 %) |

---

## 3. Risque de requalification en salariat et directive 2024/2831

### 3.1 Jurisprudence française
- **Cass. soc., 28 nov. 2018, n° 17-20.079 (Take Eat Easy)** : la subordination est caractérisée par la **géolocalisation en temps réel** et un **système de sanctions** (pénalités, désactivation). Sources : [Le Petit Juriste](https://www.lepetitjuriste.fr/take-eat-easy-voie-de-requalification-ouverte-cour-de-cassation/), [Blog du modérateur](https://www.blogdumoderateur.com/uberisation-salarie-un-livreur/).
- **Cass. soc., 4 mars 2020, n° 19-13.316 (Uber)** : le chauffeur ne constitue pas sa clientèle, ne fixe pas librement ses tarifs, reçoit des directives et subit un pouvoir de sanction (déconnexion, perte d'accès). Le statut d'indépendant est **fictif**. Sources : [Eurojuris – Arrêt Uber](https://www.eurojuris.fr/contrat-de-travail/articles/arret-uber-enseignements-plateformes-39109.htm), [CMS – arrêt contraire de 2022](https://cms.law/en/fra/legal-updates/requalification-en-contrat-de-travail-de-la-relation-entre-chauffeurs-de-vtc-et-plateforme-la-cour-de-cassation-dit-non-pour-cette-fois).
- **Conséquences d'une requalification** : rappels de salaires, cotisations URSSAF sur 3 ans, **travail dissimulé** (pénal, solidarité financière), et requalification en cascade par l'URSSAF ou l'inspection du travail.
- **Risque spécifique au secteur** : avec une personne âgée, l'intervenant reçoit forcément des consignes (horaires, habitudes, sécurité). Ces consignes doivent venir **de la famille** et non de la plateforme. Sinon, c'est la plateforme qui apparaît comme le donneur d'ordre et l'employeur.
- **Responsabilité sociale des plateformes** (art. L7341-1 et suivants C. trav.) : dès que la plateforme **détermine les caractéristiques de la prestation ou fixe son prix**, elle doit notamment prendre en charge l'assurance accident du travail (dans la limite d'un plafond), la formation professionnelle et la VAE. Cela n'emporte pas présomption de salariat mais constitue un indice. **[À VÉRIFIER : champ exact de L7342-1]**

### 3.2 Directive (UE) 2024/2831 du 23 octobre 2024 (travail via plateforme)
- **Transposition au plus tard le 2 décembre 2026.** En septembre 2026, **aucun projet de loi de transposition n'avait été présenté en Conseil des ministres** (question écrite AN n° 14781, proposition de résolution AN). Une transposition tardive est probable, ce qui n'exclut pas l'invocabilité de certaines dispositions ni l'interprétation conforme par les juges. Sources : [AN QE 14781](https://questions.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE14781), [AN proposition de résolution 3187](https://www.assemblee-nationale.fr/dyn/17/textes/l17b3187_proposition-resolution.pdf), [OEIL – résumé](https://oeil.europarl.europa.eu/oeil/fr/document-summary?id=1794723).
- **Présomption réfragable de relation de travail** (art. 5) lorsque des **faits indiquent un contrôle et une direction** selon le droit national. La charge de la preuve contraire pèse sur la plateforme.
- **Chapitre III, gestion algorithmique, applicable à TOUTES les personnes exécutant un travail via plateforme, y compris les vrais indépendants** :
  - interdiction de traiter l'état émotionnel ou psychologique, les conversations privées, les données collectées hors des périodes de travail, les données biométriques d'identification, ou de prédire l'exercice de droits syndicaux ;
  - **information** sur les systèmes automatisés de surveillance et de décision ;
  - **surveillance humaine** des décisions automatisées ;
  - **droit à explication et à réexamen humain** de toute décision significative, notamment la **restriction, la suspension ou la désactivation de compte** ;
  - **AIPD obligatoire** sur ces traitements (art. 8) ;
  - **canaux de communication** entre travailleurs de la plateforme.
- **Règlement IA (UE) 2024/1689** : les systèmes d'IA servant à **attribuer des tâches** sur la base du comportement ou à **évaluer la performance** de travailleurs relèvent de l'**Annexe III point 4 (haut risque)**. Les obligations s'appliquent à partir d'août 2026, avec un report possible via l'« omnibus numérique ». **[À VÉRIFIER : calendrier effectif]** Il faut éviter l'IA décisionnelle sur l'attribution et la notation.

### 3.3 Règles de conception produit (non négociables)

| Domaine | À FAIRE | À NE PAS FAIRE |
|---|---|---|
| **Prix** | L'AE **fixe son tarif** (fourchette indicative affichée, avec le prix médian local en information) | Prix imposé, bonus ou malus tarifaire, « surge pricing » |
| **Acceptation** | L'AE accepte ou refuse **librement**, sans incidence sur sa visibilité | Taux d'acceptation minimum, pénalité de refus, attribution automatique imposée |
| **Organisation** | Horaires, modalités et consignes **définis entre la famille et l'AE** | Planning imposé par la plateforme, protocole d'intervention obligatoire, tenue imposée |
| **Contrôle** | Check-in et check-out **déclaratifs** à l'initiative de l'AE (utile pour la facture et l'AICI) | Géolocalisation continue, suivi en temps réel, captures d'écran |
| **Notation** | Avis **informatifs** des familles, publiés selon L111-7-2 C. conso (vérification et ordre de publication indiqués) | Notation servant de base à des sanctions automatiques, classement opaque fondé sur des métriques de performance |
| **Désactivation** | Seulement pour des **motifs objectifs listés dans les CGU** (sécurité, fraude, perte de la déclaration SAP, condamnation). **Décision motivée, réexamen humain, voie de recours** (P2B et directive) | Désactivation automatique sur la note ou sur l'inactivité |
| **Exclusivité** | **Aucune exclusivité.** L'AE garde sa clientèle propre et travaille sur d'autres plateformes | Clause d'exclusivité, non-concurrence, anti-contournement disproportionnée (préférer une **commission de sortie** raisonnable et limitée dans le temps) |
| **Formation** | Offerte, **facultative**. Prérequis d'entrée objectifs (B3, assurance, déclaration) | Formation obligatoire conditionnant l'accès aux missions, « certification maison » imposée |
| **Image** | L'AE présente **sa propre** entreprise (profil, SIRET, nom commercial) | Les présenter comme « nos accompagnants » ou « notre équipe » |
| **Facturation** | Facture **au nom de l'AE**, mandat de facturation explicite | Facture de la plateforme à la famille pour la prestation |

---

## 4. Obligations de la plateforme

### 4.1 Code de la consommation
- **Art. L111-7 et D111-7 et suivants (loyauté des plateformes)** : informer clairement sur la **qualité de l'offreur** (professionnel ou non), les **critères de classement et de référencement**, l'existence d'une **rémunération ou d'un lien capitalistique** influençant le classement, les droits et obligations des parties, la **responsabilité** de chacun.
- **Art. L111-7-2 (avis en ligne)** : indiquer si les avis sont vérifiés et comment, leur ordre de publication, l'absence de contrepartie.
- **Contrats à distance et hors établissement** (L221-1 et suivants) : **droit de rétractation de 14 jours**, avec exécution anticipée sur demande expresse (L221-25 et L221-28). Les règles du démarchage à domicile s'appliquent si l'AE « vend » à domicile.
- **Abus de faiblesse** (L121-8 C. conso, art. 223-15-2 C. pén.) : voir § 6.
- **Médiation de la consommation** (L612-1 et suivants) : obligatoire pour tout professionnel B2C. La plateforme doit **adhérer à un médiateur** pour ses propres services (abonnements familles) et, en pratique, **négocier une adhésion collective pour les AE**, ce qui constitue aussi un argument d'attractivité.
- **Accessibilité (directive (UE) 2019/882, en vigueur depuis le 28 juin 2025)** : les services de commerce électronique B2C doivent être accessibles. Les microentreprises (moins de 10 salariés et 2 M€) sont exemptées pour les services, mais **le public cible l'impose de fait**. Visez le RGAA et le niveau WCAG 2.1 AA.

### 4.2 DSA (règlement (UE) 2022/2065)
La plateforme est un service d'hébergement et une **plateforme en ligne** (diffusion publique des profils). Elle est **micro ou petite entreprise** (moins de 50 salariés et moins de 10 M€ de CA) : elle est **exemptée** des obligations des sections 3 et 4 (rapports de transparence, traçabilité renforcée des professionnels de l'art. 30, conception d'interface…), **sauf pour l'obligation de déclarer son nombre d'utilisateurs actifs**.
Restent applicables : **points de contact** (art. 11-12), **CGU claires** incluant la modération (art. 14), **mécanisme de notification et d'action** (art. 16), **exposé des motifs** en cas de restriction (art. 17), notification des infractions pénales menaçant la vie ou la sécurité (art. 18). Il est recommandé d'appliquer **volontairement** l'art. 30 (vérification de l'identité et du SIRET des AE), qui sera de toute façon nécessaire pour DAC7 et le précompte.

### 4.3 Règlement P2B (UE) 2019/1150
Les AE sont des « entreprises utilisatrices ». Obligations :
- CGU claires et disponibles ;
- **préavis de 15 jours** pour toute modification ;
- **exposé des motifs** avant ou au moment d'une restriction ou suspension ;
- **préavis de 30 jours** pour une résiliation (sauf manquement grave ou obligation légale) ;
- transparence sur les **paramètres de classement** et sur l'accès aux données ;
- désignation de **médiateurs**.
Le système interne de traitement des plaintes est exigé sauf pour les petites entreprises.

### 4.4 Fiscal : DAC7 et information des utilisateurs
- **DAC7** (directive (UE) 2021/514, art. 1649 ter A et suivants CGI) : la plateforme **collecte et vérifie** (nom, adresse, date de naissance, NIF ou SIRET, IBAN, numéro TVA) et **déclare chaque année avant le 31 janvier** les revenus de chaque prestataire de **services personnels**. Le seuil d'exclusion (moins de 30 transactions et moins de 2 000 €) **ne vaut que pour la vente de biens**. Pour les services, **tous les prestataires actifs sont déclarés**. La plateforme doit aussi **communiquer l'information à chaque AE**. Depuis la LFSS 2026, ces données sont transmises à l'ACOSS (URSSAF) **dans un délai d'un mois**. Sources : [CMS – DAC7](https://cms.law/fr/fra/a-la-une/dac-7-le-renforcement-de-la-cooperation-fiscale-pour-les-plateformes-numeriques), [BOFiP – obligations des opérateurs de plateforme](https://bofip.impots.gouv.fr/bofip/14086-PGP.html/identifiant=BOI-INT-AEA-30-50-20231213), [AN – amendements LFSS 2026](https://www.assemblee-nationale.fr/dyn/17/amendements/1907/AN/1178.pdf). **[À VÉRIFIER : montant des amendes en cas de manquement]**
- **Information fiscale et sociale à chaque transaction** (art. 242 bis CGI) : obligation d'information loyale sur les obligations fiscales et sociales des utilisateurs. **[À VÉRIFIER : articulation actuelle avec DAC7]**
- **Facturation électronique** : réception obligatoire depuis le 1er septembre 2026. Émission et e-reporting au 1er septembre 2027 pour les PME et micro-entreprises. Cela concerne les factures de commission plateforme vers AE (B2B) et l'e-reporting des opérations B2C.

### 4.5 Social : obligations URSSAF des plateformes
- **Art. L613-6 CSS** : la plateforme peut, sur mandat, effectuer pour l'AE les formalités de création et les déclarations.
- **Art. L613-6-1 CSS (LFSS 2024, modifié)** : **précompte obligatoire** des cotisations et contributions sociales (et, sur option, du versement libératoire de l'impôt) par les plateformes pour les micro-entrepreneurs, **sur le chiffre d'affaires réalisé à partir du 1er janvier 2027**. **Phase pilote depuis le 1er octobre 2026** avec des plateformes volontaires, dont **Wecasa**, qui est dans le secteur des SAP. Sanction : jusqu'à 7 500 € par prestataire concerné. Sources : [Bpifrance Création](https://bpifrance-creation.fr/entrepreneur/actualites/micro-entrepreneurs-prelevement-a-source-plateformes), [Propulse by CA](https://propulsebyca.fr/micro-entrepreneur/precompte-cotisations), [lefreelance.fr](https://lefreelance.fr/articles/precompte-urssaf-plateformes-micro-entrepreneurs/), [Legifiscal](https://www.legifiscal.fr/actualites-fiscales/4150-prelevement-cotisations-auto-entrepreneurs-plateformes-numeriques-depot-dossier-30-juin-2025.html).
- **Conséquence majeure pour l'architecture** : le précompte suppose que la plateforme **voie passer le chiffre d'affaires**. Or, avec l'Avance immédiate, l'URSSAF paie directement l'AE. **[À VÉRIFIER auprès de l'URSSAF : traitement du CA encaissé via l'AICI ; il est probable que l'URSSAF le connaisse déjà, mais aucune règle explicite n'a été trouvée]** Il faut **candidater tôt** auprès de l'URSSAF pour être accompagné : c'est aussi un **signal de conformité** utile auprès des financeurs.
- **Obligation de vigilance** (L8222-1 C. trav.) : elle pèse sur le donneur d'ordre (la famille, au-delà de 5 000 €). La plateforme doit **vérifier l'immatriculation** (SIRET actif, attestation URSSAF) pour éviter toute complicité de travail dissimulé.

### 4.6 CGU et CGV : architecture contractuelle recommandée
1. **CGU plateforme** (tous utilisateurs) : rôle d'intermédiaire, modération (DSA), avis, données, sécurité, signalements.
2. **Conditions « Accompagnant »** (B2B, P2B) : indépendance, tarifs libres, commission, mandat de facturation, mandat AICI, KYC (DAC7 et précompte), motifs et procédure de désactivation, charte éthique (dons, procurations, moyens de paiement).
3. **Conditions « Famille »** (B2C) : abonnement, rétractation, médiation, absence de garantie de résultat, **qualité du payeur ou du bénéficiaire et représentation de la personne aidée**.
4. **Modèle de contrat de prestation AE ↔ famille**, fourni par la plateforme sans être imposé : mentions SAP et conditions du crédit d'impôt.
5. **Voie B** : modèle de contrat de travail conforme à l'IDCC 3239 et guide de l'employeur CESU+.

---

## 5. RGPD et données de santé

### 5.1 Qualification
- Une mention comme « Alzheimer », « hémiplégie », « GIR 2 » ou « diabétique » est une **donnée de santé** (art. 9 RGPD), même saisie en texte libre par la famille. Le simple fait que la personne soit « handicapée » est déjà une donnée de santé.
- **Base légale** : le **consentement explicite** (art. 9.2.a), recueilli auprès de **la personne concernée elle-même** si elle est en capacité. À défaut, l'art. 9.2.c (intérêts vitaux) est trop étroit pour un usage courant. Il faut donc **minimiser** : ne collecter que les **besoins fonctionnels** (« besoin d'aide pour se déplacer », « troubles de la mémoire : oui ou non, à préciser oralement »).
- **Information de la personne aidée** (art. 14) lorsque c'est la famille qui fournit ses données : notice adaptée et lisible (FALC).

### 5.2 Faut-il un hébergeur certifié HDS ?
- L'art. L1111-8 CSP impose un **hébergeur certifié HDS** pour les données de santé « recueillies à l'occasion d'activités de **prévention, de diagnostic, de soins ou de suivi social et médico-social** », lorsqu'elles sont hébergées **pour le compte** du responsable de traitement par un tiers. Le référentiel HDS v2 est pleinement en vigueur en 2026, et le décret du 24 mars 2026 impose des exigences de souveraineté applicables à partir de septembre 2026. Sources : [ANS – référentiel HDS](https://esante.gouv.fr/espace-presse/publication-au-journal-officiel-du-referentiel-de-certification-hds-souverainete-des-donnees-et-ameliorations-du-referentiel), [PrivacyWorld – HDS v2](https://www.privacyworld.blog/2026/05/v2-0-certification-of-french-health-data-hosting-service-providers-hds-now-fully-effective/), [Legiscope – HDS](https://www.legiscope.com/blog/hds-hebergeur-donnees-sante-certification.html).
- **Analyse** :
  - La voie A (administratif, courses) n'est **probablement pas** un « suivi social et médico-social ».
  - La voie B en mode mandataire ou SAD (aide aux actes de la vie quotidienne, plan d'aide APA, transmissions) **l'est très probablement**.
  - **Recommandation** : **héberger d'emblée chez un cloud certifié HDS** (OVHcloud, Scaleway, Outscale, ou AWS, Azure et GCP qui sont certifiés HDS, en privilégiant un hébergeur européen pour la souveraineté). Le surcoût est faible et cela **lève le doute** pour les partenariats avec les départements et l'ARS.
- **MVP manuel (Tally, Airtable, WhatsApp)** : **non conforme** si des données de santé y circulent. Ces outils sont hébergés aux États-Unis, ne sont pas HDS, et WhatsApp est inadapté. Règle du MVP : **aucune donnée de santé écrite** dans ces outils (champ « besoins » à choix fermés et non médical), le reste se traite par téléphone. Passer à un outil HDS dès que la voie B démarre. **[À VÉRIFIER : certification DPF d'Airtable et de Tally ; DPA signés]**

### 5.3 AIPD
**Obligatoire.** Au moins trois critères du CEPD sont réunis : personnes **vulnérables**, données **sensibles**, **évaluation ou notation** des intervenants, et **usage innovant**. La directive 2024/2831 (art. 8) l'exige en outre pour la gestion algorithmique. Sources : [CNIL – liste des traitements soumis à AIPD](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf), [CNIL – infographie AIPD](https://www.CNIL.fr/sites/cnil/files/atoms/files/infographie_aipd.pdf).
**Autres obligations** : désigner un **DPO** (fortement recommandé, potentiellement obligatoire au titre du traitement à grande échelle de données sensibles), tenir un registre, signer des contrats de sous-traitance (art. 28), définir des durées de conservation, prévoir une procédure de violation de données.

### 5.4 Consentement : personne aidée, famille, tutelle et curatelle

| Situation | Qui consent au traitement et au contrat ? |
|---|---|
| Personne capable, même âgée | **Elle-même.** La famille n'a **aucun pouvoir propre**. Il faut recueillir son accord (signature électronique simple ou appel enregistré avec son accord) |
| **Curatelle** | La personne **consent seule** pour ce qui relève de sa personne (art. 459 C. civ.). Le contrat de prestation courant est un acte d'administration qu'elle **peut conclure seule**. Il est prudent d'**informer le curateur** |
| **Tutelle** | Le **tuteur** conclut le contrat. Pour les données personnelles, il faut rechercher l'avis de la personne autant que son état le permet (art. 459). Demander le **jugement** ou une attestation de mesure |
| **Habilitation familiale** (art. 494-1 C. civ.) ou **mandat de protection future** | La personne habilitée agit **dans les limites du jugement ou du mandat**. Il faut en vérifier la copie |
| Simple « procuration » familiale | **Insuffisante** pour consentir à la place de la personne aux données de santé |

**Produit** : un « **profil personne aidée** » distinct du « compte famille », avec une case de statut juridique (autonome, curatelle, tutelle, habilitation) et une pièce justificative.

---

## 6. Protection des personnes vulnérables, honorabilité, responsabilité, assurances

### 6.1 Abus de faiblesse et intégrité
- **Art. 223-15-2 C. pén.** : jusqu'à 3 ans d'emprisonnement et 375 000 € d'amende. **Art. L121-8 C. conso** : abus de faiblesse dans la vente.
- **Art. L116-4 CASF** : il est interdit aux intervenants (salariés, et selon les cas prestataires de services à la personne auprès de personnes âgées ou handicapées) de recevoir des **dons et legs** de la personne aidée. **[À VÉRIFIER : champ exact pour un AE déclaré]**
- **Charte et CGU** : interdiction des **dons**, des **procurations bancaires**, de la détention de la **carte bancaire ou du code**, des **prêts** et des **achats avec l'argent liquide** de la personne sans ticket ; tout cela est sanctionné par la désactivation. Les courses passent par un justificatif photo et un rapprochement.
- **Dispositif de signalement** : référent « bientraitance », numéro national **3977** (maltraitance des personnes âgées et handicapées), **signalement au procureur** (art. 40 CPP, pour les personnes publiques ; obligation morale et contractuelle pour la plateforme).

### 6.2 Vérification d'honorabilité
- **Aujourd'hui** : pour un AE, le seul outil accessible est l'**extrait de casier B3**, demandé gratuitement par l'intéressé lui-même et daté de moins de 3 mois. Le B3 ne mentionne que les condamnations les plus graves : c'est une vérification **minimale**.
- **RGPD** : un acteur privé ne peut pas, en principe, **conserver** de données d'infraction (art. 10 RGPD, art. 46 de la loi Informatique et libertés). Bonne pratique : **consultation sans copie** et enregistrement de la seule mention « B3 vérifié le … ». **[À VÉRIFIER avec l'avocat RGPD]**
- **Attestation d'honorabilité du secteur social et médico-social** : le **décret n° 2026-324 du 28 avril 2026** étend l'attestation (contrôle du B2 et du FIJAIS) aux professionnels et bénévoles des **établissements et services** pour personnes handicapées et personnes âgées, ainsi qu'aux accueillants familiaux et aux mandataires judiciaires à la protection des majeurs. Calendrier :
  - enfants handicapés : depuis le 30 avril 2026 (dans certaines régions) ;
  - **adultes handicapés : premier trimestre 2027** ;
  - **personnes âgées : 1er janvier 2028**.

  Sources : [Solidarités.gouv – attestation d'honorabilité](https://solidarites.gouv.fr/enfance-handicapee-generalisation-de-lattestation-dhonorabilite), [Maison des communes 85](https://www.maisondescommunes85.fr/node/7264), [Maire-info](https://www.maire-info.com/petite-enfance/enfance-le-recours-%EF%BF%BD-l'attestation-d'honorabilite-s'etend-progressivement-article-30433).
  - **Les AE simplement déclarés SAP sont probablement hors champ** (ils ne relèvent pas du CASF), mais **un mandataire agréé ou un SAD y sera soumis**.
  - **Stratégie** : faire de l'honorabilité un **standard volontaire dès le lancement** (B3, entretien vidéo, deux références vérifiées, pièce d'identité avec contrôle de vivacité), puis **demander à être intégré** au dispositif officiel dès la phase 1. C'est un argument de confiance de premier ordre pour les départements et l'ARS. **[À VÉRIFIER : l'accès d'une plateforme non CASF au téléservice d'attestation]**

### 6.3 Responsabilité de la plateforme en cas d'incident (chute, vol, maltraitance)
- **AE** : responsabilité contractuelle et délictuelle personnelle.
- **Plateforme intermédiaire** : responsabilité pour **faute propre** (vérifications annoncées et non réalisées, publicité trompeuse du type « accompagnants certifiés », absence de réaction à des signalements). Plus la plateforme **promet** (« vérifiés », « garantis », « remplacement assuré »), plus elle **assume**, jusqu'à être requalifiée en prestataire.
- **Si requalification** (prestataire ou employeur) : responsabilité du commettant (art. 1242 al. 5 C. civ.) pour les fautes de l'intervenant.
- **Rédaction** : obligation de **moyens** sur les vérifications, décrites précisément et de façon honnête. Pas de clause exonératoire abusive envers le consommateur (L212-1 C. conso).

### 6.4 Assurances

| Assurance | Qui | Commentaire |
|---|---|---|
| **RC exploitation et RC professionnelle de la plateforme** (intermédiation, erreur de mise en relation, défaut de vérification) | Plateforme | Indispensable. Inclure les **cyber-risques** (violation de données de santé) |
| **RC professionnelle de l'AE** | AE | Non légalement obligatoire pour une simple déclaration SAP, mais **condition d'accès** à la plateforme. Couvrir les **dommages aux biens confiés** et la garde d'objets |
| **Contrat groupe négocié** (RC pro, accidents, prévoyance) | Souscrit par la plateforme au profit des AE | Argument d'attractivité. **Attention** : distribuer de l'assurance suppose une **immatriculation ORIAS** (intermédiaire), sauf contrat groupe souscrit par la plateforme ou exemption d'intermédiaire à titre accessoire. Ne pas le rendre obligatoire, ou proposer une alternative, pour ne pas créer d'indice de subordination |
| **Accidents du travail** | AE (assurance volontaire AT de la CGSS) | Si la plateforme fixe les prix : prise en charge de la cotisation au titre de L7342-2 C. trav. |
| **Voie B** | Particulier employeur | AT et maladie couverts par le régime salarié via CESU. Une **RC vie privée** de l'employeur est recommandée |

---

## 7. Spécificités Outre-mer

| Sujet | Guadeloupe | Martinique | Guyane | La Réunion | Mayotte |
|---|---|---|---|---|---|
| Collectivité compétente (APA, PCH, autorisation SAD) | Département (CD 971) | **CTM** (collectivité unique) | **CTG** (collectivité unique) | Département (CD 974) | Département de Mayotte (collectivité unique) |
| État (déclaration et agrément SAP) | DEETS Guadeloupe | DEETS Martinique | DGCOPOP / DEETS Guyane **[À VÉRIFIER]** | DEETS Réunion | DEETS Mayotte |
| ARS | ARS Guadeloupe | ARS Martinique | ARS Guyane | ARS La Réunion | ARS Mayotte (depuis 2020) |
| Sécurité sociale | CGSS | CGSS | CGSS | CGSS | **CSSM** (régime spécifique) |
| TVA | 8,5 % (taux réduit 2,1 %) | 8,5 % / 2,1 % | **TVA non applicable** | 8,5 % / 2,1 % | **TVA non applicable** |
| Crédit d'impôt SAP et AICI | Oui | Oui | Oui | Oui | **[À VÉRIFIER : CESU, AICI et APA à Mayotte]** |

- **Même droit, avec des adaptations** : l'article 73 de la Constitution (identité législative) s'applique. Le Code du travail, le CASF, le CGI (art. 199 sexdecies) et le RGPD s'appliquent dans les cinq DROM. **Mayotte** a des régimes sociaux spécifiques (CSSM, alignement progressif) : **à éviter pour le pilote**.
- **Octroi de mer** : il ne s'applique qu'aux **livraisons de biens** (importations et productions locales). **Il ne s'applique pas aux services** et n'est donc pas pertinent pour le cœur de l'activité. Il concernerait seulement l'importation de matériel (tablettes, boîtiers de téléassistance) si la plateforme en fournit.
- **Micro-entrepreneurs en DROM** : cotisations réduites et progressives les premières années, et abattement fiscal pour les DOM (30 % en Guadeloupe, Martinique et Réunion, plafonné). Le seuil de franchise de TVA est identique, mais un AE en franchise qui facture une commission « TTC » à 8,5 % ne récupère pas la TVA : il faut l'intégrer au calcul de la commission. Sources : [espace-autoentrepreneur – DOM](https://espace-autoentrepreneur.com/ruche/article/auto-entrepreneur-dans-les-dom-tom-les-particularites-du-regime), [calcunet – taux DOM 2026](https://calcunet.fr/articles/auto-entrepreneur-dom-taux-reduits-2026/), [anyti.me – imposition DOM](https://en.anyti.me/fr/fiches-pratiques/imposition-du-micro-entrepreneur-dans-les-dom-qu-est-ce-qui-change/244).
- **Phase 2 (salariés)** : les exonérations **LODEOM** (art. L752-3-2 CSS) s'appliquent aux employeurs des DROM, très favorables pour les entreprises de moins de 11 salariés. C'est un **avantage compétitif net pour un SAD ultramarin**. **[À VÉRIFIER : éligibilité du secteur SAP et articulation avec l'exonération aide à domicile L241-10]**
- **Financements locaux** : programmes FEDER et FSE+ 2021-2027 gérés par la **Région** (Guadeloupe, Réunion), la **CTM**, la **CTG** ou l'État selon le cas. Conférence des financeurs de la prévention de la perte d'autonomie (CFPPA) de chaque département. CNSA. Agrément **ESUS** (entreprise solidaire d'utilité sociale) pour accéder à l'épargne solidaire, à France Active et à Bpifrance.
- **Contexte** : les Antilles vieillissent plus vite que l'Hexagone, avec une forte proportion d'aidants familiaux et d'emploi direct informel. Le besoin et le **risque de travail non déclaré** sont tous deux élevés, ce qui renforce l'intérêt d'une voie B qui « blanchit » l'emploi direct via CESU+. **[Chiffres INSEE à sourcer dans le livrable marché]**
- **Choix du pilote (décision T1, 2026-10-09)** : **Guadeloupe** d'abord, puis Martinique, Guyane et Hexagone. La **Martinique (CTM)** garde l'avantage d'un **interlocuteur unique** pour la phase 2. En Guadeloupe, il y a **deux collectivités** : le Département (APA, PCH, autorisation SAD) et la Région (FEDER, FSE+, aides aux entreprises).

### 7.1 Organismes locaux en Guadeloupe (territoire de lancement)

| Organisme | Rôle pour Koudmen | Démarche |
|---|---|---|
| **DEETS Guadeloupe** (direction de l'économie, de l'emploi, du travail et des solidarités) | Déclaration SAP des accompagnants AE (NOVA) ; **agrément mandataire** en phase 1 | Demande écrite d'avis sur le montage (voie A / voie B) avant la première mission |
| **Département de la Guadeloupe** (CD 971, direction de l'autonomie) | APA, PCH, **autorisation SAD** (phase 2), tarif horaire de référence, conférence des financeurs (CFPPA), appels à projets MONALISA | Demande de l'arrêté de tarif APA ; avis écrit sur le niveau 3 (compagnie) ; réponse aux appels à projets « isolement » |
| **Région Guadeloupe** | Autorité de gestion du FEDER et du FSE+ ; aides à l'innovation | Dossier de financement à M4 |
| **ARS Guadeloupe, Saint-Martin, Saint-Barthélemy** | Projet régional de santé 2023-2027 (axe soutien aux aidants), plateformes de répit, fonds d'intervention régional | Présentation des données d'impact (M6-M12). Koudmen ne fait aucun soin : pas d'autorisation ARS nécessaire [À VÉRIFIER avec l'avocat] |
| **CGSS Guadeloupe** | Assurance retraite et action sociale ; recouvrement des cotisations (rôle d'URSSAF dans les DROM) ; membre de la conférence des financeurs | Rendez-vous action sociale retraite ; questions sur le précompte AE 2027 et l'AICI [À VÉRIFIER : interlocuteur AICI = URSSAF Caisse nationale ou CGSS] |
| **CAF Guadeloupe** | Forum de la Journée nationale des aidants | Stand en octobre |
| **Préfecture de la Guadeloupe** | Plan ORSEC (cyclone, séisme, eau), registres des personnes vulnérables tenus par les communes | Présenter Veyé Siklòn au service de protection civile |

Saint-Martin et Saint-Barthélemy sont des collectivités d'outre-mer distinctes (art. 74 de la Constitution). Elles sont hors du périmètre.

### 7.2 Martinique (2ᵉ territoire)

Interlocuteurs : DEETS Martinique, **CTM** (APA, PCH, autorisation SAD, fonds européens, Conférence territoriale de l'autonomie), ARS Martinique, CGSS Martinique. Demande les avis écrits au moins 3 mois avant l'ouverture.

---

## 8. Paiements

### 8.1 Ne pas devenir établissement de paiement
- **Encaisser pour le compte d'un tiers** (la famille paie, puis la plateforme reverse à l'AE) est un **service de paiement** (art. L314-1 CMF) qui exige un agrément ACPR ou une exemption.
- **Exemption « agent commercial »** (art. 3 b) DSP2, transposé dans le CMF [À VÉRIFIER : article exact]) : interprétée **très restrictivement** (l'agent ne doit agir que pour le payeur *ou* pour le bénéficiaire, avec une réelle marge de négociation). **Ne pas s'y fier.** La DSP3 et le règlement PSR, en cours d'adoption, la resserrent encore. L'exemption « réseau limité » (L521-3) ne convient pas. Source : [Stripe – solutions de paiement pour marketplaces en France](https://stripe.com/fr/resources/more/payment-solutions-marketplace-france).
- **Solution** : passer par un **PSP agréé qui porte le régime** : **Stripe Connect** (Stripe Payments Europe, établissement de monnaie électronique irlandais), **Mangopay** (EME luxembourgeois), **Lemonway** (établissement de paiement français, avec un historique dans les SAP). Les fonds transitent par des **comptes de paiement ou wallets au nom des AE**, et la plateforme prélève une **commission** (« application fee »). Le KYC des AE est effectué par le PSP et alimente DAC7.
- **Voie A avec AICI** : le flux principal **ne passe pas par le PSP** (URSSAF vers AE). Il faut prévoir **deux rails** :
  1. AICI pour les familles éligibles ;
  2. PSP pour les familles non éligibles (non imposables mais qui ont droit au crédit d'impôt l'année suivante, bénéficiaires APA ou PCH, personnes ne voulant pas de l'AICI).

  La commission est facturée à l'AE par **prélèvement SEPA** (mandat signé à l'onboarding).
- **Voie B** : **aucun flux pour la plateforme** (CESU+). Seuls les frais de placement ou de mandataire sont facturés à la famille.

### 8.2 CESU préfinancé, APA, PCH

| Financement | Voie A (AE déclaré SAP) | Voie B (emploi direct ou mandataire) | Phase 2 (SAD autorisé) |
|---|---|---|---|
| **CESU préfinancé** (employeurs, CE, mutuelles, caisses de retraite) | **Oui**, si l'AE est déclaré SAP et **affilié au CRCESU** | Oui | Oui |
| **APA** | **Non** | **Oui** (emploi direct, mandataire, parfois en CESU préfinancé APA) | **Oui** (tarif départemental, éventuellement avec un CPOM) |
| **PCH aide humaine** | **Non** | **Oui** (emploi direct, mandataire, dédommagement de l'aidant familial) | **Oui** |
| **Aides des caisses de retraite** (action sociale CGSS, Agirc-Arrco : « Bien chez moi », aide au retour à domicile après hospitalisation) | Parfois (selon le prestataire référencé) | Variable | Oui |
| **Avance immédiate** | Oui (sauf bénéficiaires APA ou PCH jusqu'en juillet 2027) | Oui via CESU+ | Oui |

**Opportunité B2B2C** : les **mutuelles**, les **caisses de retraite** et les **employeurs** (aidants salariés) peuvent préfinancer des CESU ou des heures. Pour la voie A, il suffit que les AE soient affiliés au CRCESU : c'est une **étape d'onboarding** à automatiser.

---

## 9. LE montage recommandé

### Structure
- **SAS** (siège dans le DROM pilote), avec une **demande d'agrément ESUS** dès que possible (accès à l'épargne solidaire, aux financements à impact et aux appels à projets CNSA, FSE+ et FEDER).
- **Marque unique et deux voies réglementaires** ; le parcours famille aiguille automatiquement vers la voie compatible avec le besoin.

### Phase 0 : pilote (mois 0 à 4, 50 à 100 missions)
1. **Voie A** : AE recrutés et **onboardés sur NOVA** pour les seules activités de déclaration (n° 1, 3, 7, 10, 11, 14, 16, 19, 20, 22). La plateforme fait de l'**intermédiation pure** : profil de l'AE, tarif libre, facture au nom de l'AE, Avance immédiate via un **logiciel habilité tiers** (le dossier d'habilitation API propre est lancé en parallèle), paiement PSP pour les autres cas.
2. **Voie B** : **mise en relation pour l'emploi direct** (placement : gratuit pour le salarié, abonnement ou frais pour la famille). La plateforme fournit un **kit employeur CESU+** : contrat type IDCC 3239, simulateur crédit d'impôt et exonération, guide APA. **Aucun acte de gestion** pour le compte de la famille tant que l'agrément n'est pas obtenu.
3. **Partenariats** avec 1 ou 2 **SAAD ou SAD autorisés** du territoire pour les besoins lourds ou réguliers (aide aux actes essentiels, APA en prestataire), via une convention d'**apporteur d'affaires** transparente pour la famille.
4. **Dépôt du dossier d'agrément « mandataire » PA/PH** auprès de la DEETS dès le premier mois (délai de 3 mois).
5. **Conformité minimale** : CGU, CGV et conditions accompagnants ; médiateur ; AIPD ; registre ; **pas de données de santé dans Airtable ou WhatsApp** ; B3 ; RC pro de la plateforme ; mention claire « La plateforme n'est pas un service d'aide à domicile autorisé ».

### Phase 1 : mandataire agréé (mois 4 à 12)
- La plateforme devient **mandataire agréé** pour les activités n° 25 à 27 auprès des publics PA/PH. Elle gère le recrutement, le contrat, les déclarations CESU+ via l'**API Tierce déclaration CESU** et le remplacement pendant les congés. Les **frais de gestion** sont **éligibles au crédit d'impôt** : c'est le vrai modèle économique de la voie B.
- **Habilitation API Tiers de prestation** en propre pour la voie A (AICI intégrée, sans logiciel tiers).
- **Candidature au précompte URSSAF** (pilote ou bascule 2027).
- **Conventionnement APA** avec le département pour le mode mandataire, et référencement par les caisses de retraite.
- Honorabilité : alignement sur le standard du décret 2026-324.

### Phase 2 : opérateur hybride autorisé (mois 12 à 36)
- **Autorisation SAD**, ou **rachat d'un SAAD autorisé** (souvent plus rapide : reprise de l'autorisation, sous réserve de l'accord du département).
- Accompagnants **salariés** (temps partiel choisi, LODEOM) pour l'aide aux actes et l'APA en prestataire. Les AE restent sur les services de confort.
- CPOM avec le département, la CTM ou la CTG ; habilitation à l'aide sociale ; intégration de l'AICI pour les bénéficiaires APA et PCH (juillet 2027).
- **Extension aux autres DROM** : chaque autorisation est **territoriale** (un dossier par département ou collectivité unique). L'agrément mandataire est délivré par département d'intervention. **[À VÉRIFIER]**

**Pourquoi ce montage est meilleur que l'idée initiale** :
1. **Légalité** du cœur de l'offre (compagnie, accompagnement de personnes âgées).
2. Le **50 % est disponible partout**, et l'**APA et la PCH sont captables** (le premier financeur du secteur).
3. Une **résilience** face à une éventuelle exclusion de l'AICI pour le schéma « plateforme + AE ».
4. Une **crédibilité** auprès des départements, de l'ARS et de la CNSA, indispensable aux partenariats publics visés.
5. Un **moindre risque de requalification**, car la voie B repose sur du salariat assumé.

---

## 10. Tableau des risques

Échelle : probabilité (P) et impact (I) de 1 (faible) à 5 (critique).

| # | Risque | P | I | Parade |
|---|---|---|---|---|
| 1 | Exercice d'activités soumises à autorisation (compagnie et accompagnement de personnes âgées) par des AE simplement déclarés | 5 si non traité | 5 | Deux voies ; filtrage du parcours ; liste blanche d'activités par AE alignée sur NOVA ; contrôle des intitulés de facture |
| 2 | Crédit d'impôt indu (mauvaise activité, hors domicile sans offre globale, frais plateforme facturés à la famille) | 4 | 4 | Prix unique AE ; facture au nom de l'AE ; règles de facturation codées ; rescrit DGFiP |
| 3 | Exclusion législative de l'AICI pour le schéma « plateforme + micro-entrepreneurs » (PLF ou PLFSS 2027) | 3 | 4 | Voie B (CESU+) et phase 1 mandataire ; veille ; adhésion à une fédération (FESP, FEDESAP) |
| 4 | Requalification en salariat (URSSAF, prud'hommes, présomption de la directive) | 3 | 5 | Règles de conception du § 3.3 ; audit annuel ; documentation de l'indépendance (tarifs libres, multi-plateformes) |
| 5 | Non-conformité à la gestion algorithmique (directive, chapitre III) et à l'AI Act | 3 | 3 | Pas de décision automatisée sur l'accès ou la désactivation ; réexamen humain ; AIPD ; registre des algorithmes |
| 6 | Incident grave sur une personne vulnérable (maltraitance, vol, chute) | 3 | 5 | Honorabilité renforcée, charte, signalement, RC, gestion de crise, assurance, communication |
| 7 | Violation de données de santé (MVP sur outils grand public) | 3 | 4 | Minimisation ; hébergement HDS dès la voie B ; DPA ; chiffrement ; plan de réponse à 72 h |
| 8 | Requalification en établissement de paiement | 2 | 4 | PSP agréé (Stripe Connect, Mangopay, Lemonway) ; ne jamais détenir les fonds |
| 9 | Manquements DAC7 ou précompte (2027) | 3 | 3 | KYC à l'onboarding ; reporting automatisé ; pilote URSSAF |
| 10 | Refus ou délai de l'agrément mandataire, ou refus de l'autorisation SAD | 3 | 4 | Dossier de qualité, rencontre préalable avec la DEETS et le département ; plan B par rachat d'un SAAD ou partenariat |
| 11 | Consentement invalide (personne protégée, famille sans pouvoir) | 3 | 3 | Profil « personne aidée » avec statut juridique et justificatifs ; consentement direct |
| 12 | Désintermédiation (famille et AE continuent sans la plateforme) | 4 | 3 | Valeur ajoutée continue (AICI, assurance, remplacement, facturation) plutôt qu'une clause punitive |
| 13 | Spécificités de Mayotte (régimes sociaux, CESU, APA) | 4 si lancé | 3 | Exclure Mayotte du pilote ; étude dédiée |
| 14 | Pratiques commerciales trompeuses (« vérifiés », « certifiés », « aide à domicile ») | 3 | 3 | Wording validé par l'avocat ; décrire les vérifications réelles |

---

## 11. Checklist de conformité avant lancement (pilote)

**Structure et statuts**
- [ ] SAS immatriculée ; objet social couvrant l'intermédiation, le placement et les futurs SAP (mandataire, prestataire)
- [ ] Domiciliation dans le DROM pilote ; compte bancaire ; contrat PSP signé (Stripe Connect, Mangopay ou Lemonway)
- [ ] RC exploitation, RC pro de la plateforme et cyber souscrites
- [ ] Adhésion à un médiateur de la consommation (et offre collective pour les AE)
- [ ] Rendez-vous préalables avec la **DEETS Guadeloupe** (déclaration et agrément), le **Département de la Guadeloupe** (puis la CTM / la CTG à l'ouverture de ces territoires) et l'**URSSAF/CGSS Guadeloupe** (AICI, précompte)

**Voie A (AE)**
- [ ] Liste blanche des activités autorisées en voie A (déclaration uniquement), reflétée dans le produit
- [ ] Onboarding AE : SIRET actif, **récépissé NOVA** pour les activités proposées, B3 de moins de 3 mois, RC pro, pièce d'identité, IBAN, NIF (DAC7), mandat de facturation, mandat SEPA pour la commission
- [ ] Facture type SAP (mentions obligatoires), attestation fiscale annuelle automatisée
- [ ] Rail AICI (logiciel habilité ou API propre) et rail PSP
- [ ] Rappel trimestriel du **suivi NOVA** aux AE
- [ ] Affiliation CRCESU (CESU préfinancé) proposée

**Voie B (emploi direct)**
- [ ] Kit employeur CESU+ (contrat IDCC 3239, simulateur crédit d'impôt et exonération L241-10, guide APA)
- [ ] Aucune facturation au salarié ; aucun acte de gestion avant l'agrément
- [ ] Dossier d'agrément mandataire déposé

**Contrats et information**
- [ ] CGU (DSA : point de contact, notification et action, motivation des décisions)
- [ ] Conditions accompagnants (P2B : préavis de 15 et 30 jours, motifs, classement)
- [ ] Conditions familles (rétractation, médiation, rôle de la plateforme, représentation de la personne aidée)
- [ ] Page « Comment fonctionne le classement et les avis » (L111-7, L111-7-2)
- [ ] Charte éthique et bientraitance (dons, procurations, argent liquide, signalement, 3977)
- [ ] Mention : « La plateforme n'est pas un service d'aide et d'accompagnement à domicile autorisé »

**Règles de conception anti-requalification**
- [ ] Tarif libre fixé par l'AE ; refus de mission sans pénalité ; pas de géolocalisation continue ; avis non sanctionnants ; désactivation motivée avec réexamen humain ; pas d'exclusivité

**RGPD**
- [ ] AIPD réalisée et documentée
- [ ] Registre des traitements ; DPO désigné (interne ou externalisé)
- [ ] Notices d'information (famille, personne aidée en FALC, AE)
- [ ] **Aucune donnée de santé** dans Tally, Airtable ou WhatsApp ; questionnaire « besoins fonctionnels » à choix fermés
- [ ] DPA signés avec tous les sous-traitants ; transferts hors UE couverts (DPF ou CCT)
- [ ] Choix d'un hébergeur HDS pour la version produit
- [ ] Politique de conservation (B3 : consultation sans copie)
- [ ] Procédure de violation de données (72 h)

**Fiscal et social**
- [ ] Paramétrage DAC7 (collecte et vérification) ; calendrier de déclaration au 31 janvier
- [ ] Préparation au précompte de 2027
- [ ] Facturation électronique (réception depuis septembre 2026, émission en 2027)

---

## 12. Questions à valider avec un avocat (et par rescrit)

1. **Qualification** : dans le schéma voie A (facture au nom de l'AE, commission prélevée auprès de l'AE, PSP), la plateforme peut-elle être regardée comme **prestataire SAP** ou **mandataire de fait** ? Quels faits la font basculer ?
2. **Rescrit DGFiP** : éligibilité au crédit d'impôt (a) d'une prestation AE dont 15 % sont reversés à la plateforme ; (b) de frais d'abonnement famille ; (c) de prestations hors domicile en « offre globale » quand l'AE ne réalise qu'occasionnellement des prestations à domicile pour ce client.
3. **Frontière n° 21 / n° 25** : la « garde-malade hors soins » et la « compagnie ponctuelle » auprès d'une personne âgée autonome relèvent-elles de la déclaration ou de l'autorisation ? Position de la DEETS du territoire pilote ?
4. **AICI** : la plateforme peut-elle être habilitée à l'API Tiers de prestation **pour le compte de multiples AE** ? L'URSSAF peut-elle verser sur un compte PSP au nom de l'AE ? Comment s'articulent l'AICI et le **précompte 2027** ?
5. **Directive 2024/2831** : état de la transposition française en décembre 2026, critères retenus pour la présomption, effet direct ou interprétation conforme avant transposition ?
6. **AI Act** : un algorithme de recommandation des AE (non décisionnel) relève-t-il de l'Annexe III point 4 ?
7. **HDS** : la voie A et la voie B (mandataire) relèvent-elles du « suivi social et médico-social » au sens de L1111-8 CSP ?
8. **Honorabilité** : la plateforme ou ses AE peuvent-ils accéder au dispositif d'attestation du décret 2026-324 ? Base légale d'une exigence de B3 et modalités de conservation ?
9. **Personnes protégées** : capacité de contracter et de consentir au RGPD en curatelle, sous habilitation familiale et en tutelle ; documents à exiger.
10. **L116-4 CASF** (dons et legs) : est-il applicable aux AE déclarés SAP intervenant auprès de personnes âgées ? Opposabilité contractuelle d'une interdiction plus large ?
11. **Assurance** : proposer un contrat groupe aux AE impose-t-il une immatriculation ORIAS ? Est-ce un indice de subordination ?
12. **Agrément mandataire** : périmètre géographique (un agrément par département ?), délais réels de la DEETS en DROM, avis du département, conditions de l'API Tierce déclaration CESU.
13. **Autorisation SAD** : procédure (appel à projets ou non), moratoire éventuel, conditions de reprise d'un SAAD existant dans le DROM pilote ; tarif APA de référence.
14. **Mayotte** : applicabilité du CESU, de l'AICI, de l'APA et de la PCH ; régime CSSM.
15. **LODEOM** et **exonération L241-10** : cumul pour un SAD ultramarin.
16. **Wording marketing** : « accompagnant vérifié », « 50 % remboursés » ou « payez moitié prix » : risque de pratique commerciale trompeuse si l'éligibilité est conditionnelle ?
17. **Clause anti-contournement** : rédaction licite (commission de sortie) au regard du droit de la concurrence, de P2B et de l'indice de subordination.

---

## Sources (consultées en octobre 2026)

**SAP, crédit d'impôt, Avance immédiate**
- https://code.travail.gouv.fr/code-du-travail/d7231-1
- https://bpifrance-creation.fr/activites-reglementees/services-a-personne
- https://www.banquedesterritoires.fr/dernier-decret-dapplication-pour-le-volet-aide-domicile-de-la-loi-vieillissement
- https://www.servicesalapersonne.gouv.fr/files/sap/files/documents/2026/fascicule-amenagement-CAE-micro-entrepreneurs-petites-entreprises.pdf
- https://www.servicesalapersonne.gouv.fr/files/sap/files/documents/2025/faq-osp-amenagement-dispense-cae.pdf
- https://lefreelance.fr/articles/services-a-la-personne-micro-entreprise/
- https://www.data.gouv.fr/dataservices/api-tiers-de-prestation/discussions
- https://demarche.numerique.gouv.fr/commencer/api-tiers-de-prestations/dossier_vide
- https://www.plus.transformation.gouv.fr/experiences/5941483_avance-immediate
- https://abby.fr/blog/avance-immediate-sap/
- https://www.legifiscal.fr/impots-personnels/impot-revenu/reductions-impot/avance-immediate-credit-impot-service-personne.html
- https://support.facturation.pro/hc/fr/articles/6507500947090-Comment-utiliser-l-API-tiers-prestation
- https://unipros.coop/wp-content/uploads/2026/01/Unipros_Mode-d-emploi_2026_web.pdf
- https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE8357.pdf
- https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE35123.pdf
- https://www.fesp.fr/credit-dimpot-sap-portage-de-repas-credit-dimpot-famille-les-victoires-de-la-fesp-a-loccasion-du-plf-2026/
- https://www.fesp.fr/projet-de-loi-de-finances-pour-2026/
- https://www.journaldeleconomie.fr/?p=44041
- https://www.fiscaloo.fr/12154-credit-dimpot-service-a-la-personne/
- https://www.assemblee-nationale.fr/dyn/17/amendements/0325/CION-SOC/AS1102.pdf
- https://www.assemblee-nationale.fr/dyn/17/amendements/0325/AN/1387.pdf
- https://www.assemblee-nationale.fr/dyn/17/amendements/1906A/AN/1142.pdf
- https://www.consoglobe.com/declaration-de-revenus-2025-connaissez-vous-cette-nouvelle-obligation-cg
- https://www.aladom.fr/actualites/secteur-service/9916/lurssaf-annonce-avoir-detecte-une-fraude-au-credit-dimpots-de-3-millions-deuros/
- https://www.europe1.fr/economie/plfss-et-fraude-le-ministere-de-leconomie-sattaque-au-credit-dimpot-pour-les-services-a-la-personne-4211793
- https://orne.fr/sites/default/files/2024-06/3%20volets%20mode%20emploi%20APA.pdf
- https://questions.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE57121.pdf

**Plateformes, travail, fiscalité**
- https://www.lepetitjuriste.fr/take-eat-easy-voie-de-requalification-ouverte-cour-de-cassation/
- https://www.blogdumoderateur.com/uberisation-salarie-un-livreur/
- https://www.eurojuris.fr/contrat-de-travail/articles/arret-uber-enseignements-plateformes-39109.htm
- https://cms.law/en/fra/legal-updates/requalification-en-contrat-de-travail-de-la-relation-entre-chauffeurs-de-vtc-et-plateforme-la-cour-de-cassation-dit-non-pour-cette-fois
- https://questions.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE14781
- https://www.assemblee-nationale.fr/dyn/17/textes/l17b3187_proposition-resolution.pdf
- https://oeil.europarl.europa.eu/oeil/fr/document-summary?id=1794723
- https://bpifrance-creation.fr/entrepreneur/actualites/micro-entrepreneurs-prelevement-a-source-plateformes
- https://propulsebyca.fr/micro-entrepreneur/precompte-cotisations
- https://lefreelance.fr/articles/precompte-urssaf-plateformes-micro-entrepreneurs/
- https://www.legifiscal.fr/actualites-fiscales/4150-prelevement-cotisations-auto-entrepreneurs-plateformes-numeriques-depot-dossier-30-juin-2025.html
- https://www.assemblee-nationale.fr/dyn/17/amendements/1907/AN/1178.pdf
- https://cms.law/fr/fra/a-la-une/dac-7-le-renforcement-de-la-cooperation-fiscale-pour-les-plateformes-numeriques
- https://bofip.impots.gouv.fr/bofip/14086-PGP.html/identifiant=BOI-INT-AEA-30-50-20231213
- https://stripe.com/fr/resources/more/payment-solutions-marketplace-france

**RGPD, santé, vulnérabilité**
- https://esante.gouv.fr/espace-presse/publication-au-journal-officiel-du-referentiel-de-certification-hds-souverainete-des-donnees-et-ameliorations-du-referentiel
- https://www.privacyworld.blog/2026/05/v2-0-certification-of-french-health-data-hosting-service-providers-hds-now-fully-effective/
- https://www.legiscope.com/blog/hds-hebergeur-donnees-sante-certification.html
- https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf
- https://www.CNIL.fr/sites/cnil/files/atoms/files/infographie_aipd.pdf
- https://solidarites.gouv.fr/enfance-handicapee-generalisation-de-lattestation-dhonorabilite
- https://www.maisondescommunes85.fr/node/7264
- https://www.maire-info.com/petite-enfance/enfance-le-recours-%EF%BF%BD-l'attestation-d'honorabilite-s'etend-progressivement-article-30433

**Outre-mer**
- https://espace-autoentrepreneur.com/ruche/article/auto-entrepreneur-dans-les-dom-tom-les-particularites-du-regime
- https://calcunet.fr/articles/auto-entrepreneur-dom-taux-reduits-2026/
- https://en.anyti.me/fr/fiches-pratiques/imposition-du-micro-entrepreneur-dans-les-dom-qu-est-ce-qui-change/244

**Textes à relire sur Légifrance (non consultables depuis l'environnement de recherche)** : C. trav. L7231-1, L7232-1 à L7232-6, D7231-1, L7341-1 à L7342-11, L5321-3, L8222-1 ; CASF L312-1, L313-1, L313-22, L116-4 ; CGI 199 sexdecies, 242 bis, 1649 ter A et suivants ; CSS L241-10, L613-6, L613-6-1, L752-3-2 ; C. conso L111-7, L111-7-2, L121-8, L221-28, L612-1 ; C. pén. 223-15-2 ; CSP L1111-8 ; C. civ. 459, 494-1 ; CMF L314-1, L521-3 ; BOI-IR-RICI-150 ; décret n° 2016-750 ; décret n° 2023-608 ; décret n° 2026-324 ; directive (UE) 2024/2831 ; règlements (UE) 2022/2065, 2019/1150, 2024/1689.
