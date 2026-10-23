import { newsItemAnchors } from './reading-navigation.mjs';
import { newsWindowText } from './news-window.mjs';
import { readFileSync } from 'node:fs';

// Exact public destinations reviewed alongside the article, never a wildcard host rule.
export const sourceUrls = new Set(JSON.parse(readFileSync(new URL('./source-links.json', import.meta.url), 'utf8')));
export function isReviewedSource(value) {
  if (typeof value !== 'string' || !sourceUrls.has(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.href === value;
  } catch { return false; }
}
export const articleDisclosure = 'AI 撰写 · 基于公开来源，不涉及私人对话或未公开资料';
export const publishedAt = post => post.publishedAt ?? `${post.date}T00:00:00Z`;
export const publicationText = post => {
  if (!post.publishedAt) return '';
  const time = new Date(post.publishedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false });
  const publication = post.publicationKind === 'original'
    ? `回顾日期：${post.date}；发布时间：${time}（北京时间）。`
    : `回顾日期：${post.date}；补发时间：${time}（北京时间）。这是事后整理，不是当日即时刊发。`;
  return [publication, newsWindowText(post)].filter(Boolean).join(' ');
};
export function renderSourceLinks(sources, escape) {
  if (sources?.some(source => !isReviewedSource(source.url))) throw new TypeError('Unreviewed source URL');
  return sources?.length ? `<ul class="article-sources">${sources.map(source => `<li>来源：<a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a></li>`).join('')}</ul>` : '';
}
// Only explicit item numbers or unique complete titles establish source mappings.
export function sectionSourceGroups(section, numbered = false) {
  const groups = section.paragraphs.map(text => ({text, sources: []}));
  const remaining = [];
  const number = text => /^(\d+)\.\s/.exec(text)?.[1];
  const targets = new Map();
  let active = null;
  if (numbered) for (const group of groups) {
    const id = number(group.text);
    if (id) {
      active = id;
      targets.set(id, targets.has(id) ? null : group);
    } else if (active && targets.get(active)) {
      // Unnumbered continuation paragraphs belong to the current numbered item.
      targets.set(active, group);
    }
  }
  const titles = numbered ? groups.filter(group => number(group.text)).map(group => ({
    id: number(group.text), title: group.text.replace(/^\d+\.\s+/, '').split('。')[0]
  })) : [];
  for (const source of section.sources ?? []) {
    const exactTitles = numbered && !number(source.label) ? titles.filter(item => item.title && source.label.startsWith(`${item.title}：`)) : [];
    const target = numbered ? targets.get(number(source.label) ?? (exactTitles.length === 1 ? exactTitles[0].id : null)) : null;
    if (target) target.sources.push(source); else remaining.push(source);
  }
  return {groups, remaining};
}
export function renderSectionContent(section, escape, numbered = false, separator = '') {
  const {groups, remaining} = sectionSourceGroups(section, numbered);
  const anchors = numbered && section.id ? newsItemAnchors(section) : [];
  return groups.map((group, index) => {
    const content = `<p>${escape(group.text)}</p>${renderSourceLinks(group.sources, escape)}`;
    return anchors[index] ? `<div class="news-item" id="${anchors[index]}" tabindex="-1">${content}<a class="news-permalink" href="#${anchors[index]}" aria-label="本条新闻链接：${escape(group.text.replace(/^\d+\.\s+/, '').split('。')[0])}">本条链接</a></div>` : content;
  }).join(separator)
    + (numbered && remaining.length ? '<p class="source-mapping-note">补充来源（原记录未明确对应条目）</p>' : '')
    + renderSourceLinks(remaining, escape);
}
export function articleText(post) {
  return [publicationText(post), post.subtitle, ...post.sections.flatMap(section => {
    const {groups, remaining} = sectionSourceGroups(section, post.category === '新闻回顾');
    const sourceText = source => `来源：${source.label}（${source.url}）`;
    return [section.heading, ...groups.flatMap(group => [group.text, ...group.sources.map(sourceText)]),
      ...(post.category === '新闻回顾' && remaining.length ? ['补充来源（原记录未明确对应条目）'] : []), ...remaining.map(sourceText)];
  }), post.closing, articleDisclosure].filter(Boolean).join('\n\n');
}
