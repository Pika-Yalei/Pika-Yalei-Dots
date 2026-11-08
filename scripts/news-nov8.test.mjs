import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups,isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 8 briefing keeps verified weekend developments and explicit shortfalls',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-08');
 assert.equal(p.title,'2026-11-08｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[0,1,1,2,3]);
 assert.equal(Date.parse(p.newsWindow.end)-Date.parse(p.newsWindow.start),86400000);
 assert.equal(p.newsWindow.end,'2026-11-08T02:23:33Z');
 assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 for(const s of p.sections){
  assert.match(s.paragraphs.join(''),/缺\d条/);
  const groups=sectionSourceGroups(s,true);
  assert.equal(groups.remaining.length,0);
  for(const item of groups.groups.filter(i=>/^\d+\. /.test(i.text))){assert.ok(item.sources.length>0);assert.ok(item.sources.every(s=>isReviewedSource(s.url)));}
 }
 assert.match(p.sections[2].paragraphs.join(''),/周末/);
 assert.match(p.sections[4].paragraphs.join(''),/初步/);
 assert.match(p.sections[4].paragraphs.join(''),/07:05/);
 assert.doesNotMatch(p.sections[4].paragraphs.join(''),/卡塔尔/);
});
