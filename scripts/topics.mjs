import { newsColumns } from './news-window.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
import { renderBreadcrumbs } from './breadcrumbs.mjs';

const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ids = ['ai', 'business', 'markets', 'china-policy', 'world'];
// Historical articles keep their original headings and stable section anchors.
const legacyColumns = new Map([['股票', '股票市场'], ['中国政治', '中国政治与政策'], ['国际政治', '国际政治与重大事件']]);

// Input has passed validatePosts at the build boundary. Match exact column labels,
// never keywords in introductions, article titles, or technical retrospectives.
export function collectTopics(posts) {
  const topics = newsColumns.map((name, index) => ({name, id: ids[index], entries: []}));
  for (const post of [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))) {
    if (post.category !== '新闻回顾') continue;
    for (const section of sectionAnchors(post.sections)) {
      const label = section.heading.split('｜')[0];
      const topic = topics.find(topic => topic.name === (legacyColumns.get(label) ?? label));
      if (topic) topic.entries.push({date: post.date, title: post.title, heading: section.heading, href: `/notes/${post.slug}/#${section.id}`});
    }
  }
  return topics;
}

export function renderTopics(posts) {
  const topics = collectTopics(posts);
  const count = topics.reduce((total, topic) => total + topic.entries.length, 0);
  return `<div class="article-shell">${renderBreadcrumbs([{label:'首页', href:'/'}, {label:'新闻专题'}])}<header class="article-header"><p class="eyebrow">NEWS, ACROSS THE ARCHIVE.</p><h1>按新闻专题阅读</h1><p class="article-subtitle">5 个栏目 · ${count} 个章节 · 按回顾日期由新到旧</p><p>跨日期追踪同一栏目，直接打开原文对应章节。新闻窗口、补发说明与事实限定仍以各篇手记为准。</p></header><nav class="article-contents" aria-labelledby="topics-contents-title"><h2 id="topics-contents-title">选择栏目</h2><ol>${topics.map(topic => `<li><a href="#${topic.id}">${escape(topic.name)}（${topic.entries.length} 个章节）</a></li>`).join('')}</ol></nav>${topics.map(topic => `<section class="topic-section" aria-labelledby="${topic.id}"><h2 id="${topic.id}" tabindex="-1">${escape(topic.name)}</h2>${topic.entries.length ? `<ol class="archive-list">${topic.entries.slice(0, topicPageSize).map(entry => `<li><time datetime="${escape(entry.date)}">${escape(entry.date.replaceAll('-', '.'))}</time><a href="${escape(entry.href)}">${escape(entry.heading)}<span class="sr-only"> · ${escape(entry.title)}</span></a></li>`).join('')}</ol><p><a href="${topicPath(topic.id, 1)}">查看${escape(topic.name)}全部 ${topic.entries.length} 个章节 →</a></p>` : '<p class="archive-empty">这个栏目暂时没有新闻章节。</p>'}</section>`).join('')}</div>`;
}

export function renderTopicNavigation(post) {
  const topics = collectTopics([post]).filter(topic => topic.entries.length);
  if (!topics.length) return '';
  return `<nav class="article-topics" aria-label="跨日期阅读新闻栏目"><p>继续按专题阅读：${topics.map(topic => `<a href="/topics/#${topic.id}">${escape(topic.name)}</a>`).join(' · ')}</p></nav>`;
}


// Keep both the overview and each topic page bounded as the archive grows.
export const topicPageSize = 6;
const topicPath = (id, number) => number === 1 ? `/topics/${id}/` : `/topics/${id}/page/${number}/`;

export function paginateTopics(posts) {
  return collectTopics(posts).flatMap(topic => {
    const total = Math.max(1, Math.ceil(topic.entries.length / topicPageSize));
    return Array.from({length: total}, (_, index) => ({
      id: topic.id,
      name: topic.name,
      number: index + 1,
      total,
      count: topic.entries.length,
      offset: index * topicPageSize,
      path: topicPath(topic.id, index + 1),
      entries: topic.entries.slice(index * topicPageSize, (index + 1) * topicPageSize)
    }));
  });
}

export function renderTopicPage(page) {
  const {id, name, number, total, count, offset, entries} = page;
  const pagination = total > 1 ? `<nav class="pagination" aria-label="${escape(name)}专题分页">${number > 1 ? `<a href="${topicPath(id, number - 1)}" rel="prev">← 上一页<span class="sr-only">：第 ${number - 1} 页</span></a>` : ''}<span aria-current="page">第 ${number} / ${total} 页</span>${number < total ? `<a href="${topicPath(id, number + 1)}" rel="next">下一页<span class="sr-only">：第 ${number + 1} 页</span> →</a>` : ''}</nav>` : '';
  return `<div class="article-shell">${renderBreadcrumbs([{label:'首页', href:'/'}, {label:'新闻专题', href:'/topics/'}, {label: name}])}<header class="article-header"><p class="eyebrow">ONE TOPIC, THROUGH TIME.</p><h1>${escape(name)}${number > 1 ? ` · 第 ${number} 页` : ''}</h1><p class="article-subtitle">共 ${count} 个章节 · 按回顾日期由新到旧</p></header>${entries.length ? `<p class="page-range">显示第 ${offset + 1}–${offset + entries.length} 个章节，共 ${count} 个</p><ol class="archive-list">${entries.map(entry => `<li><time datetime="${escape(entry.date)}">${escape(entry.date.replaceAll('-', '.'))}</time><a href="${escape(entry.href)}">${escape(entry.heading)}<span class="sr-only"> · ${escape(entry.title)}</span></a></li>`).join('')}</ol>` : '<p class="archive-empty">这个栏目暂时没有新闻章节。</p>'}${pagination}<p><a href="/topics/${id}/feed.xml">订阅${escape(name)}专题 RSS</a>：只接收这个栏目的正文与来源。</p><p><a class="back-link" href="/topics/#${id}">← 返回全部专题</a></p></div>`;
}
