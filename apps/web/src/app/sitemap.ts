import type { MetadataRoute } from 'next';

import { projectPublicSitemap } from '../public-indexing';

export default function sitemap(): MetadataRoute.Sitemap {
  return projectPublicSitemap().map(({ alternates, url }) => ({
    alternates: {
      languages: { ...alternates },
    },
    url,
  }));
}
