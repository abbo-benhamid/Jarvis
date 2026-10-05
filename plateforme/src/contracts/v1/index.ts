/**
 * Contrats de l'API v1 (ADR 0008). Copiés dans `mobile/src/contracts/` par `mobile/scripts/sync-contracts.mjs`
 * (sans les fichiers `*.test.ts`).
 * RÈGLE : aucun import serveur ici (seulement `zod` et les fichiers de ce dossier).
 */
export * from "./erreurs";
export * from "./auth";
export * from "./moi";
export * from "./visits";
export * from "./visits-propositions";
