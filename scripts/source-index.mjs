import { isReviewedSource, sectionSourceGroups } from './article-content.mjs';
import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function collectSources(posts) {
  const sources = new Map();
  for (const post of [...posts].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))) {
    for (const section of sectionAnchors(post.sections)) {
      const itemTargets = new Map();
      if (post.category === '新闻回顾') {
        const anchors = newsItemAnchors(section);
        let current = null;
        sectionSourceGroups(section, true).groups.forEach((group, index) => {
          current = anchors[index] ?? current;
          if (current) for (const source of group.sources) itemTargets.set(source, current);
        });
      }
      for (const source of section.sources ?? []) {
        if (!isReviewedSource(source.url)) throw new TypeError('Unreviewed source URL');
        if (!sources.has(source.url)) sources.set(source.url, {...source, references: []});
        const entry = sources.get(source.url);
        const href = `/notes/${post.slug}/#${itemTargets.get(source) ?? section.id}`;
        if (!entry.references.some(reference => reference.href === href)) entry.references.push({href, title: post.title, heading: section.heading});
      }
    }
  }
  return [...sources.values()];
}
// Source pages use their own size and canonical first-page path.
export const sourcePageSize = 40;
export function sourcePagePath(number) {
  if (!Number.isSafeInteger(number) || number < 1) throw new RangeError('Invalid source page number');
  return number === 1 ? '/sources/' : `/sources/page/${number}/`;
}
export function paginateSources(sources) {
  const total = Math.max(1, Math.ceil(sources.length / sourcePageSize));
  return Array.from({length: total}, (_, index) => ({
    number: index + 1, total, count: sources.length,
    path: sourcePagePath(index + 1), offset: index * sourcePageSize,
    sources: sources.slice(index * sourcePageSize, (index + 1) * sourcePageSize)
  }));
}
function renderSourcePagination({number, total}) {
  if (total === 1) return '';
  const links = Array.from({length: total}, (_, index) => index + 1).map(page => page === number
    ? `<span aria-current="page" aria-label="第 ${page} 页，当前页">${page}</span>`
    : `<a href="${sourcePagePath(page)}" aria-label="第 ${page} 页">${page}</a>`).join('');
  return `<nav class="pagination" aria-label="来源分页">${number > 1 ? `<a href="${sourcePagePath(number - 1)}" rel="prev">← 上一页</a>` : ''}${links}${number < total ? `<a href="${sourcePagePath(number + 1)}" rel="next">下一页 →</a>` : ''}</nav>`;
}
export function renderSourcePage(page) {
  const {sources, number, total, count, offset} = page;
  return `<div class="article-shell"><header class="article-header"><h1>新闻与复盘来源${number === 1 ? '' : ` · 第 ${number} 页`}</h1><p class="article-subtitle">逐条回到原始材料，并查看引用它的手记章节。</p></header><div class="prose"><p>共 ${count} 个实际引用的公开链接。来源来自文章正文，不代表已独立验证来源的全部内容；统计窗口和事实限定仍以各篇手记为准。</p>${sources.length ? `<p class="page-range">显示第 ${offset + 1}–${offset + sources.length} 个来源 · 第 ${number} / ${total} 页</p><ol start="${offset + 1}">${sources.map(source => `<li><p><a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a> <small>（${escape(new URL(source.url).hostname)}）</small></p><ul>${source.references.map(ref => `<li><a href="${escape(ref.href)}">${escape(ref.title)} · ${escape(ref.heading)}</a></li>`).join('')}</ul></li>`).join('')}</ol>` : '<p>尚无可列出的引用来源。</p>'}</div>${renderSourcePagination(page)}</div>`;
}
export function renderSourceIndex(posts, number = 1) {
  sourcePagePath(number);
  const page = paginateSources(collectSources(posts))[number - 1];
  if (!page) throw new RangeError('Source page does not exist');
  return renderSourcePage(page);
}
