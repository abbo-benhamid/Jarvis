# 07 — Red Team : pourquoi ce projet peut mourir (et comment l'en empêcher)

> **Posture** : avocat du diable. Deux voix : **(VC)** un investisseur seed exigeant, **(EX)** un ancien fondateur d'une marketplace de care qui a fermé. Rien ici n'est gentil. Tout ici sert à rendre le projet plus solide.
> **Date** : octobre 2026. **Statut** : document de travail, à relire par un avocat en droit social/SAP avant toute décision structurante.
> **Légende des incertitudes** : ⚠️ = point à confirmer (texte non vérifié en source primaire, ou interprétation juridique discutable).

---

## 0. Le résumé brutal en 6 phrases

1. **Le "marketplace light pour éviter la réglementation" ne vous protège pas : il déplace le risque juridique vers les accompagnants** (qui, eux, exercent une activité soumise à autorisation départementale dès qu'ils aident à domicile ou accompagnent hors domicile une personne de plus de 60 ans), **puis il revient vers vous par la requalification** (Take Eat Easy 2018, Uber 2020).
2. Le vrai concurrent n'est ni La Poste ni un SAAD : **c'est la voisine payée en liquide, la cousine, et le bénévole gratuit**, dans des territoires où 34-36 % de la population vit sous le seuil de pauvreté.
3. Une marketplace de care **fuit par construction** : dès que la famille a trouvé "sa" personne de confiance, la commission devient une taxe sans valeur (Homejoy est mort aussi de ça).
4. **Un seul incident grave** (chute, vol, maltraitance, abus de faiblesse) chez une personne vulnérable, sur une île de 400 000 habitants où tout le monde se connaît, **peut tuer la marque en une semaine** (Care.com 2019, Papa 2023-2024).
5. 50-100 missions à ~40 € et 15 % de commission = **600 à 1 200 € de revenu en 4 mois** : le pilote ne prouve rien économiquement s'il n'est pas conçu pour mesurer la rétention et la récurrence, pas le volume.
6. Le projet devient intéressant si on **change d'unité de valeur** : ne pas vendre des "missions", mais **une tranquillité d'esprit récurrente pour l'enfant aidant (souvent dans l'Hexagone)**, avec un cadre légal propre (emploi direct CESU ou SAP déclaré/agréé, ou partenariat avec SAAD autorisé).

---

## 1. Les leçons des cadavres (post-mortems utiles)

| Cas | Ce qui s'est passé | Leçon pour vous |
|---|---|---|
| **Homejoy** (US, ménage, fermé juillet 2015, ~40 M$ levés) | Procès en requalification des "contractors" en salariés ; mais aussi rétention faible, remises massives attirant de mauvais clients, expansion internationale trop rapide (dont la France, "pause" dès déc. 2014), **fuite des meilleurs pros vers un emploi direct par leurs clients**. | La désintermédiation et la requalification sont deux faces du même problème : si vous contrôlez beaucoup, vous êtes employeur ; si vous contrôlez peu, vous êtes contournable. Sources : [Wikipedia](https://en.wikipedia.org/wiki/Homejoy), [Entrepreneur](https://www.entrepreneur.com/article/248896), [TechCrunch FR](https://techcrunch.com/2014/12/15/homejoy-le-pause) |
| **HomeHero** (US, home care, fermé 2017) | Le fondateur cite les évolutions du droit du travail qui ont "coulé" le modèle 1099 (indépendants). | Le modèle "indépendants" dans le care a une durée de vie réglementaire courte. [Home Health Care News](https://homehealthcarenews.com/2017/02/homehero-closure-casts-shadow-over-home-care-disrupters/) |
| **Hometeam** (US) | A choisi le salariat (W-2) dès le départ, payé 30-50 % de plus, "viré de tous les bureaux de Sand Hill Road" par les VC ; a dû pivoter du B2C vers les payeurs (Medicaid), CEO parti en 2018. | Le salariat est plus sain mais lourd en capital ; **le B2C pur en care n'a pas suffi à faire vivre une boîte**. [Staffing Industry](https://www.staffingindustry.com/Editorial/Healthcare-Staffing-Report/Archive-Healthcare-Staffing-Report/2016/Sept.-8-2016/Hometeam-CEO-shunned-by-Silicon-Valley-VCs-for-classifying-workers-as-W-2-Business-Insider), [HHCN](https://homehealthcarenews.com/2018/04/hometeam-ceo-to-step-down-as-company-goes-all-in-on-medicaid/) |
| **Honor** (US) | Démarré comme marketplace tech, a fini par **racheter Home Instead** (franchise traditionnelle, 1 200 agences, 90 000 aides) en 2021 pour exister à l'échelle. | La tech seule ne fait pas un réseau de care : **l'opérationnel local et la confiance sont le produit**. [Senior Housing News](https://seniorhousingnews.com/2021/08/06/honor-acquires-home-instead-in-home-care-deal-with-senior-living-implications/) |
| **Care.com** (US, enquête WSJ mars 2019) | ~9 cas en 6 ans de "caregivers" avec casier, listés sur la plateforme, accusés de crimes (vol, abus, agression sexuelle, meurtre). Vérification de base non incluse dans l'abonnement standard ; 46 594 annonces de crèches retirées (≈45 %) ; chute en Bourse et rachat par IAC fin 2019. | "Nous ne sommes qu'un intermédiaire technique" **ne tient pas une seconde face à la presse**. [Engadget](https://www.engadget.com/2019-03-31-care-com-pulls-47000-daycare-listings.html), [Daily Beast/WSJ](https://thedailybeast.com/wsj-kids-assaulted-died-in-hands-of-carecom-caregivers), [backgroundchecks.com](https://backgroundchecks.com/blog/care-com-comes-under-fire-for-background-check-policies) |
| **Papa** (US, "companionship" seniors — **votre analogue le plus proche**) | Modèle "Papa Pals" indépendants pour compagnie/courses/rendez-vous. Bloomberg (2023) : >1 200 rapports internes de plaintes, dizaines d'allégations de harcèlement/agression sexuelle (dans les deux sens : seniors → pals et pals → seniors), vols. Humana, Aetna, Molina ne renouvellent pas ; ~3 douzaines de payeurs partent ; licenciements. | **Exactement votre offre, avec 240 M$ levés, et le trust & safety l'a fait vaciller.** Notez aussi : le risque va dans les deux sens (l'accompagnant peut être victime). [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/caregiving-tech-startup-papa-rolls-out-new-safety-security-measures-following-media), [Becker's](https://www.beckerspayer.com/payer/nearly-3-dozen-payers-drop-senior-companionship-company/), [HHCN](https://homehealthcarenews.com/2022/07/at-home-care-company-papa-lays-off-15-of-workforce/) |
| **Stootie** (FR, petits services entre particuliers) | Redressement puis liquidation judiciaire simplifiée, reprise par une filiale de Cdiscount, app fermée en décembre 2021. | Le "jobbing" grand public généraliste en France n'a pas trouvé d'économie viable. [Aladom](https://www.aladom.fr/actualites/secteur-service/9666/quelles-alternatives-a-stootie/), [FrenchWeb](https://www.frenchweb.fr/cdiscount-en-pole-position-pour-reprendre-stootie-lapplication-pour-les-petits-depannages-du-quotidien/341360) |
| **ARAST** (La Réunion, association d'aide à domicile, liquidée ~2013) | >1 200 salariés licenciés, des milliers de personnes âgées sans accompagnement ; rôle du Conseil général pointé par la Chambre régionale des comptes. | Sur l'île, **le secteur a une mémoire** : le Département, les familles et les syndicats se souviennent d'un effondrement. Votre fiabilité sera jugée à cette aune. [Question AN](https://questions.assemblee-nationale.fr/dyn/13/questions/QANR5L13QE117356.pdf) |
| **Ceux qui survivent en France** : Wecasa (60 M€ de volume d'affaires 2024), Click&Care (réseau d'agences d'aide à domicile, 5 M€ levés juillet 2026), Ouihelp (SAP prestataire salarié) | Les survivants du care seniors en France ont **presque tous choisi d'être des opérateurs SAP déclarés/autorisés avec salariés**, ou des outils pour ces opérateurs. Wecasa fonctionne sur des services "plaisir" (beauté, massage), pas sur des personnes vulnérables. | Signal fort : **le marché a déjà répondu à votre question de modèle**. [Banque des Territoires](https://www.banquedesterritoires.fr/clickcare-leve-5-meur-pour-revaloriser-le-metier-daide-domicile), [Maddyness](https://www.maddyness.com/2024/12/06/services-a-domicile-wecasa-accelere-et-veut-se-deployer-dans-toute-la-france/), [FrenchWeb Ouihelp](https://www.frenchweb.fr/ouihelp-leve-3-millions-deuros-pour-ameliorer-laide-a-domicile-aux-personnes-agees/313984) |

---

## 2. Les 15 raisons principales d'échec

Échelle : **Probabilité** (sur 24 mois) Faible / Moyenne / Élevée / Très élevée. **Gravité** 1 (gênant) à 5 (mort de l'entreprise).

### R1 — Le piège réglementaire est chez les accompagnants, pas chez vous
- **Mécanisme** : La loi ASV (2015) a créé un régime d'**autorisation départementale** pour les services d'aide et d'accompagnement à domicile intervenant en mode prestataire auprès des personnes de 60 ans et plus et des personnes handicapées (CASF L313-1-2). La liste SAP (Code du travail D7231-1, décret 2016-750) range dans les activités soumises à **autorisation (prestataire) / agrément (mandataire)** : l'assistance aux personnes âgées ou handicapées ayant besoin d'une aide personnelle à domicile, la conduite de leur véhicule personnel, et **l'accompagnement dans leurs déplacements hors du domicile (promenades, aide à la mobilité et au transport, actes de la vie courante)**. Or "présence", "accompagnement aux rendez-vous", "courses avec la personne" = cœur de votre offre. Un micro-entrepreneur qui le fait pour un public de 60+ **en mode prestataire** est, selon toute vraisemblance, dans le champ de l'autorisation, qu'il passe par vous ou pas. Et l'autorisation est délivrée via appel à projets du Département : inaccessible à un auto-entrepreneur isolé. Sources : [Banque des Territoires / AN sur loi ASV](https://www.assemblee-nationale.fr/14/amendements/1994/CION-SOC/AS326.pdf), [Haute-Loire, dossier d'autorisation SAAD](https://www.hauteloire.fr/sites/cg43/IMG/docx/DOSSIER_AUTORISATION_SAAD.docx), [CCI Paris IdF, agrément/déclaration](https://www.entreprises.cci-paris-idf.fr/fiches-pratiques/les-services-la-personne-lagrement-et-la-declaration).
- ⚠️ Zone grise : les activités "déclarées" seules (assistance administrative à domicile, livraison de courses, etc.) ne demandent pas d'autorisation ; la "compagnie" pure n'est pas nommée comme telle et sa qualification est discutée. **Faire valider par rescrit / échange écrit avec la DEETS et le Département avant lancement.**
- **Probabilité** : Élevée (que le problème existe) / Moyenne (qu'il soit sanctionné vite). **Gravité** : 5.
- **Signal d'alerte** : un SAAD local ou une fédération (UNA, ADMR, FESP) écrit au Département ; question d'un conseiller départemental ; refus de la DEETS d'enregistrer une déclaration SAP d'un accompagnant pour l'activité "personnes âgées".
- **Parade** : voir §5. En bref : (a) **emploi direct par la famille via CESU** (le particulier employeur n'est pas soumis à autorisation), la plateforme fait le matching + la paie ; ou (b) **partenariat avec un SAAD autorisé** qui porte juridiquement les missions sensibles ; ou (c) obtenir soi-même l'**agrément mandataire** (DEETS) puis l'autorisation prestataire à terme. Restreindre le MVP aux activités déclarées pendant la phase de clarification.

### R2 — Requalification en contrat de travail / responsabilité de plateforme
- **Mécanisme** : la Cour de cassation requalifie dès qu'il y a pouvoir de donner des ordres, contrôler et sanctionner (Take Eat Easy, 28 nov. 2018 ; Uber, 4 mars 2020). Or pour rassurer les familles vous allez vouloir : fixer les prix, imposer une charte, un check-in/check-out, des notes, désactiver les mauvais accompagnants… Chaque mesure de sécurité est **un indice de subordination**. Par ailleurs, une plateforme qui "détermine les caractéristiques de la prestation et fixe son prix" entre dans le régime de responsabilité sociale des plateformes (Code du travail L7342-1 et suivants : prise en charge d'assurance accident, droit à la formation…). Sources : [CMS](https://cms.law/en/fra/news-information/requalification-en-contrat-de-travail-de-la-relation-entre-travailleurs-independants-et-plateformes), [Le Grand Continent](https://legrandcontinent.eu/fr/2020/08/30/la-qualification-des-travailleurs-de-plateformes-en-france/).
- Bonus : un accompagnant qui fait 90 % de son CA via vous, 25 h/semaine chez la même famille = **salarié déguisé** (de la famille ou de vous). Et l'Urssaf DOM contrôle.
- **Probabilité** : Moyenne (un contentieux en 3 ans dès 30+ accompagnants actifs). **Gravité** : 4-5.
- **Signal d'alerte** : accompagnants mono-plateforme > 70 % de leur CA ; plainte prud'homale ; contrôle Urssaf ; un accompagnant désactivé qui conteste.
- **Parade** : choisir clairement un camp. Soit vous êtes **vraiment** un tiers neutre (prix libres fixés par l'accompagnant, pas de sanction autre que contractuelle, multi-plateformes encouragé), soit vous **assumez l'employeur** (vous ou la famille). Le milieu flou est le pire endroit.

### R3 — Incident grave chez une personne vulnérable + crise médiatique locale
- **Mécanisme** : chute pendant un accompagnement, vol de carte bancaire, abus de faiblesse (Code pénal 223-15-2), legs/donation captée (interdit aux intervenants SAP par CASF L116-4 ⚠️ à vérifier dans sa rédaction actuelle), agression, ou l'inverse : accompagnante harcelée par un client. Sur une île, Facebook/WhatsApp locaux + Réunion 1ère/Guadeloupe La 1ère amplifient en 24 h. Papa et Care.com montrent que **même une poignée de cas sur des milliers suffit**.
- **Probabilité** : Élevée sur 24 mois si > 2 000 missions (incident mineur quasi certain ; incident grave ≈ 10-25 %, estimation non sourcée). **Gravité** : 5.
- **Signal d'alerte** : réclamations "objet disparu", retards non signalés, accompagnant qui propose de "continuer en direct", famille qui ne répond plus aux points de suivi, signalements de gestes déplacés (même anodins).
- **Parade** : (1) vérifications sérieuses : identité, **bulletin n°3 du casier judiciaire** demandé par l'accompagnant (seul accessible légalement ; il ne contient que les condamnations graves — dire honnêtement ses limites), 2 références vérifiées par téléphone, entretien en personne, période probatoire en binôme ; (2) **règles anti-abus financier** écrites : jamais de carte bancaire/code, pas de cadeaux > 20 €, aucun mandat, courses avec ticket photographié ; (3) assurances RC pro + RC plateforme + protection juridique ; (4) **protocole de crise écrit avant la 1re mission** : qui appelle la famille, la police, le Département, le journaliste ; (5) canal de signalement anonyme pour les accompagnants aussi ; (6) un référent "safeguarding" (même à temps partiel) et un lien avec la cellule de signalement maltraitance (3977).

### R4 — Désintermédiation (la "fuite")
- **Mécanisme** : le care est **relationnel et répétitif** : même accompagnante, même mamie, chaque mardi. Après 2-3 missions, tout le monde a le numéro de tout le monde (surtout si **WhatsApp est l'outil de coordination** : vous leur donnez vous-même le canal direct). Commission 15-20 % sur un panier de 40 € = 6-8 € économisés par visite, ~30 €/mois : une incitation suffisante pour contourner. Homejoy est mort aussi de ça.
- **Probabilité** : Très élevée. **Gravité** : 4.
- **Signal d'alerte** : fréquence de réservation d'un binôme famille/accompagnant qui chute après la 3e mission alors que la famille reste "satisfaite" ; accompagnants dont le volume baisse mais pas les avis.
- **Parade** : ne pas monétiser la transaction mais **ce qui reste utile après le match** : paie/CESU/avance immédiate du crédit d'impôt (la famille ne paie que 50 %), assurance incluse, remplacement garanti en cas d'absence (la vraie douleur), journal de visite partagé avec la fratrie, coordination multi-intervenants, facturation unique. Si contourner coûte **plus cher** à la famille (perte du crédit d'impôt immédiat, plus de remplaçant, plus d'assurance), vous ne fuyez plus.

### R5 — Pouvoir d'achat local insuffisant et concurrence de l'informel
- **Mécanisme** : taux de pauvreté ~36 % à La Réunion, 34,5 % en Guadeloupe (2020), contre ~14,5 % dans l'Hexagone ; coût de la vie plus élevé. La solidarité familiale ("gramoune" gardé à la maison) et le travail non déclaré sont des alternatives gratuites ou à 10 €/h en liquide. L'INSEE titrait déjà que les services à la personne sont "moins utilisés qu'en métropole" à La Réunion. Sources : [Fondation pour le logement, synthèse Réunion 2025](https://www.fondationpourlelogement.fr/sites/default/files/2025-04/WEBSynthe%CC%80seRe%CC%81union2025.pdf), [IEDOM](https://www.iedom.fr/IMG/pdf/iedom_ra_24_-chiffres-cles.pdf), [Observatoire des inégalités](https://www.inegalites.fr/DOM-une-grande-pauvrete-cinq-a-dix-fois-plus-elevee-qu-en-metropole), INSEE "Des services moins utilisés qu'en métropole — Les SAP à La Réunion" (insee.fr/fr/statistiques/4643876).
- **Probabilité** : Élevée. **Gravité** : 4.
- **Signal d'alerte** : taux de conversion devis → mission < 20 % ; objection prix majoritaire ; panier moyen qui se réduit à 1 h.
- **Parade** : **le payeur n'est pas forcément sur l'île**. Cibler en priorité la **diaspora** (enfants réunionnais/antillais vivant dans l'Hexagone, revenus hexagonaux, culpabilité de la distance, besoin de nouvelles) et les **solvabilisateurs** (APA, PCH, caisses de retraite, mutuelles, employeurs). Sans crédit d'impôt à 50 % (immédiat), le prix est perdu d'avance face à l'informel.

### R6 — Pénurie d'accompagnants fiables
- **Mécanisme** : le secteur de l'aide à domicile est en pénurie chronique partout en France ; les bons profils sont déjà salariés d'un SAAD, de l'ADMR, d'un EHPAD, ou travaillent au noir. Un micro-entrepreneur à 15 % de commission + cotisations (~21-24 % en BNC/BIC services) + déplacements en voiture (îles montagneuses, embouteillages en Réunion) gagne **moins que le SMIC horaire net** s'il fait < 20 h/sem. Votre "abonnement accompagnant à 29-49 €/mois" aggrave ça.
- **Probabilité** : Élevée. **Gravité** : 4.
- **Signal d'alerte** : < 1 accompagnant actif pour 4 familles actives ; taux de missions non pourvues > 15 % ; churn accompagnants > 30 %/trimestre.
- **Parade** : calculer le **revenu net horaire réel de l'accompagnant** (après cotisations, trajets, temps mort) et l'afficher ; garantir un volume (planning regroupé par zone) ; supprimer l'abonnement côté offre au lancement ; viser des viviers sous-exploités (jeunes retraités, étudiants en santé/social, aidants ayant perdu leur proche, mères de famille à temps partiel) ; partenariat France Travail / Mission locale / formations (titre ADVF).

### R7 — La micro-taille des marchés insulaires
- **Mécanisme** : Guadeloupe ~380 000 hab., Martinique ~350 000 en déclin, La Réunion ~880 000. Même avec un vieillissement spectaculaire (Martinique : 42 % de 65+ projeté en 2050, 1er département le plus âgé ; Guadeloupe 37,7 % ; Réunion : les 75+ ×3 d'ici 2050), **le marché adressable payant aujourd'hui** est petit. Calcul de coin de table : Réunion, ~55 000 personnes de 75+ ⚠️ ; si 3 % achètent 8 h/mois à 22 € → ~1 650 clients × 176 € = ~290 k€/mois de volume, ~45 k€/mois de commission à 15 % **à part de marché 100 %**. Réaliste à 20 % de part : ~9 k€/mois. Pas une entreprise "venture". Sources : [Outremers360 / rapport interministériel Martinique](https://outremers360.com/bassin-atlantique-appli/vieillissement-un-scenario-catastrophe-pour-la-martinique-selon-un-rapport-interministeriel), [Sénat r22-658](https://www.senat.fr/rap/r22-658/r22-658-syn.pdf), [INSEE Flash Réunion](https://www.insee.fr/fr/statistiques/7726666).
- **Probabilité** : Certaine (c'est un fait). **Gravité** : 3 (si on le sait), 5 (si on lève comme une startup hexagonale).
- **Signal d'alerte** : CAC qui monte après 6 mois (saturation du bouche-à-oreille), mêmes 200 familles qui tournent.
- **Parade** : l'Outre-mer est un **terrain d'apprentissage et un avantage politique** (CNSA, FEDER, Départements très demandeurs), pas un marché final. Plan d'emblée "DROM + diaspora + Hexagone rural (Creuse, Cantal, Nièvre…)" dès que le playbook est validé. Ou assumer une **entreprise sociale rentable et modeste** (SCIC, ESUS) plutôt qu'une startup VC.

### R8 — Les coûts cachés de l'Outre-mer et la logistique insulaire
- **Mécanisme** : coûts de déplacement (voiture indispensable, carburant), assurance plus chère, fuseaux horaires (Réunion +2/+3 h vs Paris, Antilles −5/−6 h : la diaspora appelle à 22 h heure locale), aucune présence physique du fondateur s'il est dans l'Hexagone, marchés de 3 îles = 3 Départements, 3 DEETS, 3 politiques APA différentes. Multi-îles ≠ un marché : **Guadeloupe et Martinique, c'est deux lancements, pas un.**
- **Probabilité** : Élevée. **Gravité** : 3.
- **Signal d'alerte** : coût par mission opérationnelle (téléphone, coordination) > commission perçue.
- **Parade** : **une seule île pendant 12 mois**, un·e responsable local·e salarié·e ou associé·e dès le jour 1, zones restreintes (une intercommunalité, ex. CINOR ou TCO à La Réunion) pour densifier.

### R9 — Fondateur seul
- **Mécanisme** : le care exige simultanément opérations 7j/7 (astreinte quand une accompagnante ne vient pas un dimanche), recrutement, juridique, vente B2B2C, levée de subventions, produit. **Le burn-out du fondateur est la cause de mort n°1 des pilotes de services.** Les VC et la CNSA financent rarement un solo.
- **Probabilité** : Élevée. **Gravité** : 5.
- **Signal d'alerte** : > 60 h/sem pendant 2 mois ; aucune délégation possible sur l'astreinte ; délai de réponse aux familles > 2 h.
- **Parade** : un·e **cofondateur·rice opérations issu·e du médico-social local** (ex-responsable de secteur SAAD, infirmière coordinatrice, travailleur·se social·e créole·phone) avant toute levée ; comité d'éthique bénévole (médecin gériatre, juriste, représentant d'usagers).

### R10 — Dépendance à WhatsApp / Meta et à des outils no-code
- **Mécanisme** : comptes WhatsApp Business bannis sans préavis, changement de tarification (passage au **prix par message depuis le 1er juillet 2025** pour les templates) ; surtout : **données de dépendance/santé** (art. 9 RGPD) circulant sur WhatsApp, Airtable et Tally hébergés hors UE → non-conformité RGPD, potentiellement hébergement de données de santé (HDS) si vous tenez un suivi médico-social ⚠️. Et WhatsApp **donne le numéro direct** aux deux parties (cf. R4). Source : [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing).
- **Probabilité** : Moyenne (bannissement) / Élevée (non-conformité RGPD). **Gravité** : 3.
- **Signal d'alerte** : messages de santé ("elle a fait un malaise") dans des groupes WhatsApp ; aucune AIPD (analyse d'impact) réalisée.
- **Parade** : WhatsApp uniquement comme **canal de notification**, jamais comme dossier ; numéro relais/masqué ; minimisation (aucune donnée médicale dans le MVP) ; AIPD simple dès le pilote ; migration vers un outil hébergé UE au-delà de 100 familles.

### R11 — Concurrence : La Poste, SAAD, téléassistance, bénévolat
- **Mécanisme** : La Poste "Veiller sur mes parents" vend **une visite hebdo du facteur à 23,90 €/mois (11,95 € après crédit d'impôt)**, avec une marque de confiance centenaire et un réseau déjà sur place ([La Poste](https://www.laposte.fr/services-seniors/visites-du-facteur)) — ⚠️ disponibilité et contenu exacts en DROM à vérifier. Les SAAD autorisés captent l'APA. Les associations (Petits Frères des Pauvres, MONALISA, CCAS) font de la visite de convivialité **gratuite**. Les acteurs nationaux (Click&Care, Ouihelp, franchises type Petits-fils) peuvent ouvrir une agence quand vous aurez prouvé le marché.
- **Probabilité** : Moyenne. **Gravité** : 3.
- **Signal d'alerte** : prospects qui citent "le facteur" ou "l'aide de l'APA" ; ouverture d'une franchise nationale dans votre zone.
- **Parade** : ne pas concurrencer la visite de 10 min ni l'aide APA : se positionner sur **ce que personne ne fait bien** : l'accompagnement hors domicile long (rdv médicaux, démarches CAF/CGSS, banque), la **coordination pour la famille à distance** et le "compte rendu humain". Mieux : **devenir le partenaire des SAAD** (ils manquent de bras pour ces missions non APA).

### R12 — Saisonnalité et irrégularité de la demande
- **Mécanisme** : pics (vacances scolaires où les aidants partent, fêtes, retours de la diaspora en décembre/juillet-août qui **réduisent** la demande pendant leur séjour), creux en saison cyclonique (Réunion janv.-mars, Antilles août-oct.) avec annulations. Les accompagnants ne peuvent pas vivre d'un volume irrégulier.
- **Probabilité** : Élevée. **Gravité** : 2.
- **Signal d'alerte** : variance mensuelle des heures > ±30 %.
- **Parade** : abonnement mensuel côté famille (forfait d'heures récurrentes), offre "répit aidant" sur les vacances, protocole cyclone (appels de vérification = service à haute valeur perçue).

### R13 — Unit economics négatifs et "pilote qui ne prouve rien"
- **Mécanisme** : 2 h × 20 €/h = 40 € ; commission 15 % = 6 €. Coût d'acquisition famille en B2C local réaliste 80-200 € (salons seniors, Facebook, pharmacies) ⚠️ estimation. Coût de matching manuel (appels, visite d'évaluation, suivi) ≈ 1-2 h de fondateur par nouvelle famille. **Il faut ≈ 15-30 missions par famille pour rembourser le CAC.** 50-100 missions au total en 4 mois = 600-1 200 € de revenu, et aucune lecture de la rétention à 6 mois.
- **Probabilité** : Très élevée (sans changement). **Gravité** : 4.
- **Signal d'alerte** : moins de 50 % des familles reprennent une 2e mission sous 30 jours.
- **Parade** : redéfinir le KPI du pilote : **nombre de familles récurrentes** (≥ 4 missions/mois pendant 3 mois) plutôt que nombre de missions ; prix en **forfait mensuel** (ex. 4 visites + compte rendu + remplacement garanti) ; mesurer la marge contributive par famille et par mois.

### R14 — Dépendance aux financements publics et au cycle politique
- **Mécanisme** : CNSA, FEDER, FSE+, conférences des financeurs : délais de 6-18 mois, paiement à terme échu (trésorerie !), dossiers lourds, contrôles a posteriori ; un changement de majorité départementale ou de priorités budgétaires coupe le robinet. Et **un financeur public ne financera pas un modèle conçu pour contourner son propre régime d'autorisation.**
- **Probabilité** : Moyenne. **Gravité** : 3.
- **Signal d'alerte** : > 40 % du budget dépendant d'une subvention non encore notifiée.
- **Parade** : subventions = accélérateur, jamais le modèle ; chercher des **financements en "contrat de résultat"** (expérimentation article 51 ⚠️ si volet santé, contrats avec caisses de retraite type CGSS/Agirc-Arrco sur la prévention de la perte d'autonomie, mutuelles) ; prêt d'honneur + BPI + Initiative Réunion/Guadeloupe pour la trésorerie.

### R15 — Le transport de personnes et les risques "invisibles"
- **Mécanisme** : "accompagner aux rendez-vous" = qui conduit ? Transporter une personne **contre rémunération dans le véhicule de l'accompagnant** peut tomber sous la réglementation du transport public particulier de personnes (VTC/taxi) ⚠️, et l'assurance auto personnelle **ne couvre généralement pas** un usage professionnel. La SAP prévoit la "conduite du véhicule personnel **de la personne âgée**", ce qui est différent (et soumis à autorisation/agrément pour ce public). Autres risques invisibles : clés confiées, animaux, fin de vie (que fait l'accompagnant face à un décès ?), mesures de protection juridique (tutelle/curatelle : qui signe ?).
- **Probabilité** : Élevée (que la situation arrive). **Gravité** : 4 (accident de la route = responsabilité lourde).
- **Signal d'alerte** : > 20 % des missions incluent un trajet en voiture.
- **Parade** : au MVP, **trajets en taxi conventionné/transport à la demande, l'accompagnant accompagne mais ne transporte pas** ; ou véhicule de la personne + assurance vérifiée ; avenant "usage professionnel" exigé ; procédures écrites (urgence, décès, clés, majeur protégé).

### Synthèse — carte des risques

| # | Risque | Proba. | Gravité | Priorité |
|---|---|---|---|---|
| R1 | Autorisation SAP côté accompagnants | Élevée | 5 | **P0 — avant lancement** |
| R3 | Incident grave / crise médiatique | Élevée | 5 | **P0** |
| R4 | Désintermédiation | Très élevée | 4 | **P0 (design du modèle)** |
| R13 | Unit economics / pilote non probant | Très élevée | 4 | **P0** |
| R2 | Requalification / responsabilité plateforme | Moyenne | 5 | P1 |
| R9 | Fondateur seul | Élevée | 5 | P1 |
| R5 | Pouvoir d'achat / informel | Élevée | 4 | P1 |
| R6 | Pénurie d'accompagnants | Élevée | 4 | P1 |
| R15 | Transport / risques invisibles | Élevée | 4 | P1 |
| R7 | Taille des marchés insulaires | Certaine | 3-5 | P1 (stratégie) |
| R10 | WhatsApp / RGPD | Moy./Élevée | 3 | P2 |
| R8 | Coûts Outre-mer / multi-îles | Élevée | 3 | P2 |
| R11 | Concurrence | Moyenne | 3 | P2 |
| R14 | Dépendance subventions | Moyenne | 3 | P2 |
| R12 | Saisonnalité | Élevée | 2 | P3 |

---

## 3. Les hypothèses "leap of faith", classées, avec le test le moins cher

Classement = (impact si fausse) × (incertitude actuelle). Chaque test doit coûter < 500 € et < 3 semaines, sauf mention.

| Rang | Hypothèse | Pourquoi elle est risquée | Test le moins cher / le plus rapide | Seuil de validation (go) | Seuil d'abandon / pivot |
|---|---|---|---|---|---|
| **H1** | **Le cadre juridique "intermédiaire + auto-entrepreneurs" est légal pour les activités ciblées auprès des 60+** | Si faux, tout le modèle est illégal côté offre (R1/R2). | 2 h d'avocat spécialisé SAP/droit social (300-600 €) + **demande écrite** à la DEETS et au service autonomie du Département listant précisément les 6 activités du MVP. | Réponse écrite confirmant que ≥ 4 activités sur 6 sont en régime déclaratif, sans autorisation. | Si "accompagnement hors domicile" et "présence à domicile" exigent l'autorisation → bascule CESU/mandataire/partenariat SAAD (§5). |
| **H2** | **Quelqu'un paie, de façon récurrente, un prix qui fait vivre l'accompagnant et la plateforme** | Pauvreté locale + informel + gratuité associative (R5). | Landing page + **précommande avec paiement** (acompte 20 € remboursable) pour un forfait "4 visites/mois + compte rendu", diffusée 2 semaines (Facebook local + groupes diaspora + 5 pharmacies). Budget pub 300 €. | ≥ 25 familles qui **paient l'acompte** ; ≥ 40 % des payeurs hors de l'île (diaspora) ou solvabilisés. | < 10 acomptes → le B2C direct ne marche pas ; viser B2B2C (caisses, mutuelles, employeurs). |
| **H3** | **Les familles restent sur la plateforme après le premier bon match** (pas de fuite) | Désintermédiation (R4). | Concierge test avec 10 familles sur 8 semaines, **même binôme** famille/accompagnant ; mesurer qui continue via vous quand vous proposez explicitement "vous pouvez continuer en direct". | ≥ 70 % des familles **choisissent de rester** à M+2, en citant un bénéfice concret (avance de crédit d'impôt, remplacement, compte rendu). | < 50 % → la valeur n'est que le match : passer à un modèle **frais de placement unique** ou abonnement de service, pas commission. |
| **H4** | **On peut recruter et retenir des accompagnants fiables à un revenu attractif** | Pénurie (R6). | Annonce (France Travail, Facebook, Leboncoin) + **session d'information collective** ; compter candidatures, présents, profils retenus après entretien + B3 + 2 références. | ≥ 30 candidatures, ≥ 8 profils retenus, ≥ 5 actifs à M+2 avec revenu net horaire ≥ 13 €. | < 4 retenus → partenariat avec un SAAD ou une structure d'insertion pour l'offre. |
| **H5** | **La diaspora (enfants dans l'Hexagone) est le meilleur payeur** | Hypothèse séduisante mais non testée. | 15 entretiens (Calendly + groupes Facebook "Réunionnais de Paris/Lyon", associations antillaises) + même landing page avec ciblage géographique Hexagone. | ≥ 10 entretiens où la personne cite spontanément une douleur hebdomadaire (pas de nouvelles, rdv manqués) ; CPA diaspora < 50 % du CPA local. | Douleur faible ou "ma sœur sur place s'en occupe" majoritaire → recentrer local + B2B2C. |
| **H6** | **On peut garantir la sécurité à un coût compatible avec le prix** | Coût de vetting + suivi + assurance (R3). | Chiffrer pour 10 accompagnants : temps d'entretien, B3, références, formation 1 jour, assurance RC (3 devis). | Coût total de vetting + assurance < 150 € par accompagnant et < 8 % du revenu par mission. | Si > 15 % → seul un modèle salarié/SAAD amortit ces coûts. |
| **H7** | **Un acteur B2B2C (caisse de retraite, mutuelle, employeur, Département) paiera pour le service** | Clé pour sortir du B2C pauvre ; cycles longs. | 10 rendez-vous (CGSS, 2 mutuelles locales, 2 grands employeurs, service autonomie du Département, CCAS d'une grande commune) avec une **offre d'expérimentation de 20 bénéficiaires**. | 1 lettre d'intention signée avec budget, ou 1 expérimentation financée ≥ 10 k€ sous 6 mois. | 0 sur 10 → le B2B2C n'est pas un levier à court terme ; ne pas le mettre dans le business plan. |
| **H8** | **Le fondateur peut opérer seul 3-4 mois sans casser la qualité** | R9. | Journal de temps sur les 4 premières semaines du concierge. | < 45 h/sem, délai de réponse famille < 2 h, 0 mission non remplacée. | Au-delà → recruter un·e associé·e ops avant d'augmenter le volume. |
| **H9** | **WhatsApp est un canal acceptable pour les familles et le régulateur** | R10. | Demander à 10 familles leur canal préféré ; AIPD simplifiée (modèle CNIL). | ≥ 80 % OK WhatsApp pour notifications, aucune donnée de santé nécessaire. | Sinon SMS + appel + page web sécurisée. |

**Règle d'or** : on ne teste pas H2-H9 tant que H1 n'a pas une réponse écrite, parce que H1 détermine le modèle qu'on teste.

---

## 4. Pre-mortem — octobre 2028 : le projet a échoué

> *Extrait du post de LinkedIn du fondateur, novembre 2028 : "Ce que j'ai appris en fermant…"*

Nous avons lancé à La Réunion en janvier 2027, après trois mois de site Tally/Airtable. Le pilote a "marché" : 112 missions en quatre mois, une note moyenne de 4,8/5, un article dans le JIR. Nous avons pris ça pour une validation. C'était une erreur : 70 % des missions venaient de 14 familles, et à partir du troisième mois la moitié d'entre elles avaient continué en direct avec "leur" accompagnante, sur WhatsApp, payée en CESU ou en liquide. Nous avions mesuré du volume, pas de la fidélité.

Pour compenser, nous avons ajouté l'abonnement accompagnant à 29 €/mois. Les meilleures sont parties les premières : elles avaient déjà assez de clients. Il nous restait des profils moins stables, et un taux de missions non pourvues de 25 % le week-end. Je faisais l'astreinte seul, depuis mon téléphone, souvent à 23 h pour répondre à des enfants inquiets à Paris.

En septembre 2027, une accompagnante a emmené une dame de 84 ans à un rendez-vous au CHU avec sa propre voiture. Accident sans gravité pour la conductrice, fracture du col du fémur pour la passagère. Son assurance a refusé : usage professionnel non déclaré. La famille s'est tournée vers nous. Nos CGU disaient "intermédiaire technique" ; l'avocat de la famille a montré que nous fixions les prix, choisissions l'accompagnante, envoyions les consignes et "désactivions" les profils mal notés. Au même moment, un SAAD autorisé a signalé au Département que nous exercions sans autorisation une activité d'accompagnement hors domicile de personnes âgées. Le Département, qui finançait notre volet "prévention de l'isolement" via la conférence des financeurs, a suspendu la subvention en attendant clarification. Réunion 1ère a fait un sujet : "Aide aux gramounes : une appli sans agrément".

En janvier 2028, nous avons tenté la Guadeloupe pour retrouver de la croissance, pensant que le playbook était transférable. Ce n'était pas le cas : autre Département, autre culture, pas de responsable local, et un marché encore plus petit. Nous avons brûlé l'aide BPI et le prêt d'honneur. Les mutuelles avec lesquelles nous discutions depuis un an ont toutes dit la même chose : "revenez quand vous serez autorisés ou adossés à un SAAD". La levée seed n'a jamais eu lieu : les VC ont vu un marché de quelques centaines de milliers d'euros, un risque réglementaire non purgé et un fondateur seul épuisé.

**Les vraies causes, dans l'ordre** : (1) modèle juridique choisi pour éviter la réglementation plutôt que pour servir les familles ; (2) commission sur une relation qui ne demandait plus d'intermédiaire après le match ; (3) KPI de vanité (missions) au lieu de rétention ; (4) aucune préparation au premier incident ; (5) expansion avant densité ; (6) solitude du fondateur.

---

## 5. Le scénario inverse — octobre 2028 : succès au-delà des espérances

> *Extrait d'un article des Échos, octobre 2028 : "La startup réunionnaise qui a réinventé le lien avec les aînés"*

Tout a changé en novembre 2026, avant même la première mission, quand le fondateur a reçu la réponse écrite de la DEETS : la moitié de son offre exigeait une autorisation. Au lieu de contourner, il a pivoté : **les familles deviendraient employeuses directes via le CESU**, la plateforme se chargeant du matching, des contrats, de la paie, de l'**avance immédiate du crédit d'impôt** (la famille ne paie que la moitié, tout de suite) et d'un **remplacement garanti sous 24 h**. Pour les situations lourdes, un partenariat avec deux SAAD autorisés de l'île, qui manquaient de bras pour les missions hors APA, prenait le relais. Le Département, au lieu de s'inquiéter, a vu un allié contre le travail non déclaré.

Le deuxième déclic a été le payeur. Les entretiens ont montré que la personne qui souffrait le plus n'était pas la mamie, mais **sa fille à Lyon**, qui apprenait toujours trop tard que sa mère avait manqué un rendez-vous ou n'avait plus de médicaments. Le produit est devenu "**un fil de nouvelles**" : après chaque visite, un compte rendu humain de trois lignes et une photo (avec consentement), un appel vidéo hebdomadaire organisé par l'accompagnante, une alerte si quelque chose cloche. Le prix : un forfait mensuel de 4 à 12 visites, payé depuis l'Hexagone. Le bouche-à-oreille de la diaspora (associations, groupes Facebook, retours de vacances) a fait chuter le coût d'acquisition sous 40 €.

La sécurité est devenue l'argument de vente plutôt qu'un coût. Charte anti-abus financier publique, B3 + références + entretien en personne + formation d'une journée avec un gériatre, binôme pour les deux premières visites, protocole de crise testé, comité d'éthique avec un représentant d'usagers. Quand un incident est arrivé (une chute à domicile en avril 2027), la famille a été prévenue en 12 minutes, le compte rendu était factuel, et c'est elle qui a témoigné à la radio en faveur de la plateforme.

Les accompagnantes étaient mieux payées que dans la moyenne du secteur parce que les plannings étaient regroupés par quartier : 6 visites par demi-journée sur un même secteur de Saint-Denis, au lieu de 3 visites dispersées. La rétention des accompagnantes a dépassé 80 % à un an. En 2028, la CGSS et une mutuelle locale ont acheté un programme "prévention de l'isolement après hospitalisation" pour 300 bénéficiaires : premier contrat B2B2C, payé au résultat (réhospitalisations évitées, mesurées avec le CHU).

Enfin, l'Outre-mer s'est révélé un avantage : vieillissement le plus rapide de France, Départements prêts à expérimenter, diaspora organisée. Le playbook a été porté en **Martinique avec une associée locale**, puis dans **trois départements ruraux de l'Hexagone** où la même équation existait (parents isolés, enfants loin). La plateforme n'a jamais été la plus grosse ; elle a été **la plus digne de confiance**.

**Les vraies causes, dans l'ordre** : (1) cadre légal choisi pour être finançable et partenaire des pouvoirs publics ; (2) monétisation de la valeur récurrente (tranquillité, remplacement, crédit d'impôt immédiat) au lieu de la transaction ; (3) payeur = diaspora + B2B2C ; (4) densité géographique ; (5) sécurité comme produit ; (6) une équipe fondatrice avec un·e opérationnel·le du médico-social local.

---

## 6. Due diligence : les questions qu'un investisseur posera (et les réponses attendues)

### Juridique & conformité
| Question | Réponse attendue (ce qui rassure) | Drapeau rouge |
|---|---|---|
| "Quel est votre statut SAP exact, et celui des accompagnants ? Avez-vous un écrit de la DEETS / du Département ?" | Avis écrit + mémo d'avocat ; activités listées une par une avec leur régime ; plan pour l'agrément/autorisation ou partenariat SAAD. | "Nous sommes une simple plateforme technique." |
| "Pourquoi ne serez-vous pas requalifié comme Uber ?" | Choix assumé : soit emploi direct par la famille (CESU, convention collective particuliers employeurs IDCC 3239), soit indépendance réelle documentée (prix fixés par l'accompagnant, multi-clients, aucune sanction disciplinaire). | Prix imposés + notation + désactivation + indépendants. |
| "Si vous faites du placement, qui paie ?" | Seule la famille paie ; aucun frais facturé au candidat/salarié (le placement ne peut être payant pour le demandeur d'emploi, Code du travail L5321-3 ⚠️). | Abonnement payant pour les accompagnants salariés. |
| "RGPD, données de santé, hébergement ?" | Minimisation, AIPD faite, hébergement UE, pas de données médicales dans le MVP, DPO externe. | Dossiers de santé dans des groupes WhatsApp. |
| "DAC7 / obligations fiscales de plateforme ?" | Information des utilisateurs et déclaration annuelle des revenus des vendeurs à la DGFiP (CGI art. 242 bis) prévues. | Inconnu au bataillon. |

### Sécurité & risque
| Question | Réponse attendue | Drapeau rouge |
|---|---|---|
| "Que se passe-t-il le jour où une accompagnante vole ou maltraite une personne ?" | Protocole écrit, testé en exercice ; assurance RC plateforme + RC pro ; notification famille < 1 h ; signalement autorités ; communication de crise préparée. | "Ça n'arrivera pas, on vérifie les profils." |
| "Quelles vérifications, et quelles en sont les limites ?" | Identité, B3 (avec honnêteté sur ses limites), références appelées, entretien physique, binôme probatoire, retours familles à J+7. | Vérification uniquement en ligne. |
| "Et la sécurité des accompagnants (souvent des femmes seules au domicile d'inconnus) ?" | Évaluation du domicile à la 1re visite, droit de retrait, ligne d'alerte, exclusion des clients abusifs. | Pas de réponse (Papa a payé cher cet oubli). |

### Marché & économie
| Question | Réponse attendue | Drapeau rouge |
|---|---|---|
| "Quelle est la taille du marché **payant** sur l'île, et comment dépassez-vous ce plafond ?" | Bottom-up chiffré (75+, taux de recours SAP local, panier), plan diaspora + B2B2C + duplication Hexagone rural. | TAM "silver economy 130 Md€". |
| "Contribution margin par famille et par mois ? Payback du CAC ?" | Marge contributive > 0 dès le mois 2 ; payback < 6 mois ; cohortes. | "On sera rentable à l'échelle." |
| "Rétention des familles à M3/M6 ? Des accompagnants ?" | Courbes de cohorte, même petites (n=20), honnêtes. | Nombre total de missions sans cohortes. |
| "Que se passe-t-il quand une famille et une accompagnante s'entendent bien ?" | Elles restent parce que la plateforme porte paie, crédit d'impôt immédiat, remplacement, assurance, compte rendu fratrie. Taux de fuite mesuré. | "On interdit le contact direct dans les CGU." |
| "Revenu net horaire de vos accompagnants ?" | Chiffre réel, ≥ SMIC net + 10 %, trajets inclus. | Inconnu, ou inférieur au SMIC. |
| "Pourquoi La Poste, Click&Care ou un SAAD ne vous écrase pas ?" | Spécialisation (coordination diaspora, hors domicile, hors APA), partenariat plutôt que confrontation avec les SAAD, densité et confiance locales. | "Ils sont trop lents." |

### Équipe & exécution
| Question | Réponse attendue | Drapeau rouge |
|---|---|---|
| "Qui fait l'astreinte du dimanche à 7 h ?" | Associé·e ops local·e, rotation, procédure de remplacement. | Le fondateur, seul. |
| "Pourquoi vous ? Pourquoi là ?" | Lien personnel avec le territoire, réseau médico-social, crédibilité auprès du Département. | Opportunisme de subvention. |
| "Que faites-vous si les subventions n'arrivent pas ?" | Le modèle tient sans ; subventions = accélérateur. | Business plan à 60 % subventionné. |

### Ce qu'un VC dira probablement, honnêtement
**(VC)** : "Marché trop petit pour du venture tant que vous restez dans les DROM, risque réglementaire non purgé, solo founder. Revenez avec : une réponse écrite de l'administration, 30 familles récurrentes à M3 avec une marge positive, un·e associé·e ops, et la preuve que la diaspora paie. À ce stade, votre meilleur financement est BPI + prêt d'honneur + France Active/ESS + un pilote financé par une caisse ou une mutuelle, pas un VC."

---

## 7. Verdict : "marketplace light pour éviter la réglementation" — bonne idée ou piège ?

### Verdict : **c'est un piège.** Pas parce que le modèle de marketplace est mauvais en soi, mais parce que **le motif ("éviter la réglementation") est le mauvais point de départ** pour un service auprès de personnes vulnérables.

**(EX)** : "Nous avons fait exactement ça. Le 'light' nous a fait gagner six mois au début, et il nous a coûté l'entreprise à la fin. Le régulateur n'est pas votre ennemi : c'est votre futur client (le Département paie l'APA), votre futur prescripteur (CCAS, hôpitaux) et votre caution de confiance. Le contourner, c'est se fermer la porte de l'argent qui compte."

Pourquoi c'est un piège, en 5 points :
1. **Il ne vous protège pas** : l'obligation d'autorisation pèse sur l'activité d'accompagnement des 60+, donc sur vos accompagnants ; et le "simple intermédiaire" est requalifié dès que vous exercez le contrôle que la sécurité exige (R1, R2).
2. **Il vous prive du levier économique n°1** : le crédit d'impôt de 50 % et son avance immédiate, qui exigent un cadre SAP déclaré (ou l'emploi direct CESU). Sans lui, vous êtes 2× plus cher que l'informel.
3. **Il vous ferme le B2B2C** : APA, PCH, caisses de retraite, mutuelles et Départements ne financent que des cadres reconnus.
4. **Il est incompatible avec la sécurité** : vous ne pouvez pas à la fois "ne rien contrôler" (pour rester intermédiaire) et "tout vérifier" (pour protéger les personnes).
5. **Il maximise la fuite** : une commission sur une mise en relation unique, dans une relation intrinsèquement durable.

### Ce que je changerais fondamentalement

1. **Changer le cadre juridique (le plus important)**
   - **Option A — recommandée pour le pilote : "plateforme du particulier employeur"**. La famille emploie directement l'accompagnant via **CESU** (pas d'autorisation requise pour le particulier employeur ; crédit d'impôt 50 % avec avance immédiate ⚠️ vérifier les modalités pour le CESU+ en DROM). La plateforme vend **à la famille** un abonnement de service : matching, contrat type, paie, déclarations, remplacement, assurance complémentaire, comptes rendus. Le salarié ne paie rien.
   - **Option B — à 12-18 mois : devenir organisme SAP mandataire agréé** (agrément DEETS) puis, si la traction le justifie, **SAAD prestataire autorisé** via appel à projets du Département. Plus lourd, mais ouvre l'APA/PCH et les partenariats publics.
   - **Option C — en parallèle : "back-office et débordement" des SAAD existants** : ils sont autorisés et manquent de bras ; vous leur apportez demande, outil, accompagnants formés. Vous devenez infrastructure plutôt que concurrent.
   - Réserver le modèle "indépendants" aux activités **purement déclaratives** (assistance administrative, aide numérique, courses livrées) et aux publics non vulnérables.

2. **Changer d'unité de valeur** : de "mission à l'acte" à **"forfait mensuel de tranquillité"** (visites récurrentes + compte rendu + remplacement garanti + alerte), payé par l'aidant. Commission → abonnement famille 39-99 €/mois + coût des heures. **Supprimer l'abonnement accompagnant** (ou le transformer en avantages : formation, mutuelle, assurance).

3. **Changer de payeur prioritaire** : **diaspora** d'abord (pouvoir d'achat hexagonal, douleur forte, acquisition communautaire peu chère), **B2B2C** ensuite (caisses de retraite, mutuelles, employeurs d'aidants, sorties d'hospitalisation), local B2C solvable en troisième.

4. **Changer la métrique du pilote** : pas "50-100 missions", mais **"30 familles récurrentes à M3 avec ≥ 4 visites/mois, fuite < 30 %, marge contributive positive, 0 incident non géré"**.

5. **Faire de la sécurité le produit** : charte anti-abus financier publique, protocole de crise avant la 1re mission, sécurité des accompagnants autant que des aînés, comité d'éthique, transparence des incidents (rapport annuel de confiance). C'est ce qui vous différencie de la voisine au noir et de l'appli lambda.

6. **Densité avant expansion** : une île, une intercommunalité, 12 mois. Pas de Guadeloupe/Martinique avant d'avoir un playbook rentable et un·e associé·e local·e sur place.

7. **Équipe** : ne pas lancer seul. Un·e associé·e opérations issu·e du médico-social local est plus important qu'un CTO au stade MVP (le no-code suffit).

8. **Repositionner l'ambition** : l'Outre-mer comme **laboratoire du vieillissement le plus rapide de France**, avec une ambition de duplication vers tous les territoires où "les enfants sont loin des parents" (Hexagone rural, diasporas). C'est un pitch d'impact crédible, finançable par l'ESS, la BPI et, plus tard, des fonds à impact (plutôt que par des VC classiques).

---

## 8. Plan d'action anti-risque — les 30 prochains jours

| Semaine | Action | Livrable | Coût estimé |
|---|---|---|---|
| S1 | Consultation avocat SAP/droit social + courrier DEETS + RDV service autonomie du Département | Mémo juridique, liste des activités par régime | 300-600 € |
| S1-S2 | 15 entretiens diaspora + 10 familles locales + 3 SAAD + 1 CCAS | Synthèse douleurs/prix, carte des partenaires | 0 € |
| S2 | Landing page forfait mensuel + acompte remboursable | Taux de précommande (H2, H5) | 300 € de pub |
| S2-S3 | Session d'information recrutement accompagnants | Vivier qualifié (H4) | 100 € |
| S3 | Protocole de crise, charte anti-abus financier, devis assurances, AIPD | Dossier "confiance" prêt avant la 1re mission | 0-200 € |
| S4 | Décision Go / Pivot sur le cadre juridique (A, B ou C) avec les seuils de §3 | Note de décision d'une page | — |

---

## Sources principales

- Homejoy : [Wikipedia](https://en.wikipedia.org/wiki/Homejoy) · [Entrepreneur](https://www.entrepreneur.com/article/248896) · [Scaled and Failed](https://scaledandfailed.substack.com/p/issue-24-home-services) · [TechCrunch (pause France)](https://techcrunch.com/2014/12/15/homejoy-le-pause)
- HomeHero / Hometeam / Honor : [HHCN 2017](https://homehealthcarenews.com/2017/02/homehero-closure-casts-shadow-over-home-care-disrupters/) · [HHCN 2018](https://homehealthcarenews.com/2018/04/hometeam-ceo-to-step-down-as-company-goes-all-in-on-medicaid/) · [Staffing Industry](https://www.staffingindustry.com/Editorial/Healthcare-Staffing-Report/Archive-Healthcare-Staffing-Report/2016/Sept.-8-2016/Hometeam-CEO-shunned-by-Silicon-Valley-VCs-for-classifying-workers-as-W-2-Business-Insider) · [Senior Housing News](https://seniorhousingnews.com/2021/08/06/honor-acquires-home-instead-in-home-care-deal-with-senior-living-implications/)
- Care.com (WSJ 2019) : [Engadget](https://www.engadget.com/2019-03-31-care-com-pulls-47000-daycare-listings.html) · [Daily Beast](https://thedailybeast.com/wsj-kids-assaulted-died-in-hands-of-carecom-caregivers) · [backgroundchecks.com](https://backgroundchecks.com/blog/care-com-comes-under-fire-for-background-check-policies)
- Papa : [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/caregiving-tech-startup-papa-rolls-out-new-safety-security-measures-following-media) · [Becker's Payer](https://www.beckerspayer.com/payer/nearly-3-dozen-payers-drop-senior-companionship-company/) · [Coverager](https://coverager.com/papa-loses-contracts-with-several-health-insurers/)
- France, plateformes : [Stootie (Aladom)](https://www.aladom.fr/actualites/secteur-service/9666/quelles-alternatives-a-stootie/) · [Wecasa (Maddyness)](https://www.maddyness.com/2024/12/06/services-a-domicile-wecasa-accelere-et-veut-se-deployer-dans-toute-la-france/) · [Click&Care (Banque des Territoires)](https://www.banquedesterritoires.fr/clickcare-leve-5-meur-pour-revaloriser-le-metier-daide-domicile) · [Ouihelp (FrenchWeb)](https://www.frenchweb.fr/ouihelp-leve-3-millions-deuros-pour-ameliorer-laide-a-domicile-aux-personnes-agees/313984)
- Droit : [Requalification plateformes (CMS)](https://cms.law/en/fra/news-information/requalification-en-contrat-de-travail-de-la-relation-entre-travailleurs-independants-et-plateformes) · [Le Grand Continent](https://legrandcontinent.eu/fr/2020/08/30/la-qualification-des-travailleurs-de-plateformes-en-france/) · [Loi ASV / SAAD (AN)](https://www.assemblee-nationale.fr/14/amendements/1994/CION-SOC/AS326.pdf) · [Dossier autorisation SAAD (Haute-Loire)](https://www.hauteloire.fr/sites/cg43/IMG/docx/DOSSIER_AUTORISATION_SAAD.docx) · [CCI Paris IdF agrément/déclaration](https://www.entreprises.cci-paris-idf.fr/fiches-pratiques/les-services-la-personne-lagrement-et-la-declaration) · [Portail auto-entrepreneur, agrément SAP](https://www.portail-autoentrepreneur.fr/academie/gestion-auto-entreprise/services-personnes/agrement-services-a-la-personne)
- Territoires : [Fondation pour le logement, Réunion 2025](https://www.fondationpourlelogement.fr/sites/default/files/2025-04/WEBSynthe%CC%80seRe%CC%81union2025.pdf) · [IEDOM chiffres clés](https://www.iedom.fr/IMG/pdf/iedom_ra_24_-chiffres-cles.pdf) · [Observatoire des inégalités](https://www.inegalites.fr/DOM-une-grande-pauvrete-cinq-a-dix-fois-plus-elevee-qu-en-metropole) · [Sénat, rapport r22-658](https://www.senat.fr/rap/r22-658/r22-658-syn.pdf) · [Outremers360, Martinique](https://outremers360.com/bassin-atlantique-appli/vieillissement-un-scenario-catastrophe-pour-la-martinique-selon-un-rapport-interministeriel) · [ARAST (question AN)](https://questions.assemblee-nationale.fr/dyn/13/questions/QANR5L13QE117356.pdf)
- Concurrence / outils : [La Poste, Veiller sur mes parents](https://www.laposte.fr/services-seniors/visites-du-facteur) · [Meta, tarification WhatsApp](https://developers.facebook.com/docs/whatsapp/pricing)

**Points ⚠️ à faire valider par un professionnel** : périmètre exact des activités soumises à autorisation (D7231-1, en particulier "compagnie" et "garde-malade hors soins") ; applicabilité de L7342-1 ; rédaction actuelle de CASF L116-4 ; règles de transport rémunéré de personnes ; HDS ; modalités de l'avance immédiate CESU+ en DROM ; disponibilité de "Veiller sur mes parents" en DROM ; estimations de CAC et de probabilité d'incident (non sourcées, ordres de grandeur).
