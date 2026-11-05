import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {sectionSourceGroups} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 5 briefing preserves five columns and twenty-five independently sourced items',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-05');assert.ok(p);assert.equal(p.title,'2026-11-05｜24 小时新闻简报');
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(t=>/^\d+\. /.test(t)).length),[5,5,5,5,5]);
 for(const s of p.sections){const groups=sectionSourceGroups(s,true);assert.equal(groups.remaining.length,0);for(const g of groups.groups.filter(g=>/^\d+\. /.test(g.text)))assert.ok(g.sources.length);}
 assert.deepEqual(p.newsWindow,{start:'2026-11-04T02:30:00Z',end:'2026-11-05T02:30:00Z'});assert.ok(Date.parse(p.publishedAt)>=Date.parse(p.newsWindow.end));
 assert.ok(p.sections[2].paragraphs.every(t=>t.includes('11月4日') && t.includes('收盘') && t.includes('币种')));
 assert.match(p.sections[4].paragraphs.join(''),/方案仍待总统、内阁与国会审批/);
 assert.equal(p.sections.reduce((n,s)=>n+s.sources.length,0),36);
});
