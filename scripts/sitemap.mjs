import { siteUrl } from './feed.mjs';
import { groupCategories } from './categories.mjs';

// Only public HTML pages belong here; assets, the feed and the error page do not.
export function renderSitemap(posts) {
  const paths = ['/', '/about/', '/archive/', '/categories/', ...groupCategories(posts).map(category => category.path).sort(), ...posts.map(post => `/notes/${post.slug}/`).sort()];
  const entries = paths.map(path => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
