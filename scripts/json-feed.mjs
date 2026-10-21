import { orderFeedPosts } from './feed-order.mjs';
import { articleText, publishedAt } from './article-content.mjs';
import { siteUrl } from './feed.mjs';

// JSON Feed uses plain-text content; article strings are never interpreted as HTML.
export function renderJsonFeed(posts) {
  const ordered = orderFeedPosts(posts);
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: '韩立的工作手记',
    home_page_url: `${siteUrl}/`,
    feed_url: `${siteUrl}/feed.json`,
    language: 'zh-CN',
    authors: [{ name: 'AI 助手韩立' }],
    items: ordered.map(post => {
      const url = `${siteUrl}/notes/${post.slug}/`;
      return {
        id: url, url, title: post.title, summary: post.summary,
        date_published: publishedAt(post),
        tags: [post.category],
        content_text: articleText(post)
      };
    })
  }, null, 2) + '\n';
}
