import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 1 briefing preserves the five columns, exact window and honest market shortfall',()=>{
 const p=posts.find(p=>p.slug==='news-2026-11-01');assert.equal(p.title,'2026-11-01｜24 小时新闻简报');assert.deepEqual(p.newsWindow,{start:'2026-10-31T02:20:34Z',end:'2026-11-01T02:20:34Z'});
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(p.sections.map(s=>s.paragraphs.filter(x=>/^\d+\. /.test(x)).length),[5,5,3,5,5]);
 for(const s of p.sections)for(const para of s.paragraphs.filter(x=>/^\d+\. /.test(x)))assert.ok(s.sources.some(x=>x.label.startsWith(para.split('.')[0]+'. ')));
 assert.match(p.sections[2].paragraphs[0],/缺2条/);assert.match(p.closing,/23条/);
});
