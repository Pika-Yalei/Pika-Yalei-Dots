import { renderPageWindow } from './page-window.mjs';
import { websitePath } from './source-website-path.mjs';
export { websitePath } from './source-website-path.mjs';
import { collectSources, sourceAnchor } from './source-index.mjs';
const escape = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function websitePages(posts) {
 const groups=new Map();
 for(const source of collectSources(posts)) {
  const host=new URL(source.url).hostname;
  if(!groups.has(host))groups.set(host,[]);
  groups.get(host).push(source);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([host,sources],hostIndex)=>{
  const total=Math.ceil(sources.length/30), base=websitePath(host);
  return Array.from({length:total},(_,i)=>({host,base,directoryHref:`${websiteDirectoryPath(Math.floor(hostIndex/websiteDirectoryPageSize)+1)}#${websiteDirectoryAnchor(host)}`,number:i+1,total,count:sources.length,offset:i*30,path:i?`${base}page/${i+1}/`:base,sources:sources.slice(i*30,(i+1)*30)}));
 });
}
export const websiteDirectoryPageSize = 30;
export const websiteDirectoryAnchor = host => `website-${websitePath(host).split('/')[3]}`;
export function websiteDirectoryPath(number) {
 if (!Number.isSafeInteger(number) || number < 1) throw new RangeError('Invalid website directory page number');
 return number === 1 ? '/sources/websites/' : `/sources/websites/page/${number}/`;
}
export function paginateWebsiteDirectory(pages) {
 const websites = pages.filter(page => page.number === 1).sort((a,b) => a.host.localeCompare(b.host));
 const total = Math.max(1, Math.ceil(websites.length / websiteDirectoryPageSize));
 return Array.from({length:total}, (_,index) => ({
  number:index+1, total, count:websites.length, offset:index*websiteDirectoryPageSize,
  path:websiteDirectoryPath(index+1),
  websites:websites.slice(index*websiteDirectoryPageSize,(index+1)*websiteDirectoryPageSize)
 }));
}
export function renderWebsiteDirectory(page) {
 const navigation = page.total > 1 ? `<nav class="pagination" aria-label="来源网站目录分页">${page.number > 1 ? `<a href="${websiteDirectoryPath(page.number-1)}" rel="prev">← 上一页</a>` : ''}${renderPageWindow(page.number,page.total,websiteDirectoryPath)}${page.number < page.total ? `<a href="${websiteDirectoryPath(page.number+1)}" rel="next">下一页 →</a>` : ''}</nav>` : '';
 return `<div class="article-shell"><header class="article-header"><h1>按来源网站浏览${page.number > 1 ? ` · 第 ${page.number} 页` : ''}</h1><p class="article-subtitle">只列出手记实际引用的材料，不代表对网站全部内容的背书。</p><p class="page-range">共 ${page.count} 个网站 · 显示第 ${page.count ? page.offset+1 : 0}–${page.offset+page.websites.length} 个</p></header><ul class="category-list">${page.websites.map(p=>`<li id="${websiteDirectoryAnchor(p.host)}" tabindex="-1"><a href="${escape(p.path)}"><span>${escape(p.host)}</span><span class="category-count">${p.count} 个来源</span></a></li>`).join('')}</ul>${page.count?'':'<p>尚无引用来源。</p>'}${navigation}<p><a href="/sources/">返回全部来源</a></p></div>`;
}
export function renderWebsitePage(page) {
 const href=n=>n===1?page.base:`${page.base}page/${n}/`;
 const navigation=page.total>1?`<nav class="pagination" aria-label="网站来源分页">${page.number>1?`<a href="${href(page.number-1)}" rel="prev">← 上一页</a>`:''}${renderPageWindow(page.number,page.total,href)}${page.number<page.total?`<a href="${href(page.number+1)}" rel="next">下一页 →</a>`:''}</nav>`:'';
 return `<div class="article-shell"><header class="article-header"><h1>${escape(page.host)} 的引用材料${page.number>1?` · 第 ${page.number} 页`:''}</h1><p class="article-subtitle">共 ${page.count} 个来源 · 显示第 ${page.offset+1}–${page.offset+page.sources.length} 个</p></header><div class="prose"><ol start="${page.offset+1}">${page.sources.map(source=>`<li class="source-entry" id="${sourceAnchor(source.url)}" tabindex="-1"><p><a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a></p><ul>${source.references.map(ref=>`<li><a href="${escape(ref.href)}">${escape(ref.title)} · ${escape(ref.heading)}</a></li>`).join('')}</ul></li>`).join('')}</ol></div>${navigation}<p><a href="${escape(page.directoryHref ?? '/sources/websites/')}">返回来源网站目录中的本站</a> · <a href="/sources/">全部来源</a></p></div>`;
}
