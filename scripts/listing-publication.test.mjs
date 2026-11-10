import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderListingPublication } from './listing-publication.mjs';
import { paginatePosts } from './pagination.mjs';
test('listing publication distinguishes recorded original and backfill instants in Beijing time', () => {
  const original = {date:'2026-11-09',publishedAt:'2026-11-09T16:01:02Z',publicationKind:'original'};
  const before = structuredClone(original);
  assert.equal(renderListingPublication(original), '<p class="entry-publication">发布时间：<time datetime="2026-11-09T16:01:02Z">2026-11-10 00:01:02</time>（北京时间）</p>');
  assert.match(renderListingPublication({...original,publicationKind:'backfill'}), /补发时间：/);
  assert.deepEqual(original,before);
  assert.equal(renderListingPublication({date:'2026-11-09'}),'');
  for (const publishedAt of ['invalid','2026-02-30T00:00:00Z','2026-11-09T00:00:00Z" onclick="x','2026-11-09']) {
    assert.throws(() => renderListingPublication({publishedAt}), /Invalid listing publication timestamp/);
  }
});
test('every home and continuation card has exactly its own recorded publication without altering order', () => {
  const posts = JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url))).sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug));
  for (const page of paginatePosts(posts)) {
    const html = readFileSync(new URL(`../dist${page.path}index.html`,import.meta.url),'utf8');
    const entries = [...html.matchAll(/<article class="entry">([\s\S]*?)<\/article>/g)].map(match=>match[1]);
    assert.equal(entries.length,page.posts.length);
    entries.forEach((entry,index)=>{
      const post=page.posts[index];
      assert.ok(entry.includes(`href="/notes/${post.slug}/"`));
      assert.equal((entry.match(/class="entry-publication"/g)??[]).length, post.publishedAt ? 1 : 0);
      if (post.publishedAt) assert.ok(entry.includes(renderListingPublication(post)));
    });
  }
});
