---
name: communication-claire
description: Règles de communication du fondateur de Koudmen. À appliquer à CHAQUE réponse, document, synthèse ou livrable de ce projet. Écriture à ~80 % ASD-STE100, schémas plutôt que texte, pages HTML interactives pour les livrables, vidéos explicatives quand c'est pertinent.
---

# Communication claire — règles du projet

Le fondateur veut comprendre vite et superviser. Les agents font le travail lourd. Ton rôle : rendre le résultat **lisible, visuel et vérifiable**.

Applique l'échelle ci-dessous. Monte d'un niveau quand le sujet le justifie.

```
Texte STE  →  Schéma  →  Page HTML interactive  →  Vidéo explicative
(toujours)    (souvent)   (livrables importants)    (sur demande / gros sujets)
```

## Niveau 1 — Écriture « 80 % ASD-STE100 » (toujours)

ASD-STE100 est la langue contrôlée de la maintenance aéronautique. Applique ses principes en français, assouplis à ~80 %.

### Règles

| Règle | Limite |
|---|---|
| Phrase de procédure (consigne, action) | 20 mots max |
| Phrase descriptive | 25 mots max |
| Paragraphe | 6 phrases max, 1 seul sujet |
| Instructions par phrase | 1 (sauf actions simultanées) |
| Groupe nominal | 3 mots max si possible |

1. **Un mot = un sens.** Utilise toujours le même terme pour la même chose (ex. : toujours « accompagnant », jamais « aidant » pour la même personne).
2. **Voix active.** « L'agent vérifie le casier », pas « le casier est vérifié ».
3. **Impératif pour les actions.** « Envoie la demande à la DEETS. »
4. **Temps simples.** Présent, passé simple/composé, futur. Évite les tournures progressives et les conditionnels empilés.
5. **Verbes simples plutôt que verbes savants.** « Commencer » plutôt que « initier », « utiliser » plutôt que « recourir à », « avant » plutôt que « préalablement à ».
6. **Ne supprime pas les petits mots** (articles, « que », « qui ») pour gagner de la place.
7. **Listes verticales** pour les textes complexes et les étapes.
8. **Avertissements d'abord.** Commence par l'instruction, puis donne le risque. `ATTENTION` = risque financier/juridique. `DANGER` = risque pour une personne.

### Les 20 % de souplesse

- Le jargon métier nécessaire est accepté (SAP, CESU, APA, HDS…), mais défini à sa première apparition.
- Une phrase plus longue est acceptée pour une nuance juridique, si elle reste claire.
- Le ton reste humain et direct, pas robotique.

### Exemple

- ❌ « Il est impératif que la plateforme s'assure préalablement au démarrage de l'activité de l'obtention de l'agrément. »
- ✅ « Obtiens l'agrément avant la première mission. Sans agrément, la famille perd le crédit d'impôt. »

## Niveau 2 — Schémas (souvent)

Un schéma remplace souvent 3 paragraphes. Fais un schéma quand il y a :
- un flux (argent, données, parcours utilisateur) ;
- une décision (arbre « si… alors… ») ;
- une structure (organisation, architecture, montage juridique) ;
- une chronologie (roadmap).

Format : **Mermaid** dans les fichiers Markdown, **SVG inline** dans les pages HTML.

## Niveau 3 — Pages HTML interactives (livrables importants)

Pour une synthèse, une comparaison, un modèle financier ou un pitch : produis une page HTML (Artifact) belle et interactive. Exemples : simulateur de prix, onglets par thème, schémas cliquables, curseurs de scénarios.

- Charge le skill `artifact-design` avant d'écrire la page.
- Garde la page autonome (pas de dépendance cachée) et lisible sur téléphone.
- Garde une version Markdown dans `docs/` comme source de vérité.

## Niveau 4 — Vidéos explicatives (sur demande ou gros sujets)

Pour expliquer un concept clé (le modèle, le montage juridique, le pitch) : propose une vidéo explicative style 3Blue1Brown.

- Options : animation Manim (Python, gratuit, local) + narration TTS ; ou outil de génération vidéo connecté (Higgsfield) ; narration ElevenLabs si le fondateur donne une clé API, sinon une alternative gratuite (ex. Piper, Coqui/XTTS en local).
- **Demande toujours avant** de lancer une génération payante (crédits).

## Contrôle avant d'envoyer

- [ ] Phrases courtes, voix active, un terme = un sens ?
- [ ] Un schéma serait-il plus clair qu'un paragraphe ?
- [ ] Ce livrable mérite-t-il une page HTML ?
- [ ] Les incertitudes sont-elles signalées clairement (`[À VÉRIFIER]`) ?
