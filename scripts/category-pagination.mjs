import { renderPageWindow } from './page-window.mjs';
import { renderCategory } from './categories.mjs';
export const categoryPageSize = 6;
export function paginateCategories(categories) {
  return categories.flatMap(category => {
    const total = Math.max(1, Math.ceil(category.posts.length / categoryPageSize));
    return Array.from({length: total}, (_, index) => ({
      ...category, number: index + 1, total, count: category.posts.length,
      offset: index * categoryPageSize, categoryPath: category.path,
      path: index ? `${category.path}page/${index + 1}/` : category.path,
      posts: category.posts.slice(index * categoryPageSize, (index + 1) * categoryPageSize)
    }));
  });
}
export function renderCategoryPage(page) {
  const href = number => number === 1 ? page.categoryPath : `${page.categoryPath}page/${number}/`;
  const navigation = page.total > 1 ? `<nav class="pagination" aria-label="分类分页">${page.number > 1 ? `<a href="${href(page.number - 1)}" rel="prev">← 上一页</a>` : ''}${renderPageWindow(page.number,page.total,href)}${page.number < page.total ? `<a href="${href(page.number + 1)}" rel="next">下一页 →</a>` : ''}<a href="/archive/">查看全部归档</a></nav>` : '';
  return renderCategory({...page, path: page.categoryPath})
    .replace('</h1>', `${page.number > 1 ? ` · 第 ${page.number} 页` : ''}</h1>`)
    .replace(`共 ${page.posts.length} 篇手记`, `共 ${page.count} 篇手记`)
    .replace('<ol class="archive-list">', `<p class="page-range">显示第 ${page.count ? page.offset + 1 : 0}–${page.offset + page.posts.length} 篇</p><ol class="archive-list" start="${page.offset + 1}">`)
    .replace('</ol></div>', `</ol>${navigation}</div>`);
}
