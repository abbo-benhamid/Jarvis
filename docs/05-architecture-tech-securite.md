# 05 — Architecture technique, IA, paiements et sécurité de bout en bout

> Rôle : CTO / architecte logiciel et RSSI senior (HealthTech et marketplaces, France et Outre-mer).
> Date : octobre 2026. Périmètre : conception d'architecture, sans code.
> Convention : **[VÉRIFIÉ]** = confirmé par une source citée ; **[ESTIMATION]** = ordre de grandeur de praticien, à confirmer par devis ; **[INCERTAIN]** = point juridique ou technique ouvert, à faire valider (avocat, DPO, fournisseur).

---

## 0. Synthèse exécutive (à lire en premier)

**Les 7 décisions structurantes :**

1. **On ne bâtit pas une app, on bâtit un « système de confiance ».** Le produit qui se vend aux familles, aux départements, aux mutuelles et aux ARS, ce n'est pas la mise en relation : c'est **la preuve qu'une visite a eu lieu, qu'elle s'est bien passée et que personne n'a abusé de la personne aidée**. Toute l'architecture découle de cette « preuve de visite » (Proof-of-Visit) et du « bouclier anti-abus financier ».
2. **Trois publics, trois canaux, un seul cœur.** La **famille** passe par WhatsApp et le web. La **personne aidée** passe par la **voix** sur son téléphone fixe ou son mobile simple : pas d'app, pas de mot de passe. L'**accompagnant** passe par une **app mobile qui marche hors ligne** (check-in, journal, SOS). Toutes les interactions remontent vers un backend unique, souverain et prêt pour l'HDS.
3. **On héberge comme si on traitait des données de santé dès le premier jour.** Un journal de visite contient presque toujours des données de santé (« elle avait oublié ses médicaments »). On choisit donc un hébergeur **certifié HDS en France** (Clever Cloud ou Scaleway). Le surcoût est marginal, et c'est un prérequis commercial pour les conseils départementaux et les mutuelles.
4. **Stack : TypeScript de bout en bout.** Next.js pour le web et le back-office, Expo / React Native pour l'app accompagnant, NestJS en monolithe modulaire, PostgreSQL et PostGIS, avec un micro-service Python réservé à l'IA vocale. Supabase et Firebase sont écartés de la production (sociétés américaines, CLOUD Act, pas d'HDS).
5. **Paiements : Stripe Connect au MVP**, avec deux rails. Rail 1 : carte ou SEPA, avec libération des fonds après validation de la visite. Rail 2 : **avance immédiate URSSAF**, l'accompagnant déclaré SAP étant le prestataire et la plateforme intégrant l'API Tiers de prestation en tant que logiciel. Mangopay ou Lemonway seront réévalués en phase 2. ⚠️ Le rail URSSAF est **politiquement menacé** pour les plateformes : plusieurs amendements PLF/PLFSS 2026 le visent (voir §4.5). Le modèle économique ne doit pas en dépendre.
6. **IA utile et bornée.** Elle sert à résumer les visites, à analyser les risques dans les messages, à détecter les anomalies et à faire de l'IVR en français. Aucun diagnostic médical. LLM hébergés dans l'UE sans entraînement sur nos données (Mistral ou Scaleway Generative APIs, à Paris). **Le créole est un chantier de R&D**, pas une fonctionnalité du MVP : aucun modèle ouvert ne couvre explicitement le créole guadeloupéen, martiniquais ou réunionnais (vérifié dans la liste de langues d'Omnilingual ASR de Meta, voir §5.3).
7. **Une résilience pensée pour les cyclones.** Mode hors ligne natif, repli SMS et IVR, protocole cyclone activé automatiquement, ops de secours en métropole. Garance (La Réunion, 2025) a coupé internet à 114 000 personnes et mis 175 relais hors service. Chido (Mayotte, 2024) a mis 80 à 95 % du réseau mobile hors service, et il a fallu ~5 semaines pour revenir à 90 %.

**Faille du plan initial que je signale franchement :** le MVP « Tally + Airtable + WhatsApp » proposé tel quel **n'est pas conforme au RGPD pour ce public**. Airtable stocke les données aux États-Unis : la résidence UE n'existe qu'en offre Enterprise Scale, et même là les métadonnées et l'authentification restent aux US. On y mettrait des données de personnes vulnérables, souvent de santé. La phase 0 doit utiliser des outils hébergés en UE (§1.1) et **minimiser fortement** ce qu'on y stocke.

---

## 1. Stratégie par phases

### 1.1 Phase 0 — Pilote « no-code souverain » (M0 → M3/M4, 50 à 100 missions)

**Principe :** l'humain fait le travail et l'outil ne fait que tracer. **Aucune donnée de santé** dans les outils no-code. Les observations sensibles vont dans un espace chiffré séparé ou ne sont pas écrites du tout.

| Besoin | Outil recommandé | Pourquoi / limites RGPD | Coût mensuel |
|---|---|---|---|
| Formulaires (inscription famille, candidature accompagnant, retour de visite) | **Tally** (Belgique, données en UE) [VÉRIFIÉ](https://tally.so/help/gdpr) | Société UE, pas de transfert hors UE structurel. Pro utile (logique, sans branding, webhooks). Ne pas collecter de pièces d'identité via Tally. | 0 à ~29 € (Pro) [ESTIMATION] |
| Base de données / CRM des missions | **Baserow Cloud** (Pays-Bas, serveurs en Allemagne) ou **Grist auto-hébergé** sur Clever Cloud / Scaleway | Baserow : société UE, Premium ~5 à 10 $/utilisateur/mois [VÉRIFIÉ](https://hackceleration.com/labs/compare/airtable-vs-baserow). Grist : open source (Apache 2.0) utilisé par l'État (DINUM/ANCT), auto-hébergeable [VÉRIFIÉ](https://www.getgrist.com/product/self-hosted/). NocoDB est possible en auto-hébergé (gratuit) [VÉRIFIÉ](https://nocodb.com/docs/product-docs/cloud-enterprise-edition/understanding-pricing). | 15 à 40 € |
| ❌ À éviter | **Airtable** | Résidence UE seulement en Enterprise Scale, partielle (métadonnées, authentification et support restent aux US) [VÉRIFIÉ](https://www.airtable.com/company/data-residency-faqs). Inadapté aux données de personnes vulnérables. | — |
| Alternatives à Tally | Fillout | Résidence UE non confirmée par mes recherches [INCERTAIN] → ne pas retenir sans DPA explicite. | — |
| Messagerie familles et accompagnants | **WhatsApp Business (app)** sur un téléphone dédié, puis l'API Cloud dès la phase 1 | Meta est sous-traitant hors UE. Règle d'or : **WhatsApp sert aux notifications et à la logistique, jamais à des données de santé ni à des documents d'identité.** Mentionner WhatsApp dans l'information RGPD et proposer une alternative (SMS ou e-mail). | 0 € |
| E-mail transactionnel et marketing | **Brevo** (France) | Starter dès ~7 €/mois [VÉRIFIÉ](https://pricingsaas.com/companies/brevo) | 7 à 25 € |
| Signature des CGU, de la charte et des mandats | **Yousign** (France) | eIDAS, horodatage | ~25 à 50 € [ESTIMATION] |
| Ligne téléphonique locale | SIM locale (opérateur DROM) + renvoi, ou standard VoIP | Pour l'astreinte et pour les personnes aidées sans smartphone | 15 à 40 € |
| Vérification d'identité des accompagnants | Manuelle en visio (pièce + selfie live) + **B3 du casier** demandé par le candidat lui-même + 2 références appelées | Ne pas stocker les copies de pièces dans le no-code : elles vont dans un coffre chiffré (ex. dossier chiffré sur un drive HDS ou Cryptobox) et sont **supprimées après vérification**, seule la trace « vérifié le JJ/MM par X » étant conservée. | 0 € |
| Paiement | **Paiement direct famille → accompagnant** (virement, CESU, avance immédiate via le propre logiciel de l'accompagnant) + **facture séparée de la plateforme** (frais de service / abonnement) via Stripe Billing ou un lien de paiement | **On évite de collecter des fonds pour compte de tiers** sans prestataire de services de paiement (PSP) agréé : un encaissement « maison » relèverait du monopole des services de paiement. | 1,5 % + 0,25 € par transaction carte EEE [VÉRIFIÉ](https://hayot-expertise.fr/blog/frais-stripe-paypal-mollie-klarna-comparatif-optimisation-ecommerce-2026) |
| Documentation interne et procédures | La Suite numérique (Docs), Outline ou Notion **sans données personnelles** | — | 0 à 20 € |
| Automatisations | n8n auto-hébergé (UE) plutôt que Zapier ou Make (transferts hors UE) | — | 0 à 20 € |

**Total des outils en phase 0 : ~100 à 250 €/mois** [ESTIMATION], hors temps humain.

**Ce qu'il faut en plus dès la phase 0, et qui n'est pas un outil :**
- un **registre des traitements** et une **AIPD simplifiée** (le pilote implique déjà des personnes vulnérables, de la géolocalisation et de l'évaluation : au moins 2 critères CNIL/CEPD → AIPD requise) ;
- une **charte accompagnant** signée (interdictions : argent liquide au-delà d'un plafond, carte bancaire, codes, procurations, dons et legs, prêts) ;
- une **astreinte téléphonique 24/7** pendant les créneaux de mission (même tenue par les fondateurs) ;
- une **preuve de visite manuelle** : l'accompagnant envoie un message « arrivé » / « parti » au numéro de la plateforme, et la plateforme rappelle la personne aidée ou la famille sur un échantillon de visites.

### 1.2 Phase 1 — MVP codé (M3 → M9/M10)

Objectif : remplacer le no-code par un **cœur transactionnel fiable**, avec preuve de visite automatisée, paiements intégrés, WhatsApp via l'API, IVR vocal en français et back-office d'opérations.

Périmètre fonctionnel du MVP :
- **Web famille** (Next.js) : cercle d'aidants, demande de mission, suivi, journal, paiement, évaluation.
- **App accompagnant** (Expo) : profil vérifié, missions, check-in/out hors ligne, journal guidé, SOS, revenus.
- **Canal WhatsApp** (API Cloud) : notifications, confirmations, réponses rapides et lien vers l'espace sécurisé.
- **Canal voix** : numéro local, appel de confirmation de visite à la personne aidée (DTMF « tapez 1 »), appel de bienveillance.
- **Back-office ops** : file d'incidents, vérifications, matching assisté, modération.
- **Paiements** : Stripe Connect (rail 1) ; préparation de l'habilitation URSSAF (rail 2).

### 1.3 Phase 2 — Scale (M10 → M18 et au-delà)

Multi-territoires (Guadeloupe, Martinique, La Réunion, puis Guyane et Mayotte), API B2B2C (mutuelles, CD, CCAS), matching par ML, détection de fraude avancée, ASR créole en bêta, ISO 27001, programme de bug bounty, réévaluation de Mangopay ou Lemonway.

### 1.4 Critères de bascule (déclencheurs objectifs)

| Bascule | Déclencher **dès qu'un** de ces seuils est atteint |
|---|---|
| **Phase 0 → 1** | • > 30 missions/semaine **ou** > 15 h/semaine de travail manuel d'ops · • besoin d'encaisser pour compte de tiers (commission prélevée sur le flux) · • partenaire institutionnel exigeant une traçabilité (CD, mutuelle) · • **un incident de sécurité ou un quasi-incident** non détectable sans outil (ex. visite déclarée mais non effectuée) · • > 40 accompagnants actifs |
| **Phase 1 → 2** | • > 500 missions/mois **ou** ouverture d'un 2e territoire · • appel d'offres ou convention exigeant ISO 27001, HDS ou un pentest récent · • taux d'incidents de fraude > 0,5 % des missions (signal qu'il faut du ML) · • coût d'infra > 3 k€/mois (optimisation nécessaire) |

---

## 2. Stack recommandée — comparaison et arbitrage

### 2.1 Trois options comparées

| Critère | **A. TypeScript full-stack** (Next.js + Expo + NestJS + Postgres sur hébergeur HDS français) | **B. Python + Flutter** (FastAPI + Flutter + Postgres) | **C. BaaS** (Supabase / Firebase + Next.js / Expo) |
|---|---|---|---|
| Time-to-market | ★★★★ | ★★★ | ★★★★★ |
| Une seule langue sur le front, le mobile et le back | ✅ (partage des types et des validations, ex. Zod) | ❌ (Dart + Python) | ✅ |
| Hors ligne mobile | Bon (WatermelonDB / SQLite chiffré, expo-sqlite) | Très bon (Drift / Isar) | Moyen |
| Vivier de recrutement France / DROM | Très large | Moyen (Flutter plus rare) | Large, mais profils « junior BaaS » |
| Souveraineté / HDS | ✅ si hébergé sur Clever Cloud / Scaleway / OVH HDS | ✅ idem | ❌ Supabase Cloud = société US sur AWS (CLOUD Act), pas d'HDS ; Firebase = Google. Supabase auto-hébergé est possible mais coûteux en ops. |
| IA / ML | Via un micro-service Python | Natif | Via des fonctions |
| Dette à 3 ans | Faible si monolithe modulaire | Faible | **Élevée** (logique métier dispersée dans des RLS et des fonctions edge) |

**Décision : option A.** La raison décisive : **une seule équipe TypeScript** (1 lead + 1 dev au démarrage) peut couvrir le web, le mobile et l'API. Un **micro-service Python** isolé gère l'IA vocale et le ML, qui sont l'endroit où Python est irremplaçable.

### 2.2 Architecture logique (cible phase 1)

```
                ┌──────────────── CANAUX ────────────────┐
 Famille ──► Web Next.js  │  WhatsApp Cloud API  │  E-mail (Brevo)
 Personne aidée ──► Voix : numéro local → IVR (Twilio/Vonage) → DTMF / ASR FR
 Accompagnant ──► App Expo (offline-first, SQLite chiffré) │ SMS fallback
                └───────────────┬────────────────────────┘
                                ▼
                 API Gateway / BFF (NestJS) — authN (OIDC), rate-limit, WAF
                                ▼
 ┌──────────────── MONOLITHE MODULAIRE NestJS (TypeScript) ───────────────┐
 │ Identité & Cercles │ Missions & Matching │ Visites (Proof-of-Visit)    │
 │ Journal (chiffré)  │ Paiements (Stripe / URSSAF) │ Confiance & Risques │
 │ Consentements      │ Notifications (Conversation Gateway) │ Back-office│
 └───────┬──────────────────┬──────────────────┬──────────────────────────┘
         ▼                  ▼                  ▼
  PostgreSQL + PostGIS   Redis + file d'attente   Stockage objet S3 (chiffré)
  (RLS, pgcrypto,        (BullMQ : jobs,          (justificatifs → purge
   chiffrement par champ) relances, SLA)            automatique)
         │
         ├─► Outbox → bus d'événements → Service IA (Python/FastAPI) :
         │     résumés LLM (Mistral / Scaleway, UE), scoring risque,
         │     ASR (Whisper / Voxtral FR ; R&D créole), détection d'anomalies
         └─► Entrepôt analytique pseudonymisé (Metabase auto-hébergé)
 Observabilité : OpenTelemetry → Grafana/Loki (UE) ; Sentry auto-hébergé ou région UE
 Secrets : Scaleway Secret Manager / Vault ; KMS pour les clés de chiffrement de champs
```

**Choix détaillés :**
- **Backend** : NestJS en **monolithe modulaire** (pas de micro-services avant 20 développeurs), architecture hexagonale par domaine, **pattern outbox** pour les événements (paiement, incident) afin de ne jamais perdre une alerte.
- **Base** : PostgreSQL 16+ avec **PostGIS** (géorepérage, distance pour le matching), **Row-Level Security** par cercle familial en défense en profondeur, `pgcrypto` / chiffrement applicatif par enveloppe pour les champs sensibles.
- **Web** : Next.js (App Router), rendu serveur pour l'accessibilité et le référencement, **RGAA niveau AA** (public âgé et familles).
- **Mobile** : Expo / React Native, base locale chiffrée (SQLCipher), synchronisation par file d'événements signés, **mise à jour OTA** (EAS Update) pour corriger vite.
- **Auth** : OIDC (Keycloak auto-hébergé, ou Zitadel UE), **passkeys** pour les accompagnants et le staff, lien magique ou OTP pour les familles, aucun compte pour la personne aidée (authentification par numéro de téléphone enregistré + code PIN vocal optionnel).

### 2.3 Hébergement souverain : HDS ou pas ?

**Analyse juridique synthétique [INCERTAIN — à valider avec le DPO ou un avocat] :**
- L'obligation HDS (art. L.1111-8 CSP) vise l'hébergement de données de santé « recueillies à l'occasion d'activités de prévention, de diagnostic, de soins **ou de suivi social et médico-social** » pour le compte d'un tiers. L'accompagnement de personnes âgées ou handicapées **peut** être qualifié de suivi social ou médico-social, et nos journaux de visite contiendront de fait des données de santé (art. 9 RGPD).
- Ce qui compte en pratique : **notre hébergeur cloud doit être certifié HDS** (puisqu'il héberge pour notre compte). Nous-mêmes n'avons pas besoin d'être certifiés HDS tant que nous n'hébergeons pas pour des tiers.
- **Décision : hébergeur certifié HDS (référentiel 2024) dès le MVP.** Le surcoût est faible, le risque juridique disparaît et c'est un argument commercial auprès des CD, des ARS et des mutuelles.

| Hébergeur | HDS | Atouts | Limites | Verdict |
|---|---|---|---|---|
| **Clever Cloud** (Nantes) | ✅ certifié HDS 2024 sur les 6 activités [VÉRIFIÉ](https://www.clever-cloud.com/health-data-hosting) ; PostgreSQL managé éligible HDS [VÉRIFIÉ](https://clever.cloud/product/postgresql/) | **PaaS** : pas d'ops Kubernetes, déploiement par `git push`, idéal pour une équipe de 2 | Moins de briques IA ou GPU ; tarification HDS sur devis | **Choix MVP (applicatif et base de données)** |
| **Scaleway** (Paris) | ✅ certifié HDS [VÉRIFIÉ](https://www.scaleway.com/fr/news/scaleway-annonce-sa-certification-hds-pour-garantir-la-securite-des-donnees-de-sante/) | IA managée à Paris (Generative APIs), stockage objet, Postgres managé (ex. DB-POP2-2C-8G à 0,1434 €/h [VÉRIFIÉ](https://www.scaleway.com/en/pricing/managed-databases-pricing/)) | Plus d'ops (IaaS / Kapsule) | **Choix IA** (inférence LLM) ; alternative complète |
| **OVHcloud** | ✅ HDS (tableaux de garanties 2024 publiés) [VÉRIFIÉ](https://docs.ovhcloud.com/fr/guides/account-and-service-management/account-information/hds-garanties.md) | SecNumCloud sur certaines offres, prix bas | Expérience développeur moins fluide | Option phase 2 si un client exige SecNumCloud |
| Outscale (Dassault) | HDS + SecNumCloud | Très haut niveau de souveraineté | Cher, orienté grands comptes | Surdimensionné |

> Point Outre-mer : les données restent en métropole, ce qui est conforme et sans problème juridique. **La latence** depuis La Réunion vers Paris est d'environ 150 à 200 ms [ESTIMATION] : c'est acceptable, et l'app hors ligne la masque.

---

## 3. Canaux : architecture « WhatsApp-first + voix-first »

### 3.1 Principe : la « Conversation Gateway »

Un module unique abstrait tous les canaux. Le métier émet une **intention** (ex. `VISITE_CONFIRMEE`), et la passerelle choisit le canal selon les préférences, la disponibilité et le coût, avec **repli automatique** : WhatsApp → SMS → appel vocal → alerte humaine. Chaque message est journalisé (horodatage, canal, statut de remise) car il **sert de preuve** en cas de litige.

### 3.2 WhatsApp Business Platform (API Cloud de Meta)

- **Tarification depuis le 1er juillet 2025 : au message de template remis** (et non plus à la conversation). Les messages de service (réponses libres dans la fenêtre de 24 h ouverte par l'utilisateur) sont **gratuits**. Les **templates utilitaires envoyés dans la fenêtre de 24 h sont gratuits**, ceux envoyés hors fenêtre sont facturés au tarif utilitaire [VÉRIFIÉ](https://help.sleekflow.io/en_US/whatsapp/pricing), [VÉRIFIÉ](https://www.ycloud.com/blog/whatsapp-api-pricing-update).
- **Ordres de grandeur France** (indicatif du destinataire +33) : marketing ~0,14 $, utilitaire ~0,05 $, authentification ~0,05 $ par message [VÉRIFIÉ](https://www.spurnow.com/blogs/whatsapp-business-api-pricing-explained) (grille officielle : [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), en vigueur au 1er avril 2026).
- ⚠️ **[INCERTAIN] Les numéros +262 / +590 / +596 / +594 / +269 sont tarifés selon l'indicatif du destinataire**, pas forcément au tarif « France ». Les DROM peuvent tomber dans une autre zone de la grille Meta. À vérifier sur la grille avant de bâtir le budget.
- **Règles à respecter :** opt-in explicite et traçable ; templates **pré-approuvés** par Meta et classés (marketing / utilitaire / authentification) ; un message marketing déguisé en utilitaire est requalifié et peut dégrader la note de qualité du numéro ; limites d'envoi progressives selon la qualité.
- **Design « coût quasi nul »** : on fait **en sorte que la famille écrive en premier**. Exemple : « Répondez OK pour recevoir le résumé de la visite ». La fenêtre de 24 h s'ouvre et le résumé, envoyé en utilitaire, devient gratuit. Budget réaliste : **< 0,10 € par mission** en WhatsApp [ESTIMATION].
- **Règle RGPD dure :** **aucune donnée de santé dans WhatsApp.** Le message contient « La visite de mardi s'est bien passée ✅. Résumé dans votre espace : [lien] », et le lien ouvre l'espace authentifié hébergé en HDS.
- **Intégration** : API Cloud en direct (pas de surcoût de BSP) via un webhook vers la Conversation Gateway. Un BSP (360dialog, Twilio) n'a d'intérêt que pour le support.

### 3.3 SMS

- Usages : **repli** quand WhatsApp échoue, OTP, check-in de secours (« ARRIVE 4821 »), alertes cyclone.
- Coût Twilio : France ~0,08 $ ; **La Réunion ~0,19 $** [VÉRIFIÉ](https://textbee.dev/sms-pricing/twilio), [VÉRIFIÉ](https://sent.dm/resources/reunion-mayotte-sms-pricing). À Guadeloupe, l'émetteur peut être réécrit en short code ou en Sender ID alphanumérique, et la portabilité du numéro n'est pas disponible chez Twilio [VÉRIFIÉ](https://www.twilio.com/guidelines/gp/sms). → **Mettre en concurrence avec un agrégateur français (OVHcloud SMS, Brevo SMS, opérateurs locaux)**, souvent moins cher sur les DROM [ESTIMATION].

### 3.4 Voix — le canal de la personne aidée

**Pourquoi la voix d'abord :** une partie importante des personnes aidées n'utilise ni smartphone ni WhatsApp. La voix, sur le fixe, est **leur** canal. Elle leur rend aussi un **rôle actif** : c'est la personne aidée qui confirme sa propre visite.

Parcours vocaux du MVP :
1. **Appel de confirmation de visite** (après le check-out) : « Bonjour Madame X, ici [Plateforme]. Est-ce que [prénom] est bien venu(e) vous voir aujourd'hui ? Tapez 1 pour oui, 2 pour non, 3 pour parler à quelqu'un. » Sur « 2 » ou « 3 », un **incident est ouvert automatiquement**.
2. **Appel de bienveillance** (option payante) : à heure fixe, « Tout va bien aujourd'hui ? ». Sans réponse après 2 essais, on appelle le cercle familial.
3. **Ligne entrante locale** : la personne aidée appelle un numéro court et mémorisable, et l'IVR (en français, avec messages pré-enregistrés en créole) la met en relation avec l'astreinte.

**Numéros locaux 0590 / 0596 / 0594 / 0262 / 0269 :** la disponibilité via API (Twilio, Vonage, Telnyx) **n'a pas pu être confirmée** [INCERTAIN]. OVHcloud propose des numéros géographiques, mais sa doc SIP Trunk ne mentionne que FR / BE / CH / UK [VÉRIFIÉ](https://www.ovhcloud.com/fr/phone/sip-trunk/). Stratégie :
- **Plan A** : numéro géographique DROM chez un opérateur ou intégrateur français (OVHcloud VoIP ou opérateur local) relié par **SIP** à une plateforme vocale programmable (Twilio Elastic SIP, Vonage, ou **jambonz** open source auto-hébergé).
- **Plan B** : numéro national 09 ou mobile via Twilio / Vonage, avec un **nom d'appelant cohérent** et un enregistrement sur les annuaires anti-spam. L'appel affiché doit être reconnu par la personne âgée : un 0262 local est fortement préférable, c'est un facteur de confiance (l'arnaque téléphonique est la peur n° 1).
- Prévoir le **cadre ARCEP** sur l'affichage du numéro (pas de spoofing) et les justificatifs d'adresse locale exigés par les fournisseurs pour attribuer un numéro géographique.

Coût voix [ESTIMATION] : 0,02 à 0,10 €/min selon fixe ou mobile et territoire. Un appel de confirmation de 40 s coûte environ 0,03 à 0,07 €.

### 3.5 App mobile et web

- **App accompagnant** obligatoire : géolocalisation, hors ligne, SOS, journal. **Pas d'app famille au MVP** : web responsive + WhatsApp suffisent (PWA installable). L'app famille ne viendra que si l'usage le prouve.
- Pas d'app pour la personne aidée. En phase 2, en option : **tablette simplifiée** fournie (mode kiosque, appel visio du cercle familial en un bouton), finançable par la conférence des financeurs ou la CNSA [INCERTAIN].

---

## 4. Paiements

### 4.1 Contrainte réglementaire de départ

Encaisser l'argent d'une famille pour le reverser à un accompagnant, c'est un **service de paiement pour compte de tiers** (monopole bancaire / DSP2). L'exemption « agent commercial » est interprétée de façon restrictive. → **On s'adosse à un établissement agréé** (Stripe, Mangopay, Lemonway), qui porte la conformité LCB-FT et le KYC des accompagnants.

### 4.2 Comparaison

| | **Stripe Connect** | **Mangopay** | **Lemonway** |
|---|---|---|---|
| Statut | Établissement de paiement (Stripe Technology Europe, Irlande) | Établissement de monnaie électronique (Luxembourg) | Établissement de paiement français, agrément ACPR n° 16568 [VÉRIFIÉ](https://www.lemonway.com/press) |
| « Séquestre » | Pas un séquestre juridique : fonds retenus sur le solde de la plateforme et versements différés (separate charges & transfers, payouts manuels) | **Portefeuilles e-money** par utilisateur : modèle proche du séquestre, conçu pour les marketplaces [VÉRIFIÉ](https://sharetribe.com/academy/marketplace-payments/mangopay-overview) | Portefeuilles et séquestre, très utilisé en économie collaborative et crowdfunding |
| KYC vendeurs | Intégré (onboarding hébergé Express) | Intégré (documents, UBO) | Intégré |
| Frais (indicatifs) | Cartes EEE **1,5 % + 0,25 €**, SEPA ~0,35 € [VÉRIFIÉ](https://hayot-expertise.fr/blog/frais-stripe-paypal-mollie-klarna-comparatif-optimisation-ecommerce-2026) ; Connect : ~2 €/compte actif/mois + frais de versement [ESTIMATION, à confirmer sur stripe.com/fr/connect/pricing] | Sur devis, souvent frais fixes d'entrée ; considéré comme peu adapté sous ~500 k€ de volume annuel [VÉRIFIÉ](https://www.lafabriquedunet.fr/logiciels/alternatives/alternative-mangopay) | Sur devis [VÉRIFIÉ](https://www.capterra.fr/software/1057670/lemonway) |
| Expérience dev | ★★★★★ | ★★★ | ★★★ |
| Délai d'intégration | 2 à 4 semaines | 4 à 8 semaines + contractualisation | 6 à 10 semaines |

**Décision : Stripe Connect (comptes Express) au MVP.** Modèle « separate charges and transfers ». La famille paie à la réservation (empreinte ou débit), les fonds restent sur la plateforme et sont **transférés à l'accompagnant 48 h après une visite validée** (check-out + absence de contestation). La commission est prélevée par `application_fee`. **Réévaluation Mangopay / Lemonway en phase 2** si un partenaire institutionnel exige un vrai séquestre ou un acteur français, ou quand le volume dépasse quelques millions d'euros.

### 4.3 Flux technique « Rail 1 » (carte / SEPA)

```
Réservation → SetupIntent / mandat SEPA (famille) → Mission planifiée
→ J-1 : PaymentIntent capturé (ou débit SEPA)  [fonds sur le solde plateforme]
→ Visite : check-in/out + confirmation personne aidée (IVR) + journal
→ Fenêtre de contestation 48 h (famille / personne aidée)
→ Transfer vers le compte Connect de l'accompagnant (montant – commission)
→ Payout SEPA vers l'IBAN de l'accompagnant
→ Facture émise AU NOM DE l'accompagnant (mandat de facturation) + facture de frais plateforme
```
Points clés : **mandat de facturation** signé par l'accompagnant (la plateforme émet les factures en son nom) ; **e-invoicing** : la réforme de la facturation électronique B2B ne couvre pas le B2C, mais il faut suivre l'e-reporting [INCERTAIN] ; idempotence sur tous les webhooks Stripe.

### 4.4 Flux « Rail 2 » : avance immédiate du crédit d'impôt (API Tiers de prestation URSSAF)

**Ce que permet l'API** : inscrire un particulier, transmettre des demandes de paiement et suivre leur statut [VÉRIFIÉ](https://www.data.gouv.fr/dataservices/api-tiers-de-prestation/discussions). Le particulier ne paie que son reste à charge (50 %).

**Qui peut l'utiliser :** le **prestataire déclaré ou agréé SAP** habilité, ou un **logiciel** agissant pour son compte (Abby, Evoliz, Sinao, VosFactures, Axonaut, etc. sont compatibles [VÉRIFIÉ](https://independant.io/logiciel-api-tiers-prestation-avance-immediate/)). Habilitation : démarche en ligne [VÉRIFIÉ](https://demarche.numerique.gouv.fr/commencer/api-tiers-de-prestations/dossier_vide), contact : habilitation-api@urssaf.fr.

**Architecture recommandée :** la plateforme **ne devient pas prestataire** (cohérent avec la posture d'« intermédiaire technique »). Elle **intègre l'API en tant que logiciel de facturation de ses accompagnants** micro-entrepreneurs déclarés SAP.

```
1. Accompagnant : n° de déclaration SAP (NOVA) + SIRET + mandat donné à la plateforme
2. Famille/personne aidée (bénéficiaire fiscal) : inscription via l'API
   (état civil, adresse, contacts, IBAN) → l'URSSAF envoie un e-mail d'activation
   au particulier, qui doit valider son compte (point de friction n° 1 → accompagnement par l'ops)
3. Après la visite validée : la plateforme génère la facture au nom de l'accompagnant
   et transmet la demande de paiement (AICI)
4. Le particulier valide ou conteste dans son espace URSSAF (délai court ; sans réponse,
   validation tacite selon les règles URSSAF [INCERTAIN : vérifier délais exacts])
5. L'URSSAF verse le paiement à l'accompagnant (délai annoncé ~4 jours ouvrés) et prélève le
   reste à charge au particulier [VÉRIFIÉ : principe ; INCERTAIN : ventilation exacte → doc API]
6. La commission de la plateforme ne transite PAS par l'URSSAF → prélevée séparément
   par mandat SEPA sur l'accompagnant (Stripe Billing) ou facturée en abonnement
```

**⚠️ Trois alertes franches :**
1. **Éligibilité de l'activité** : le crédit d'impôt et l'avance immédiate supposent une activité SAP éligible. Or « l'assistance aux personnes âgées ou handicapées » et « l'accompagnement hors du domicile » de ces publics relèvent, selon les cas, de l'**agrément** ou de l'**autorisation** du conseil départemental, pas d'une simple déclaration [INCERTAIN — sujet juridique traité dans le livrable réglementaire]. Seules les activités de la liste soumise à simple déclaration (ex. petits travaux, courses / livraison, assistance administrative, certaines formes de compagnie [à confirmer]) sont sûres pour un micro-entrepreneur déclaré. **Le catalogue de prestations de l'app doit être piloté par ces règles**, avec un étiquetage par activité SAP et un blocage du rail 2 quand l'activité n'est pas éligible.
2. **Risque politique** : des amendements au PLF et au PLFSS 2026 ont proposé de **supprimer l'avance immédiate pour les plateformes de mise en relation** ou de limiter l'assiette du crédit d'impôt à la seule rémunération du travailleur, hors rémunération des intermédiaires [VÉRIFIÉ](https://www.assemblee-nationale.fr/dyn/17/amendements/0325/AN/1387.pdf), [VÉRIFIÉ](https://www.senat.fr/enseance/2025-2026/138/Amdt_I-933.html). Le crédit d'impôt SAP a coûté 6,4 Md€ en 2024 et le gouvernement cible la fraude [VÉRIFIÉ](https://www.europe1.fr/economie/plfss-et-fraude-le-ministere-de-leconomie-sattaque-au-credit-dimpot-pour-les-services-a-la-personne-4211793). → **Le business plan ne doit pas dépendre du rail 2**, et la commission doit être **visible et séparée** de la prestation.
3. **Lutte anti-fraude URSSAF** : les visites facturées doivent être **prouvables** (Proof-of-Visit horodaté et confirmé). C'est notre meilleur argument face au contrôle, et un avantage concurrentiel.

### 4.5 CESU

- **CESU préfinancé (e-CESU)** : l'accompagnant déclaré SAP s'affilie au **CRCESU** et coche « acceptation e-CESU ». La famille paie ensuite avec son e-CESU directement sur le compte CRCESU de l'accompagnant (NAN + référence de facture) [VÉRIFIÉ](https://www.cr-cesu.fr/wp-content/uploads/plaquette_acceptation_e_cesu-1.pdf). **La plateforme ne peut pas encaisser de CESU pour le compte de tiers.** Elle **enregistre** le paiement (rapprochement manuel ou par déclaration) et prélève sa commission séparément.
- **CESU déclaratif** : il concerne l'emploi direct (particulier employeur). C'est **incompatible avec le modèle micro-entrepreneur** et à éviter, car il créerait un risque de requalification.

---

## 5. Intelligence artificielle

### 5.1 Principes et garde-fous (non négociables)

1. **Aucun diagnostic, aucun conseil médical.** Les prompts système et la post-validation filtrent tout contenu médical prescriptif. L'IA **reformule et signale** (« L'accompagnant note une fatigue inhabituelle → pensez à en parler au médecin traitant »), elle ne conclut jamais.
2. **L'humain dans la boucle** pour toute décision défavorable à une personne : suspension d'un accompagnant, refus de candidature, blocage de paiement. L'IA propose, un humain décide et c'est tracé. Cela s'aligne sur l'art. 22 du RGPD et sur la **directive européenne 2024/2831 sur le travail via plateforme** (transparence de la gestion algorithmique, contrôle humain, transposition attendue fin 2026 [INCERTAIN : état de la transposition française]).
3. **AI Act** : un système qui **attribue des tâches** ou **évalue** des travailleurs de plateforme peut relever des systèmes à **haut risque** (annexe III, emploi et gestion des travailleurs) [INCERTAIN : calendrier d'application possiblement décalé par le « Digital Omnibus »]. On conçoit dès maintenant documentation, journalisation, explicabilité du score de matching et supervision humaine.
4. **Fournisseurs LLM** : hébergement UE, **zéro rétention**, **pas d'entraînement** sur nos données, DPA signé.

### 5.2 Briques et fournisseurs

| Brique | Usage | Choix MVP | Pourquoi |
|---|---|---|---|
| LLM « résumé de visite » | Transformer le journal guidé (cases + note libre + vocal transcrit) en résumé lisible pour la famille, avec un ton chaleureux et neutre | **Mistral (La Plateforme)** ou **Scaleway Generative APIs** (modèles Mistral / Llama hébergés à Paris, certifiés HDS) | Mistral : API payante exclue de l'entraînement, ZDR disponible, DPA, résidence UE [VÉRIFIÉ](https://anarlog.so/blog/mistral-data-retention-policy). Scaleway : ~0,20 à 0,90 € / M tokens, 1 M de tokens gratuits, inférence à Paris, ISO 27001 + HDS [VÉRIFIÉ](https://www.scaleway.com/en/pricing/model-as-a-service). Coût d'un résumé : < 0,001 € [ESTIMATION]. |
| LLM « analyse de risque » | Détecter dans les messages et journaux : demandes d'argent, prêt, procuration, codes, don, héritage, isolement imposé, conflit | Classifieur léger (règles + petit modèle) + LLM de second niveau | Coût faible, explicable |
| ASR français | Dictée du journal par l'accompagnant, IVR | Whisper large-v3 auto-hébergé ou Voxtral (Mistral) [ESTIMATION sur l'offre exacte 2026] | Français robuste |
| ASR / TTS créole | IVR et dictée en créole | **R&D** (voir §5.3) ; MVP : **messages pré-enregistrés en créole par des voix locales** + DTMF | Pas de modèle fiable disponible |
| Matching | Proposer 3 accompagnants par mission | Règles + score pondéré (v1) → *learning-to-rank* (v2) | Voir §5.4 |
| Modération | Profils, photos, messages, avis | Règles + LLM + revue humaine | — |
| Anomalies et fraude | Visites fantômes, GPS falsifié, collusion | Règles (v1) → Isolation Forest / modèles de graphe (v2) | Voir §7.2 |

Alternatives LLM : Azure OpenAI (EU Data Boundary) ou Claude / Llama via des clouds en région UE. Elles sont acceptables contractuellement mais exposées au **CLOUD Act** (sociétés US) → réservées aux traitements **sans données personnelles** (ex. génération de contenus marketing ou de formation).

### 5.3 Créole : état de l'art (octobre 2026) et stratégie

**Constats vérifiés :**
- **Whisper** (OpenAI) supporte le **créole haïtien** (`ht`) parmi ses 99 langues. Des versions fine-tunées atteignent ~19 % de WER (whisper-medium) et ~9 % en domaine médical restreint (large-v3-turbo + LoRA) [VÉRIFIÉ](https://huggingface.co/phatjmo/whisper-medium-hat/blob/main/README.md), [VÉRIFIÉ](https://friendli.ai/models/veyatia/whisper-creole-medical-v4). **Aucun support natif** des créoles guadeloupéen, martiniquais, guyanais ou réunionnais.
- **Meta Omnilingual ASR** (novembre 2025, open source, 1 600+ langues, wav2vec2 jusqu'à 7 Md de paramètres) [VÉRIFIÉ](https://ai.meta.com/blog/omnilingual-asr-advancing-automatic-speech-recognition/). J'ai vérifié sa liste de langues ([lang_ids.py](https://github.com/facebookresearch/omnilingual-asr/blob/main/src/omnilingual_asr/models/wav2vec2_llama/lang_ids.py)) : elle contient `hat_Latn` (haïtien), **`acf_Latn` (kwéyòl de Sainte-Lucie, très proche des créoles martiniquais et guadeloupéen)**, `mfe_Latn` (mauricien) et `crs_Latn` (seychellois). Elle ne contient **ni `gcf` (Guadeloupe/Martinique), ni `rcf` (Réunion), ni `gcr` (Guyane)**. → Le saint-lucien est le **meilleur point de départ** pour un fine-tuning antillais. Pour La Réunion, il faut repartir du français et/ou du mauricien, avec prudence car le créole réunionnais est assez distinct du mauricien.
- **Meta MMS** (2023, 1 100+ langues, TTS pour 1 100+ langues) : la couverture exacte des créoles français n'a pas pu être vérifiée [INCERTAIN] ([source](https://www.infoq.com/news/2023/06/meta-mms-speech-ai/)).
- **Recherche active** : un projet NSF (2025-2027) vise un ASR guadeloupéen à plus de 85 % de précision et un corpus annoté de plus de 100 h (guadeloupéen, martiniquais, mauricien) [VÉRIFIÉ](https://www.acsu.buffalo.edu/~fabiolah/NSF-DLI.html). Des travaux montrent que **quelques minutes à une heure** de données annotées suffisent pour adapter un modèle auto-supervisé pré-entraîné sur le français au gwadloupéyen et au morisien ([ACL 2022](https://aclweb.org/anthology/2022.findings-acl.197.pdf)).

**Stratégie créole en 3 temps :**
1. **MVP** : IVR en DTMF (touches) + **prompts pré-enregistrés** en créole par des voix locales (authenticité, confiance, coût quasi nul). L'ASR ne sert qu'en français (beaucoup d'aînés sont bilingues, avec alternance de codes).
2. **Phase 2** : **collecte de données consentie** (« Kreyòl Commons »). Enregistrements volontaires et rémunérés d'accompagnants et de bénévoles sur des phrases du domaine (salutations, courses, rendez-vous, alerte), **jamais** d'enregistrements de personnes aidées sans consentement spécifique. Cible : 20 à 50 h par créole, transcrites selon une graphie standardisée (GEREC-F pour les Antilles, Lékritur 2001 / KWZ pour La Réunion [INCERTAIN : choix de graphie à arbitrer avec des linguistes]). Partenaires : Université des Antilles, Université de La Réunion, projet NSF ci-dessus. Financement : **FEDER / programmes de R&D**, car c'est un bien commun linguistique publiable en open data, et un **actif d'image fort**.
3. **Phase 3** : fine-tuning d'Omnilingual / Whisper (LoRA) pour la compréhension de **commandes vocales restreintes** (« oui / non / aide / appeler ma fille ») avant toute transcription libre. Le TTS créole génératif n'arrive qu'à la fin, voix validées par la communauté.

### 5.4 Matching

- **v1 (règles + score)** : filtres durs (zone ≤ X km via PostGIS, disponibilité, prestation autorisée, vérifications à jour, pas d'incident ouvert, préférences : genre, langue créole, animaux, fumeur), puis un score pondéré (**continuité** — on privilégie le même accompagnant —, distance, fiabilité (taux de check-in à l'heure), avis, affinités déclarées). **Le score est expliqué** à l'accompagnant et à l'ops.
- **v2 (ML, > 2 000 missions)** : *learning-to-rank* sur l'acceptation, la récurrence et la satisfaction, **sans variables protégées** (origine, âge de l'accompagnant, etc.), avec audit d'équité trimestriel.
- **Choix du modèle « 3 propositions + choix humain »** : la famille choisit, ce qui préserve l'indépendance (argument anti-requalification) et la confiance.

### 5.5 Données à collecter dès le jour 1 (pour l'IA de demain)

Journal structuré (cases cochées) plutôt que texte libre ; événements horodatés (check-in, retards, annulations) ; acceptations et refus de missions avec motif ; évaluations bidirectionnelles ; signalements et leur issue (étiquettes de fraude). **Toujours avec une finalité déclarée, des durées limitées et une pseudonymisation pour l'entraînement.**

---

## 6. Modèle de données (haut niveau)

Classification : 🟢 standard · 🟠 personnelle sensible (fraude, géolocalisation, finances) · 🔴 santé / art. 9 → chiffrement par champ + accès restreint et tracé.

| Entité | Attributs clés | Relations | Sensibilité |
|---|---|---|---|
| **PersonneAidée** | identité minimale, adresse + géocode, téléphone vocal, langue(s), préférences, niveau d'autonomie déclaratif (pas de GIR au MVP), **statut de protection juridique** (aucune / curatelle / tutelle / mandat de protection future) + représentant | appartient à 1 Cercle | 🔴 / 🟠 |
| **Cercle** | nom, règles de partage (qui voit quoi), payeur principal | 1 PersonneAidée, N AidantsFamille | 🟢 |
| **AidantFamille** | identité, contact, **rôle dans le cercle** (admin, lecteur, payeur), lien de parenté | N Cercles | 🟢 |
| **Accompagnant** | identité, SIRET, n° SAP, statut des vérifications, zones, compétences, langues, disponibilités, score de fiabilité, Stripe account id | N Vérifications, N Missions | 🟠 |
| **Vérification** | type (identité, B3, attestation d'honorabilité si applicable, références, entretien, formation, RC Pro), résultat, date, expiration, vérificateur, **preuve = hash / référence, pas la pièce** | Accompagnant | 🟠 |
| **Prestation (catalogue)** | libellé, **code activité SAP**, éligibilité crédit d'impôt, régime (déclaration / agrément / autorisation), interdits | — | 🟢 |
| **Mission** | besoin, prestations, récurrence, créneaux, tarif, statut | Cercle, Accompagnant, N Visites | 🟢 |
| **Visite** | horaires prévus et réels, **ProofOfVisit** (géofence, NFC/QR, confirmation de la personne aidée, signature d'appareil), statut, contestation | Mission, 1 Journal | 🟠 |
| **Journal** | cases structurées, note libre, transcription vocale, résumé IA (+ version du modèle), photos (option, consentement) | Visite | 🔴 |
| **Message** | canal, contenu (ou pointeur), statut de remise, score de risque | Cercle / Mission | 🟠 |
| **Paiement** | rail (Stripe / URSSAF / CESU / direct), montants, commission, statut, IDs externes, facture(s) | Visite / Mission | 🟠 |
| **Facture** | émetteur (accompagnant via mandat ou plateforme), numérotation, mentions SAP | Paiement | 🟢 |
| **Évaluation** | bidirectionnelle, critères, commentaire, modération | Visite | 🟢 |
| **Signalement / Incident** | gravité (P1 à P4), catégorie (sécurité, maltraitance, financier, qualité), chronologie, actions, issue, autorités prévenues | Visite / personnes | 🔴 |
| **Consentement** | personne, finalité, version du texte, canal, date, retrait, **qui a consenti** (personne elle-même / représentant légal) | toutes | 🟢 |
| **AlerteSOS** | émetteur, position, horodatage, traitement | Visite | 🟠 |
| **JournalAudit** | qui a accédé à quoi, quand, pourquoi (append-only) | toutes | 🟠 |

**Règles transverses :** séparation stricte des **données d'identité** (schéma `identity`) et des **données d'activité** (schéma `care`), reliées par des identifiants pseudonymes ; analytique uniquement sur des données pseudonymisées.

---

## 7. Sécurité et confiance (le cœur du produit)

### 7.1 Vérification des accompagnants (« Trust Ladder »)

Niveaux visibles par les familles (badges) :

| Niveau | Contrôles | Outil | Coût unitaire |
|---|---|---|---|
| **N1 Identité** | Pièce d'identité + selfie vidéo avec détection du vivant, conforme au référentiel **PVID de l'ANSSI** | **IDnow** (certifié PVID [VÉRIFIÉ](https://thepaypers.com/fraud-and-fincrime/news/idnow-receives-pvid-certification-from-anssi)) ou **Ubble** (prestataire PVID [VÉRIFIÉ](https://www.ubble.ai/wp-content/uploads/2023/11/Politique-de-vérification-didentité-à-distance-v1.6.pdf)), Onfido en alternative | ~1,5 à 5 € par vérification [ESTIMATION, sur devis] |
| | Alternative gratuite : justificatif d'identité numérique **France Identité** | FranceConnect+ reste réservé aux acteurs ayant une obligation légale de vérification (banques, assurances…) [VÉRIFIÉ](https://www.lemondeinformatique.fr/actualites/lire-franceconnect-pret-a-accueillir-les-acteurs-prives-73458.html) → probablement pas accessible pour nous [INCERTAIN] | 0 € |
| **N2 Antécédents** | Bulletin n°3 du casier judiciaire, demandé par le candidat (gratuit, en ligne) et présenté en visio pendant l'entretien, renouvelé tous les ans | Procédure | 0 € |
| | **Attestation d'honorabilité** (casier + FIJAISV) : plateforme honorabilite.social.gouv.fr. Le **décret n° 2026-324 du 28 avril 2026** l'étend aux établissements et services des champs du **handicap et des personnes âgées** [VÉRIFIÉ](https://www.iledefrance.ars.sante.fr/attestation-dhonorabilite). Son applicabilité à des indépendants intervenant via une plateforme non autorisée est **[INCERTAIN]**. Si l'accès est possible, **l'exiger** : c'est le meilleur filtre contre les auteurs de violences et un argument massif face aux CD et ARS. | honorabilite.social.gouv.fr | 0 € |
| **N3 Humain** | Entretien vidéo structuré (grille de mises en situation), **2 références appelées**, vérification du SIRET / de la déclaration SAP / de la RC Pro | Ops | ~45 min d'ops |
| **N4 Formation** | Module « posture et éthique » (repérage de la maltraitance, interdits financiers, gestion des urgences, confidentialité) + QCM + **mission découverte** en binôme ou en présence de la famille | LMS léger | ~2 h |
| **Continu** | Re-vérification annuelle, contrôle d'expiration des documents, suivi des signaux faibles | Automatique | — |

**Ne jamais conserver** la copie de la pièce d'identité ni le B3 au-delà de la vérification. On conserve uniquement : type, date, résultat, vérificateur et référence du rapport du prestataire KYC.

### 7.2 Sécurité physique des personnes vulnérables

**a) Proof-of-Visit (PoV) multi-facteurs.** Une visite est « prouvée » si au moins 2 des 3 facteurs sont réunis :
1. **Géorepérage** : check-in et check-out dans un rayon de 100 à 150 m du domicile (PostGIS), avec détection des positions simulées (Play Integrity / App Attest, signaux de type « mock location »).
2. **Présence physique** : scan d'un **tag NFC ou QR code** collé chez la personne aidée (méthode éprouvée de la « télégestion » des services d'aide à domicile, qui fonctionne **sans réseau** : l'horodatage est signé dans l'app et synchronisé plus tard).
3. **Confirmation par la personne aidée** : appel IVR en DTMF, ou validation par un membre du cercle présent.

**b) Bouton SOS** dans l'app accompagnant, pour l'accompagnant lui-même et pour la personne aidée (malaise, chute). Un appui long déclenche une alerte silencieuse : position, appel automatique de l'astreinte, puis de la famille. **Rappel affiché en permanence : en cas d'urgence vitale, appeler d'abord le 15 / 112.**

**c) Minuteur de visite** : sans check-out 30 min après l'heure prévue, l'accompagnant reçoit une relance, puis un appel, puis l'astreinte est prévenue (protège les deux parties).

**d) « Bouclier anti-abus financier » (différenciateur majeur)** :
- **Interdits contractuels et techniques** : aucun paiement hors plateforme, aucun prêt, don, legs, procuration ou maniement de carte ou de codes. Rappel légal : l'**article L.116-4 du CASF** interdit aux intervenants à domicile de recevoir des donations ou legs des personnes âgées ou vulnérables qu'ils accompagnent [INCERTAIN : champ exact à vérifier pour des indépendants non agréés — à appliquer contractuellement dans tous les cas].
- **Détection dans les messages** : numéros de téléphone ou IBAN échangés, mots-clés (« espèces », « prêter », « procuration », « code », « héritage », « Western Union », « en direct sans l'appli »), avec score de risque → revue humaine. **Transparence** : les CGU et l'AIPD informent que les messages sur la plateforme font l'objet d'une analyse automatisée de sécurité.
- **Courses avec avance d'argent** : budget plafonné, ticket photographié dans le journal, rapprochement automatique ; au-delà d'un plafond, validation par la famille.
- **Signaux d'anomalie** : hausse soudaine de la fréquence des visites demandée « par la personne aidée » seule, accompagnant qui devient le contact principal, visites hors horaires, annulations de la famille suivies de missions directes, chute d'activité d'un binôme fidèle (soupçon de désintermédiation), multi-comptes (empreinte d'appareil, IBAN partagé).
- **Contrôle croisé** : rappel aléatoire de 5 à 10 % des personnes aidées par l'ops (« qualité »), y compris pour détecter les signaux de maltraitance.

**e) Protocole d'incident 24/7**

| Niveau | Exemples | Délai | Actions |
|---|---|---|---|
| **P1 — Danger immédiat** | Violence, chute grave, agression, personne introuvable | < 5 min | 15 / 17 / 112 d'abord, astreinte, famille, **suspension préventive** de l'accompagnant si mis en cause, préservation des preuves (gel des logs) |
| **P2 — Suspicion de maltraitance ou d'abus financier** | Demande d'argent, procuration, isolement, lésions inexpliquées | < 2 h | Suspension préventive, entretien des deux parties, signalement : **3977** (maltraitance des personnes âgées et handicapées), conseil départemental / cellule de recueil des informations préoccupantes adultes, **procureur** (art. 40 CPP si applicable, sinon signalement citoyen) |
| **P3 — Incident de service** | No-show, retard important, litige | < 24 h | Remplacement, geste commercial, mise en contestation du paiement |
| **P4 — Qualité** | Avis négatif, mésentente | < 72 h | Médiation |

Organisation : astreinte tournante, **double zone horaire** (Antilles UTC−4 et Réunion UTC+4 ; une équipe en métropole peut couvrir les nuits locales), scripts d'appel, registre des incidents, **retour d'expérience mensuel**, et assurance **RC Pro de la plateforme + RC Pro obligatoire des accompagnants + protection juridique**.

### 7.3 Protection des accompagnants

- **Contre les agressions** : SOS, partage de position pendant la visite uniquement (jamais en continu hors mission), droit de retrait sans pénalité, signalement du domicile (animal dangereux, tiers agressif) visible par les accompagnants suivants.
- **Contre les fausses accusations** : la PoV horodatée, le journal contemporain de la visite et les tickets de caisse constituent un **dossier de preuve neutre** ; procédure contradictoire, aucune sanction sans entretien, **suspension préventive à charge neutre** (indemnisation si l'accusation n'est pas fondée [ESTIMATION : à budgéter dans une caisse de solidarité]). **Pas d'enregistrement audio ou vidéo des visites** : ce serait disproportionné au regard du RGPD et de la vie privée au domicile.
- **Contre l'arbitraire algorithmique** : score expliqué, droit de contestation, revue humaine (directive Travail de plateforme).
- **Contre le non-paiement** : paiement capturé avant la visite (rail 1).

### 7.4 Sécurité applicative

| Domaine | Mesures |
|---|---|
| Référentiels | **OWASP ASVS niveau 2** (niveau 3 sur l'authentification, les paiements et les données de santé), **OWASP MASVS** pour l'app, OWASP Top 10 LLM pour les briques IA (injection de prompt via les journaux) |
| Authentification | Passkeys / WebAuthn (staff, accompagnants), **MFA obligatoire pour le back-office** (clés FIDO2, jamais d'OTP SMS pour les admins), sessions courtes, détection d'anomalies de connexion |
| Autorisations | RBAC + ABAC par cercle, **RLS PostgreSQL** en défense en profondeur, principe du moindre privilège, **« bris de glace »** tracé pour l'accès ops aux journaux 🔴 |
| Chiffrement | TLS 1.3, chiffrement au repos (fourni par l'hébergeur) **+ chiffrement applicatif par champ** (enveloppe, clé par cercle via KMS) pour les journaux, incidents et notes ; base mobile SQLCipher ; sauvegardes chiffrées |
| Secrets | Secret manager (Scaleway / Vault), rotation, **aucun secret dans le dépôt** (gitleaks en CI), clés de signature des appareils |
| Chaîne CI/CD | Revue de code obligatoire, SAST (Semgrep), SCA (Dependabot / Renovate), scan d'images, SBOM, signature des artefacts, environnements isolés, **données de prod jamais en staging** (jeux synthétiques) |
| Journalisation | Journal d'audit **append-only** (qui a consulté quel journal 🔴), centralisation dans l'UE (Grafana / Loki), alertes, conservation de 6 à 12 mois des logs de sécurité (recommandation CNIL) |
| Tests | **Pentest** externe avant le lancement du MVP et chaque année (prestataire qualifié PASSI : ~8 à 15 k€ [ESTIMATION]), **bug bounty privé YesWeHack** (plateforme française) en phase 2 |
| Conformité | Trajectoire **ISO 27001** : SMSI démarré en M10, certification visée en M18-24 (~15 à 30 k€ d'audit + outillage type Vanta / Drata / Tenacy [ESTIMATION]). **HDS** : héritée de l'hébergeur ; notre certification propre n'est pas nécessaire tant que nous n'hébergeons pas pour des tiers. **NIS2** : a priori hors champ (taille) [INCERTAIN]. |
| IA | Isolation des prompts, aucune donnée d'identité directe envoyée au LLM (pseudonymisation des prénoms), sorties filtrées, journalisation des versions de modèle |

### 7.5 PRA / PCA spécial Outre-mer (cyclones, coupures)

**Réalité terrain :** Garance (La Réunion, février 2025) a privé d'électricité 180 000 personnes et d'internet 114 000, avec 175 relais hors service [VÉRIFIÉ](https://www.maire-info.com/la-reunion-lourdement-frappee-par-le-cyclone-garance-article2-29455). Chido (Mayotte, décembre 2024) a mis 80 à 95 % du réseau mobile hors service, et il a fallu environ 5 semaines pour rétablir 90 % du réseau [VÉRIFIÉ](https://www.clubic.com/actualite-547640-mayotte-free-orange-et-sfr-se-mobilisent-apres-le-passage-du-cyclone-chido.html), [VÉRIFIÉ](https://alloforfait.fr/mobile/news/139550-mayotte-plus-90-reseau-mobile-retabli.html).

| Couche | Dispositif |
|---|---|
| Infra centrale (métropole) | Multi-AZ, RPO ≤ 15 min, RTO ≤ 4 h, sauvegardes chiffrées dans une 2e région HDS, restauration testée chaque trimestre |
| App accompagnant | **Hors ligne natif** : missions des 7 prochains jours, fiches d'urgence (contacts, allergies déclarées, consignes), check-in NFC/QR signé et horodaté, journal local chiffré → synchronisation différée |
| Repli de canal | WhatsApp → SMS (check-in par code) → **IVR** → appel humain |
| **Mode cyclone** (déclenché par la vigilance Météo-France / préfecture) | Vigilance orange : contact proactif avec toutes les personnes aidées, priorisation des personnes isolées, **liste exportable hors ligne** (chiffrée) des personnes vulnérables et de leurs contacts pour les CCAS et les secours, sur la base d'un consentement recueilli à l'inscription. Alerte rouge / violette : **suspension automatique** de toutes les missions (on ne met personne sur la route). Post-cyclone : campagne d'appels « êtes-vous en sécurité ? », mobilisation des accompagnants volontaires. |
| Ops | Astreinte de secours **en métropole** (un autre fuseau horaire et un réseau intact), **un terminal de communication satellitaire** pour l'ops locale (Starlink / messagerie satellite [ESTIMATION ~50 à 100 €/mois]), procédures papier imprimées |
| Partenariats | Conventions avec les CCAS et les communes (registres des personnes vulnérables) : la plateforme devient un **maillon de la résilience territoriale**, un argument fort pour les CD et les financements FEDER. |

### 7.6 RGPD by design

**Bases légales (proposition, à valider par le DPO) :**
- Exécution du contrat : missions, paiement.
- **Consentement explicite** (art. 9-2-a) ou **intérêt / mission de prise en charge** (art. 9-2-h ne s'applique pas sans professionnel de santé) pour les données de santé du journal → **consentement explicite de la personne aidée elle-même**, ou de son représentant légal si elle est sous tutelle ou habilitation familiale.
- **Point crucial** : un enfant aidant **ne peut pas consentir à la place** d'un parent majeur capable. Le parcours doit recueillir le consentement de la personne aidée (appel vocal enregistré de façon minimale : « Acceptez-vous que [plateforme] organise des visites chez vous ? Tapez 1 » + courrier récapitulatif), avec une **procédure renforcée si l'on soupçonne une altération des facultés**.
- Intérêt légitime : lutte contre la fraude, sécurité (avec mise en balance documentée).
- Obligation légale : facturation, URSSAF.

**Consentements différenciés (granulaires, révocables) :** partage du journal avec chaque membre du cercle · résumé par IA · notifications WhatsApp · appel de bienveillance · photos dans le journal · utilisation pseudonymisée pour l'amélioration des modèles · transmission aux secours / CCAS en mode cyclone · enregistrements vocaux pour la R&D créole (consentement **séparé et spécifique**).

**Durées de conservation (proposition) :**

| Donnée | Durée active | Archivage intermédiaire | Suppression |
|---|---|---|---|
| Copie de pièce d'identité / B3 | **Supprimée dès la vérification** (≤ 7 j) | — | Automatique |
| Résultat de vérification | Durée de la relation | 5 ans (prescription) | Ensuite |
| Journal de visite (🔴) | 12 mois glissants consultables | Jusqu'à 5 ans en archive chiffrée si incident ou litige [INCERTAIN] | Sinon à 13 mois |
| Géolocalisation | Uniquement check-in/out (pas de suivi continu) | 12 mois | Ensuite |
| Factures / paiements | — | 10 ans (Code de commerce) | Ensuite |
| Incidents P1-P2 | Jusqu'à clôture + 5 ans | — | Ensuite |
| Comptes inactifs | 24 mois après la dernière activité | — | Avec préavis |
| Logs de sécurité | 6 à 12 mois | — | Ensuite |

**Droits de la personne aidée :** accès au journal **la concernant** (version lue au téléphone si besoin), opposition au partage avec tel membre du cercle (**la personne aidée peut exclure un proche** : protection contre les conflits familiaux et les abus intrafamiliaux), rectification, effacement (dans les limites des obligations légales), interface « Mes données » simple et assistée par l'ops.

**Gouvernance :** DPO externalisé dès la phase 0 (~300 à 800 €/mois [ESTIMATION]), **AIPD complète avant le MVP** (critères : personnes vulnérables, données de santé, géolocalisation, évaluation / scoring, croisement de données), registre, liste publique des sous-traitants (Clever Cloud, Scaleway, Stripe, Meta, Twilio, Brevo, prestataire KYC), clauses DPA, politique de minimisation (**pas de NIR**, pas de GIR détaillé, pas de traitements médicaux).

---

## 8. Budget tech et équipe

### 8.1 Coûts mensuels des outils et de l'infra [ESTIMATION sauf mention]

| Poste | Phase 0 (M0-M4) | Phase 1 (M4-M10) | Phase 2 (M10-M18) |
|---|---|---|---|
| No-code (Tally, Baserow / Grist, n8n) | 50 à 100 € | 0 à 50 € (transition) | 0 € |
| Hébergement HDS (apps, Postgres HA, Redis, S3) | — | 400 à 1 200 € | 1 500 à 4 000 € |
| IA (LLM UE, ASR) | — | 30 à 150 € | 200 à 1 000 € (+ GPU R&D créole ponctuel) |
| WhatsApp / SMS / voix | 10 à 30 € | 100 à 400 € | 500 à 2 000 € |
| KYC (variable) | manuel | 2 à 5 € par accompagnant onboardé | idem, volume |
| Brevo, Yousign, monitoring, Sentry, outils de dev (GitHub, Figma) | 50 à 100 € | 250 à 500 € | 500 à 1 000 € |
| DPO externalisé | 300 à 500 € | 500 à 800 € | 800 à 1 200 € |
| Ligne d'astreinte, téléphonie, terminal satellite | 30 à 60 € | 100 à 200 € | 200 à 400 € |
| **Total outils / infra** | **~0,5 à 0,8 k€/mois** | **~1,5 à 3,5 k€/mois** | **~4 à 10 k€/mois** |
| Ponctuel | AIPD (2 à 5 k€) | Pentest (8 à 15 k€), design UX (10 à 20 k€) | ISO 27001 (15 à 30 k€), bug bounty (5 à 10 k€/an de primes) |

Frais de paiement (variables, sur le GMV) : ~1,5 % + 0,25 € par transaction carte EEE + frais Connect. Ils sont à **répercuter dans la commission** (ex. une commission de 15 % donne ~13 % de marge brute après frais [ESTIMATION]).

### 8.2 Équipe tech

| Phase | Profils | Format recommandé | Coût mensuel [ESTIMATION] |
|---|---|---|---|
| **0** | 1 ops / produit no-code (souvent un fondateur) + 1 freelance no-code ponctuel (10 à 15 j) | Freelance | 5 à 10 k€ au total |
| **1** | **CTO associé** (lead full-stack TS, sécurité) + 1 dev full-stack / mobile senior freelance + designer UX/UI (mission) + DPO externe + pentesteur (mission) | CTO en equity (10 à 20 %) + salaire réduit ; freelance à 550 à 750 €/jour | 15 à 25 k€/mois (≈ 100 à 150 k€ pour 6 mois) |
| **2** | + 1 dev back, + 1 dev mobile, + 1 data / ML (Python, mi-temps → temps plein), + 0,5 SRE / sécurité, + 1 product manager | Salariés (les recruter localement en DROM est un **atout FSE+ / emploi local**) | 45 à 70 k€/mois chargés |

**Recommandation ferme : un CTO associé**, pas une agence. Le cœur de valeur (confiance, preuve de visite, anti-fraude, conformité) **est** la technologie. Une agence livre des écrans, pas une posture de sécurité ni un SMSI. À défaut de CTO dans les 3 mois : un **CTO fractionnaire** (2 j/semaine) + 2 freelances seniors, avec transfert de compétences contractualisé.

---

## 9. Roadmap technique sur 18 mois

| Mois | Jalons tech et sécurité | Jalons conformité | Critère de sortie |
|---|---|---|---|
| **M0-M1** | Outils de la phase 0 (Tally, Baserow / Grist, Brevo, WhatsApp Business), charte, procédure de vérification manuelle, astreinte | Registre, AIPD simplifiée, DPO, CGU / mentions | 1re mission réalisée |
| **M1-M3** | Pilote 50 à 100 missions ; PoV manuel (messages + rappel de contrôle) ; mesure du temps ops | Retours d'expérience incidents, vérification du statut SAP / agrément (avec le juriste) | Seuils de bascule (§1.4) |
| **M2-M3** | Recrutement du CTO ; ateliers d'architecture ; maquettes Figma testées avec 10 aînés et 10 accompagnants | Contrats Clever Cloud HDS / Scaleway, DPA | Backlog MVP validé |
| **M3-M6** | Build MVP : socle (auth, cercles, missions, back-office), app accompagnant hors ligne + NFC / géofence, Stripe Connect, WhatsApp Cloud API | AIPD complète, politique de sécurité (PSSI) | Bêta fermée |
| **M6-M7** | IVR de confirmation de visite (FR + prompts créoles enregistrés), SOS, minuteur, journal guidé + résumé LLM | **Pentest** avant lancement, corrections | Pentest sans critique ouverte |
| **M7-M8** | **Lancement MVP** sur le territoire pilote ; migration des données de la phase 0 (minimisées) puis extinction du no-code | Information des personnes, consentements migrés | 100 % des visites sous PoV |
| **M8-M10** | **Habilitation API Tiers de prestation** (si le cadre légal le permet encore), rail 2, CESU (rapprochement), moteur de risque v1 (règles + mots-clés) | Démarche URSSAF, revue juridique avance immédiate | 1re avance immédiate traitée |
| **M10-M12** | 2e territoire (paramétrage multi-territoire : fuseau, numéros, prestations), **mode cyclone**, API partenaires (lecture seule) | Lancement du SMSI ISO 27001 | Saison cyclonique (nov.-avril, océan Indien) couverte |
| **M12-M15** | Matching v2 (*learning-to-rank*), détection d'anomalies (ML), tableau de bord B2B (CD / mutuelles), **bug bounty privé** | Audit de conformité directive Travail de plateforme / AI Act | Taux de fraude < 0,3 % |
| **M15-M18** | **Kreyòl Commons** : collecte consentie + partenariats universitaires (FEDER) ; PoC ASR commandes vocales créoles (base Omnilingual `acf` pour les Antilles) ; 3e territoire ; tablette simplifiée (pilote) | Audit de pré-certification ISO 27001, 2e pentest | Dossier de financement R&D déposé |

---

## 10. Ce qui rend l'ensemble « révolutionnaire » (et défendable)

1. **La personne aidée confirme sa propre visite, par la voix et dans sa langue.** Elle redevient sujet et non objet du service. C'est simple, presque gratuit (une confirmation DTMF coûte quelques centimes), et aucun concurrent grand public ne le fait.
2. **La preuve de visite multi-facteurs** est un **actif de confiance** valorisable auprès des familles, et un **argument anti-fraude** vis-à-vis de l'URSSAF, des CD et des mutuelles, qui cherchent précisément à fiabiliser l'effectivité des heures financées.
3. **Le bouclier anti-abus financier** est une proposition de valeur explicite face à la peur n° 1 des familles. Il se vend aussi en B2B (assureurs, banques, CD).
4. **La résilience cyclonique** fait de la plateforme une infrastructure de solidarité locale, pas seulement une marketplace. C'est un levier de partenariats publics et de financements.
5. **Kreyòl Commons** produit un bien commun linguistique open data, finançable, qui crée un fossé concurrentiel culturel et technologique.

---

## 11. Sources

- WhatsApp : [Grille Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Changements de juillet 2025 (SleekFlow)](https://help.sleekflow.io/en_US/whatsapp/pricing) · [YCloud](https://www.ycloud.com/blog/whatsapp-api-pricing-update) · [Tarifs France (Spur)](https://www.spurnow.com/blogs/whatsapp-business-api-pricing-explained)
- SMS : [Twilio par pays](https://textbee.dev/sms-pricing/twilio) · [Réunion / Mayotte](https://sent.dm/resources/reunion-mayotte-sms-pricing) · [Twilio Guadeloupe](https://www.twilio.com/guidelines/gp/sms)
- Voix : [OVHcloud SIP Trunk](https://www.ovhcloud.com/fr/phone/sip-trunk/) · [OVHcloud VoIP](https://www.ovhcloud.com/fr/phone/voip/services-inclus/appels-sortants/)
- URSSAF / avance immédiate : [API Tiers de prestation (data.gouv)](https://www.data.gouv.fr/dataservices/api-tiers-de-prestation/discussions) · [Demande d'habilitation](https://demarche.numerique.gouv.fr/commencer/api-tiers-de-prestations/dossier_vide) · [Logiciels compatibles](https://independant.io/logiciel-api-tiers-prestation-avance-immediate/) · [Abby — guide](https://abby.fr/blog/logiciel-compatible-avance-immediate/) · [Amendement AN 1387](https://www.assemblee-nationale.fr/dyn/17/amendements/0325/AN/1387.pdf) · [Amendement AS1102](https://www.assemblee-nationale.fr/dyn/17/amendements/0325/CION-SOC/AS1102.pdf) · [Sénat PLF 2026 amdt I-933](https://www.senat.fr/enseance/2025-2026/138/Amdt_I-933.html) · [Europe 1 — fraude crédit d'impôt SAP](https://www.europe1.fr/economie/plfss-et-fraude-le-ministere-de-leconomie-sattaque-au-credit-dimpot-pour-les-services-a-la-personne-4211793) · [MoneyVox](https://www.moneyvox.fr/actu/94897/encore-une-mauvaise-nouvelle-pour-avance-immediate-du-credit-impot-emploi-a-domicile)
- CESU : [CRCESU — acceptation e-CESU](https://www.cr-cesu.fr/wp-content/uploads/plaquette_acceptation_e_cesu-1.pdf)
- Paiements : [Stripe — marketplaces en France](https://stripe.com/resources/more/payment-solutions-marketplace-france) · [Frais Stripe 2026](https://hayot-expertise.fr/blog/frais-stripe-paypal-mollie-klarna-comparatif-optimisation-ecommerce-2026) · [Mangopay (Sharetribe)](https://sharetribe.com/academy/marketplace-payments/mangopay-overview) · [Alternatives Mangopay](https://www.lafabriquedunet.fr/logiciels/alternatives/alternative-mangopay) · [Lemonway](https://www.lemonway.com/press)
- HDS / hébergement : [Clever Cloud HDS](https://www.clever-cloud.com/health-data-hosting) · [Scaleway HDS](https://www.scaleway.com/fr/news/scaleway-annonce-sa-certification-hds-pour-garantir-la-securite-des-donnees-de-sante/) · [OVHcloud HDS 2024](https://docs.ovhcloud.com/fr/guides/account-and-service-management/account-information/hds-garanties.md) · [Nouveau référentiel HDS (CMS)](https://cms.law/en/fra/news-information/nouveau-referentiel-de-certification-des-hebergeurs-de-donnees-de-sante-hds) · [Scaleway Managed DB](https://www.scaleway.com/en/pricing/managed-databases-pricing/)
- No-code : [Airtable — résidence UE](https://www.airtable.com/company/data-residency-faqs) · [Tally RGPD](https://tally.so/help/gdpr) · [Grist auto-hébergé](https://www.getgrist.com/product/self-hosted/) · [Baserow vs Airtable](https://hackceleration.com/labs/compare/airtable-vs-baserow) · [NocoDB](https://nocodb.com/docs/product-docs/cloud-enterprise-edition/understanding-pricing) · [Brevo](https://pricingsaas.com/companies/brevo)
- IA : [Mistral — rétention des données](https://anarlog.so/blog/mistral-data-retention-policy) · [Scaleway Generative APIs](https://www.scaleway.com/en/pricing/model-as-a-service) · [Meta Omnilingual ASR](https://ai.meta.com/blog/omnilingual-asr-advancing-automatic-speech-recognition/) · [Liste des langues Omnilingual](https://github.com/facebookresearch/omnilingual-asr/blob/main/src/omnilingual_asr/models/wav2vec2_llama/lang_ids.py) · [Meta MMS](https://www.infoq.com/news/2023/06/meta-mms-speech-ai/) · [Whisper créole haïtien](https://huggingface.co/phatjmo/whisper-medium-hat/blob/main/README.md) · [Whisper créole médical](https://friendli.ai/models/veyatia/whisper-creole-medical-v4) · [Projet NSF créoles](https://www.acsu.buffalo.edu/~fabiolah/NSF-DLI.html) · [ACL 2022 — SSL créoles](https://aclweb.org/anthology/2022.findings-acl.197.pdf)
- Identité / honorabilité : [IDnow PVID](https://thepaypers.com/fraud-and-fincrime/news/idnow-receives-pvid-certification-from-anssi) · [Ubble PVID](https://www.ubble.ai/wp-content/uploads/2023/11/Politique-de-vérification-didentité-à-distance-v1.6.pdf) · [FranceConnect et privé](https://www.lemondeinformatique.fr/actualites/lire-franceconnect-pret-a-accueillir-les-acteurs-prives-73458.html) · [Attestation d'honorabilité (ARS IDF)](https://www.iledefrance.ars.sante.fr/attestation-dhonorabilite)
- Résilience : [Garance — maire-info](https://www.maire-info.com/la-reunion-lourdement-frappee-par-le-cyclone-garance-article2-29455) · [Réseaux Réunion rétablis](https://alloforfait.fr/internet/news/140588-la-reunion-reseaux-tres-grande-partie-retablis.html) · [Chido — Clubic](https://www.clubic.com/actualite-547640-mayotte-free-orange-et-sfr-se-mobilisent-apres-le-passage-du-cyclone-chido.html) · [Mayotte 90 % rétabli](https://alloforfait.fr/mobile/news/139550-mayotte-plus-90-reseau-mobile-retabli.html)

### Points ouverts à faire valider en priorité
1. Qualification HDS du journal de visite et périmètre « suivi social / médico-social » (DPO / avocat santé).
2. Régime SAP (déclaration / agrément / autorisation) de chaque prestation du catalogue → éligibilité au crédit d'impôt et à l'avance immédiate (traité dans le livrable réglementaire).
3. Sort des amendements « plateformes » sur l'avance immédiate (LFI / LFSS 2026 promulguées) et doctrine URSSAF sur l'habilitation des plateformes-logiciels.
4. Accès à l'attestation d'honorabilité pour des indépendants via une plateforme.
5. Tarif WhatsApp applicable aux indicatifs DROM ; disponibilité de numéros géographiques DROM via API.
6. Grille Stripe Connect exacte (compte actif, versements) et devis Mangopay / Lemonway / IDnow / Ubble.
