import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginatePosts, pageCount, pagePath, renderPagination } from './pagination.mjs';
import { validateLinks } from './validate-links.mjs';
import { siteUrl } from './feed.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('pagination preserves order and input, handles boundaries, and keeps page one canonical', () => {
  for (const count of [0, 1, 6, 7, 12, 13]) {
    const posts = Array.from({length:count}, (_, i) => ({slug:`post-${i}`}));
    const before = structuredClone(posts);
    const pages = paginatePosts(posts);
    assert.equal(pages.length, Math.max(1, Math.ceil(count / 6)));
    assert.equal(pageCount(posts), pages.length);
    assert.deepEqual(pages.flatMap(page => page.posts), posts);
    assert.deepEqual(posts, before);
    pages.forEach((page, index) => {
      assert.equal(page.offset, index * 6);
      assert.equal(page.number, index + 1);
      assert.equal(page.total, pages.length);
      assert.equal(page.path, index ? `/page/${index + 1}/` : '/');
      assert.ok(page.posts.length <= 6);
      assert.notEqual(page.posts, posts);
    });
  }
  assert.equal(pagePath(1), '/');
});

test('pagination uses real boundary links, a current position, and bounded navigation', () => {
  assert.equal(renderPagination({number:1,total:1}), '');
  const first = renderPagination({number:1,total:3});
  assert.doesNotMatch(first, /rel="prev"|page\/1\//);
  assert.match(first, /href="\/page\/2\/" rel="next"/);
  const middle = renderPagination({number:2,total:3});
  assert.match(middle, /href="\/" rel="prev"/);
  assert.match(middle, /href="\/page\/3\/" rel="next"/);
  assert.match(middle, /aria-label="手记分页"/);
  assert.match(middle, /<span aria-current="page">第 2 \/ 3 页<\/span>/);
  const last = renderPagination({number:3,total:3});
  assert.doesNotMatch(last, /rel="next"/);
  assert.match(last, /href="\/page\/2\/" rel="prev"/);
  assert.match(last, /href="\/archive\/"/);
  assert.equal([...renderPagination({number:500,total:1000}).matchAll(/<a /g)].length, 3);
});

test('static builds cover overflow, sorting, metadata, full feeds/archive and stale-page cleanup', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-pagination-'));
  try {
    for (const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const [base] = JSON.parse(await readFile(path.join(root,'content/posts.json'),'utf8'));
    // Deliberately shuffled: sorting must happen before slicing, including tied dates.
    const fixtures = Array.from({length:13}, (_, index) => ({...base, slug:`fixture-${String(index).padStart(2,'0')}`, date:index < 8 ? '2026-10-19' : '2026-10-18'})).reverse();
    for (const count of [13, 12, 7, 6, 1, 0]) {
      const input = fixtures.slice(0,count);
      await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(input));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
      const dist = path.join(temp,'dist');
      const sorted = [...input].sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
      const seen = [];
      const sitemap = await readFile(path.join(dist,'sitemap.xml'),'utf8');
      assert.equal([...sitemap.matchAll(/<loc>[^<]+\/page\/\d+\/<\/loc>/g)].length, pageCount(input) - 1);
      assert.doesNotMatch(sitemap, /\/page\/1\//);
      for (const page of paginatePosts(sorted)) {
        const html = await readFile(path.join(dist,page.path,'index.html'),'utf8');
        const slugs = [...html.matchAll(/<h2><a href="\/notes\/([^/]+)\/"/g)].map(match => match[1]);
        assert.deepEqual(slugs, page.posts.map(post => post.slug));
        seen.push(...slugs);
        assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
        if (count) assert.ok(html.includes(`显示第 ${page.offset + 1}–${page.offset + page.posts.length} 篇，共 ${count} 篇`));
        assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}${page.path}">`));
        assert.ok(html.includes(`<meta property="og:url" content="${siteUrl}${page.path}">`));
        assert.ok(sitemap.includes(`<loc>${siteUrl}${page.path}</loc>`));
        assert.deepEqual([...html.matchAll(/class="entry-index">(\d+)</g)].map(match => Number(match[1])), page.posts.map((_,i) => count - page.offset - i));
        if (page.number > 1) {
          assert.match(html, new RegExp(`<title>手记 · 第 ${page.number} 页`));
          assert.match(html, new RegExp(`name="description" content="浏览韩立的公开手记，第 ${page.number} 页`));
          assert.doesNotMatch(html, /href="\/" aria-current="page"/);
        }
        assert.doesNotMatch(html, /\/page\/1\//);
        if (count <= 6) assert.doesNotMatch(html, /class="pagination"/);
        if (count === 0) assert.match(html, /第一篇手记正在路上/);
      }
      assert.deepEqual(seen, sorted.map(post => post.slug));
      await assert.rejects(stat(path.join(dist,'page',String(pageCount(input) + 1))), {code:'ENOENT'});
      await assert.rejects(stat(path.join(dist,'page/1')), {code:'ENOENT'});
      const archive = await readFile(path.join(dist,'archive/index.html'),'utf8');
      assert.deepEqual([...archive.matchAll(/href="\/notes\/([^/]+)\/"/g)].map(match=>match[1]), seen);
      const rss = await readFile(path.join(dist,'feed.xml'),'utf8');
      assert.equal([...rss.matchAll(/<item>/g)].length, count);
      const json = JSON.parse(await readFile(path.join(dist,'feed.json'),'utf8'));
      assert.equal(json.items.length, count);
      for (const post of input) assert.ok((await stat(path.join(dist,'notes',post.slug,'index.html'))).isFile());
      await validateLinks(dist);
    }
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test('pagination styling wraps at narrow widths and hides navigation in print', async () => {
  const css = await readFile(path.join(root,'public/style.css'),'utf8');
  assert.match(css, /\.pagination\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.pagination>\*\{min-width:0;max-width:100%\}/);
  assert.match(css, /@media print\{[\s\S]*\.pagination\{display:none\}/);
});
