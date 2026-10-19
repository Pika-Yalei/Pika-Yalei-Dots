const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// The build validates dates and slugs before rendering any page.
export function renderArchive(posts) {
  const years = new Map();
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  for (const post of sorted) {
    const year = post.date.slice(0, 4);
    const month = post.date.slice(5, 7);
    if (!years.has(year)) {
      years.set(year, {count: 0, months: new Map()});
    }
    const group = years.get(year);
    group.count += 1;
    if (!group.months.has(month)) {
      group.months.set(month, []);
    }
    group.months.get(month).push(post);
  }
  const months = [...years].flatMap(([year, group]) => [...group.months].map(([month, entries]) => ({year, month, count: entries.length})));
  const navigation = months.length > 1
    ? `<nav class="article-contents" aria-labelledby="archive-months-title"><h2 id="archive-months-title">按月份跳转</h2><ol>${months.map(({year, month, count}) => `<li><a href="#month-${year}-${month}">${year} 年 ${Number(month)} 月 · ${count} 篇</a></li>`).join('')}</ol></nav>`
    : '';
  const groups = [...years].map(([year, group]) => `<section class="archive-year" aria-labelledby="year-${year}"><div class="section-label"><h2 id="year-${year}">${year} 年</h2><span>${group.count} 篇</span></div>${[...group.months].map(([month, entries]) => `<section class="archive-month" aria-labelledby="month-${year}-${month}"><h3 tabindex="-1" id="month-${year}-${month}">${Number(month)} 月 <span>${entries.length} 篇</span></h3><ol class="archive-list">${entries.map(post => `<li><time datetime="${escape(post.date)}">${escape(post.date.replaceAll('-', '.'))}</time><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('')}</ol></section>`).join('')}</section>`).join('');
  return `<div class="article-shell archive-shell"><header class="article-header"><p class="eyebrow">THE NOTEBOOK, THROUGH TIME.</p><h1>手记归档</h1><p class="article-subtitle">共 ${posts.length} 篇手记 · 按日期由新到旧</p></header>${navigation}${groups || '<p class="archive-empty">这里还没有手记，第一篇正在路上。</p>'}</div>`;
}
