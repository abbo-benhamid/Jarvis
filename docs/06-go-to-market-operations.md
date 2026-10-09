# 06 — Go-to-market & Opérations : plan d'exécution (M0 → M12)

> Point de vue : growth lead / COO qui a déjà lancé des marketplaces locales de services, et qui connaît le terrain ultramarin.
> Date : octobre 2026. **Mise à jour T1 (2026-10-09) : lancement en Guadeloupe**, puis Martinique, Guyane, Hexagone. Ce document se concentre sur l'exécution. Le modèle juridique (statut d'« intermédiaire technique », SAP) et la sécurité sont traités ailleurs. Ici, on les mentionne seulement quand ils changent une décision opérationnelle.
> Légende : **[Source]** = fait sourcé (URL en fin de section ou dans l'annexe) · **[Hypothèse]** = estimation de praticien, à valider sur le terrain · **[À vérifier]** = information non confirmée.

---

## 0. Ce que je changerais d'abord (les 6 décisions qui comptent)

1. **Le client qui paie n'est pas la personne aidée. C'est souvent l'enfant, et souvent l'enfant qui vit dans l'Hexagone.** Environ **37 % des natifs des Antilles vivent hors de leur territoire d'origine, contre 18 % pour La Réunion**, et environ **258 000 natifs des Antilles vivent dans l'Hexagone** (Insee, données 2020) [Source 1]. L'acquisition doit donc être pensée « double bout » dès le premier jour : l'aidé est aux Abymes, le payeur est à Créteil.
2. **Ne pas monétiser l'offre (accompagnants) au départ.** Un abonnement à 29-49 €/mois côté accompagnants, sur des territoires où le chômage est élevé, coupe l'arrivée de nouveaux accompagnants. La plateforme gagne de l'argent côté famille, avec un **forfait** et une marge intégrée au prix horaire. On pourra introduire un abonnement « Pro » pour les accompagnants à partir de M9, quand ils auront des revenus récurrents.
3. **Une commission seule ne tient pas dans l'aide à la personne.** Après 3 visites réussies, la famille et l'accompagnante échangent leurs numéros, et la relation passe hors plateforme. Il faut vendre ce que la famille ne peut pas obtenir en direct : **remplacement garanti sous 24 h, compte rendu de visite, assurance, avance immédiate du crédit d'impôt, coordination de la fratrie.** Ce sont ces éléments qui justifient le forfait.
4. **Densité avant couverture.** On commence sur 1 à 3 communes contiguës (rayon de 20 min en voiture), pas sur un département entier. En Outre-mer, les embouteillages (Jarry, Fort-de-France, la route du Littoral à La Réunion) détruisent la rentabilité d'une mission de 2 h si l'accompagnante fait 1 h de trajet.
5. **« Single-player mode » avant la marketplace.** Un outil gratuit utile même sans aucun accompagnant : le **carnet de veille familial** (voir §1.4). Il capte la diaspora et constitue la base de données de demande.
6. **Valider à la main, puis coder.** Aucune ligne de code avant d'atteindre les critères go/no-go de S12 (§5.3). L'outillage reste Tally + Airtable + WhatsApp Business + Stripe/SumUp.

---

## 1. Le problème de la poule et de l'œuf

### 1.1 Quel côté d'abord ? **L'offre, mais en petit et « pré-vendue »**

| Côté | Rareté réelle dans les DROM | Coût d'acquisition | Verdict |
|---|---|---|---|
| Accompagnants (offre) | Le **volume** est abondant (chômage, retraité·es actifs, étudiant·es). L'offre **de confiance** est rare. | Faible (France Travail, missions locales, bouche-à-oreille) | Constituer un **noyau de 10-12 accompagnants triés** avant la première campagne côté demande |
| Familles (demande) | Le besoin est massif : Guadeloupe et Martinique sont les 2 régions françaises avec la plus forte part de 60 ans et plus [Source 2]. La **demande qui paie** est rare, et elle se situe en partie hors du territoire. | Élevé (confiance, cycle de décision de la fratrie) | C'est le vrai goulot. On lance la demande à S4, quand l'offre est prête |

**Règle opérationnelle :** ne jamais faire attendre une famille qui a dit oui. Une famille déçue en Outre-mer, c'est 30 personnes prévenues à la messe, au marché et dans le groupe WhatsApp de la famille élargie. Il faut donc **un ratio d'au moins 1 accompagnante active pour 3 familles actives** dans la zone pilote, et un plafond de capacité assumé (« liste d'attente »). Une liste d'attente crée de la rareté ; ça se vend bien.

**Astuce pour amorcer l'offre :** on recrute les 10 premières accompagnantes **avec un minimum garanti** (par exemple 8 h payées par semaine pendant 6 semaines, soit environ 160 €/semaine, budget de 10 k€ au total). Ces heures se remplissent de vraies missions quand il y en a. Sinon, l'accompagnante fait des **« visites de démonstration »** gratuites chez des personnes âgées repérées par le CCAS ou une paroisse : elles génèrent des témoignages, des photos (avec consentement) et des prescripteurs. Aucune heure n'est perdue.

### 1.2 Choix du territoire pilote

| Critère | Guadeloupe | Martinique | La Réunion |
|---|---|---|---|
| Vieillissement | Très fort : 2ᵉ région la plus âgée, 380 400 hab. en 2025, 28 000 personnes de 60 ans et plus dépendantes attendues en 2030 [Source 2] | **Le plus fort** : 1/3 de la population aura 65 ans ou plus vers 2030 [Source 3] | Plus jeune, mais vieillissement rapide (« autant de seniors que de jeunes » en 2050) [Source 4] |
| Diaspora payeuse (Hexagone) | Forte (37 % des natifs des Antilles à l'extérieur) | Forte | Plus faible (18 %) [Source 1] |
| Concurrence locale numérique | **Izokan** (start-up guadeloupéenne, « plateforme des Z », maintien à domicile + lien avec les enfants éloignés, Prix de l'Audace UDE-Medef 2024) [Source 5] ; dispositif ANAAIS (A3A) [Source 6] | Faible à ma connaissance [À vérifier] | Ogenie.fr (activités seniors), GIP SAP « Répit & Repos » avec bourse d'heures [Source 7] |
| Concentration média | RCI, Guadeloupe La 1ère (41,6 % de couverture TV) [Source 8] | RCI, Martinique La 1ère | **Freedom : 39,3 % de part d'audience radio** (un seul canal touche presque toute l'île) [Source 9] |
| Taille du marché | Moyen | Moyen | Le plus grand (≈ 2× les Antilles) |

> **Décision T1 (fondateur) : la Guadeloupe ouvre en premier.** La règle n°1 ci-dessous s'applique : l'ancrage du fondateur est en Guadeloupe. La Martinique vient ensuite (vers M7-M9, critères dans `10-lancement-guadeloupe.md` §6), puis la Guyane et l'Hexagone. La Réunion sort de la feuille de route actuelle. Le texte qui suit est la recommandation v1, gardée pour mémoire.

**Recommandation v1.** La règle n°1 l'emporte sur toutes les autres : **le pilote se fait là où un fondateur peut faire 25 à 30 rencontres terrain par semaine.** Si les fondateurs n'ont aucun ancrage, je recommande la **Martinique** (le territoire le plus âgé, une diaspora forte, pas de concurrent numérique identifié), puis la Guadeloupe à M7-M9 (mêmes médias RCI/La 1ère et même diaspora). La Réunion vient à M10-M12, en s'appuyant sur Freedom et en partenariat avec le GIP SAP. Si le choix est contraint entre Réunion et Guadeloupe (comme dans le brief initial) : **Guadeloupe** pour la diaspora, à condition d'avoir **rencontré Izokan avant S2** pour décider entre partenariat (eux font la tech de suivi, nous l'humain) ou différenciation claire.

### 1.3 Zone de départ (la « micro-ville »)

| Territoire | Zone pilote proposée | Pourquoi |
|---|---|---|
| Martinique (2ᵉ territoire) | **Fort-de-France + Schœlcher** (+ Le Lamentin au 3ᵉ mois d'ouverture) | Densité, CHU (rendez-vous médicaux = missions d'accompagnement), pharmacies, paroisses |
| **Guadeloupe (pilote)** | **Les Abymes + Pointe-à-Pitre + Le Gosier** (+ Baie-Mahault ou Sainte-Anne à M4-M6 ; 2ᵉ bassin Basse-Terre + Saint-Claude + Gourbeyre à M6-M9) | CHU, plateforme de répit **Village des Colibris** et **Aloïs** aux Abymes [Source 10], siège de la Mutuelle Mare-Gaillard au Gosier [Source 11], ZEBOX à Jarry. Évite les heures de pointe de Jarry et des ponts de la Rivière Salée. Marie-Galante, Les Saintes et La Désirade : plus tard, avec un financeur public |
| La Réunion | **Saint-Denis + Sainte-Marie**, ou **Saint-Pierre + Le Tampon** (le Sud a un indice de vieillissement plus élevé [Source 12]) | Siège du GIP SAP à Saint-Denis ; Journée des aidants au Tampon [Source 7] |

Critère de passage à la commune suivante : **plus de 70 % des demandes servies en moins de 48 h et des accompagnantes occupées à plus de 60 %** pendant 4 semaines consécutives.

### 1.4 « Single-player mode » : utile avant même qu'il y ait une marketplace

1. **Carnet de veille familial (gratuit).** Un groupe WhatsApp « Famille + Coordinatrice » et une fiche Tally/Notion par parent : traitements, médecins, numéros utiles, rendez-vous, documents (carte Vitale, mutuelle), préférences (« Manman aime qu'on lui lise France-Antilles »). La fratrie dispersée (Guadeloupe / Paris / Montréal) partage enfin une vue unique. **C'est l'aimant à leads diaspora.**
2. **Appel de veille hebdomadaire (9 €/mois, ou offert le 1ᵉʳ mois).** Une coordinatrice créolophone appelle le parent chaque semaine et envoie un compte rendu de 3 lignes aux enfants. C'est le **produit d'entrée** : il crée la relation, détecte les besoins (« elle n'arrive plus à faire ses courses ») et convertit vers des visites. [Hypothèse : conversion de 20 à 30 % vers une offre de visites dans les 60 jours.]
3. **Pour les accompagnants : boîte à outils gratuite.** Aide à la création de la micro-entreprise, déclaration SAP, modèle de facture et d'attestation fiscale, attestation d'assurance groupe. Ils viennent pour l'outil et restent pour les missions.

---

## 2. Double stratégie d'acquisition

### 2.1 Offre commerciale (proposée pour le pilote, à tester)

| Offre | Contenu | Prix TTC [Hypothèse à tester] | Après avance immédiate* |
|---|---|---|---|
| **Kontak** (entrée) | Appel de veille hebdomadaire + carnet familial + compte rendu | 9-19 €/mois | — |
| **Visite découverte** | 2 h, accompagnante + coordinatrice, bilan des besoins | 49 € (remboursés si la famille souscrit) | — |
| **Présence** (cœur de gamme) | 1 visite de 2 h/semaine (8 h/mois), compte rendu, remplacement garanti | 199 €/mois (≈ 25 €/h) | ≈ 100 €/mois |
| **Présence +** | 2 visites/semaine (16 h/mois) + 1 accompagnement à un rendez-vous médical | 379 €/mois | ≈ 190 €/mois |
| À l'heure | Missions ponctuelles (courses, démarches, rendez-vous) | 27 €/h, minimum 2 h | ≈ 13,50 €/h |

\* **Avance immédiate du crédit d'impôt SAP (50 %)** : elle n'est possible que si l'accompagnant·e (ou la plateforme mandataire) est déclaré·e SAP et adhère au service de l'Urssaf [Source 13]. Le crédit d'impôt bénéficie au foyer fiscal qui paie. Point de vigilance : quand un enfant paie pour un parent qui vit chez lui, il y a des conditions (résidence d'un ascendant, éligibilité APA). **[À vérifier avec un fiscaliste avant tout marketing qui affiche « 50 % remboursés ».]**

**Partage de la valeur (cible) :** accompagnant·e 18-19 €/h facturés (soit ≈ 14-15 € net après cotisations micro-entrepreneur, ACRE la première année [À vérifier sur les taux 2026]) ; plateforme ≈ 25-30 % incluant assurance, coordination et réserve de remplacement. C'est plus que les 12-20 % envisagés au départ. **C'est assumé** : la valeur est dans l'orchestration, pas dans la mise en relation.

### 2.2 Acquisition locale (DROM)

**Principe : les prescripteurs d'abord, les médias ensuite.** Aux Antilles et à La Réunion, la confiance passe par une personne connue : la pharmacienne, l'infirmière libérale, le prêtre, la voisine. Les médias amplifient une preuve qui existe déjà ; ils ne la créent pas.

| Canal | Action concrète | Objectif à S12 | Coût |
|---|---|---|---|
| **Infirmiers libéraux (IDEL)** | Ce sont eux qui sont chez les personnes âgées tous les jours. Kit : 20 flyers + QR code + numéro WhatsApp direct. Leur proposer de signaler une famille en 1 message ; « en retour, on vous prévient si on observe quelque chose d'anormal » (sans commission : déontologie, voir §8). | 30 IDEL rencontrés, 10 prescripteurs actifs | 300 € (impression) |
| **Pharmacies** | Présentoir + affiche « Besoin de quelqu'un pour Manman ? ». Démarrer par 10 officines de la zone. Viser le titulaire, pas le comptoir. | 10 officines, 1 lead/semaine chacune | 500 € |
| **Médecins généralistes / CHU** (service gériatrie, assistantes sociales de sortie d'hospitalisation) | Rendez-vous de 15 min avec l'assistante sociale du service gériatrie : la **sortie d'hospitalisation** est le moment de besoin le plus aigu. | 2 services hospitaliers prescripteurs | 0 € |
| **CCAS** des communes pilotes | Présenter l'offre comme un complément aux SAAD (pas un concurrent), proposer les visites de démonstration gratuites aux personnes isolées repérées par le CCAS (registre canicule / personnes vulnérables). | 2 CCAS conventionnés (convention simple) | 0 € |
| **Plateformes de répit** (Martinique : **ACEROLA**/ASSCAM, **Ô de Mélisse**/Assistance 2000 ; Guadeloupe : **Village des Colibris**, **Aloïs**/Assistance 2000, A3A ; Réunion : **GIP SAP**) [Sources 6, 7, 10, 14] | Proposer d'être leur « bras de répit à domicile de courte durée ». C'est précisément le besoin que l'expérimentation ANAAIS a mis en évidence (répit flexible et court) [Source 6]. | 1 accord d'orientation | 0 € |
| **Églises / paroisses / temples hindous (Réunion)** | Annonce en fin de messe, intervention à la réunion de l'équipe du Rosaire / du Secours catholique, flyer. Les **visiteurs de malades** des paroisses sont aussi un vivier de recrutement. | 5 paroisses | 0 € |
| **Radio locale** | *Guadeloupe* : RCI Guadeloupe (radio leader historique [Source 15]), Guadeloupe La 1ère radio, émissions de libre antenne ; *Réunion* : **Freedom** (39 % de part d'audience, libre antenne très suivie [Source 9]). Ne pas acheter de spots à S1-S8 : obtenir **un passage invité ou une chronique** sur le thème « aidants » autour de la **Journée nationale des aidants (6 octobre)**. | 2 passages radio | 0 € (relations presse), puis 2-4 k€ de spots à M4 |
| **Presse** | France-Antilles (Martinique/Guadeloupe), Le Journal de l'Île de La Réunion, Clicanoo, Outremers360 (pour l'angle diaspora). Angle : « Ces enfants partis qui veillent sur leurs parents depuis Paris ». | 2 articles | 0 € |
| **Marchés** | Stand le samedi au marché de Pointe-à-Pitre (marché Saint-Antoine) et au marché du Gosier [À VÉRIFIER jour], puis au marché couvert de Fort-de-France (Martinique) : « bilan aidant » gratuit en 5 min. | 4 samedis, 40 contacts | 200 €/samedi |
| **Facebook / WhatsApp** | Groupes communaux d'entraide, d'annonces et « bons plans » (faire une recherche par commune ; ne pas spammer : demander l'accord de l'admin, proposer un contenu utile comme « guide des aides pour nos aînés »). Statuts WhatsApp des accompagnantes. | 5 groupes partenaires | 0-500 € de boost |
| **Événements** | Journée nationale des aidants (forum CAF/plateforme de répit en Guadeloupe [Source 16] ; GIP SAP au Tampon [Source 7]) ; Semaine bleue (octobre) ; Conférence territoriale de l'autonomie (CTM) [Source 17] | 2 événements | 500 € |

### 2.3 Acquisition diaspora (Hexagone)

**Insight clé :** l'enfant de la diaspora n'achète pas des heures. Il achète **la paix de l'esprit** (« je sais que quelqu'un est passé voir Manman aujourd'hui ») et **une réponse à sa culpabilité**. Le compte rendu de visite (photo, 3 lignes, humeur, alertes) EST le produit, côté acheteur.

| Canal | Actions | Objectif M1-M6 | Coût |
|---|---|---|---|
| **Meta Ads ciblées** (Île-de-France, Occitanie, Nouvelle-Aquitaine : principales destinations des Guadeloupéens [Source 18]) | Ciblage par centres d'intérêt (RCI, La 1ère, zouk, Carnaval...), 35-60 ans. Créa : vidéo de 20 s d'une vraie accompagnante qui parle créole avec une vraie grand-mère (consentement écrit). Envoyer vers WhatsApp, pas vers un formulaire. | Coût par lead < 12 €, 150 leads en 4 semaines | 1 500-2 000 €/mois |
| **CSE / comités d'entreprise** : RATP, AP-HP, La Poste, SNCF, hôpitaux d'Île-de-France, ministères | Les agents originaires d'Outre-mer y sont nombreux (congés bonifiés dans les trois fonctions publiques [Source 19]). Offre CSE : -15 % + webinaire « Aider ses parents à distance » de 45 min. Passer par les **associations ultramarines internes** aux entreprises quand elles existent [À vérifier entreprise par entreprise]. | 3 CSE signés | 0 € (temps fondateur) |
| **Associations de la diaspora** : **CREFOM** (Conseil représentatif des Français d'Outre-mer, plus de 120 associations fédérées) [Source 20], associations culturelles (ex. ARCC à Paris 20ᵉ pour La Réunion [Source 21]), associations de quartier antillaises (Sarcelles, Créteil, Évry, Aulnay) | Intervention à l'AG, stand aux fêtes. Partenariat « tarif membre ». | 5 associations | 1 000 € |
| **Représentations des collectivités à Paris** : antenne de Paris du Département de La Réunion (qui accompagne déjà les associations réunionnaises de l'Hexagone et lance des appels à projets [Source 22]) ; délégations de la CTM et de la Région Guadeloupe [À vérifier contacts] | Présenter le service comme un **outil de lien diaspora ↔ territoire**. Candidater aux appels à projets associatifs avec une association partenaire. | 1 rendez-vous par territoire | 0 € |
| **Médias diaspora** : **Outre-mer La 1ère** (France Télévisions), **Outremers360** (site + radio), **Tropiques FM** (92.6 FM en Île-de-France, plus de 150 000 auditeurs/jour revendiqués [Source 23]) | Relations presse sur des histoires vraies + spots radio Tropiques FM autour de la Fête des mères. | 3 retombées | 0-3 k€ |
| **Influenceurs** | Créateurs antillais/réunionnais de 30 à 50 ans (humour famille, cuisine, « vie en métropole ») : contenu « mon appel du dimanche avec Manman ». Pas de mégas : 5 micro-influenceurs (10-80 k abonnés). | 5 collaborations | 2-4 k€ |
| **Événements** | **SAGASDOM** (Salon de la gastronomie des Outre-mer, Paris, début octobre ; édition du 2 au 4 octobre 2026 [Source 24]) ; **Foire de Paris** (30 avril-11 mai 2026, avec 58 stands Martinique/Guadeloupe lors d'une édition récente [Sources 25, 26]) ; Salon de l'Agriculture (pavillon Outre-mer, fin février) | Stand partagé avec une association ou une mutuelle (coût réduit). | 2 événements à M12 | 3-6 k€ |
| **Moments de retour au pays** | **Toussaint** (fin octobre-novembre, très forte aux Antilles), **Noël / chanté Nwel** (décembre), **Carnaval** (février), **été** (juillet-août), **Fête des mères** (fin mai) | Campagne « Avant de repartir, organise la suite » : la visite découverte se fait **pendant que l'enfant est sur place**, ce qui lève la confiance en une rencontre. Affichage à l'aéroport [Hypothèse coût] ; flyers dans les agences de voyage communautaires. | 30 % des souscriptions annuelles | 2-5 k€ |
| **Parrainage** | « Un mois offert pour toi et ta cousine. » Dans les familles élargies antillaises et réunionnaises, la propagation est forte. | 25 % des acquisitions à M12 | Coût d'un mois offert |

**Calendrier saisonnier (à intégrer au plan) :** octobre (Journée des aidants le 6/10, Semaine bleue, SAGASDOM) → Toussaint → Noël → Carnaval → Fête des mères (pic émotionnel) → été (retours).

---

## 3. Accompagnants : recrutement, sélection, formation, fidélisation

### 3.1 Profils cibles (par ordre de qualité/fiabilité observée dans ce type de service) [Hypothèse de praticien]

1. **Femmes de 40 à 60 ans** ayant déjà aidé un parent, souvent en reconversion ou à temps partiel. C'est le cœur de cible : fiables et respectées par les aîné·es.
2. **Jeunes retraité·es** (ex-La Poste, enseignement, administration) : ils cherchent du lien et un complément de revenus. Très appréciés pour l'aide administrative.
3. **Étudiant·es en santé/social** (IFSI, travail social, Université des Antilles / de La Réunion) : disponibles en soirée et le week-end, mais rotation forte (stages, départ en Hexagone).
4. **Titulaires ou candidat·es du titre ADVF** : déjà formé·es, mais souvent salarié·es de SAAD. Attention à ne pas débaucher les SAAD, qu'il vaut mieux garder comme partenaires.

### 3.2 Canaux de sourcing

| Canal | Action | Volume attendu (3 semaines) [Hypothèse] |
|---|---|---|
| **France Travail** (agences de la zone) | Réunion d'information collective + offre publiée. Demander une session de recrutement par simulation (MRS) si disponible. **La POEI (jusqu'à 400 h de formation financée) suppose un contrat de travail : elle ne s'applique pas à un statut d'auto-entrepreneur** [Source 27]. Pour les indépendants, se renseigner sur l'AIF auprès du conseiller [À vérifier]. | 20-40 candidatures |
| **Missions locales** | Pour les 18-25 ans, en binôme avec une accompagnante senior | 5-10 |
| **Universités / IFSI** (CHU de La Réunion, Université des Antilles) [Source 28] | Affichage + association étudiante | 10-15 |
| **Paroisses, associations de visiteurs de malades, clubs du 3ᵉ âge** | Les « bénévoles déjà actifs » sont souvent les meilleures recrues | 5-10 |
| **Facebook / WhatsApp / radio** | Post « Rejoignez l'équipe », témoignage d'une accompagnante | 20-50 |
| **Parrainage** par les accompagnantes | 50 € après 20 h réalisées par la personne parrainée | Dès M2 |

**Entonnoir cible :** 100 candidatures → 50 pré-qualifiées par téléphone → 25 entretiens → 15 vérifiées → 12 formées → 10 actives. **Taux de transformation global : environ 10 %.** C'est normal, et c'est même un argument marketing (« nous retenons 1 candidature sur 10 »).

### 3.2 bis Recrutement des accompagnants en Guadeloupe

- **Tension réelle.** Les aides à domicile et auxiliaires de vie sont parmi les métiers aux plus forts volumes de recrutements difficiles en 2026 (France Travail, BMO 2026 Guadeloupe). L'Insee estime le besoin à **+ 1 620 emplois** d'ici 2030, en plus des 5 071 emplois de 2020.
- **Ne débauche pas les SAAD.** Cible les profils qu'ils n'atteignent pas : jeunes retraités, femmes de 40-60 ans à temps partiel, étudiants, proches aidants.
- **Canaux locaux à activer :**
  - agences France Travail des Abymes, de Pointe-à-Pitre et du Gosier [À VÉRIFIER liste] ; Mission locale de Guadeloupe ;
  - Université des Antilles, pôle Guadeloupe (campus de Fouillole, Pointe-à-Pitre) et IFSI du CHU de la Guadeloupe ;
  - paroisses et associations de visiteurs de malades ; clubs du 3ᵉ âge des CCAS ;
  - RCI Guadeloupe (libre antenne) et groupes Facebook communaux.
- **Créole guadeloupéen.** Exige la pratique du créole pour le niveau 3. Vérifie le vocabulaire de l'app (Koudmen, Lakou, Kayé, Kozé) avec des locuteurs guadeloupéens [À VÉRIFIER].
- **Mobilité.** Recrute des accompagnants qui vivent dans les 3 communes pilotes. Un trajet de plus de 20 min tue la marge d'une mission de 2 h.
- **Archipel.** Pour Marie-Galante, Les Saintes et La Désirade, recrute sur place. Ne fais pas traverser une accompagnante pour une mission.

### 3.3 Parcours de vérification (7 étapes, environ 10 jours)

1. **Préqualification téléphonique** (10 min, grille) : motivation, disponibilités, zone, véhicule, langue (créole indispensable aux Antilles et à La Réunion pour une bonne partie des aîné·es).
2. **Entretien en personne** (45 min), avec **mise en situation** : jeu de rôle « Madame refuse d'ouvrir la porte » / « Monsieur est tombé ».
3. **Pièces** : identité, justificatif de domicile, **extrait de casier judiciaire bulletin n°3** (demandé par la personne elle-même), SIRET (ou accompagnement à la création), attestation RC Pro (ou adhésion au contrat groupe).
4. **2 références vérifiées par téléphone** (employeur, famille aidée, curé/pasteur, association).
5. **Formation initiale** (voir 3.4) avec évaluation.
6. **Visite en binôme** avec la coordinatrice ou une accompagnante confirmée.
7. **Période probatoire** : 3 premières missions suivies d'un appel à la famille sous 24 h.

Badge « Vérifiée » affiché uniquement après l'étape 7. **Revérification** du casier tous les 12 mois.

### 3.4 Formation : « Socle Accompagnant de vie » (21 h, interne, gratuite pour l'accompagnant)

| Module | Durée | Contenu |
|---|---|---|
| 1. Posture et éthique | 3 h | Bientraitance, secret, limites du rôle (**ni soins, ni toilette, ni médicaments** : seulement le rappel de prise), argent (interdiction des dons et des procurations) |
| 2. Comprendre le vieillissement | 3 h | Troubles cognitifs, signes d'alerte (déshydratation : chaleur et carême), isolement, deuil |
| 3. Sécurité | 4 h | **PSC1** (premiers secours, ≈ 60-80 € par personne, à faire en externe avec la Croix-Rouge / la Protection civile) ; prévention des chutes ; conduite à tenir en cas d'alerte cyclonique / de séisme (plan familial) |
| 4. Communication | 3 h | Créole et respect des codes (vouvoiement, « Man X », religion), communication avec la fratrie à distance, rédaction du compte rendu en 3 lignes |
| 5. Aide administrative légère | 3 h | Ameli, CGSS, impots.gouv, mutuelle, Agirc-Arrco, prise de rendez-vous Doctolib ; **ne jamais garder d'identifiants** (on fait avec la personne, pas à sa place) |
| 6. Outils et procédures | 2 h | WhatsApp Business, check-in/check-out, compte rendu, procédure d'incident, facturation, Urssaf |
| 7. Évaluation | 3 h | QCM + mise en situation filmée |

**Certification et parcours qualifiant :** à moyen terme, encourager le **titre professionnel ADVF** (niveau 3, environ 5-7 mois, éligible au CPF [Source 29]) pour les meilleures accompagnantes. On peut aussi rechercher un partenariat avec l'AFPA ou un GRETA local, pour que notre socle de 21 h soit reconnu comme module préparatoire. **Ne pas promettre une « certification » maison** qui n'a aucune valeur légale.

**Financement de la formation :** à court terme, sur fonds propres (≈ 150 € par accompagnante, PSC1 inclus). À moyen terme, via un appel à projets CNSA / conférence des financeurs (prévention de la perte d'autonomie) ou le FSE+ au travers d'un organisme de formation partenaire [À vérifier selon les fenêtres d'appel].

### 3.5 Rémunération, statut, assurance

- **Statut :** micro-entrepreneur, déclaré SAP (déclaration en ligne via NOVA) pour donner accès au crédit d'impôt. ⚠️ Certaines activités auprès de personnes âgées ou handicapées relèvent de l'**agrément ou de l'autorisation** quand elles sont exercées en mode prestataire ou mandataire (par exemple l'accompagnement hors du domicile de publics fragiles). **Le périmètre exact doit être validé par un juriste avant S4**, voir le document réglementaire. Option pragmatique : **SAAD partenaire** autorisé qui porte les missions réglementées, la plateforme gardant les missions en déclaration simple (compagnie, courses, aide administrative).
- **Risque de requalification en salariat :** pas d'exclusivité imposée, liberté d'accepter ou de refuser une mission, pas de sanction pour un refus, tarif de l'accompagnante modulable dans une fourchette, formation présentée comme une **offre** et non comme une obligation de subordination. [À valider juridiquement.]
- **Revenu cible :** 18-19 €/h facturés par l'accompagnante (vs SMIC horaire brut 2026 ≈ 12 € [À vérifier]). C'est **50 % au-dessus du SMIC** pour être plus attractif que les SAAD. Bonus : +2 €/h le dimanche, les jours fériés et pour les remplacements à moins de 24 h.
- **Assurance :** **contrat groupe RC Pro + dommages aux biens confiés**, négocié par la plateforme pour toutes les accompagnantes (budget [Hypothèse] 10-20 € par accompagnante et par mois), plus un **contrat RC exploitation de la plateforme**. Intégrer dans la négociation la couverture « vol allégué » (premier motif de litige dans l'aide à domicile) et le transport de la personne dans le véhicule de l'accompagnante (exclu par défaut : à cadrer).

### 3.6 Fidélisation (la communauté est le produit côté offre)

- **Planning stable** : viser des « binômes fixes » (la même accompagnante pour la même famille). C'est le premier facteur de rétention des deux côtés.
- **Paiement rapide** : virement à J+7 maximum (en Outre-mer, la trésorerie des indépendants est tendue).
- **Cercle mensuel** : un petit-déjeuner ou un « lunch kréol » d'1 h 30 (analyse de cas, partage d'émotions : prévention de l'épuisement professionnel). Budget : 15 € par personne.
- **Groupe WhatsApp de l'équipe** animé par la référente, avec un « bravo de la semaine » (citations des familles).
- **Progression** : Accompagnante → Confirmée (après 100 h et une note supérieure à 4,7) → Référente de quartier (rémunérée pour l'onboarding des nouvelles : 50 € par personne).
- **Ce qu'il ne faut pas faire** : un classement public, des pénalités automatiques, un abonnement payant au départ.

---

## 4. Opérations

### 4.1 Protocole de matching manuel (SLA : proposition en moins de 24 h, première visite en moins de 72 h)

1. **Entrée** : WhatsApp ou téléphone, puis fiche Tally remplie **par la coordinatrice pendant l'appel** (pas par la famille).
2. **Qualification (15 min)** : besoins, fréquence, adresse, profil de la personne (autonomie, troubles cognitifs : si l'état est sévère, orienter vers une plateforme de répit ou un SAAD), payeur, interlocuteurs, préférences (genre, langue, religion, animaux).
3. **Filtre de sécurité** : si le besoin inclut des soins, de la toilette, des médicaments ou une surveillance de nuit, **orientation explicite** vers un SAAD ou des IDEL partenaires (on garde la relation : les SAAD deviennent aussi des prescripteurs pour nous).
4. **Scoring dans Airtable** : distance (< 20 min = obligatoire), disponibilités, compétences, affinité (langue, centres d'intérêt), charge actuelle de l'accompagnante.
5. **Proposition de 1 à 2 profils** à la famille (photo, présentation de 3 lignes, mini-vidéo de 30 s) et appel à l'accompagnante.
6. **Visite découverte** avec la coordinatrice (au moins pour les 50 premières familles).
7. **Contrat / CGU** signés (Yousign ou équivalent), mandat de paiement (SEPA / carte).
8. **Suivi** : appel à la famille après la mission 1 et la mission 3, puis tous les mois.

### 4.2 Qualité

- **Check-in / check-out** par message WhatsApp géolocalisé (code « Arrivée Mme X 14h02 »).
- **Compte rendu obligatoire** sous 2 h : 3 lignes + humeur (😊/😐/😟) + alerte oui/non + photo facultative (avec consentement). Il est envoyé à la famille.
- **Notation à double sens** après chaque mission (famille ↔ accompagnante).
- **Visite surprise de la coordinatrice** : 1 famille sur 10 par mois.
- **Revue qualité hebdomadaire** : toutes les notes ≤ 3, toutes les alertes, tous les retards de plus de 15 min.

### 4.3 Gestion des incidents (matrice)

| Niveau | Exemples | Délai de réponse | Action |
|---|---|---|---|
| **N1 Mineur** | Retard < 30 min, désaccord sur une tâche | 24 h | Appel aux deux parties, note dans le dossier |
| **N2 Sérieux** | Absence non prévenue, plainte de comportement, objet cassé | 4 h | Remplacement, entretien avec l'accompagnante, geste commercial |
| **N3 Grave** | Chute ou malaise, suspicion de maltraitance, accusation de vol, accident | **Immédiat** | 15/112 si urgence → appel à la famille → suspension préventive de l'accompagnante → déclaration à l'assureur → fiche d'incident → si maltraitance : signalement (3977, ARS, procureur selon le cas) |
| **Crise territoriale** | Cyclone, séisme, épidémie, grève générale, pénurie de carburant | Activation du plan | Appel de vigilance de **toutes** les personnes aidées avant et après l'événement (liste prioritaire), groupe WhatsApp familles mis à jour. **C'est un moment de vérité : bien géré, il devient un énorme levier de bouche-à-oreille.** |

### 4.4 Remplacement et astreinte

- **Pool de remplacement** : chaque famille a **une accompagnante titulaire + une suppléante déjà présentée** (rencontrée lors d'une visite).
- **Astreinte** : coordinatrice joignable de 7 h à 20 h, 7 j/7 (rotation à 2 personnes dès M3). Hors de ces horaires, un message d'orientation (urgence = 15). Prime d'astreinte [Hypothèse] : 150 €/semaine.
- **Remplacement sous 24 h** garanti dans le forfait, ou visite remboursée.

### 4.5 KPIs opérationnels (revue chaque lundi à 8 h)

Délai premier contact → proposition ; délai → première visite ; taux de remplacement réussi < 24 h ; taux de no-show ; taux d'occupation des accompagnantes ; heures par famille ; incidents N2/N3 pour 100 missions ; pourcentage de comptes rendus envoyés en moins de 2 h ; pourcentage de binômes stables (même accompagnante sur 4 semaines).

---

## 5. Plan d'action

### 5.1 Équipe du pilote (rôles utilisés ci-dessous)

- **CEO** : fondateur·rice, demande diaspora, partenariats, financement.
- **COO** : cofondateur·rice terrain dans le DROM : offre, prescripteurs, opérations.
- **COORD** : coordinatrice de matching (recrutée à S3, à temps partiel puis temps plein).
- **JUR** : juriste / expert-comptable externe (au forfait).

### 5.2 S1 à S12 (semaine par semaine)

| Sem. | Objectif | Livrables | Responsable | Budget |
|---|---|---|---|---|
| **S1** | Cadrage et décisions | Choix du territoire et de la zone pilote ; rendez-vous juriste (périmètre SAP, CGU, statut) ; création de la société et du compte bancaire ; numéro WhatsApp Business ; landing page (Carrd/Framer) avec 2 offres et liste d'attente | CEO + COO + JUR | 1 500 € (juriste) + 200 € |
| **S2** | Écoute marché (30 entretiens) | **15 entretiens de familles** (dont 8 diaspora en visio) + **10 prescripteurs** (IDEL, pharmacies, CCAS) + **5 acteurs** (plateforme de répit, **Isokan/Izokan (obligatoire)**, CCAS des Abymes, un SAAD, la DEETS Guadeloupe) → synthèse « top 5 des douleurs » et « prix acceptable » | COO + CEO | 300 € (déplacements) |
| **S3** | Lancer le recrutement de l'offre | Annonces France Travail, missions locales, Facebook, paroisses ; grille d'entretien ; base Airtable ; recrutement de la COORD | COO | 500 € |
| **S4** | **Expérience E1 (demande diaspora)** + entretiens d'accompagnants | Campagne Meta (Île-de-France) vers WhatsApp ; 25 entretiens d'accompagnants ; contrat groupe RC Pro signé | CEO / COO | 1 500 € (ads) + 300 € (assurance) |
| **S5** | Formation de la cohorte 1 | 21 h de socle + PSC1 pour 12 accompagnantes ; kit (badge, tote bag, carnet) | COO + COORD | 2 000 € |
| **S6** | Premières missions | 10 premières visites découverte (dont des visites de démonstration CCAS/paroisse) ; tournée IDEL et pharmacies (20 contacts) | COORD + COO | Minimum garanti : 1 600 €/sem. |
| **S7** | Montée en charge et prescripteurs | **Expérience E3 (prescripteurs)** : kit déposé dans 10 pharmacies et chez 15 IDEL ; premier stand au marché ; appel CCAS | COO | 800 € |
| **S8** | Paiement et récurrence | Lancement des forfaits payants (Stripe / SumUp, mandat SEPA) ; **Expérience E4 (abonnement)** ; premier cercle d'accompagnantes | CEO + COORD | 300 € |
| **S9** | Médias | Passage radio (RCI Guadeloupe / Guadeloupe La 1ère) + 1 article de presse (France-Antilles Guadeloupe) ; 3 témoignages vidéo | CEO | 500 € |
| **S10** | Diaspora : partenariats | 3 rendez-vous CSE / associations (CREFOM, association culturelle) ; webinaire « Aider ses parents à distance » | CEO | 300 € |
| **S11** | Qualité et rétention | Enquête NPS (familles + accompagnantes) ; revue des incidents ; cohorte 2 de recrutement lancée | COO + COORD | 200 € |
| **S12** | **Comité go/no-go** | Tableau de bord S1-S12, unit economics par mission, décision : code / pivot / arrêt | Tous | — |

**Budget S1-S12 : environ 22-28 k€** (dont ≈ 10 k€ de minimum garanti aux accompagnantes, 4 k€ d'acquisition, 3 k€ juridique/assurance, 2,5 k€ de formation, la COORD à temps partiel ≈ 4,5 k€ chargés ; les fondateurs ne sont pas rémunérés).

### 5.3 Expériences de validation : go/no-go avant de coder

| # | Hypothèse | Expérience | Critère GO | Critère NO-GO / pivot |
|---|---|---|---|---|
| **E1** | La diaspora achète à distance | 1 500 € de Meta Ads → WhatsApp → visite découverte prépayée à 49 € | **≥ 150 leads, CPL ≤ 12 €, ≥ 15 visites prépayées** | < 5 visites payées → repositionner sur la demande locale et les prescripteurs |
| **E2** | On recrute de l'offre de qualité vite | 3 semaines de sourcing | **≥ 80 candidatures, ≥ 10 accompagnantes actives à S6** | < 5 actives → revoir la rémunération ou le profil |
| **E3** | Les prescripteurs envoient des familles | Kits chez 25 IDEL et pharmacies | **≥ 10 leads qualifiés en 4 semaines** | < 3 → les prescripteurs ne sont pas un canal ; miser sur les médias et les événements |
| **E4** | Le forfait se vend mieux que l'heure | Proposer les forfaits Présence et À l'heure à 40 familles qualifiées | **≥ 40 % choisissent un forfait mensuel** | < 15 % → modèle à l'acte, en travaillant la rétention par la relation |
| **E5** | La récurrence existe | Suivi de cohorte | **≥ 60 % des familles font une 2ᵉ mission sous 30 jours ; ≥ 40 % sont en récurrence à 60 jours** | < 30 % → produit « ponctuel » : revoir la proposition de valeur |
| **E6** | On tient la qualité opérationnelle | Mesure continue | **≥ 80 % des matchings en moins de 48 h ; incidents N2+ < 3 % ; NPS familles ≥ 50** | Incident N3 mal géré ou NPS < 20 → stop et audit |
| **E7** | Le contournement est contenu | Suivi des familles perdues (appel de sortie) | **< 15 % de départs vers le « direct »** | > 30 % → renforcer la valeur du forfait (remplacement, assurance, crédit d'impôt) ou adopter un modèle d'abonnement pur |

**Décision de coder à S12 si :** ≥ 60 missions réalisées, ≥ 25 familles payantes, au moins 4 des 7 expériences en GO dont **E5 et E6 obligatoirement**, et une **marge sur coût variable positive** (prix famille − accompagnante − assurance − paiement > 0). Sinon, 4 semaines d'itération supplémentaires, une seule fois.

### 5.4 M4 à M12 (mois par mois)

| Mois | Objectif | Livrables clés | Responsable | Budget mensuel [Hypothèse] |
|---|---|---|---|---|
| **M4** | Industrialiser le manuel | Process documentés (SOP) ; COORD à temps plein ; 2ᵉ commune ; spécifications du MVP (app familles = compte rendu + paiement ; app accompagnants = planning + check-in) ; dépôt de dossiers de financement (BPI Bourse French Tech, Initiative / Réseau Entreprendre, Région) | CEO / COO | 12 k€ |
| **M5** | Diaspora à l'échelle | 2 CSE actifs ; campagne Toussaint « Avant de repartir » ; 25 accompagnantes ; développement du MVP (no-code avancé ou agence, 6-8 semaines) | CEO | 15 k€ (dont 6 k€ de dev) |
| **M6** | Premier partenariat institutionnel | Convention CCAS ou plateforme de répit ; dossier conférence des financeurs ; campagne Noël ; NPS ≥ 50 | COO | 15 k€ |
| **M7** | Lancement du MVP | Bascule des familles dans l'app ; **ouverture de la Martinique** (2ᵉ territoire, mêmes médias RCI/La 1ère) **si les critères d'ouverture sont atteints** (`10` §6), avec 1 COO local à temps partiel ; sinon M8-M9 ; 1ᵉʳ contact mutuelle | CEO + COO | 20 k€ |
| **M8** | Mutuelles et assisteurs | Pilote avec une mutuelle locale (garantie « aide au retour d'hospitalisation ») ; référencement auprès d'un assisteur ; campagne Carnaval | CEO | 20 k€ |
| **M9** | Rentabilité unitaire | Offre « Pro » accompagnants (optionnelle) ; analyse des cohortes ; revue tarifaire | CEO + COO | 20 k€ |
| **M10** | Consolider les Antilles | 2ᵉ bassin en Guadeloupe (Basse-Terre) ; premier projet B2G archipel (Marie-Galante) avec le Département ; étude de la Guyane (CTG, CGSS Guyane) | CEO | 22 k€ |
| **M11** | Fête des mères (pic) + levée | Campagne Fête des mères (Antilles fin mai) ; deck de levée (pré-seed / seed 0,8-1,5 M€) ou subventions FEDER / FSE+ | CEO | 25 k€ |
| **M12** | Bilan et extension | 2 territoires actifs (Guadeloupe, Martinique) + Guyane en préparation ; objectifs ci-dessous | Tous | 25 k€ |

**Budget M4-M12 : environ 175 k€.** Avec S1-S12, le total sur 12 mois est d'**environ 200 k€** (prêts d'honneur + BPI + subventions + love money, voir le document financement).

**Objectifs à M12 [Hypothèse ambitieuse mais tenable] :** 250 familles actives, 80 accompagnantes actives, 4 000 heures/mois, 85 k€ de chiffre d'affaires mensuel (GMV) et ≈ 22 k€ de revenu net mensuel pour la plateforme, NPS ≥ 55, 3 conventions institutionnelles.

---

## 6. Scripts et pitchs

### 6.1 Script d'appel : famille (entrée WhatsApp ou téléphone), 8 minutes

> **Ouverture :** « Bonjou [Prénom], c'est [Prénom], coordinatrice chez [Nom]. Merci de nous avoir écrit. Vous avez 5 minutes ? Je voudrais d'abord comprendre comment va votre maman / papa. »
> **Écoute (laisser parler, noter) :** « Qui s'occupe d'elle au quotidien aujourd'hui ? Qu'est-ce qui vous inquiète le plus en ce moment ? Qu'est-ce qu'elle aime faire ? Est-ce qu'elle parle plutôt créole ou français ? »
> **Filtre :** « Est-ce qu'elle a besoin d'aide pour la toilette ou les médicaments ? » → si oui : « Pour ça, je vais vous orienter vers [SAAD / infirmier partenaire]. Nous, on peut compléter avec de la présence et de la compagnie. »
> **Proposition :** « Ce que je vous propose : une visite découverte de 2 heures, avec moi et une accompagnante qui habite à 10 minutes de chez elle. Vous recevez un compte rendu le jour même. Si ça lui plaît, on met en place une visite régulière, par exemple chaque mardi après-midi. Et si l'accompagnante est malade, on la remplace dans les 24 heures. »
> **Prix :** « La découverte coûte 49 €, et ils sont déduits si vous continuez. Le suivi hebdomadaire est à 199 € par mois, et selon votre situation fiscale, la moitié peut être avancée par l'État. »
> **Clôture :** « Je vous propose mardi ou jeudi ? Je vous envoie le lien de paiement sur WhatsApp et je préviens votre maman. Vous voulez que ce soit vous qui la préveniez, ou moi ? »

### 6.2 Message WhatsApp type (diaspora, après le clic sur une pub)

> Bonjour [Prénom] 👋 Ici [Prénom], coordinatrice [Nom] en Martinique.
> Vous cherchez quelqu'un pour passer voir votre parent à [commune] ? On s'en occupe :
> ✅ Une accompagnante vérifiée (casier, références, formation premiers secours) qui habite le quartier
> ✅ Un compte rendu après chaque visite, sur ce WhatsApp
> ✅ Remplacement sous 24 h si elle est absente
> Pour commencer : une **visite découverte de 2 h (49 €)**. Je peux vous appeler 5 min aujourd'hui ? Dites-moi l'heure qui vous arrange (heure de Paris 😉).

### 6.3 Pitch de 30 secondes : prescripteurs (IDEL, pharmacien·ne, assistante sociale)

> « Vous voyez chaque semaine des patients âgés seuls dont les enfants sont loin. Nous, on envoie une accompagnante vérifiée et formée aux premiers secours, qui habite le quartier, pour la compagnie, les courses, les démarches et les rendez-vous. **Pas de soins : ça reste votre métier**, et on vous renvoie les besoins de soins qu'on repère. Il vous suffit de donner ce flyer ou de m'envoyer un WhatsApp avec l'accord de la famille. On rappelle sous 24 h. Je vous laisse 20 flyers ? »

### 6.4 Pitch diaspora (stand, webinaire CSE, radio)

> « Vous êtes à Paris, Manman est au Lamentin. Vous l'appelez le dimanche, elle dit que tout va bien… et vous ne savez jamais vraiment. Nous, on envoie chaque semaine quelqu'un du quartier, qui parle créole, qu'on a vérifié et formé, pour passer deux heures avec elle : les courses, un papier à la CGSS, une sortie à la messe ou au marché. Et vous recevez un compte rendu avec une photo, le jour même. Si l'accompagnante est malade, on la remplace dans les 24 heures. **Vous n'êtes plus seul·e à veiller sur elle.** Commencez par une visite découverte, idéalement pendant votre prochain séjour au pays. »

---

## 7. Tableau de bord KPIs

### 7.1 North Star Metric

**« Visites récurrentes réalisées avec compte rendu, par semaine » (VRR/sem.)**
Pourquoi : elle capture à la fois la valeur pour l'aidé (présence régulière), la valeur pour la famille (le compte rendu = la paix de l'esprit), la rétention (la récurrence) et le revenu. Une mission ponctuelle sans compte rendu ne compte pas.

Cibles : S12 = 30 VRR/sem. · M6 = 120 · M12 = 450.

### 7.2 Tableau complet

| Catégorie | KPI | Définition | Cible S12 | Cible M12 |
|---|---|---|---|---|
| **Acquisition** | Leads/semaine (local / diaspora) | Nouveaux contacts qualifiés | 15 (50/50) | 60 |
| | CPL diaspora | Dépense ads / leads | ≤ 12 € | ≤ 10 € |
| | CAC famille payante | Total acquisition / nouvelles familles payantes | ≤ 120 € | ≤ 90 € |
| | Part des prescripteurs et du parrainage | % des nouvelles familles | 30 % | 50 % |
| **Activation** | Lead → visite découverte | % | 35 % | 40 % |
| | Visite découverte → abonnement | % | 50 % | 60 % |
| | Délai lead → 1ʳᵉ visite | Médiane | ≤ 72 h | ≤ 48 h |
| **Rétention** | Rétention familles M1 / M3 | % de familles actives | 70 % / 50 % | 80 % / 65 % |
| | Heures / famille / mois | Moyenne | 6 h | 9 h |
| | Rétention accompagnantes M3 | % d'actives | 70 % | 75 % |
| | Taux de contournement | % de départs déclarés « en direct » | < 15 % | < 10 % |
| **Satisfaction** | NPS familles | Enquête mensuelle | ≥ 50 | ≥ 60 |
| | NPS accompagnantes (eNPS) | Enquête trimestrielle | ≥ 30 | ≥ 40 |
| | Note moyenne par mission | /5 | ≥ 4,6 | ≥ 4,7 |
| **Opérations** | Délai de matching (demande → proposition) | Médiane | ≤ 24 h | ≤ 12 h |
| | Taux de remplacement réussi < 24 h | % des absences couvertes | ≥ 85 % | ≥ 95 % |
| | No-show accompagnantes | % de missions | < 3 % | < 1,5 % |
| | Incidents N2 / N3 pour 100 missions | — | < 3 / 0 | < 2 / < 0,2 |
| | Comptes rendus envoyés < 2 h | % | ≥ 90 % | ≥ 98 % |
| | Taux d'occupation des accompagnantes | Heures réalisées / heures déclarées disponibles | ≥ 50 % | ≥ 70 % |
| **Économie** | GMV mensuelle | Montant facturé aux familles | 5 k€ | 85 k€ |
| | Take rate net | Revenu plateforme / GMV | 25 % | 26-28 % |
| | Marge sur coût variable par heure | € | > 0 | > 4 € |

Outillage : Airtable (interfaces) + Looker Studio jusqu'à M6, puis tableau de bord intégré au produit.

---

## 8. Partenariats institutionnels stratégiques

| Partenaire | Ce qu'il peut apporter | Comment l'approcher | Priorité / délai |
|---|---|---|---|
| **CCAS des communes pilotes** | Prescription, orientation des personnes isolées, crédibilité, salles | Rendez-vous avec le directeur ou la directrice + adjoint·e aux aînés ; proposer des visites de démonstration gratuites et un **rapport d'impact** (isolement mesuré) | ★★★ S3-S8 |
| **Isokan / Izokan** (Les Abymes [À VÉRIFIER], fondateurs Juliano Rémy et Hugues Lami ; Prix de l'Audace UDE-Medef 2024) [Source 5] | Concurrent ou partenaire : plateforme numérique des aides et du lien avec les enfants éloignés | Rencontre avant S2. Option A : eux = coordination numérique, Koudmen = présence humaine vérifiée. Option B : différence claire (preuve de visite, diaspora) | ★★★ S1-S2 |
| **DEETS Guadeloupe** et **Département de la Guadeloupe** (direction de l'autonomie) | Avis écrit sur le montage ; tarif APA ; conférence des financeurs ; MONALISA | Demande écrite en S1 (voir `01` §7.1) | ★★★ S1-S4 |
| **CHU de la Guadeloupe** (gériatrie, service social) | Sorties d'hospitalisation = besoin le plus aigu | Rendez-vous avec le service social de gériatrie | ★★ S6-M4 |
| **Plateformes de répit** (ACEROLA / ASSCAM, Ô de Mélisse et Aloïs / Assistance 2000, Village des Colibris, A3A, GIP SAP) [Sources 6, 7, 10, 14] | Orientation d'aidants épuisés ; répit à domicile court, que leurs structures (accueil de jour, hébergement temporaire) couvrent mal | Proposer une offre « répit 2-4 h à domicile » à tarif partenaire, et une évaluation conjointe | ★★★ S2-M6 |
| **Département / CTM** (APA, conférence des financeurs de la prévention de la perte d'autonomie) | Financement de la prévention, de la lutte contre l'isolement (démarche **MONALISA** : appel à projets du CD971 en 2020 [Source 30]), solvabilisation APA (emploi direct / CESU [À vérifier]) | Répondre aux appels à projets « prévention / isolement » de la conférence des financeurs ; s'inscrire dans la **Conférence territoriale de l'autonomie** de la CTM [Source 17] ; Réunion : passer par le **GIP SAP**, émanation du Département | ★★ M4-M9 |
| **ARS** (Guadeloupe / Martinique / Réunion) | Légitimité, financement de l'innovation (fonds d'intervention régional), orientation vers les dispositifs aidants. L'ARS Martinique consacre 13,2 M€/an au répit [Source 14] | Ne pas demander d'argent en premier : demander à **présenter les données d'impact** au référent « aidants / personnes âgées » ; candidater aux appels à projets « aidants » | ★★ M6-M12 |
| **CGSS** (branche retraite + action sociale, caisse unique dans les DROM [Source 31]) | Orientation des retraités fragiles (équivalent des plans d'aide « bien vieillir »), ateliers de prévention, partenariats territoriaux (exemple de convention CGSS-commune à Saint-André [Source 32]) | Rendez-vous avec la direction de l'action sociale ; se positionner comme prestataire de **« lien social / sortie »** dans les plans d'aide, ce qui nécessitera vraisemblablement un partenariat avec une structure agréée | ★★ M6-M12 |
| **Agirc-Arrco action sociale** | **« Sortir Plus »** (accompagnement des 75 ans et plus isolés pour leurs sorties, financé en CESU) et **« Aide à domicile momentanée »** (jusqu'à 10 h sur 6 semaines, gratuite, mise en place en 48 h, pour les 75 ans et plus) [Source 33]. C'est exactement notre cœur de métier. | Les prestations passent par des **prestataires référencés** : contacter le délégué social régional Agirc-Arrco Antilles-Guyane / Réunion ; probablement via un **SAAD partenaire agréé** [À vérifier] | ★★★ M4-M8 (fort levier de solvabilisation) |
| **Mutuelles locales** : **Mutuelle Mare-Gaillard** (Groupe VYV, environ 100 000 personnes protégées, Le Gosier) [Source 11], **UFR** (« première mutuelle des DOM », 1977) et le réseau mutualiste des Antilles-Guyane cité par la même source [Source 11 ; À vérifier], MNT, MGEN | Garanties « retour d'hospitalisation », « aidant », services adhérents ; canal de distribution massif | Proposer un **pilote de 3 mois** sur 50 adhérents de 75 ans et plus, avec mesure (réhospitalisations, satisfaction). Passer par la direction « services / prévention ». En parallèle, se faire **référencer auprès des assisteurs** (IMA, AXA Assistance, Mondial Assistance), qui manquent souvent de prestataires dans les DROM [Hypothèse] | ★★ M7-M12 |
| **MSA** | Dans les DROM, la protection sociale agricole est gérée par la **CGSS** [Source 31], donc pas d'interlocuteur MSA distinct en Martinique, en Guadeloupe ni à La Réunion. Utile seulement pour la diaspora rurale de l'Hexagone. | — | ☆ |
| **La Poste « Veiller sur mes parents »** | Concurrent ou partenaire ? Le service coûte jusqu'à environ 135-140 €/mois pour 6 visites de facteur par semaine ; ce sont des visites courtes [Source 34]. **Disponibilité réelle dans les DROM : [À vérifier]** | **Partenaire, pas concurrent.** Le facteur fait 5-10 minutes de veille ; nous faisons 2 h de présence active. Proposition : être la **réponse « besoin détecté »** quand le facteur signale qu'une personne a besoin de courses ou d'aide administrative. Approche : direction régionale La Poste / Silver économie (« La Poste Santé & Autonomie ») avec les données d'un pilote | ★ M9-M12 (on n'arrive pas chez La Poste sans traction) |
| **SAAD autorisés** (88 services d'aide à domicile référencés en Guadeloupe [Source 35]) | Réponse au risque réglementaire (portage des missions qui exigent un agrément ou une autorisation), orientation croisée | Proposer un **accord de complémentarité** : ils nous envoient les demandes « compagnie / courses » qu'ils ne servent pas (peu rentables pour eux) ; nous leur envoyons les besoins de soins et de toilette | ★★★ S2-M4 |
| **Écosystème startup** : Technopole de La Réunion / incubateur régional, Beelab (femmes), French Tech La Réunion (Capitale 2026-2028), French Tech Guadeloupe, **ZEBOX Caraïbes** (CMA CGM, Guadeloupe), INCOPLEX Outre-mer, Plan Innovation Outre-mer (14 M€, France 2030) [Sources 36, 37, 38] | Hébergement, mentorat, accès à BPI et aux financements, visibilité (French Tech Connect Outre-mer à VivaTech) | Candidater dès M2-M3 (ZEBOX si Antilles ; incubateur régional de la Technopole si Réunion) | ★★ M2-M4 |

**Règle d'approche institutionnelle :** on n'arrive jamais les mains vides. Il faut 1) une **histoire vraie** (un cas concret, anonymisé), 2) **3 chiffres** (familles, heures, NPS), 3) **une demande précise et petite** (« pouvez-vous nous orienter 10 personnes isolées ? »). L'argent vient au 2ᵉ ou 3ᵉ rendez-vous.

---

## 9. Équipe fondatrice idéale et premières embauches

### 9.1 Fondateurs (2, idéalement 3)

| Rôle | Profil idéal | Pourquoi c'est non négociable |
|---|---|---|
| **CEO, « bout diaspora »** | Ultramarin·e ou proche de la diaspora, basé·e en Île-de-France au départ, expérience en growth/marketing B2C ou marketplace. Il ou elle est le client cible. | La moitié de la demande payante est dans l'Hexagone ; il faut la crédibilité du « je vis ton problème » |
| **COO, « bout terrain »** | Basé·e dans le territoire pilote, issu·e du médico-social (ex-coordinatrice de SAAD, IDE, travailleuse sociale, cadre de CCAS), **créolophone**, avec un réseau local. | La confiance, la qualité et les prescripteurs se jouent sur le terrain, en personne. Le COO est l'actif principal de l'entreprise à ce stade |
| **CTO (à partir de M4, ou freelance)** | Produit/no-code puis mobile ; sensibilité RGPD et données de santé | Avant M4, le code est une distraction. Un·e CTO associé·e peut arriver à M4-M6 |

### 9.2 Premières embauches (ordre)

1. **S3 : Coordinatrice de matching** (temps partiel → temps plein à M4). Profil : assistante de coordination SAAD, standardiste médicale, organisée, créolophone, chaleureuse au téléphone. ≈ 2 000-2 300 € bruts/mois [Hypothèse]. **C'est l'embauche la plus importante de l'année.**
2. **M3 : Référente accompagnants** (pouvant être une accompagnante promue, à mi-temps) : onboarding, cercles, remplacement.
3. **M5 : Growth / community manager diaspora** (freelance ou alternant·e) : ads, contenu, influenceurs, CSE.
4. **M7 : Country lead Martinique** (même profil que le COO).
5. **M10 : Responsable du 2ᵉ bassin en Guadeloupe (Basse-Terre)**, puis country lead Guyane vers M18.

**Conseil consultatif (non rémunéré ou en BSPCE) :** un·e **médecin gériatre** du CHU local, un·e **ex-directeur·rice de CCAS ou de SAAD**, un·e **juriste en droit social / SAP**, un·e **fondateur·rice de marketplace** (pour la méthode).

---

## 10. Risques majeurs d'exécution (et parades)

| Risque | Probabilité | Parade |
|---|---|---|
| Requalification (salariat déguisé ou activité SAP non agréée) | Moyenne | Validation juridique à S1 ; SAAD partenaire ; CGU et pratiques cohérentes (liberté de refus, pas de sanction) |
| Incident grave (chute, accusation de vol) en début d'activité | Moyenne | Assurance groupe signée **avant** la 1ʳᵉ mission, procédure N3, communication transparente avec la famille |
| Contournement (la relation passe en direct) | Forte | Valeur du forfait (remplacement, compte rendu, crédit d'impôt, assurance), binôme titulaire + suppléante, programme de fidélité |
| Dépendance au fondateur terrain | Forte | Process documentés dès M4, référente promue, 2ᵉ coordinatrice à M6 |
| Concurrent local mieux financé (Izokan en Guadeloupe, SAAD qui se digitalisent) | Moyenne | Rencontrer et explorer le partenariat ; différenciation par l'humain vérifié + la diaspora |
| Événement climatique (cyclone juin-novembre aux Antilles, pic août-octobre) | Certaine sur 12 mois | Plan de crise (§4.3) et Veyé Siklòn, transformés en preuve de fiabilité |
| Coupures d'eau en Guadeloupe (Grande-Terre surtout) | Certaine | Fiche « eau » dans le Kayé ; alerte à la famille après 48 h ; livraison d'eau en Coups de main |
| Séisme (zone de sismicité 5) ou barrages routiers (mouvements sociaux) | Faible à moyenne | Liste de crise, appels Kozé, missions de proximité à pied ; plan de reprise des données hors de l'île |

---

## Annexe : sources

1. Insee via Outremers360, mobilité des natifs des DROM (37 % Antilles / 18 % Réunion ; 258 000 natifs des Antilles dans l'Hexagone en 2020) : https://outremers360.com/bassin-atlantique-appli/mobilite-des-jeunes-aux-antilles-et-a-la-reunion-des-taux-de-scolarisation-et-de-reussite-plus-eleves-pour-les-natifs-des-drom-residant-dans-lhexagone ; https://www.insee.fr/fr/statistiques/5355264
2. Insee Guadeloupe (population 2025, 2ᵉ région la plus âgée, dépendance 2030) : https://www.insee.fr/fr/statistiques/8557247 ; https://www.insee.fr/fr/statistiques/5359577 ; https://www.insee.fr/fr/statistiques/2872512
3. Insee Martinique, vieillissement : https://www.insee.fr/fr/statistiques/4796029
4. Insee Réunion à l'horizon 2050 : https://www.insee.fr/fr/statistiques/3254355
5. Izokan (Guadeloupe), Outremers360 : https://outremers360.com/bassin-atlantique-appli/innovation-en-outre-mer-isokan-la-reponse-numerique-guadeloupeenne-aux-defis-de-la-silver-economie
6. ANAAIS / A3A, répit à la demande en Guadeloupe : https://consortiuminters4.uqar.ca/wp-content/uploads/2023/12/20231206_Resume-de-pratique_Repit-Proche-aidant_VF.pdf
7. GIP SAP Réunion, « Répit & Repos », JNA 2024-2025 : https://www.departement974.fr/sites/default/files/jna_2024_-_dossier_de_presse_1-avec_compression.pdf ; https://www.departement974.fr/sites/default/files/jna_2023_-_dossier_de_presse.pdf
8. Médiamétrie Métridom Antilles (janvier-juin 2026) : https://www.mediametrie.fr/system/files/2026-07/2026%2007%2001_CP%20Antilles%20TV%20%20janv-juin%202026%20Radio%20Sept%202025-Juin%202026.pdf
9. Audiences Réunion (Freedom) : https://www.leaderreunion.fr/en/audiences-tele-et-radio-antenne-reunion-et-freedom-loin-devant/
10. Plateformes de répit en Guadeloupe (Village des Colibris, Aloïs) : https://guadeloupe.france-assos-sante.org/wp-content/uploads/sites/10/2021/05/JEDS-Antilles-2021_Actions-pour-les-Aidants-Familiaux.pdf
11. Mutuelles des DOM (Mare-Gaillard, UFR...) : https://www.lecomparateurassurance.com/10-guide-mutuelle/mutuelle-sante-martinique ; https://fr.indeed.com/cmp/Mutuelle-Mare-Gaillard
12. ARS Réunion, panorama du Sud : https://www.lareunion.ars.sante.fr/system/files/2024-12/Panorama%20ITCS%20Sud.pdf
13. Avance immédiate du crédit d'impôt SAP : https://www.laposte.fr/senior/credit-impot-services-a-la-personne ; https://abby.fr/blog/avance-immediate-sap/
14. Plateformes de répit en Martinique (ACEROLA, Ô de Mélisse) et budget ARS : https://www.martinique.ars.sante.fr/media/124701/download ; https://rci.fm/node/5438592 ; https://www.essentiel-autonomie.com/trouver-plateforme-de-repit
15. RCI, audiences : https://rci.fm/martinique/infos/Societe/Des-performances-daudiences-record-pour-les-stations-radios-du-groupe-RCI
16. CAF Guadeloupe, forum de la Journée des aidants : https://www.caf.fr/allocataires/caf-de-la-guadeloupe/actualites-departementales/journee-nationale-des-aidants-rendez-vous-ce-lundi-06-octobre-au-forum-organise-par-la-plateforme-de
17. CTM, Conférence territoriale de l'autonomie : https://outremers360.com/bassin-atlantique-appli/martinique-la-collectivite-territoriale-de-martinique-installe-la-premiere-conference-territoriale-de-lautonomie
18. Insee Analyses Guadeloupe (mobilités vers l'Île-de-France, l'Occitanie, la Nouvelle-Aquitaine) : https://www.insee.fr/fr/statistiques/8742758
19. Congés bonifiés (fonction publique hospitalière / AP-HP) : https://affairesjuridiques.aphp.fr/textes/instruction-n-dgosrh42014219-du-16-juillet-2014-relative-aux-conditions-dattribution-des-conges-bonifies-aux-agents-de-la-fonction-publique-hospitaliere/ ; https://acteurspublics.fr/articles/conges-bonifies-des-fonctionnaires-le-champ-des-beneficiaires-en-question/
20. CREFOM : https://www.mmoe.llc.ed.ac.uk/en/general-keywords/national-identity ; https://maire-info.com/le-conseil-des-outre-mer-recu-par-francois-hollande-article2-17031
21. ARCC (association réunionnaise, Paris 20ᵉ) : https://www.mmoe.llc.ed.ac.uk/en/node/475
22. Département de La Réunion, antenne de Paris et appel à projets pour les associations de l'Hexagone : https://outremers360.com/bassin-atlantique-appli/un-nouvel-appel-a-projets-par-le-departement-de-la-reunion-a-destination-des-associations-reunionnaises-dans-lhexagone-ou-en-europe ; https://outremers360.com/bassin-atlantique-appli/la-boutique-de-lile-de-la-reunion-rouvre-ses-portes-a-lantenne-de-paris-du-departement-de-la-reunion
23. Tropiques FM : https://www.afrik.com/tropiques-fm-un-pari-gagne ; https://app.adintime.com/en/radio/979-tropiques-fm-926
24. SAGASDOM 2026 : https://parisjetaime.com/evenement/salon-de-la-gastronomie-des-outre-mer-e210 ; https://www.sortiraparis.com/en/news/in-paris/guides/197753-what-to-do-in-paris-this-friday-must-see-outings-on-october-2-2026
25. Foire de Paris 2026 : https://sortiraparis.com/en/what-to-do-in-paris/shows-and-fairs/articles/338647-paris-fair-2026-the-spring-s-unmissable-parisian-outing
26. RCI, 58 stands Martinique/Guadeloupe à la Foire de Paris : https://rci.fm/deuxiles/infos/Economie/58-stands-de-Martinique-et-de-Guadeloupe-la-Foire-de-Paris
27. France Travail, POE / POEI : https://www.francetravail.fr/files/live/sites/PE/files/fichiers-en-telechargement/fichiers-en-telechargement---dem/com-574-Se-former-avant-embauche-POE_AFPR.pdf
28. IFSI du CHU de La Réunion : https://chu-reunion.fr/wp-content/uploads/2024/09/FLYER-IFSI-2024.pdf
29. Titre professionnel ADVF (AFPA) : https://www.afpa.fr/formation-qualifiante/assistant-de-vie-aux-familles-23
30. MONALISA, appel à projets du CD971 : https://www.cg971.fr/wp-content/uploads/2020/06/NOTE-DE-CADRAGE-MONALISA.pdf
31. CGSS, caisse unique dans les DROM : https://www.allianz.fr/assurance-particulier/epargne-retraite/retraite/lexique/definition-cgss.html
32. Convention CGSS - Saint-André : https://www.saint-andre.re/wp-content/uploads/2024/12/AR-Affaire28_Annexe1_Projet-convention-CGSS.pdf
33. Agirc-Arrco, aide à domicile momentanée / Sortir Plus : https://www.pour-les-personnes-agees.gouv.fr/vivre-a-domicile/aides-financieres/laide-a-domicile-momentanee-pour-les-retraites-agirc-arrco ; https://services75ans.agirc-arrco.fr/fileadmin/services75ans.agirc-arrco.fr/MEDIA/PDF/De__pliant_Action_sociale.pdf
34. La Poste « Veiller sur mes parents » : https://www.laposte.fr/services-seniors/teleassistance-securite-et-autonomie-de-personnes-agees ; https://www.quechoisir.org/actualite-la-poste-des-visites-payantes-chez-les-seniors-n42560/
35. Annuaire des services d'aide à domicile en Guadeloupe : https://www.pour-les-personnes-agees.gouv.fr/annuaire-service-aide-accompagnement-domicile/guadeloupe-971
36. Technopole / incubateur de La Réunion, Beelab, ZEBOX Guadeloupe, INCOPLEX : https://www.enseignementsup-recherche.gouv.fr/fr/l-incubateur-de-la-reunion-45877 ; https://outremers360.com/bassin-atlantique-appli/innovation-zebox-incubateur-du-groupe-cma-cgm-ouvrira-en-septembre-2022-en-guadeloupe ; https://outremers360.com/bassin-atlantique-appli/13-entrepreneurs-ultramarins-reunis-dans-la-premiere-promotion-du-programme-incoplex-outre-mer
37. French Tech Outre-mer / VivaTech 2026 / Plan Innovation Outre-mer : https://outremers360.com/bassin-indien-appli/vivatech-2026-la-french-tech-la-reunion-organise-la-premiere-french-tech-connect-outre-mer-ocean-indien
38. French Tech Martinique : https://outremers360.com/bassin-atlantique-appli/exclu-innovation-en-outre-mer-mayotte-et-martinique-vont-recevoir-leurs-labellisations-french-tech

**Limites et incertitudes déclarées :** les tarifs, les taux de conversion, les budgets et les rémunérations marqués [Hypothèse] sont des ordres de grandeur de praticien, à confirmer par les expériences E1-E7. Les noms de groupes Facebook ne sont volontairement pas listés : ils changent vite et doivent être identifiés commune par commune. Les contacts des délégations de la CTM et de la Région Guadeloupe à Paris, la disponibilité de « Veiller sur mes parents » dans les DROM, les conditions du crédit d'impôt quand un enfant paie pour un parent, et le périmètre exact agrément / déclaration SAP restent **[À vérifier]** avant toute communication publique.
