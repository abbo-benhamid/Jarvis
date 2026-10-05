# Backlog UX (après S1c)

> Source : `S1b-ux.md`. Ces points restent ouverts après le sprint S1c (volet interface).
> Règle : un point MINEUR de plus de 30 minutes, ou hors du périmètre interface, va ici.

| # | Point | Pourquoi reporté | Propriétaire |
|---|---|---|---|
| m16 | L'étape « Trouvez la visite À vérifier » se coche dès la visite de la page Visites. Il faut la cocher à l'ouverture de la visite « À vérifier ». | Demande un nouvel événement de mesure (serveur). | Serveur |
| m17 | Le lien de reprise utilise `APP_URL`. Vérifier sa valeur en production. [À VÉRIFIER] | Configuration, pas interface. | Serveur / déploiement |
| m12 (part) | Deux messages serveur différents pour un code testeur faux (« Ce code testeur n'est pas valide » / « Code inconnu… »). Le client normalise déjà « diaspora 01 » en « DIASPORA-01 ». | Texte serveur (`src/server/sandbox/actions.ts`). | Serveur |
| A5 (part) | Robot « Simuler l'appel de l'aîné » pour une visite « À vérifier » du bac à sable. La famille ne confirme plus ; seuls l'opérateur et le robot peuvent le faire. | Logique des robots (`src/server/sandbox/robots.ts`). | Serveur |
| T1 | Textes serveur encore visibles par le testeur : « Faites le check-in » (message du robot), « Proposition du robot Koudmen (bac à sable) », « Vérifiez les champs en rouge » (remplacé à l'affichage par `FormMessage`). | Textes dans `src/server/**`. | Serveur |
| T2 | Pages légales : les marqueurs « [À VÉRIFIER AVEC UN AVOCAT] » (confidentialité) et « [À VÉRIFIER] » (mentions légales) restent visibles. | Pages modifiées en parallèle par le volet sécurité ; décision du fondateur (texte juridique). | Fondateur + sécurité |
| P1 | Panneau du test : à 360 px, « Simuler la suite » et « Mon avis » passent sur 2 lignes (panneau d'environ 230 px). Piste : une icône seule pour « Mon avis » avec nom accessible. | Compromis lisibilité / hauteur ; à valider en session pilote. | Interface |
| P2 | Chiffres des estimations (coût horaire 20 €, crédit d'impôt 50 %, taux nets 78 % et 78,8 %) dans `src/lib/estimates.ts`. [À VÉRIFIER] avec le simulateur URSSAF avant le pilote. | Validation métier. | Fondateur |
| S1-S6 | Suggestions de la revue (Kayé riche, photo des profils, bouton A+, etc.). | Hors du périmètre du test. | Produit |
