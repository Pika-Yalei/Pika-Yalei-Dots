import { collectSources, paginateSources } from './source-index.mjs';
import { pageCount, paginatePosts } from './pagination.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryPath, groupCategories, renderCategories, renderCategory } from './categories.mjs';
import { siteUrl } from './feed.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const noteSlugs = html => [...html.matchAll(/href="\/notes\/([^/]+)\/"/g)].map(match => match[1]);
const makePost = (overrides = {}) => ({
  slug:'category-example', date:'2026-10-16', title:'公开示例', subtitle:'通用说明',
  category:'工作手记', summary:'独立创作的公开示例。', readingMinutes:2,
  sections:[{heading:'通用方法', paragraphs:['先检查，再记录。']}], closing:'保持核对。',
  ...overrides
});

test('category paths are stable, bounded and safe for arbitrary exact labels', () => {
  const labels = [
    '', ' ', '中文', '中文 ', 'A B', 'A-B', 'a-b', 'a/b', 'a\\b', '../outside',
    '../../index.html', '/absolute', '?q=1#x', '<img src=x> & "quote"',
    'é', 'e\u0301', '😀', '\ud800', '\ud801', '\ufffd', '\u0000', 'x'.repeat(10000)
  ];
  const paths = labels.map(categoryPath);
  assert.equal(new Set(paths).size, labels.length, 'Similar labels must not merge');
  for (const [index, value] of paths.entries()) {
    assert.match(value, /^\/categories\/category-[a-f0-9]{64}\/$/);
    assert.equal(value, categoryPath(labels[index]));
  }
  assert.deepEqual([...labels].reverse().map(categoryPath).reverse(), paths);
  assert.equal(categoryPath('工作手记'), '/categories/category-a774e00617e02f585a6914e833d4ff249a3b98f44d87229ddf92d880732ca778/');
});

test('category groups have deterministic labels and descending dates without changing input', () => {
  const posts = [
    makePost({slug:'older', date:'2025-10-16', category:'B'}),
    makePost({slug:'same-day-z', category:'B'}),
    makePost({slug:'other', category:'A'}),
    makePost({slug:'same-day-a', category:'B'}),
    makePost({slug:'latest', date:'2026-10-17', category:'B'})
  ];
  const original = structuredClone(posts);
  posts.forEach(Object.freeze);
  Object.freeze(posts);
  const groups = groupCategories(posts);
  assert.deepEqual(groups.map(category => category.name), ['A', 'B']);
  assert.deepEqual(groups[1].posts.map(post => post.slug), ['latest', 'same-day-a', 'same-day-z', 'older']);
  assert.deepEqual(groupCategories([...posts].reverse()), groups);
  assert.deepEqual(posts, original);
  assert.equal(groups[1].path, categoryPath('B'));
  const added = groupCategories([...posts, makePost({slug:'new-category', category:'0'})]);
  assert.equal(added.find(category => category.name === 'B').path, groups[1].path);
  assert.deepEqual(groupCategories([]), []);
});

test('category renderers escape labels and article titles and handle an empty notebook', () => {
  const [category] = groupCategories([makePost({category:'<script> & "name"', title:"<img src=x> & 'title'"})]);
  const index = renderCategories([category]);
  assert.match(index, /共 1 个分类 · 1 篇手记/);
  assert.match(index, /&lt;script&gt; &amp; &quot;name&quot;/);
  const detail = renderCategory(category);
  assert.match(detail, /<h1>&lt;script&gt; &amp; &quot;name&quot;<\/h1>/);
  assert.match(detail, /&lt;img src=x&gt; &amp; &#39;title&#39;/);
  assert.match(detail, /href="\/categories\/">分类/);
  assert.deepEqual(noteSlugs(detail), ['category-example']);
  for (const html of [index, detail]) assert.doesNotMatch(html, /<script\b|<img\b/);
  const empty = renderCategories([]);
  assert.match(empty, /共 0 个分类 · 0 篇手记/);
  assert.match(empty, /第一篇手记发布后会自动出现/);
  assert.doesNotMatch(empty, /<ul class="category-list"/);
});

test('static category pages link each group, preserve exact labels and clean up removed groups', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-categories-'));
  try {
    for (const directory of ['scripts', 'public', 'content']) {
      await cp(path.join(root, directory), path.join(temp, directory), {recursive:true});
    }
    const posts = [
      makePost({slug:'same-z', category:'中文 / 方法'}),
      makePost({slug:'older', date:'2025-10-01', category:'中文 / 方法'}),
      makePost({slug:'same-a', category:'中文 / 方法'}),
      makePost({slug:'safe-escape', category:'../../<img src=x> & "路径"'}),
      makePost({slug:'similar-one', category:'a/b'}),
      makePost({slug:'similar-two', category:'a-b'}),
      makePost({slug:'surrogate-one', category:'\ud800'}),
      makePost({slug:'surrogate-two', category:'\ud801'})
    ];
    const input = path.join(temp, 'content/posts.json');
    const dist = path.join(temp, 'dist');
    const build = async entries => {
      await writeFile(input, JSON.stringify(entries));
      return execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp, stdio:'pipe'}).toString();
    };
    const categories = groupCategories(posts);
    assert.match(await build(posts), new RegExp(`Built ${posts.length + categories.length + pageCount(posts) + paginateSources(collectSources(posts)).length + 5} HTML pages`));
    const index = await readFile(path.join(dist, 'categories/index.html'), 'utf8');
    const home = (await Promise.all(paginatePosts(posts).map(page => readFile(path.join(dist, page.path, 'index.html'), 'utf8')))).join('\n');
    const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
    assert.match(index, /共 6 个分类 · 8 篇手记/);
    assert.match(index, /href="\/categories\/" aria-current="page">分类/);
    assert.doesNotMatch(home, /href="\/categories\/" aria-current/);
    const snapshots = new Map();
    for (const category of categories) {
      assert.ok(index.includes(`href="${category.path}"`));
      assert.ok(home.includes(`href="${category.path}"`));
      assert.ok(sitemap.includes(`<loc>${siteUrl}${category.path}</loc>`));
      const html = await readFile(path.join(dist, category.path, 'index.html'), 'utf8');
      snapshots.set(category.path, html);
      assert.deepEqual(noteSlugs(html), category.posts.map(post => post.slug));
      assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}${category.path}">`));
      assert.match(html, /property="og:type" content="website"/);
      assert.match(html, /href="\/categories\/">分类/);
      assert.doesNotMatch(html, /href="\/categories\/" aria-current/);
      assert.doesNotMatch(html, /<script\b|<form\b|<img\b|<iframe\b/);
      for (const post of category.posts) {
        const article = await readFile(path.join(dist, 'notes', post.slug, 'index.html'), 'utf8');
        assert.ok(article.includes(`<span><a href="${category.path}">`));
      }
    }
    assert.match(index, /\.\.\/\.\.\/&lt;img src=x&gt; &amp; &quot;路径&quot;/);
    assert.deepEqual(noteSlugs(snapshots.get(categoryPath('中文 / 方法'))), ['same-a', 'same-z', 'older']);
    assert.ok((await stat(path.join(dist, 'categories/index.html'))).isFile());
    assert.equal((await readdir(path.join(dist, 'categories'))).length, categories.length + 1);
    await build([...posts].reverse());
    assert.equal(await readFile(path.join(dist, 'categories/index.html'), 'utf8'), index);
    for (const [pagePath, html] of snapshots) {
      assert.equal(await readFile(path.join(dist, pagePath, 'index.html'), 'utf8'), html);
    }
    // Invalid category names fail before removing the last successful pages.
    for (const category of ['', ' \t\n']) {
      await assert.rejects(build([makePost({category})]), /posts\[0\]\.category/);
      assert.equal(await readFile(path.join(dist, 'categories/index.html'), 'utf8'), index);
    }
    await build([posts[0]]);
    assert.deepEqual((await readdir(path.join(dist, 'categories'))).sort(), [categoryPath(posts[0].category).split('/')[2], 'index.html'].sort());
    assert.match(await readFile(path.join(dist, 'categories/index.html'), 'utf8'), /共 1 个分类 · 1 篇手记/);
    await build([]);
    assert.deepEqual(await readdir(path.join(dist, 'categories')), ['index.html']);
    assert.match(await readFile(path.join(dist, 'categories/index.html'), 'utf8'), /共 0 个分类 · 0 篇手记/);
    assert.doesNotMatch(await readFile(path.join(dist, 'sitemap.xml'), 'utf8'), /\/categories\/category-/);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});
