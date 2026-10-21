import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns } from './news-window.mjs';
const posts=JSON.parse(await readFile(new URL('../content/posts.json',import.meta.url),'utf8'));
test('October 21 is one sourced five-column briefing with an explicit evidence gap',()=>{
 const today=posts.filter(post=>post.date==='2026-10-21');
 assert.equal(today.length,1);const post=today[0];validatePosts([post]);
 assert.equal(post.slug,'news-2026-10-21');assert.equal(post.publicationKind,'original');
 assert.deepEqual(post.newsWindow,{start:'2026-10-20T03:00:00Z',end:'2026-10-21T03:00:00Z'});
 assert.deepEqual(post.sections.slice(1).map(s=>s.heading.split('｜')[0]),newsColumns);
 for(const section of post.sections.slice(1,5)) assert.ok(section.sources.length>0);
 assert.match(post.sections[5].paragraphs.join(''),/证据|核验/);
 const text=post.sections.flatMap(s=>s.paragraphs).join('\n');
 assert.match(text,/2027年第一季度/);assert.match(text,/指数点位，不是美元价格/);
 assert.match(text,/不是中欧双方已经达成/);
});
