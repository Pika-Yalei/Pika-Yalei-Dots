import { publishedAt } from './article-content.mjs';
// Feeds describe publication, unlike the archive's review-date chronology.
// Stable ties and a copied array keep output deterministic and input unchanged.
export const orderFeedPosts = posts => [...posts].sort((a,b) =>
  Date.parse(publishedAt(b)) - Date.parse(publishedAt(a)) ||
  b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
