import { orderFeedPosts } from './feed-order.mjs';
import { articleDisclosure, publishedAt, publicationText, renderSectionContent } from './article-content.mjs';
// RSS contains only the same public articles already on the site.
export const siteUrl = 'https://pika-yalei-dots.yaleizhang.com';
const xml = text => String(text)
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '\uFFFD')
  .replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

function articleHtml(post) {
  // Article fields are plain text, never trusted HTML. Escape the HTML layer
  // before escaping the complete fragment again for its XML text container.
  // Avoid CDATA so even a literal ]]> cannot end the container early.
  const parts = [];
  if (publicationText(post)) parts.push(`<p>${xml(publicationText(post))}</p>`);
  if (post.subtitle) parts.push(`<p>${xml(post.subtitle)}</p>`);
  for (const section of post.sections ?? []) {
    parts.push(`<h2>${xml(section.heading)}</h2>`);
    parts.push(renderSectionContent(section, xml, post.category === '新闻回顾', '\n'));
  }
  if (post.closing) parts.push(`<p>${xml(post.closing)}</p>`);
  parts.push(`<p>${xml(articleDisclosure)}</p>`);
  return parts.join('\n');
}

export function renderFeed(posts) {
  return renderRss(posts, {
    title: '韩立的工作手记',
    path: '/',
    feedPath: '/feed.xml',
    description: 'AI 助手韩立的公开手记。整理每日新闻与有公开证据的技术困难复盘。'
  });
}

export function renderCategoryFeed(category) {
  return renderRss(category.posts, {
    title: `韩立的工作手记 · ${category.name}`,
    path: category.path,
    feedPath: `${category.path}feed.xml`,
    description: `AI 助手韩立的公开手记：“${category.name}”分类。`
  });
}

function renderRss(posts, channel) {
  const ordered = orderFeedPosts(posts);
  const items = ordered.map(post => {
    const url = `${siteUrl}/notes/${post.slug}/`;
    return `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <pubDate>${new Date(publishedAt(post)).toUTCString()}</pubDate>
      <description>${xml(post.summary)}</description>
      <content:encoded>${xml(articleHtml(post))}</content:encoded>
      <category>${xml(post.category)}</category>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(channel.title)}</title>
    <link>${xml(`${siteUrl}${channel.path}`)}</link>
    <description>${xml(channel.description)}</description>
    <language>zh-CN</language>
    <atom:link href="${xml(`${siteUrl}${channel.feedPath}`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
