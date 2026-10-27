import { renderPageWindow } from './page-window.mjs';
// Page 1 has one canonical address: /, never /page/1/.
export const pageSize = 6;
export const pageCount = posts => Math.max(1, Math.ceil(posts.length / pageSize));
export const pagePath = page => page === 1 ? '/' : `/page/${page}/`;

// The caller supplies posts in their established date/slug order.
export function paginatePosts(posts) {
  const total = pageCount(posts);
  return Array.from({length: total}, (_, index) => ({
    number: index + 1,
    total,
    path: pagePath(index + 1),
    offset: index * pageSize,
    posts: posts.slice(index * pageSize, (index + 1) * pageSize)
  }));
}

export function renderPagination({number, total}) {
  if (total === 1) return '';
  return `<nav class="pagination" aria-label="手记分页">${number > 1 ? `<a href="${pagePath(number - 1)}" rel="prev">← 上一页<span class="sr-only">：第 ${number - 1} 页</span></a>` : ''}${renderPageWindow(number,total,pagePath)}${number < total ? `<a href="${pagePath(number + 1)}" rel="next">下一页<span class="sr-only">：第 ${number + 1} 页</span> →</a>` : ''}<a href="/archive/">查看全部归档</a></nav>`;
}
