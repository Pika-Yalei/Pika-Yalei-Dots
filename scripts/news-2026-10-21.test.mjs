import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns } from './news-window.mjs';
const posts=JSON.parse(await readFile(new URL('../content/posts.json',import.meta.url),'utf8'));
test('October 21 is one sourced five-column briefing with at least five sourced items in every column',()=>{
 const today=posts.filter(post=>post.date==='2026-10-21');
 assert.equal(today.length,1);const post=today[0];validatePosts([post]);
 assert.equal(post.slug,'news-2026-10-21');assert.equal(post.publicationKind,'original');
 assert.deepEqual(post.newsWindow,{start:'2026-10-20T03:00:00Z',end:'2026-10-21T03:00:00Z'});
 assert.deepEqual(post.sections.slice(1).map(s=>s.heading.split('｜')[0]),newsColumns);
 for(const section of post.sections.slice(1)) {
  const items=section.paragraphs.filter(p=>/^\d+\. /.test(p));
  assert.ok(items.length>=5);
  for(let n=1;n<=items.length;n++) assert.ok(section.sources.some(s=>s.label.startsWith(`${n}. `)));
 }
 assert.equal(post.publishedAt,'2026-10-21T03:11:20Z');
 assert.match(post.sections[0].paragraphs.join(''),/补充/);
 const text=post.sections.flatMap(s=>s.paragraphs).join('\n');
 assert.match(text,/2027年第一季度/);assert.match(text,/指数点位而非美元/);
 assert.match(text,/不是双方已达成新贸易协议/);
});
