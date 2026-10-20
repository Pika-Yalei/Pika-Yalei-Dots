import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryPath, groupCategories } from './categories.mjs';
import { renderCategoryFeed, renderFeed, siteUrl } from './feed.mjs';
import { renderJsonFeed } from './json-feed.mjs';
import { validateLinks } from './validate-links.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const post = (overrides = {}) => ({
  slug: 'example', date: '2026-10-20', title: '公开示例', subtitle: '副标题',
  category: '方法', summary: '通用方法摘要', readingMinutes: 2,
  sections: [{heading: '章节', paragraphs: ['公开正文']}], closing: '保持核对。', ...overrides
});
const items = xml => [...xml.matchAll(/    <item>[\s\S]*?    <\/item>/g)].map(match => match[0]);

test('category RSS shares complete global items and sorts deterministically without mutation', () => {
  const input = [post({slug: 'z'}), post({slug: 'old', date: '2020-01-01'}), post({slug: 'a'})];
  const before = structuredClone(input);
  const category = {name: '方法', path: categoryPath('方法'), posts: input};
  const rss = renderCategoryFeed(category);
  assert.deepEqual(items(rss), items(renderFeed(input)));
  assert.equal(renderCategoryFeed({...category, posts: [...input].reverse()}), rss);
  assert.deepEqual(input, before);
  assert.match(rss, /<title>韩立的工作手记 · 方法<\/title>/);
  assert.ok(rss.includes(`<link>${siteUrl}${category.path}</link>`));
  assert.ok(rss.includes(`<atom:link href="${siteUrl}${category.path}feed.xml" rel="self" type="application/rss+xml" />`));
  assert.match(rss, /AI 撰写 · 通用观察，不涉及真实私人事件/);
  assert.deepEqual(items(renderCategoryFeed({...category, posts: []})), []);
});

test('category labels and full-text content use safe XML and HTML layers', () => {
  const name = `<img src=x> & "分类" ' ]] 中文😀\u0000\ud800`;
  const [category] = groupCategories([post({category: name, subtitle: '<script> & ]]>'})]);
  const rss = renderCategoryFeed(category);
  assert.match(rss, /韩立的工作手记 · &lt;img src=x&gt; &amp; &quot;分类&quot; &apos; \]\] 中文😀\uFFFD\uFFFD/u);
  assert.match(rss, /&amp;lt;script&amp;gt; &amp;amp; ]]&amp;gt;/);
  assert.doesNotMatch(rss, /<img|<script|\u0000|\ud800|\]\]>/u);
  assert.deepEqual(items(rss), items(renderFeed(category.posts)));
});

test('isolated builds publish discoverable category feeds and remove deleted or renamed categories', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-category-feed-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), {recursive: true});
    }
    const dist = path.join(temp, 'dist');
    const build = async posts => {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(posts));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd: temp, stdio: 'pipe'});
      await validateLinks(dist);
    };
    const posts = [post({slug: 'a', category: '中文 / <方法> & "主题"'}),
      post({slug: 'z', category: '中文 / <方法> & "主题"'}),
      post({slug: 'other', category: '中文-方法'})];
    await build(posts);
    for (const category of groupCategories(posts)) {
      const rss = await readFile(path.join(dist, category.path, 'feed.xml'), 'utf8');
      assert.equal(rss, renderCategoryFeed(category));
      assert.deepEqual(items(rss), items(renderFeed(category.posts)));
      for (const absent of posts.filter(p => p.category !== category.name)) {
        assert.ok(!rss.includes(`/notes/${absent.slug}/`));
      }
      const html = await readFile(path.join(dist, category.path, 'index.html'), 'utf8');
      assert.ok(html.includes(`<a href="${category.path}feed.xml">订阅此分类 RSS</a>`));
      const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
      assert.ok(head.includes(`href="${category.path}feed.xml"`));
      assert.ok(head.indexOf(`${category.path}feed.xml`) < head.indexOf('href="/feed.xml"'));
      assert.match(head, /href="\/feed.json"/);
      assert.ok(!(await readFile(path.join(dist, 'sitemap.xml'), 'utf8')).includes(`${category.path}feed.xml`));
    }
    assert.equal(await readFile(path.join(dist, 'feed.xml'), 'utf8'), renderFeed(posts));
    assert.equal(await readFile(path.join(dist, 'feed.json'), 'utf8'), renderJsonFeed(posts));
    const headers = await readFile(path.join(dist, '_headers'), 'utf8');
    assert.match(headers, /\/categories\/\*\/feed.xml\n  Content-Type: application\/rss\+xml; charset=utf-8/);
    const retained = categoryPath(posts[0].category);
    const original = await readFile(path.join(dist, retained, 'feed.xml'), 'utf8');
    await build([...posts].reverse());
    assert.equal(await readFile(path.join(dist, retained, 'feed.xml'), 'utf8'), original);
    await build([posts[0]]);
    assert.equal(items(await readFile(path.join(dist, retained, 'feed.xml'), 'utf8')).length, 1);
    await assert.rejects(readFile(path.join(dist, categoryPath(posts[2].category), 'feed.xml')), {code: 'ENOENT'});
    await build([post({category: '改名'})]);
    await assert.rejects(readFile(path.join(dist, retained, 'feed.xml')), {code: 'ENOENT'});
    await build([]);
    assert.deepEqual(await readdir(path.join(dist, 'categories')), ['index.html']);
    assert.equal(await readFile(path.join(dist, 'feed.xml'), 'utf8'), renderFeed([]));
    assert.equal(await readFile(path.join(dist, 'feed.json'), 'utf8'), renderJsonFeed([]));
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
});
