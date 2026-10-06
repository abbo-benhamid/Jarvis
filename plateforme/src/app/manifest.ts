import type { MetadataRoute } from "next";

/**
 * Manifeste de la PWA légère (ADR 0008, lot W4). Servi à /manifest.webmanifest, lié automatiquement par Next.
 * Pensé pour l'accompagnant : l'app s'ouvre sur ses visites. Un autre rôle est redirigé vers son accueil.
 * Pas de service worker : l'app reste en ligne (le hors-ligne est le rôle de l'app mobile, lot M3).
 * Couleurs : jetons clairs (`--bg` sable, `--mer`). Icônes générées depuis la marque (BrandMark).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/accompagnant",
    name: "Koudmen — le lakou numérique",
    short_name: "Koudmen",
    description: "Vos visites pas à pas : arrivée prouvée, Kayé en 2 minutes.",
    lang: "fr",
    dir: "ltr",
    start_url: "/accompagnant",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F2EA",
    theme_color: "#0D5F58",
    categories: ["lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Mes visites", short_name: "Visites", url: "/accompagnant/visites", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Propositions", url: "/accompagnant/propositions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
