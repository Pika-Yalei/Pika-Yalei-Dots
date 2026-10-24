import { siteUrl } from './feed.mjs';
import { orderFeedPosts } from './feed-order.mjs';
import { articleDisclosure, publicationText, publishedAt, renderSectionContent } from './article-content.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
import { collectTopics } from './topics.mjs';

const xml = text => String(text)
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '\uFFFD')
  .replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[char]));

// A topic subscription is a section feed, never a second copy of every article.
// Match the same exact and legacy headings as the HTML topic navigation.
export function renderTopicFeed(posts, topicId) {
  const topic = collectTopics([]).find(topic => topic.id === topicId);
  if (!topic) throw new TypeError('Unknown news topic');
  const path = `/topics/${topic.id}/`;
  const items = orderFeedPosts(posts).flatMap(post => {
    const entries = collectTopics([post]).find(candidate => candidate.id === topic.id).entries;
    const sections = sectionAnchors(post.sections);
    return entries.map(entry => {
      const section = sections.find(section => entry.href === `/notes/${post.slug}/#${section.id}`);
      // Do not render article-local item permalink controls inside a feed reader.
      const {id, ...content} = section;
      const html = [publicationText(post) ? `<p>${xml(publicationText(post))}</p>` : '',
        `<h2>${xml(section.heading)}</h2>`, renderSectionContent(content, xml, true, '\n'),
        `<p>${xml(articleDisclosure)}</p>`].filter(Boolean).join('\n');
      const url = `${siteUrl}${entry.href}`;
      return `    <item>
      <title>${xml(`${post.date}｜${section.heading}`)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <pubDate>${new Date(publishedAt(post)).toUTCString()}</pubDate>
      <description>${xml(`${topic.name}栏目；回顾日期：${post.date}。`)}</description>
      <content:encoded>${xml(html)}</content:encoded>
      <category>${xml(topic.name)}</category>
    </item>`;
    });
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(`韩立的工作手记 · ${topic.name}专题`)}</title>
    <link>${siteUrl}${path}</link>
    <description>${xml(`只订阅${topic.name}栏目的公开正文和来源，按实际发布时间排序。`)}</description>
    <language>zh-CN</language>
    <atom:link href="${siteUrl}${path}feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
