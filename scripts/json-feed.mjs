import { siteUrl } from './feed.mjs';

// JSON Feed uses plain-text content; article strings are never interpreted as HTML.
export function renderJsonFeed(posts) {
  const ordered = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
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
        date_published: `${post.date}T00:00:00Z`,
        tags: [post.category],
        content_text: [post.subtitle, ...post.sections.flatMap(section => [section.heading, ...section.paragraphs]), post.closing, 'AI 撰写 · 通用观察，不涉及真实私人事件'].join('\n\n')
      };
    })
  }, null, 2) + '\n';
}
