import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
test('October 30 brief contains five independently numbered inline-sourced items per fixed topic',()=>{
 const p=posts.find(p=>p.slug==='news-2026-10-30');
 assert.equal(p.title,'2026-10-30｜24 小时新闻简报');
 assert.deepEqual(p.newsWindow,{start:'2026-10-29T02:15:00Z',end:'2026-10-30T02:15:00Z'});
 assert.deepEqual(p.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 for(const s of p.sections){assert.equal(s.paragraphs.length,5);for(let i=1;i<=5;i++){assert.ok(s.paragraphs[i-1].startsWith(`${i}. `));assert.ok(s.sources.some(x=>x.label.startsWith(`${i}. `)));}}
 assert.equal(p.sections.reduce((n,s)=>n+s.sources.length,0),34);
});
