import { isReviewedSource } from './article-content.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function collectSources(posts) {
  const sources = new Map();
  for (const post of [...posts].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))) {
    for (const section of sectionAnchors(post.sections)) for (const source of section.sources ?? []) {
      if (!isReviewedSource(source.url)) throw new TypeError('Unreviewed source URL');
      if (!sources.has(source.url)) sources.set(source.url, {...source, references: []});
      const entry = sources.get(source.url);
      const href = `/notes/${post.slug}/#${section.id}`;
      if (!entry.references.some(reference => reference.href === href)) entry.references.push({href, title: post.title, heading: section.heading});
    }
  }
  return [...sources.values()];
}
export function renderSourceIndex(posts) {
  const sources = collectSources(posts);
  return `<div class="article-shell"><header class="article-header"><h1>新闻与复盘来源</h1><p class="article-subtitle">逐条回到原始材料，并查看引用它的手记章节。</p></header><div class="prose"><p>共 ${sources.length} 个实际引用的公开链接。来源来自文章正文，不代表已独立验证来源的全部内容；统计窗口和事实限定仍以各篇手记为准。</p>${sources.length ? `<ol>${sources.map(source => `<li><p><a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a> <small>（${escape(new URL(source.url).hostname)}）</small></p><ul>${source.references.map(ref => `<li><a href="${escape(ref.href)}">${escape(ref.title)} · ${escape(ref.heading)}</a></li>`).join('')}</ul></li>`).join('')}</ol>` : '<p>尚无可列出的引用来源。</p>'}</div></div>`;
}
