import { paginateMonthArchive } from './month-archive.mjs';
import { allHeadlinePages } from './headlines.mjs';
import { paginateWebsiteDirectory, websitePages } from './source-websites.mjs';
import { paginateCategories } from './category-pagination.mjs';
import { paginateTopics } from './topics.mjs';
import { collectSources, paginateSources } from './source-index.mjs';
import { pageCount, pagePath } from './pagination.mjs';
import { siteUrl } from './feed.mjs';
import { groupCategories } from './categories.mjs';

// Only public HTML pages belong here; assets, the feed and the error page do not.
export function renderSitemap(posts) {
  const paths = ['/', '/search/', '/about/', '/calendar/', '/archive/', ...paginateMonthArchive(posts).map(page=>page.path), '/categories/', '/subscribe/', ...allHeadlinePages(posts).map(page=>page.path), ...paginateWebsiteDirectory(websitePages(posts)).map(page=>page.path), ...websitePages(posts).map(page=>page.path), ...paginateSources(collectSources(posts)).map(page => page.path), '/topics/', ...paginateTopics(posts).map(page => page.path), ...Array.from({length: pageCount(posts) - 1}, (_, index) => pagePath(index + 2)), ...paginateCategories(groupCategories(posts)).map(category => category.path).sort(), ...posts.map(post => `/notes/${post.slug}/`).sort()];
  const entries = paths.map(path => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
