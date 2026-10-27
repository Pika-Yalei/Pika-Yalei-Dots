import { renderPageWindow } from './page-window.mjs';
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const monthPageSize = 6;
export function monthArchivePath(month, number = 1) {
  if (typeof month !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Invalid archive month');
  if (!Number.isSafeInteger(number) || number < 1) throw new RangeError('Invalid archive page number');
  return number === 1 ? `/archive/${month}/` : `/archive/${month}/page/${number}/`;
}
export function paginateMonthArchive(posts) {
  const months = new Map();
  for (const post of [...posts].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))) {
    const month = post.date.slice(0,7);
    if (!months.has(month)) months.set(month,[]);
    months.get(month).push(post);
  }
  return [...months].flatMap(([month,entries]) => {
    const total = Math.ceil(entries.length/monthPageSize);
    return Array.from({length:total}, (_,i) => ({
      month, number:i+1, total, count:entries.length, offset:i*monthPageSize,
      path:monthArchivePath(month,i+1), posts:entries.slice(i*monthPageSize,(i+1)*monthPageSize)
    }));
  });
}
export function renderMonthArchive(page) {
  const navigation = page.total > 1 ? `<nav class="pagination" aria-label="月份归档分页">${page.number > 1 ? `<a href="${monthArchivePath(page.month,page.number-1)}" rel="prev">← 上一页</a>` : ''}${renderPageWindow(page.number,page.total,number=>monthArchivePath(page.month,number))}${page.number < page.total ? `<a href="${monthArchivePath(page.month,page.number+1)}" rel="next">下一页 →</a>` : ''}</nav>` : '';
  return `<div class="article-shell archive-shell"><header class="article-header"><h1>${escape(page.month)} 手记归档${page.number > 1 ? ` · 第 ${page.number} 页` : ''}</h1><p class="article-subtitle">共 ${page.count} 篇手记 · 按日期由新到旧</p><p class="page-range">显示第 ${page.offset+1}–${page.offset+page.posts.length} 篇</p></header><ol class="archive-list" start="${page.offset+1}">${page.posts.map(post=>`<li><time datetime="${escape(post.date)}">${escape(post.date.replaceAll('-','.'))}</time><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('')}</ol>${navigation}<p><a href="/archive/#month-${escape(page.month)}">返回总归档中的本月</a> · <a href="/archive/">全部归档</a></p></div>`;
}
