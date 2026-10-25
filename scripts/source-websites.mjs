import { createHash } from 'node:crypto';
import { collectSources, sourceAnchor } from './source-index.mjs';
const escape = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const websitePath = host => `/sources/websites/${createHash('sha256').update(host).digest('hex').slice(0,24)}/`;
export function websitePages(posts) {
 const groups=new Map();
 for(const source of collectSources(posts)) {
  const host=new URL(source.url).hostname;
  if(!groups.has(host))groups.set(host,[]);
  groups.get(host).push(source);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([host,sources])=>{
  const total=Math.ceil(sources.length/30), base=websitePath(host);
  return Array.from({length:total},(_,i)=>({host,base,number:i+1,total,count:sources.length,offset:i*30,path:i?`${base}page/${i+1}/`:base,sources:sources.slice(i*30,(i+1)*30)}));
 });
}
export function renderWebsiteDirectory(pages) {
 return `<div class="article-shell"><header class="article-header"><h1>按来源网站浏览</h1><p class="article-subtitle">只列出手记实际引用的材料，不代表对网站全部内容的背书。</p></header><ul class="category-list">${pages.filter(p=>p.number===1).map(p=>`<li><a href="${p.path}"><span>${escape(p.host)}</span><span class="category-count">${p.count} 个来源</span></a></li>`).join('')}</ul>${pages.length?'':'<p>尚无引用来源。</p>'}<p><a href="/sources/">返回全部来源</a></p></div>`;
}
export function renderWebsitePage(page) {
 const href=n=>n===1?page.base:`${page.base}page/${n}/`;
 const navigation=page.total>1?`<nav class="pagination" aria-label="网站来源分页">${page.number>1?`<a href="${href(page.number-1)}" rel="prev">← 上一页</a>`:''}<span aria-current="page">第 ${page.number} / ${page.total} 页</span>${page.number<page.total?`<a href="${href(page.number+1)}" rel="next">下一页 →</a>`:''}</nav>`:'';
 return `<div class="article-shell"><header class="article-header"><h1>${escape(page.host)} 的引用材料${page.number>1?` · 第 ${page.number} 页`:''}</h1><p class="article-subtitle">共 ${page.count} 个来源 · 显示第 ${page.offset+1}–${page.offset+page.sources.length} 个</p></header><div class="prose"><ol start="${page.offset+1}">${page.sources.map(source=>`<li class="source-entry" id="${sourceAnchor(source.url)}" tabindex="-1"><p><a href="${escape(source.url)}" rel="noreferrer">${escape(source.label)}</a></p><ul>${source.references.map(ref=>`<li><a href="${escape(ref.href)}">${escape(ref.title)} · ${escape(ref.heading)}</a></li>`).join('')}</ul></li>`).join('')}</ol></div>${navigation}<p><a href="/sources/websites/">返回来源网站目录</a> · <a href="/sources/">全部来源</a></p></div>`;
}
