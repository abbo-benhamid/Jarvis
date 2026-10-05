/**
 * Retour haptique (V2-app). Web et tests : rien (pas de vibration du navigateur).
 * iOS / Android : `haptique.native.ts` (expo-haptics).
 */
export type Haptique = 'leger' | 'succes';

export function retourHaptique(_type: Haptique): void {
  // Pas de retour haptique sur le web.
}
