import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups,isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 9 briefing preserves original sources, time window and explicit shortfalls',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-09');
 assert.equal(p.title,'2026-11-09｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[2,4,1,2,4]);
 assert.equal(Date.parse(p.newsWindow.end)-Date.parse(p.newsWindow.start),86400000);
 assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 for(const s of p.sections){
  assert.match(s.paragraphs.join(''),/缺\d条/);
  const groups=sectionSourceGroups(s,true);
  assert.equal(groups.remaining.length,0);
  for(const item of groups.groups.filter(i=>/^\d+\. /.test(i.text))){assert.ok(item.sources.length>0);assert.ok(item.sources.every(s=>isReviewedSource(s.url)));}
 }
 assert.match(p.sections[2].paragraphs.join(''),/特别交易收盘/);
 assert.match(p.sections[3].paragraphs.join(''),/仅核得官方检索摘要/);
 assert.match(p.sections[1].paragraphs.join(''),/不能写成泄密已证实/);
 assert.match(p.sections[4].paragraphs.join(''),/会谈尚未发生/);
});
