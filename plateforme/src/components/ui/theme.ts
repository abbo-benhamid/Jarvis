/** Clé du choix de thème mémorisé (même clé que la maquette). */
export const THEME_STORAGE_KEY = "kd-theme";

export type ThemeChoice = "light" | "dark";

/**
 * Script court, lancé dans <head> avant l'affichage : applique le thème mémorisé (data-theme sur <html>).
 * Sans choix, rien n'est posé : les jetons suivent la préférence du système.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
