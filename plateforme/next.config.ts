import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Politique de sécurité du contenu (CSP) raisonnable pour Next.js sans nonce :
 * - scripts et styles de notre origine seulement ('unsafe-inline' requis par l'hydratation Next.js) ;
 * - 'unsafe-eval' seulement en développement (rechargement à chaud) ;
 * - aucune ressource tierce, aucune mise en cadre (frame-ancestors 'none').
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Géolocalisation : autorisée seulement sur notre origine (check-in ponctuel).
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  // D3 : aucune page indexée pendant le test.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Le lien de reprise contient un secret : il ne doit jamais partir dans un en-tête Referer.
      { source: "/tester/reprendre/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  async redirects() {
    // Ancienne page unique « Mentions et confidentialité » (S0) → pages séparées (D4).
    return [{ source: "/mentions", destination: "/mentions-legales", permanent: false }];
  },
};

export default nextConfig;
