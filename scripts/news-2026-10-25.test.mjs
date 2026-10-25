import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns } from './news-window.mjs';
import { sectionSourceGroups } from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
const post=posts.find(p=>p.slug==='news-2026-10-25');
test('October 25 reports actual coverage without padding the AI shortfall',()=>{
 validatePosts([post]);assert.equal(posts.filter(p=>p.date==='2026-10-25').length,1);
 assert.equal(post.title,'2026-10-25｜24 小时新闻简报');
 assert.deepEqual(post.sections.map(s=>s.heading),newsColumns);
 assert.equal(Date.parse(post.newsWindow.end)-Date.parse(post.newsWindow.start),86400000);
 assert.ok(Date.parse(post.publishedAt)>=Date.parse(post.newsWindow.end));
 assert.deepEqual(post.sections.map(s=>s.paragraphs.filter(p=>/^\d+\. /.test(p)).length),[2,5,5,5,5]);
 assert.match(post.summary,/22条/);assert.match(post.sections[0].paragraphs[0],/缺3条/);
 for(const section of post.sections){
  const grouped=sectionSourceGroups(section,true);assert.equal(grouped.remaining.length,0);
  for(const group of grouped.groups.filter(g=>g.sources.length)){assert.ok(group.sources.length>0);}
  for(const p of section.paragraphs.filter(p=>/^\d+\. /.test(p)))assert.match(p,/分析：/);
 }
});
test('October 25 keeps per-item sources and concrete limitations visible',()=>{
 const html=readFileSync(new URL('../dist/notes/news-2026-10-25/index.html',import.meta.url),'utf8');
 assert.equal((html.match(/class="news-item"/g)||[]).length,22);
 assert.equal((html.match(/class="article-sources"/g)||[]).length,22);
 assert.doesNotMatch(html,/source-mapping-note|回顾范围与核验口径/);
 const text=post.sections.flatMap(s=>s.paragraphs).join('\n');
 for(const limitation of ['本窗口之前的背景','不是常规交易时段行情','未达到统计显著','不等于全面正式开售','不能写成已实施的新规','交易所原PDF本次未能读取'])assert.ok(text.includes(limitation));
});
