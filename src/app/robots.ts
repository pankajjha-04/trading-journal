import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Everything behind auth is noindex anyway; blocking it here also keeps
      // crawlers from burning requests on redirects to /login.
      disallow: ['/dashboard', '/journal', '/analytics', '/reports', '/settings', '/api/'],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
