import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newsColumns } from './news-window.mjs';
import { sectionSourceGroups } from './article-content.mjs';
import { validatePosts } from './validate-posts.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
const post=posts.find(p=>p.slug==='news-2026-10-26');
test('October 26 has one original 24-hour briefing and five independently sourced items per column',()=>{
 validatePosts([post]);assert.equal(posts.filter(p=>p.date==='2026-10-26').length,1);
 assert.equal(post.title,'2026-10-26｜24 小时新闻简报');
 assert.deepEqual(post.sections.map(s=>s.heading),newsColumns);
 assert.equal(Date.parse(post.newsWindow.end)-Date.parse(post.newsWindow.start),86400000);
 assert.ok(Date.parse(post.publishedAt)>=Date.parse(post.newsWindow.end));
 for(const section of post.sections){
  assert.equal(section.paragraphs.filter(p=>/^\d+\. /.test(p)).length,5);
  const mapped=sectionSourceGroups(section,true);assert.equal(mapped.remaining.length,0);
  for(const group of mapped.groups.filter(g=>/^\d+\. /.test(g.text))){assert.ok(group.sources.length>0);assert.match(group.text,/分析：/);}
 }
});
test('October 26 renders sources beneath all items and retains concrete factual limits',()=>{
 const html=readFileSync(new URL('../dist/notes/news-2026-10-26/index.html',import.meta.url),'utf8');
 assert.equal((html.match(/class="news-item"/g)||[]).length,25);
 assert.equal((html.match(/class="article-sources"/g)||[]).length,25);
 assert.doesNotMatch(html,/source-mapping-note|回顾范围与核验口径/);
 const text=post.sections.flatMap(s=>s.paragraphs).join('\n');
 for(const term of ['原行为时间未公开','尚未宣布正式协议','未经审计','不代表全部均在本窗口内完成','不冒充最终认证','出口民调','不是今日首次宣布'])assert.ok(text.includes(term),term);
});
