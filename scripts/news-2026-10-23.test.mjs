import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns } from './news-window.mjs';
import { sectionSourceGroups } from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
test('October 23 is one dated 24-hour brief with 25 separately sourced items',()=>{
 const today=posts.filter(p=>p.date==='2026-10-23');assert.equal(today.length,1);
 const post=today[0];validatePosts([post]);assert.equal(post.slug,'news-2026-10-23');
 assert.equal(post.title,'2026-10-23｜24 小时新闻简报');assert.equal(post.publicationKind,'original');
 assert.deepEqual(post.newsWindow,{start:'2026-10-22T02:05:00Z',end:'2026-10-23T02:05:00Z'});
 assert.deepEqual(post.sections.map(s=>s.heading),newsColumns);
 for(const section of post.sections){
  assert.equal(section.paragraphs.length,5);
  const grouped=sectionSourceGroups(section,true);assert.equal(grouped.remaining.length,0);
  for(let i=0;i<5;i++){
   assert.ok(section.paragraphs[i].startsWith(`${i+1}. `));
   assert.match(section.paragraphs[i],/分析：/);assert.ok(grouped.groups[i].sources.length>0);
  }
 }
 assert.equal(post.sections.flatMap(s=>s.sources).length,39);
});
test('publication keeps concrete status, precision and market limitations close to facts',()=>{
 const p=posts.find(p=>p.slug==='news-2026-10-23');
 const text=p.sections.flatMap(s=>s.paragraphs).join('\n');
 assert.doesNotMatch(text,/回顾范围与核验口径|编辑校核提醒|多数美国股票实际上上涨/);
 assert.match(text,/未披露具体时刻/);assert.match(text,/不具约束力/);assert.match(text,/并非修订准则已经最终实施/);
 assert.match(text,/12月1日起施行/);assert.match(text,/GAAP 与调整后利润并不相同/);
 for(const item of p.sections[2].paragraphs){assert.match(item,/10月22日/);assert.match(item,/收盘/);assert.match(item,/指数以点计/);}
 const html=readFileSync(new URL('../dist/notes/news-2026-10-23/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/source-mapping-note/);
 assert.equal((html.match(/class="news-item"/g)||[]).length,25);
 assert.equal((html.match(/class="article-sources"/g)||[]).length,25);
});
