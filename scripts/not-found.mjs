const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function renderNotFound(posts) {
  const recent = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).slice(0, 3);
  const suggestions = recent.length ? `<section aria-labelledby="recent-notes"><h2 id="recent-notes">不妨从这些手记继续</h2><ul class="archive-list">${recent.map(post => `<li><time datetime="${escape(post.date)}">${escape(post.date.replaceAll('-', '.'))}</time><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('')}</ul></section>` : '';
  return `<section class="not-found article-shell"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>这一页，<br>还没写到。</h1><p>也可能是地址走岔了路。可以回到首页，或在归档中找一找。记得关键词时可用站内搜索，记得回顾日期时可用新闻日历。</p><p><a class="read-link" href="/">回到手记首页 →</a> · <a class="read-link" href="/archive/">浏览全部归档 →</a></p><nav class="prose" aria-labelledby="recovery-title"><h2 id="recovery-title">按你记得的线索找回内容</h2><ul><li><a href="/search/">按关键词搜索文章</a>：记得标题、摘要或来源中的词时，使用本地搜索。</li><li><a href="/calendar/">按回顾日期查看新闻</a>：记得简报日期时，从日历进入当天的文章列表。</li><li><a href="/sources/">按引用来源查找</a>：记得来源名称、网站或链接时，从来源索引返回引用它的文章。</li></ul></nav>${suggestions}</section>`;
}
