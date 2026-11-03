import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {sectionSourceGroups} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 3 preserves five full columns and item-local sources',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-03');assert.ok(p);assert.equal(p.title,'2026-11-03｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,5,5,5,5]);
 for(const s of p.sections){const groups=sectionSourceGroups(s,true);assert.equal(groups.remaining.length,0);for(const g of groups.groups.filter(g=>/^\d+\. /.test(g.text)))assert.ok(g.sources.length);}
 assert.deepEqual(p.newsWindow,{start:'2026-11-02T02:08:32Z',end:'2026-11-03T02:08:32Z'});assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
});
