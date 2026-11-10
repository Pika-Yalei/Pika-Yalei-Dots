import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups,isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 10 briefing retains five columns, 24 distinct items and immediate sources',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-10');
 assert.equal(p.title,'2026-11-10｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,5,5,4,5]);
 assert.deepEqual(p.newsWindow,{start:'2026-11-09T02:50:00Z',end:'2026-11-10T02:50:00Z'});
 assert.equal(Date.parse(p.newsWindow.end)-Date.parse(p.newsWindow.start),86400000);
 assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 for(const s of p.sections){
  const groups=sectionSourceGroups(s,true);
  assert.equal(groups.remaining.length,0);
  for(const item of groups.groups.filter(i=>/^\d+\. /.test(i.text))){assert.ok(item.sources.length>0);assert.ok(item.sources.every(s=>isReviewedSource(s.url)));}
 }
 assert.match(p.sections[3].paragraphs.join(''),/缺1条/);
 assert.match(p.sections[3].paragraphs.join(''),/尚未生效/);
 assert.match(p.sections[4].paragraphs.join(''),/并非全年最终定值/);
 assert.match(p.sections[2].paragraphs.join(''),/纽约当地16:00、北京时间11月10日05:00/);
 assert.match(p.sections[0].paragraphs.join(''),/不是给ChatGPT用户新增的开关/);
});
