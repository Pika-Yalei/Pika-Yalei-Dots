import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {sectionSourceGroups} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 2 preserves five columns, explicit shortages and item-local sources',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-02');assert.ok(p);assert.equal(p.title,'2026-11-02｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,4,5,1,5]);
 assert.match(p.sections[1].paragraphs.join(''),/缺 1 条/);assert.match(p.sections[3].paragraphs.join(''),/缺 4 条/);
 for(const s of p.sections){const groups=sectionSourceGroups(s,true);assert.equal(groups.remaining.length,0);for(const g of groups.groups.filter(g=>/^\d+\. /.test(g.text)))assert.ok(g.sources.length);}
 assert.deepEqual(p.newsWindow,{start:'2026-11-01T02:15:06Z',end:'2026-11-02T02:15:06Z'});assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
});
