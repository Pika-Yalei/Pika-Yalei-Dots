import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectSources, paginateSources, renderSourcePage, renderSourceReference } from './source-index.mjs';
import { websitePages, renderWebsitePage } from './source-websites.mjs';
import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';
const url='https://github.com/simonw/llm/pull/1771';
const makePost=(paragraphs,labels,extra={})=>({slug:'example',date:'2026-10-30',title:'文章 <标题>',category:'新闻回顾',sections:[{heading:'AI & 旧栏目',paragraphs,sources:labels.map(label=>({label,url}))}],...extra});

test('same URL across news items, supplemental section and articles preserves distinct exact contexts',()=>{
 const post=makePost(['1. 第一条 <真实标题>。事实。','延续事实与分析。','2. 第二条。事实。'],['1. 第一来源','1. 同URL重复','2. 第二来源','未明确对应的资料']);
 const before=structuredClone(post),section=sectionAnchors(post.sections)[0],anchors=newsItemAnchors(section);
 const [source]=collectSources([post,{...post,slug:'older',date:'2026-10-29'}]);
 assert.equal(source.references.length,6);
 assert.deepEqual(source.references.slice(0,3).map(ref=>[ref.href,ref.itemTitle,ref.scope]),[
  [`/notes/example/#${anchors[0]}`,'第一条 <真实标题>','news-item'],
  [`/notes/example/#${anchors[2]}`,'第二条','news-item'],
  [`/notes/example/#${section.id}`,'','section']
 ]);
 assert.ok(source.references.every(ref=>ref.title===post.title&&ref.heading===section.heading));
 assert.deepEqual(post,before);
 for(const html of [renderSourcePage(paginateSources([source])[0]),renderWebsitePage(websitePages([post])[0])]){
  assert.match(html,/新闻条目：第一条 &lt;真实标题&gt;/);
  assert.match(html,/整节参考（未明确对应单条新闻）/);
  assert.doesNotMatch(html,/<真实标题>|<标题>/);
  for(const ref of source.references.slice(0,3)) assert.ok(html.includes(renderSourceReference(ref)));
 }
});

test('unique full-title historical mappings follow continuation but ambiguous numbers/titles remain sectional',()=>{
 const exact=makePost(['1. 历史完整标题。事实。','分析延续。'],['历史完整标题：原始来源']);
 assert.equal(collectSources([exact])[0].references[0].itemTitle,'历史完整标题');
 for(const post of [
  makePost(['1. 重复编号甲。','1. 重复编号乙。','延续。'],['1. 来源']),
  makePost(['1. 同名标题。甲。','2. 同名标题。乙。'],['同名标题：来源']),
  makePost(['1. 完整标题。'],['完整：不够精确','9. 不存在的编号']),
  makePost(['没有编号的历史正文。'],['历史正文：来源']),
  makePost(['1. 非新闻条目。'],['1. 来源'],{category:'技术复盘'})
 ]){
  const refs=collectSources([post])[0].references;
  assert.equal(refs.length,1);
  assert.equal(refs[0].scope,'section');assert.equal(refs[0].itemTitle,'');
  assert.ok(refs[0].href.endsWith(`#${sectionAnchors(post.sections)[0].id}`));
 }
});

test('shared reference renderer escapes titles, headings and href attributes',()=>{
 const html=renderSourceReference({title:'<script>',heading:'"&',href:'/notes/x/?q="<',itemTitle:'<img onerror="bad">',scope:'news-item'});
 assert.doesNotMatch(html,/<script>|<img|href="[^\"]*"</);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img onerror=&quot;bad&quot;&gt;/);
 assert.match(html,/href="\/notes\/x\/\?q=&quot;&lt;"/);
});

test('actual built source index and per-website pages include identical mapping descriptions',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
 const read=path=>readFileSync(new URL(`../dist${path}index.html`,import.meta.url),'utf8');
 let itemCount=0,sectionCount=0;
 for(const page of paginateSources(collectSources(posts))){
  const html=read(page.path);
  for(const source of page.sources) for(const ref of source.references){
   assert.ok(html.includes(renderSourceReference(ref)));
   if(ref.scope==='news-item')itemCount++;else sectionCount++;
  }
 }
 for(const page of websitePages(posts)){
  const html=read(page.path);
  for(const source of page.sources) for(const ref of source.references) assert.ok(html.includes(renderSourceReference(ref)));
 }
 assert.ok(itemCount>0);assert.ok(sectionCount>0);
});
