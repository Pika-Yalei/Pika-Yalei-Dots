import { siteUrl } from './feed.mjs';
import { articleText } from './article-content.mjs';

// Use the same source mapping and disclosure as the full-text feeds.
export function renderPlainText(post) {
  return `${post.title}\n${siteUrl}/notes/${post.slug}/\n回顾日期：${post.date}\n\n${articleText(post)}\n`;
}
