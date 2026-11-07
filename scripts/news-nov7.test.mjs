import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups, isReviewedSource} from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('November 7 briefing preserves the five columns and exact 24-hour window with inline citations',()=>{
 const post=posts.find(p=>p.slug==='news-2026-11-07');
 assert.equal(post.title,'2026-11-07｜24 小时新闻简报');
 assert.deepEqual(post.sections.map(s=>s.heading),['AI','商业','股票市场','中国政治与政策','国际政治与重大事件']);
 assert.deepEqual(post.sections.map(s=>s.paragraphs.filter(p=>/^\d+\. /.test(p)).length),[5,5,5,5,5]);
 assert.equal(Date.parse(post.newsWindow.end)-Date.parse(post.newsWindow.start),86400000);
 assert.equal(post.newsWindow.end,'2026-11-07T03:01:47Z');
 assert.ok(Date.parse(post.publishedAt)>=Date.parse(post.newsWindow.end));
 for(const section of post.sections){
  const grouped=sectionSourceGroups(section,true);
  assert.equal(grouped.remaining.length,0);
  for(const item of grouped.groups.filter(item=>/^\d+\. /.test(item.text))){
   assert.ok(item.sources.length>0);
   assert.ok(item.sources.every(s=>isReviewedSource(s.url)));
  }
 }
 const policy=post.sections[3].paragraphs.join('');
 assert.match(policy,/自公布之日起施行/);
 assert.match(policy,/2027年1月1日起施行/);
 assert.match(post.sections[4].paragraphs.join(''),/暂时关闭/);
 assert.match(post.sections[4].paragraphs.join(''),/理事会立场/);
});
