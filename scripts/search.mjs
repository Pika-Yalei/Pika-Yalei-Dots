import { createHash } from 'node:crypto';
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
  return [...posts].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).flatMap(post => [
    {type:'article', title:post.title, detail:post.summary, date:post.date, href:`/notes/${post.slug}/`},
    ...collectHeadlines([post]).map(item => ({type:'headline', title:item.title, detail:`${item.heading} · ${item.article}`, date:item.date, href:item.href})),
    ...sectionAnchors(post.sections).flatMap(section => {
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
        return {type:'source', title:source.label, detail:`${new URL(source.url).hostname} · ${post.title} · ${section.heading}${target ? ` · ${target.title}` : ''}`, date:post.date, href:source.url, reference:`/notes/${post.slug}/#${target?.anchor ?? section.id}`, referenceLabel:target ? '查看引用新闻条目' : '查看引用章节（未明确对应单条新闻）'};
      });
    })
  ]);
}
export function renderSearch(posts) {
  return `<div class="article-shell"><header class="article-header"><h1>站内搜索</h1><p class="article-subtitle">搜索公开文章标题与摘要、新闻标题、来源标签与网站。</p></header><div class="prose"><p id="search-help">关键词只在本页内匹配，不上传、不写入网址或浏览器存储。空格分隔的词须全部匹配；忽略大小写和全角差异。不搜索新闻正文或来源网页全文。来源按引用位置计数，同一来源可能重复出现。结果按回顾日期排列，最多显示 50 条，请添加关键词缩小范围。</p><p>无需脚本也可浏览：<a href="/archive/">文章归档</a> · <a href="/headlines/">新闻条目</a> · <a href="/sources/">来源索引</a>。</p><noscript><p>本地搜索需要 JavaScript；请使用上面的静态索引。</p></noscript><div id="search-controls"></div><p id="search-status" role="status" aria-live="polite" aria-atomic="true" aria-label="搜索结果状态">搜索尚未就绪；如未出现输入框，请使用静态索引。</p><ol id="search-results"></ol></div></div><template id="search-data">${escape(JSON.stringify(collectSearchEntries(posts)))}</template><template id="search-ui"><div role="search" aria-label="站内搜索"><label for="search-query">关键词</label><input id="search-query" type="search" maxlength="200" autocomplete="off" spellcheck="false" aria-describedby="search-help"><label for="search-type">内容类型</label><select id="search-type"><option value="all">全部</option><option value="article">文章</option><option value="headline">新闻条目</option><option value="source">引用来源</option></select><button id="search-clear" type="button">清空搜索</button></div></template>`;
}
