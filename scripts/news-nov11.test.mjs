import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups,isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 11 briefing has 25 independent items with immediate numbered citations',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-11');
 assert.equal(p.title,'2026-11-11｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,5,5,5,5]);
 assert.deepEqual(p.newsWindow,{start:'2026-11-10T02:30:41Z',end:'2026-11-11T02:30:41Z'});
 assert.equal(Date.parse(p.newsWindow.end)-Date.parse(p.newsWindow.start),86400000);
 assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 for(const s of p.sections){
  const groups=sectionSourceGroups(s,true);assert.equal(groups.remaining.length,0);
  for(const item of groups.groups.filter(i=>/^\d+\. /.test(i.text))){assert.ok(item.sources.length>0);assert.ok(item.sources.every(s=>isReviewedSource(s.url)));}
 }
 assert.match(p.sections[0].paragraphs[0],/限时介绍价/);
 assert.match(p.sections[1].paragraphs[0],/批准额度不等于已交割金额/);
 assert.match(p.sections[2].paragraphs[4],/北京时间11月11日05:00收盘/);
 assert.match(p.sections[3].paragraphs[3],/门诊、住院次均药品费用增幅/);
 assert.match(p.sections[4].paragraphs[3],/程序性表决/);
 assert.match(p.sections[4].paragraphs[4],/模型情景估算/);
 const html=readFileSync(new URL('../dist/notes/news-2026-11-11/index.html',import.meta.url),'utf8');
 assert.equal((html.match(/class="news-item"/g)||[]).length,25);
 assert.doesNotMatch(html,/回顾范围与核验口径|来源汇总/);
});
