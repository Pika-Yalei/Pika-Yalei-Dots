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
export const publicationText = post => post.publishedAt
  ? `回顾日期：${post.date}；补发时间：${new Date(post.publishedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。这是事后整理，不是当日即时刊发。`
  : '';
export function renderSourceLinks(sources, escape) {
  if (sources?.some(source => !isReviewedSource(source.url))) throw new TypeError('Unreviewed source URL');
  return sources?.length ? `<ul class="article-sources">${sources.map(source => `<li>来源：<a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a></li>`).join('')}</ul>` : '';
}
export function articleText(post) {
  return [publicationText(post), post.subtitle, ...post.sections.flatMap(section =>
    [section.heading, ...section.paragraphs, ...(section.sources ?? []).map(source => `来源：${source.label}（${source.url}）`)]),
    post.closing, articleDisclosure].filter(Boolean).join('\n\n');
}
