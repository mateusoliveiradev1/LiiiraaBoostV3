import type { MetadataRoute } from 'next';

import { projectPublicRobots } from '../public-indexing';

export default function robots(): MetadataRoute.Robots {
  const projection = projectPublicRobots();

  return {
    host: projection.host,
    rules: {
      allow: [...projection.allow],
      disallow: [...projection.disallow],
      userAgent: '*',
    },
    sitemap: projection.sitemap,
  };
}
