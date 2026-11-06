import { createHash } from 'node:crypto';
import { collectTopics } from './topics.mjs';
import { collectHeadlines } from './headlines.mjs';
import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';
import { isReviewedSource, sectionSourceGroups } from './article-content.mjs';
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function fingerprintSearch(assets) {
  const bytes = assets.get('search.js');
  if (!Buffer.isBuffer(bytes)) throw new TypeError('Missing reviewed search.js bytes');
  return `search.${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.js`;
}
export function collectSearchEntries(posts) {
  return [...posts].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).flatMap(post => {
    const topics = collectTopics([post]);
    const bySection = new Map(topics.flatMap(topic => topic.entries.map(entry => [entry.href, topic.id])));
    // Use the same numbered-item boundaries as the rendered article, including continuation paragraphs.
    const bodies = new Map();
    for (const section of sectionAnchors(post.sections)) {
      const anchors = newsItemAnchors(section);
      let href = null;
      (section.paragraphs ?? []).forEach((paragraph, index) => {
        if (anchors[index]) href = `/notes/${post.slug}/#${anchors[index]}`;
        if (href) bodies.set(href, [...(bodies.get(href) ?? []), paragraph]);
      });
    }
    return [
    {type:'article', topics:topics.filter(topic => topic.entries.length).map(topic => topic.id), title:post.title, detail:post.summary, date:post.date, href:`/notes/${post.slug}/`},
    ...collectHeadlines([post]).map(item => ({type:'headline', topics:[item.topicId], title:item.title, body:(bodies.get(item.href) ?? []).join('\n'), detail:`${item.heading} · ${item.article}`, date:item.date, href:item.href})),
    ...sectionAnchors(post.sections).flatMap(section => {
      const topicId = bySection.get(`/notes/${post.slug}/#${section.id}`);
      const targets = new Map();
      if (post.category === '新闻回顾') {
        const anchors = newsItemAnchors(section);
        let current = null;
        sectionSourceGroups(section, true).groups.forEach((group, index) => {
          if (anchors[index]) current = {anchor:anchors[index], title:group.text.replace(/^\d+\.\s+/, '').split('。')[0]};
          if (current) for (const source of group.sources) targets.set(source, current);
        });
      }
      return (section.sources ?? []).map(source => {
        if (!isReviewedSource(source.url)) throw new TypeError('Unreviewed search source URL');
        const target = targets.get(source);
        return {type:'source', topics:topicId ? [topicId] : [], title:source.label, detail:`${new URL(source.url).hostname} · ${post.title} · ${section.heading}${target ? ` · ${target.title}` : ''}`, date:post.date, href:source.url, reference:`/notes/${post.slug}/#${target?.anchor ?? section.id}`, referenceLabel:target ? '查看引用新闻条目' : '查看引用章节（未明确对应单条新闻）'};
      });
    })
  ];
  });
}
// Keep email-like versioned URLs out of HTML edge email rewriting; JSON parsing restores @.
export function renderSearch(posts) {
  return `<div class="article-shell"><header class="article-header"><h1>站内搜索</h1><p class="article-subtitle">搜索公开文章标题与摘要、新闻标题、来源标签、网站与网址，也可选择匹配新闻正文。</p></header><div class="prose"><p id="search-help">关键词只在本页内匹配，不上传、不写入网址或浏览器存储。输入关键词后按 Enter 可跳到结果状态，再按 Tab 浏览结果链接。空格分隔的词须全部匹配；忽略大小写和全角差异。引用来源也可按完整网址或网址片段查找；只匹配本站已引用的链接，不访问或搜索来源网页全文，默认不搜索新闻正文；将匹配范围设为“同时匹配新闻正文”可查找本站新闻条目的事实与分析，包括续段，不包含外部来源网页正文。正文命中直接链接原新闻条目。来源按引用位置计数，同一来源可能重复出现。结果可按回顾日期从新到旧或从旧到新排列，同日内顺序不变，每页 50 条，可翻页或直达首页、末页查看全部匹配。可只选内容类型、栏目或日期范围浏览；栏目按新闻章节归属，文章命中表示该篇包含该栏。日期指简报回顾日，不是实际发布时间，起止日期均包含。</p><p>无需脚本也可浏览：<a href="/archive/">文章归档</a> · <a href="/headlines/">新闻条目</a> · <a href="/sources/">来源索引</a>。</p><noscript><p>本地搜索需要 JavaScript；请使用上面的静态索引。</p></noscript><div id="search-controls"></div><p id="search-print-context" class="search-print-context"></p><p id="search-status" tabindex="-1" role="status" aria-live="polite" aria-atomic="true" aria-label="搜索结果状态">搜索尚未就绪；如未出现输入框，请使用静态索引。</p><ol id="search-results"></ol></div></div><template id="search-data">${escape(JSON.stringify(collectSearchEntries(posts)).replaceAll('@', '\\u0040'))}</template><template id="search-ui"><div role="search" aria-label="站内搜索"><label for="search-query">关键词</label><input id="search-query" type="search" maxlength="200" autocomplete="off" spellcheck="false" aria-describedby="search-help"><label for="search-scope">匹配范围</label><select id="search-scope" aria-describedby="search-help"><option value="summary">标题、摘要与来源</option><option value="body">同时匹配新闻正文</option></select><label for="search-type">内容类型</label><select id="search-type"><option value="all">全部</option><option value="article">文章</option><option value="headline">新闻条目</option><option value="source">引用来源</option></select><label for="search-topic">新闻栏目</label><select id="search-topic"><option value="all">全部栏目</option>${collectTopics([]).map(topic => `<option value="${topic.id}">${escape(topic.name)}</option>`).join('')}</select><label for="search-order">日期排序</label><select id="search-order"><option value="newest">从新到旧</option><option value="oldest">从旧到新</option></select><label for="search-from">起始回顾日期</label><input id="search-from" type="date" min="0001-01-01" max="9999-12-31" aria-describedby="search-help search-status"><label for="search-to">结束回顾日期</label><input id="search-to" type="date" min="0001-01-01" max="9999-12-31" aria-describedby="search-help search-status"><button id="search-clear" type="button">清空搜索</button></div><nav id="search-pagination" aria-label="搜索结果分页" hidden><button id="search-first" type="button" aria-controls="search-results">首页</button><button id="search-previous" type="button" aria-controls="search-results">上一页</button><button id="search-next" type="button" aria-controls="search-results">下一页</button><button id="search-last" type="button" aria-controls="search-results">末页</button></nav></template>`;
}
