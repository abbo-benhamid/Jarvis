import type { MetadataRoute } from "next";

/** D3 : le site de test ne doit pas être indexé. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
