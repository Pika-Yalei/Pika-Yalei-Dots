import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns } from './news-window.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
test('October 22 is one original 24-hour brief with five independent sourced items per column',()=>{
 const today=posts.filter(p=>p.date==='2026-10-22');assert.equal(today.length,1);
 const p=today[0];validatePosts([p]);assert.equal(p.slug,'news-2026-10-22');assert.equal(p.publicationKind,'original');
 assert.deepEqual(p.newsWindow,{start:'2026-10-21T02:22:00Z',end:'2026-10-22T02:22:00Z'});
 assert.deepEqual(p.sections.slice(1).map(s=>s.heading.split('｜')[0]),newsColumns);
 for(const s of p.sections.slice(1)) {assert.equal(s.paragraphs.length,5); for(let i=1;i<=5;i++){assert.ok(s.paragraphs[i-1].startsWith(`${i}. `));assert.ok(s.sources.some(x=>x.label.startsWith(`${i}. `)));assert.match(s.paragraphs[i-1],/分析：/);}}
 const text=p.sections.flatMap(s=>s.paragraphs).join('\n');
 assert.match(text,/实际发布时间/);assert.match(text,/不是当前活跃广告主/);assert.match(text,/不把发稿时刻当会谈时刻/);assert.match(text,/没有证据证明已达成停火协议/);assert.match(text,/日期参数异常/);
});
