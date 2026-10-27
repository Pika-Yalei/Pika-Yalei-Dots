// Bound navigation independently of archive size while retaining both endpoints.
export function pageWindow(number, total) {
  if (!Number.isInteger(number) || !Number.isInteger(total) || total < 1 || number < 1 || number > total) throw new RangeError('Invalid page position');
  const pages = [...new Set([1, total, number - 1, number, number + 1].filter(page => page >= 1 && page <= total))].sort((a,b) => a-b);
  return pages.flatMap((page,index) => index && page - pages[index-1] > 1 ? [null,page] : [page]);
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderPageWindow(number, total, href) {
  return pageWindow(number,total).map(page => page === null ? '<span aria-hidden="true">…</span>' : page === number ? `<span aria-current="page" aria-label="第 ${page} 页，当前页">第 ${page} / ${total} 页</span>` : `<a href="${escape(href(page))}" aria-label="第 ${page} 页${page === 1 ? '，首页' : page === total ? '，末页' : ''}">${page}</a>`).join('');
}
