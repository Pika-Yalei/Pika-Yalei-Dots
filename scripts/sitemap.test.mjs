import { allHeadlinePages } from './headlines.mjs';
import { paginateWebsiteDirectory, websitePages } from './source-websites.mjs';
import { paginateCategories } from './category-pagination.mjs';
import { paginateTopics } from './topics.mjs';
import { collectSources, paginateSources } from './source-index.mjs';
import { pageCount } from './pagination.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSitemap, renderRobots } from './sitemap.mjs';
import { siteUrl } from './feed.mjs';
import { categoryPath, groupCategories } from './categories.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('sitemap is deterministic, absolute and excludes non-content paths', () => {
  const posts = [{slug:'z-last', date:'2026-10-21', sections:[], category:'中文'}, {slug:'a-first', date:'2026-10-21', sections:[], category:'<tag> & ?'}];
  const xml = renderSitemap(posts);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, ['/', '/about/', '/archive/', '/categories/', '/subscribe/', ...allHeadlinePages(posts).map(page=>page.path), '/sources/websites/', '/sources/', '/topics/', ...paginateTopics(posts).map(page => page.path), ...posts.map(post => categoryPath(post.category)).sort(), '/notes/a-first/', '/notes/z-last/'].map(p => siteUrl + p));
  assert.equal(xml, renderSitemap([...posts].reverse()));
  assert.deepEqual(posts.map(p=>p.slug), ['z-last', 'a-first']);
  assert.doesNotMatch(xml, /404|feed\.xml|style|lastmod/);
  assert.equal([...renderSitemap([]).matchAll(/<url>/g)].length, 19);
  assert.equal(renderRobots(), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

test('build publishes a sitemap whose unique links all resolve, including empty sites', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-sitemap-'));
  try {
    for (const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const posts = JSON.parse(await readFile(path.join(temp,'content/posts.json'),'utf8'));
    for (const input of [posts, []]) {
      await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(input));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
      const xml = await readFile(path.join(temp,'dist/sitemap.xml'),'utf8');
      assert.equal(xml,renderSitemap(input));
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
      assert.equal(new Set(urls).size,input.length+paginateCategories(groupCategories(input)).length+pageCount(input)+paginateSources(collectSources(input)).length+paginateTopics(input).length+websitePages(input).length+allHeadlinePages(input).length+paginateWebsiteDirectory(websitePages(input)).length+5);
      for (const value of urls) {
        const url = new URL(value);
        assert.equal(url.origin,siteUrl);
        assert.ok((await stat(path.join(temp,'dist',url.pathname,'index.html'))).isFile());
      }
      assert.equal(await readFile(path.join(temp,'dist/robots.txt'),'utf8'),renderRobots());
      const headers = await readFile(path.join(temp,'dist/_headers'),'utf8');
      assert.match(headers,/\/sitemap.xml\n  Content-Type: application\/xml; charset=utf-8/);
      assert.match(headers,/\/robots.txt\n  Content-Type: text\/plain; charset=utf-8/);
    }
  } finally { await rm(temp,{recursive:true,force:true}); }
});
