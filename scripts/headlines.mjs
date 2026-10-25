import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';
import { collectTopics } from './topics.mjs';
const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const headlinePageSize=20;
export const headlinePath=number=>number===1?'/headlines/':`/headlines/page/${number}/`;
export function collectHeadlines(posts) {
 return [...posts].sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug)).flatMap(post=>{
  const topics=collectTopics([post]).flatMap(topic=>topic.entries);
  return sectionAnchors(post.sections).flatMap(section=>{
   if(!topics.some(entry=>entry.href===`/notes/${post.slug}/#${section.id}`))return [];
   const anchors=newsItemAnchors(section);
   return section.paragraphs.flatMap((text,index)=>anchors[index]?[{date:post.date,title:text.replace(/^\d+\.\s+/,'').split('。')[0],heading:section.heading,article:post.title,href:`/notes/${post.slug}/#${anchors[index]}`}]:[]);
  });
 });
}
export function headlinePages(posts) {
 const entries=collectHeadlines(posts),total=Math.max(1,Math.ceil(entries.length/headlinePageSize));
 return Array.from({length:total},(_,i)=>({number:i+1,total,count:entries.length,offset:i*headlinePageSize,path:headlinePath(i+1),entries:entries.slice(i*headlinePageSize,(i+1)*headlinePageSize)}));
}
export function renderHeadlines(page) {
 const nav=page.total>1?`<nav class="pagination" aria-label="新闻条目分页">${page.number>1?`<a href="${headlinePath(page.number-1)}" rel="prev">← 上一页</a>`:''}<span aria-current="page">第 ${page.number} / ${page.total} 页</span>${page.number<page.total?`<a href="${headlinePath(page.number+1)}" rel="next">下一页 →</a>`:''}</nav>`:'';
 return `<div class="article-shell"><header class="article-header"><h1>新闻条目索引${page.number>1?` · 第 ${page.number} 页`:''}</h1><p class="article-subtitle">按回顾日期浏览 ${page.count} 条已归档新闻，直接跳到原条目及其来源。同一事件的后续进展可能出现在不同日期，条目数不等于独立事件数。</p></header>${page.entries.length?`<p class="page-range">显示第 ${page.offset+1}–${page.offset+page.entries.length} 条</p><ol class="archive-list" start="${page.offset+1}">${page.entries.map(entry=>`<li><time datetime="${escape(entry.date)}">${escape(entry.date)}</time><div><a href="${escape(entry.href)}">${escape(entry.title)}</a><p class="headline-context">${escape(entry.heading)}<span class="sr-only"> · ${escape(entry.article)}</span></p></div></li>`).join('')}</ol>`:'<p>尚无可索引的新闻条目。</p>'}${nav}<p><a href="/topics/">按专题阅读</a> · <a href="/archive/">按日期浏览整篇简报</a></p></div>`;
}
