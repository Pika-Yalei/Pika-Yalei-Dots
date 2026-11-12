import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups,isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 12 briefing has 25 independently sourced current-window items',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-12');
 assert.equal(p.title,'2026-11-12｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,5,5,5,5]);
 assert.equal(Date.parse(p.newsWindow.end)-Date.parse(p.newsWindow.start),86400000);
 assert.ok(p.newsWindow.end.startsWith('2026-11-12T02:'));
 assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 for(const s of p.sections){
  const groups=sectionSourceGroups(s,true); assert.equal(groups.remaining.length,0);
  assert.equal(groups.groups.length,5);
  for(const item of groups.groups){assert.ok(item.sources.length>0);assert.ok(item.sources.every(s=>isReviewedSource(s.url)));}
 }
 assert.match(p.sections[0].paragraphs[2],/美国18岁以上/);
 assert.match(p.sections[1].paragraphs[4],/预期年化目标/);
 assert.match(p.sections[2].paragraphs[4],/北京时间11月12日05:00/);
 assert.match(p.sections[3].paragraphs[1],/不超过20亿美元/);
 assert.match(p.sections[4].paragraphs[0],/原则同意/);
 assert.match(p.sections[4].paragraphs[1],/并非法定结果认证/);
 const html=readFileSync(new URL('../dist/notes/news-2026-11-12/index.html',import.meta.url),'utf8');
 assert.equal((html.match(/class="news-item"/g)||[]).length,25);
 assert.doesNotMatch(html,/回顾范围与核验口径|来源汇总/);
});
