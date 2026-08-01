import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: site, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/product`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${site}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
