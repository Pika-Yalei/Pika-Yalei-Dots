import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newsColumns } from './news-window.mjs';
import { sectionSourceGroups } from './article-content.mjs';
import { validatePosts } from './validate-posts.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
const post=posts.find(p=>p.slug==='news-2026-10-28');
test('October 28 has exactly five independent sourced developments in each column',()=>{
 validatePosts([post]);
 assert.equal(posts.filter(p=>p.date==='2026-10-28').length,1);
 assert.equal(post.title,'2026-10-28｜24 小时新闻简报');
 assert.deepEqual(post.newsWindow,{start:'2026-10-27T02:30:00Z',end:'2026-10-28T02:30:00Z'});
 assert.ok(Date.parse(post.publishedAt)>=Date.parse(post.newsWindow.end));
 assert.deepEqual(post.sections.map(s=>s.heading),newsColumns);
 for(const section of post.sections){
  assert.equal(section.paragraphs.length,5);
  assert.deepEqual(section.paragraphs.map(p=>p.match(/^\d+\. /)?.[0]),['1. ','2. ','3. ','4. ','5. ']);
  const mapped=sectionSourceGroups(section,true);assert.equal(mapped.remaining.length,0);
  for(const group of mapped.groups){assert.ok(group.sources.length>0);assert.match(group.text,/分析：/);}
 }
});
test('October 28 renders all item sources and distinguishes evidence from outcomes',()=>{
 const html=readFileSync(new URL('../dist/notes/news-2026-10-28/index.html',import.meta.url),'utf8');
 assert.equal((html.match(/class="news-item"/g)||[]).length,25);
 assert.equal((html.match(/class="article-sources"/g)||[]).length,25);
 assert.doesNotMatch(html,/source-mapping-note|回顾范围与核验口径/);
 const text=post.sections.flatMap(s=>s.paragraphs).join('\n');
 for(const term of ['临床前','预览','不是官方计票结果','不是已经成行','并非27日集中发生','人民币','港元','美元','日元','收盘']) assert.ok(text.includes(term),term);
 assert.match(post.sections[2].paragraphs[0],/28日04:00/);
 assert.match(post.sections[3].paragraphs[0],/决定作于24日/);
});
