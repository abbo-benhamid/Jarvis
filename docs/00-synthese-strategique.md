# Koudmen — Synthèse stratégique de l'orchestrateur

> Synthèse des 7 études (`01` à `07`). Version 1 — octobre 2026.
> Statut : **idée affinée, avant validation juridique**. Aucun code.
> Chaque chiffre provient d'un document détaillé. Ceux qui sont marqués [À VÉRIFIER] ou ⚠️ dans les sources doivent être confirmés avant de servir à une décision.

---

## 1. Ce que l'équipe a découvert (en 6 phrases)

1. **Le modèle de départ ne tient pas.** L'idée était une marketplace « light » avec des auto-entrepreneurs pour éviter la réglementation. Or la compagnie, l'aide au quotidien et l'accompagnement hors du domicile **de personnes âgées ou handicapées** demandent une **autorisation du Département** (ou un agrément de l'État en mode mandataire). Le statut d'intermédiaire ne protège ni l'accompagnant ni la plateforme. *Les agents Juridique (01), Business (03) et Red team (07) arrivent à ce constat chacun de leur côté.*
2. **Conséquence économique directe :** dans ce montage, la famille **n'a pas droit au crédit d'impôt de 50 %**. Elle paierait environ 25 €/h, contre environ 11,50 €/h en emploi direct CESU. Elle partirait donc dès le deuxième mois.
3. **Le vrai client n'est pas celui qu'on croyait.** C'est **l'enfant de la diaspora installé en Hexagone**, avec un revenu hexagonal, dont le parent âgé vit seul aux Antilles. On estime entre **85 000 et 120 000 familles** concernées.
4. **Ce qu'on vend n'est pas une heure de présence, c'est la tranquillité d'esprit à distance.** Concrètement : une preuve que la visite a eu lieu, un compte-rendu, un remplacement garanti et une coordination de la fratrie.
5. **La désintermédiation est le risque qui tue les marketplaces de care** (Homejoy, Papa, Care.com). La plateforme ne survit que si elle reste utile **après** la mise en relation.
6. **La sécurité des personnes vulnérables n'est pas une contrainte : c'est le produit.** Un incident grave non maîtrisé suffit à tuer l'entreprise.

---

## 2. La vision retenue

**Koudmen — le lakou numérique : le réseau de confiance qui veille sur nos aînés, ici et là-bas.**

*Koudmen* désigne l'entraide collective en créole. *Lakou* désigne la cour familiale partagée. Le nom n'est pas pris par un acteur du secteur, mais il faut encore vérifier qu'aucune marque n'est déposée (INPI / EUIPO) [À VÉRIFIER].

Ce n'est **pas** « un Yoopies pour l'Outre-mer ». C'est **l'opérateur de confiance de la veille à distance**, qui combine trois couches :

| Couche | Ce que c'est | Pourquoi c'est difficile à copier |
|---|---|---|
| **1. Le cercle (Lakou)** | Une application de coordination familiale autour d'un aîné : fratrie en Hexagone, voisins, accompagnants, prescripteurs | Effet réseau familial et données de continuité |
| **2. La présence vérifiée** | Des visites humaines avec **preuve de visite**, un **journal Kayé** et un remplacement garanti | Densité locale d'accompagnants fidélisés, protocole de confiance |
| **3. L'infrastructure territoriale** | **Veyé Siklòn** (veille cyclone), ordonnance sociale, contrats avec les collectivités | Intégration institutionnelle, preuve d'impact |

### Les 7 innovations phares (détails : `04`)

1. **Preuve de visite** (`05`). Une visite n'est validée que si 2 facteurs sur 3 sont réunis : GPS au domicile, tag NFC/QR posé chez la personne, et **confirmation vocale de l'aîné lui-même** (« tapez 1 »). Cette preuve déclenche le paiement et alimente la confiance de la famille. C'est l'innovation centrale.
2. **Kayé, le journal du lien.** Après chaque visite : photo, humeur, mot vocal envoyés à la famille. L'IA résume les visites et repère des **signaux faibles** (appétit, isolement, confusion), sans jamais poser de diagnostic, pour ne pas devenir un dispositif médical.
3. **Kozé, la voix sans écran, en créole.** Des appels de convivialité et de rappel par téléphone fixe ou message vocal WhatsApp. Aucun modèle de reconnaissance vocale ne gère aujourd'hui les créoles guadeloupéen, martiniquais ou réunionnais. On commence donc avec des **humains et des messages pré-enregistrés par des voix locales**, puis on construit le corpus « Kreyòl Commons » avec les universités (financement FEDER). Ce corpus deviendra un avantage difficile à rattraper.
4. **Lakou, le cercle de soin.** Répartition des tâches et des frais entre frères et sœurs (paiement partagé). Un « droit au secret » protège l'aîné (« pa di yo sa » : ne leur dis pas ça).
5. **Veyé Siklòn.** En cas d'alerte cyclonique ou de coupure d'eau, on joint toutes les personnes inscrites en moins de 24 h, en mode SMS ou appel vocal même sans réseau de données. Le service est relié au registre communal des personnes vulnérables, ce qui en fait un produit vendable aux collectivités.
6. **Coopérative et passeport de confiance.** À terme, les accompagnants deviennent sociétaires (SCIC ou CAE). Cela protège contre la requalification en salariat, limite la désintermédiation et donne un récit d'impact fort. Leur réputation vérifiée leur appartient et les suit.
7. **Koud, la banque de temps entre l'Hexagone et les DROM.** Une heure donnée ici devient une heure reçue là-bas pour ses propres parents, sur le modèle du Fureai Kippu japonais. C'est une phase 3, sous réserve d'un montage juridique solide.

---

## 3. Le montage juridique retenu : deux voies et des paliers

*(Détails : `01`. Tout doit être validé par un avocat avant la première mission.)*

| | **Voie A — « Coups de main »** | **Voie B — « Présence et autonomie »** |
|---|---|---|
| Activités | Aide administrative, courses dans une offre globale, assistance numérique, préparation de repas, petit entretien : uniquement les **activités soumises à simple déclaration** | Compagnie, aide au quotidien, accompagnement aux rendez-vous de personnes âgées ou handicapées |
| Statut accompagnant | Auto-entrepreneur **déclaré SAP sur NOVA** | **Salarié de la famille** (emploi direct, CESU+) |
| Crédit d'impôt 50 % | Oui, avec **avance immédiate** URSSAF | Oui, avec avance immédiate CESU+ |
| APA / PCH | Non | **Oui** (premier financeur du secteur) |
| Rôle de Koudmen | Plateforme et logiciel de facturation | Outil de l'employeur : contrat, planning, déclarations, preuve de visite, remplacement |

**Les paliers :**
- **Phase 0 :** mise en relation et outillage.
- **Phase 1 (mois 9 à 12) :** agrément **mandataire** auprès de la DEETS.
- **Phase 2 :** **autorisation SAD**, ou rachat d'un SAAD autorisé.

**Partenariats avec les SAAD dès le départ.** On cherche à être leur renfort, pas leur ennemi.

**Règles produit imposées par la directive européenne sur le travail via plateforme** (UE 2024/2831, à transposer avant le 2 décembre 2026) :
- tarif libre fixé par l'accompagnant ;
- droit de refuser une mission sans pénalité ;
- pas de géolocalisation continue (la position n'est vérifiée qu'au check-in) ;
- avis jamais utilisés pour sanctionner ;
- toute désactivation motivée et revue par un humain ;
- aucune exclusivité.

**Arbitrage de l'orchestrateur sur un désaccord entre agents.** Le Juridique dit que la commission doit être prélevée sur l'accompagnant, parce que les frais facturés à la famille ne sont pas éligibles au crédit d'impôt. Le Business et la Red team recommandent au contraire de ne rien prendre à l'accompagnant (risque de requalification, et pénurie d'accompagnants).

→ **Décision : 0 € prélevé sur l'accompagnant.** Koudmen se rémunère par un **abonnement payé par la famille**. Cet abonnement n'ouvre pas droit au crédit d'impôt, mais il rémunère des services réels : preuve de visite, journal, remplacement, coordination et assurance. Le crédit d'impôt continue de s'appliquer aux heures, qui sont payées directement à l'accompagnant. Le juriste doit confirmer ce point.

---

## 4. Comment on gagne de l'argent

*(Détails et modèle P&L : `03` et `annexes/modele-pl.py`.)*

### Grille cible (à tester pendant le pilote)

| Offre | Pour qui | Prix indicatif |
|---|---|---|
| **Lakou gratuit** | Tout le monde : cercle familial et carnet | 0 € (porte d'entrée, acquisition diaspora) |
| **Veyé** | Diaspora : appel hebdomadaire et alertes | 39 €/mois |
| **Sérénité** | Familles locales et diaspora : visites, preuve, journal, remplacement | 19,90 €/mois + frais dégressifs, ou **forfait tout compris d'environ 149 à 199 €/mois pour 1 visite par semaine** (option recommandée par `06` pour la diaspora) |
| **Intégral** | Besoins réguliers, emploi direct géré | 39 €/mois + 6 % |
| **B2B2C** | Employeurs (salariés aidants), mutuelles, caisses de retraite (Agirc-Arrco « Sortir Plus ») | 29 à 34 € HT/h, ou par salarié |
| **B2G** | Départements/CTM, CCAS : isolement, veille cyclone | 400 à 900 € par bénéficiaire et par an |

**L'accompagnant** gagne environ **15,80 € net/h**, contre environ 9,95 € en SAAD. C'est notre arme de recrutement.

**Unit economics (scénario central) :**
- revenu d'environ 46 € HT par famille et par mois ;
- coût d'acquisition (CAC) d'environ 110 € ;
- valeur client / coût d'acquisition (LTV/CAC) de 2,8, puis 6,3 ;
- coût d'acquisition remboursé en 6 mois, puis en 3.

**P&L sur 36 mois :**

| Scénario | Chiffre d'affaires | Point mort |
|---|---|---|
| Prudent | — | Non atteint à 36 mois |
| Central | 95 k€ → 457 k€ → 1,05 M€ | Vers le mois 34 |
| Ambitieux | 2,4 M€ en année 3 | Vers le mois 22 à 24 |

**Besoin de financement d'environ 460 k€.**

**Lecture honnête.** Sur les DROM et la diaspora seuls, Koudmen est une **belle PME à impact** (environ 0,5 M€ de revenus plateforme en part réaliste à 3 ans, selon `02`). Elle devient une **startup à fort potentiel** si l'une de ces trois portes s'ouvre :
- les payeurs institutionnels (mutuelles, caisses, employeurs) ;
- l'Hexagone (les mêmes besoins de veille à distance existent partout) ;
- les autres diasporas : Afrique, Maghreb, Haïti.

### Ordre de financement
1. Apport, love money, incubateur (Technopole, ZEBOX, French Tech).
2. Prêts d'honneur (Initiative, Réseau Entreprendre), Bourse French Tech (30 k€), prêt bancaire garanti par France Active.
3. Contrats avec la conférence des financeurs de la prévention de la perte d'autonomie (CFPPA, axe isolement), puis seed à impact de 300 à 800 k€ avec un prêt d'amorçage BPI, et FSE+/FEDER.
4. Contrat à impact social (après 24 mois de données).

---

## 5. Technologie et sécurité

*(Détails : `05`.)*

| Phase | Outils | Règle d'or |
|---|---|---|
| **0 — Pilote manuel** (S1 à S12) | Tally (UE), Grist ou Baserow auto-hébergés, Brevo, WhatsApp Business, numéro local | **Pas d'Airtable** (données hors UE) et **aucune donnée de santé**. Environ 100 à 250 €/mois |
| **1 — MVP codé** (environ M7-M8) | TypeScript de bout en bout : Next.js, Expo (mode hors ligne), NestJS en monolithe modulaire, PostgreSQL/PostGIS. Un micro-service Python pour l'IA. Hébergement **HDS** chez Clever Cloud ; IA chez Scaleway Paris. Paiements via Stripe Connect | Pas de Supabase ni de Firebase (CLOUD Act, pas d'HDS). Coût : 100 à 150 k€ sur 6 mois |
| **2 — Passage à l'échelle** | Matching par apprentissage automatique, corpus créole, API des collectivités | ISO 27001 et pentest annuel |

**Le socle de confiance :**
- **Vérification de l'identité** : extrait de casier judiciaire B3 consulté sans en garder copie, deux références, entretien vidéo, formation de 21 h avec PSC1, et dès que possible l'attestation d'honorabilité (décret 2026-324), utilisée comme standard volontaire.
- **Bouclier anti-abus financier** : interdiction des dons, des procurations et du maniement de la carte bancaire ; détection des demandes de paiement hors plateforme.
- **Protection des accompagnants** contre les agressions et les fausses accusations. La preuve de visite les protège aussi.
- **Bouton SOS**, protocole d'incident à 4 niveaux, astreinte de 7 h à 20 h, et un plan de crise média préparé **avant** le lancement.
- **RGPD dès la conception** : analyse d'impact (AIPD) obligatoire ; consentement donné par **l'aîné lui-même** ou par son représentant légal ; minimisation des données.
- **Résilience Outre-mer** : mode hors ligne, repli sur SMS et appel vocal, plan de reprise après sinistre adapté aux cyclones.

---

## 6. Le lancement

*(Détails, scripts et acteurs réels : `06`.)*

**Territoire pilote : la Martinique** (Fort-de-France et Schœlcher). C'est aussi le choix de `02` et `06`.
- Elle a le vieillissement le plus rapide de France (environ 40 % de 60 ans et plus en 2030).
- Elle compte le plus d'aidants des DROM et des seniors plus solvables qu'ailleurs.
- **Un seul interlocuteur public, la CTM**, qui cumule les compétences du Département et de la Région.
- 37 % des natifs des Antilles vivent hors de leur île : le pont avec la diaspora est maximal.

Ensuite la Guadeloupe (à M4-M6, où il faudra rencontrer Izokan, déjà présent), puis La Réunion. Le Juridique préférait La Réunion ou la Guadeloupe ; **l'orchestrateur tranche pour la Martinique**, sauf si le fondateur a un ancrage local plus fort ailleurs. Cet ancrage est le premier critère.

**Amorçage du marché :**
- Un noyau de **10 à 12 accompagnantes** avec un revenu minimum garanti (environ 10 k€ de budget).
- Au moins 1 accompagnante pour 3 familles, sur 1 à 3 communes seulement.
- Côté diaspora : l'outil gratuit Lakou, les associations, les CSE (RATP, AP-HP, La Poste), Outre-mer La 1ère, et les retours de vacances de décembre et de l'été.
- Côté local : pharmacies, infirmiers libéraux, CCAS, églises, RCI, plateformes de répit.

**Indicateur principal (North Star) :** nombre de **visites récurrentes avec compte-rendu par semaine**. Cible : 450 à M12.

**Seuil go/no-go à S12, avant d'écrire une ligne de code :**
- au moins **25 familles payantes récurrentes** ;
- au moins 60 missions ;
- moins de 30 % de fuite hors plateforme ;
- marge contributive positive ;
- zéro incident grave non maîtrisé.

---

## 7. Les risques n°1 et leurs parades

*(Liste complète : `07`.)*

| Risque | Parade |
|---|---|
| Cadre légal mal maîtrisé | Avis écrit de la DEETS et de la CTM, plus un avocat, **avant la première mission**. Montage en deux voies |
| Incident grave avec une personne vulnérable, puis crise médiatique (cas Care.com, Papa) | Preuve de visite, bouclier anti-abus, protocole de crise, assurance de groupe, communication préparée |
| Désintermédiation | Valeur continue : journal, remplacement, avance de crédit d'impôt, coordination de la fratrie. Pas de commission sur l'accompagnant. Mode « Passerelle » payant, qui fait de la fuite un revenu |
| Marché insulaire trop petit pour du capital-risque | Rentabilité d'abord, payeurs institutionnels, plan d'extension vers l'Hexagone et d'autres diasporas |
| Fondateur seul | Recruter un CTO associé et un ou une responsable des opérations ancré·e localement |
| Avance immédiate supprimée pour les plateformes (amendements aux budgets 2027) | Le modèle ne doit **pas** dépendre de l'avance immédiate. La voie B (CESU+) reste un plan de repli |

---

## 8. Plan d'action pour les 30 prochains jours

1. **Semaines 1-2 — Juridique.** Consulter un avocat spécialisé SAP et numérique (les 17 questions sont listées dans `01`). Envoyer une demande écrite à la DEETS et à la CTM Martinique. Envisager un rescrit fiscal à la DGFiP sur l'éligibilité au crédit d'impôt.
2. **Semaines 1-2 — Terrain.** Mener **30 entretiens** : 10 enfants de la diaspora, 10 aînés ou aidants locaux, 10 accompagnants potentiels. Valider la volonté de payer environ 149 à 199 €/mois.
3. **Semaine 2 — Marque.** Faire la recherche d'antériorité INPI/EUIPO sur « Koudmen », puis réserver le domaine et les comptes sociaux.
4. **Semaine 3.** Monter la phase 0 conforme RGPD (Tally, Grist, WhatsApp Business) et rédiger la charte anti-abus.
5. **Semaines 3-4.** Rencontrer 3 plateformes de répit, 5 pharmacies et 1 SAAD partenaire. Prendre un premier contact avec Agirc-Arrco action sociale.
6. **Semaine 4.** Déposer les candidatures à l'incubateur et au prêt d'honneur.

---

## 9. Les questions que je te pose (à toi, fondateur)

Le plan change selon tes réponses :

1. **Ton ancrage :** où vis-tu, et as-tu un réseau en Martinique, en Guadeloupe ou à La Réunion ? C'est le critère n°1 du choix du territoire.
2. **Ton équipe :** es-tu seul ? As-tu un profil tech, opérationnel, social ou santé autour de toi ?
3. **Ton budget de départ :** combien peux-tu mettre sur les 6 premiers mois (environ 25 k€ pour les 12 premières semaines, selon `06`) ?
4. **Ton ambition :** une PME rentable et à fort impact dans les Outre-mer, ou une startup qui vise ensuite l'Hexagone et l'international ?
5. **Le statut :** es-tu prêt à viser l'agrément, puis l'autorisation, plutôt qu'à les contourner ? Toute l'équipe le recommande.

---

## Index des documents

| # | Document | Contenu |
|---|---|---|
| 00 | `00-synthese-strategique.md` | Cette synthèse |
| 01 | `01-juridique-reglementaire.md` | Activités SAP, crédit d'impôt et avance immédiate, requalification et directive européenne, DSA/DAC7, RGPD/HDS, vulnérabilité, Outre-mer, 17 questions pour l'avocat |
| 02 | `02-marche-concurrence.md` | Démographie des DROM, diaspora, TAM/SAM/SOM, concurrence (Papa, Honor, Click&Care…), 6 personas, choix du pilote |
| 03 | `03-business-model-finances.md` | Désintermédiation (15 mécanismes), grille tarifaire, unit economics, P&L 36 mois en 3 scénarios, financement, avantages défendables |
| 04 | `04-vision-innovation-produit.md` | 3 visions, marque Koudmen, 30 idées dont un top 7 détaillé, récits d'usage, 12 principes de design, 13 indicateurs d'impact |
| 05 | `05-architecture-tech-securite.md` | Phases 0/1/2, stack, WhatsApp et voix, paiements et avance immédiate, IA et créole, modèle de données, sécurité et confiance, budget, roadmap 18 mois |
| 06 | `06-go-to-market-operations.md` | Amorçage du marché, acteurs locaux réels, recrutement et formation, opérations, plan S1-S12 puis M4-M12, scripts, KPIs, partenariats |
| 07 | `07-red-team-risques.md` | Post-mortems du secteur, 15 risques, hypothèses à valider en priorité, pre-mortem 2028, due diligence, verdict |
