import { paginateCategories } from './category-pagination.mjs';
import { paginateTopics } from './topics.mjs';
import { collectSources, paginateSources } from './source-index.mjs';
import { pageCount } from './pagination.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateLinks } from './validate-links.mjs';
import { groupCategories } from './categories.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:root});
async function files(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
}
const all = await files(dist);
const pages = all.filter(f=>f.endsWith('.html'));
test('build generates every public page and a real 404 page', async () => {
  const posts = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
  assert.equal(pages.length, posts.length + paginateCategories(groupCategories(posts)).length + pageCount(posts) + paginateSources(collectSources(posts)).length + paginateTopics(posts).length + 6);
  for (const file of ['index.html','about/index.html','archive/index.html','categories/index.html','404.html', ...groupCategories(posts).map(category => `${category.path.slice(1)}index.html`), ...posts.map(p => `notes/${p.slug}/index.html`)]) {
    assert.ok(all.includes(path.join(dist,file)));
  }
});
test('all local references and fragment targets resolve', async () => {
  await validateLinks(dist);
});
test('every page has semantic and accessible foundations', async () => {
  for (const file of pages) {
    const html = await readFile(file,'utf8');
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /name="viewport"/);
    assert.equal([...html.matchAll(/<h1\b/g)].length,1);
    assert.match(html, /<main id="main" tabindex="-1">/);
    assert.match(html, /class="skip"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /name="description"/);
  }
});
test('output has no scripts, forms, trackers, remote imports or common secrets', async () => {
  for (const file of all) {
    const text = await readFile(file,'utf8');
    assert.doesNotMatch(text, /<script\b|<iframe\b|<form\b|@import\b|localStorage|sessionStorage|document\.cookie|google-analytics|googletagmanager|cloudflareinsights/i);
    assert.doesNotMatch(text, /(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (file.endsWith('.css')) {
      assert.doesNotMatch(text,/url\s*\(/i);
    }
  }
});
test('security headers are included', async () => {
  const headers = await readFile(path.join(dist,'_headers'),'utf8');
  assert.match(headers,/default-src 'none'/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/Referrer-Policy: no-referrer/);
});
test('untrusted-looking article strings are escaped and unsafe slugs rejected', async () => {
  const temp = await mkdtemp(path.join(tmpdir(),'notebook-test-'));
  try {
    for (const dir of ['scripts','public','content']) {
      await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    }
    const posts = JSON.parse(await readFile(path.join(temp,'content/posts.json'),'utf8'));
    posts[0].title = '<script>alert("test")</script>';
    posts[0].sections[0].paragraphs[0] = '<img src=x onerror=alert(1)>';
    await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(posts));
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
    const page = await readFile(path.join(temp,'dist/notes',posts[0].slug,'index.html'),'utf8');
    assert.match(page,/&lt;script&gt;/);
    assert.match(page,/&lt;img src=x/);
    assert.doesNotMatch(page,/<script|<img/);
    posts[0].slug = '../../outside';
    await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(posts));
    assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,stdio:'pipe'}));
  } finally {
    await rm(temp,{recursive:true,force:true});
  }
});

test('every page links the public repository and the decorative arrow uses SVG', async () => {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<footer[^>]*>[\s\S]*<a href="https:\/\/github\.com\/Pika-Yalei\/Pika-Yalei-Dots" aria-label="GitHub：韩立的工作手记源码仓库">GitHub<\/a>[\s\S]*<\/footer>/);
  }
  const home = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.match(home, /<svg class="entry-arrow" aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(home, /class="entry-arrow"[^>]*>↗/);
});

test('archive navigation is present on every page and active only on the archive', async () => {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<a href="\/archive\/"(?: aria-current="page")?>归档<\/a>/);
    assert.equal(html.includes('href="/archive/" aria-current="page"'), file === path.join(dist, 'archive/index.html'));
  }
});

test('category navigation appears on every page and only marks the index as current', async () => {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<a href="\/categories\/"(?: aria-current="page")?>分类<\/a>/);
    assert.equal(html.includes('href="/categories/" aria-current="page"'), file === path.join(dist, 'categories/index.html'));
  }
});

test('archive groups all posts by descending year and month with accurate counts, dates and safe links', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-archive-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), {recursive:true});
    }
    const [base] = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
    const fixtures = [
      {...base, slug:'older-year', date:'2024-12-31', title:'Earlier year'},
      {...base, slug:'same-day-z', date:'2025-10-14', title:'Z title'},
      {...base, slug:'older-month', date:'2025-02-02', title:'Earlier month'},
      {...base, slug:'same-day-a', date:'2025-10-14', title:'<img src=x> & "Title"'},
      {...base, slug:'later-date', date:'2025-10-15', title:'Latest title'}
    ];
    const buildArchive = async posts => {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(posts));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
      return readFile(path.join(temp, 'dist/archive/index.html'), 'utf8');
    };
    const html = await buildArchive(fixtures);
    const monthLinks = [...html.matchAll(/href="#(month-[^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(monthLinks, ['month-2025-10', 'month-2025-02', 'month-2024-12']);
    for (const id of monthLinks) assert.ok(html.includes(`<h3 tabindex="-1" id="${id}">`));
    await validateLinks(path.join(temp, 'dist'));
    assert.match(html, /共 5 篇手记/);
    assert.match(html, /id="year-2025">2025 年<\/h2><span>4 篇/);
    assert.match(html, /id="year-2024">2024 年<\/h2><span>1 篇/);
    assert.match(html, /id="month-2025-10">10 月 <span>3 篇/);
    assert.match(html, /id="month-2025-02">2 月 <span>1 篇/);
    assert.ok(html.indexOf('id="year-2025"') < html.indexOf('id="year-2024"'));
    assert.ok(html.indexOf('id="month-2025-10"') < html.indexOf('id="month-2025-02"'));
    const links = [...html.matchAll(/href="\/notes\/([^/]+)\/"/g)].map(match => match[1]);
    assert.deepEqual(links, ['later-date', 'same-day-a', 'same-day-z', 'older-month', 'older-year']);
    for (const post of fixtures) {
      assert.match(html, new RegExp(`<time datetime="${post.date}">${post.date.replaceAll('-', '\\.')}</time>`));
      assert.ok((await stat(path.join(temp, 'dist/notes', post.slug, 'index.html'))).isFile());
    }
    assert.match(html, /&lt;img src=x&gt; &amp; &quot;Title&quot;/);
    assert.doesNotMatch(html, /<img|<script/);
    const one = await buildArchive([fixtures[0]]);
    assert.match(one, /共 1 篇手记/);
    assert.doesNotMatch(one, /archive-months-title|href="#month-/);
    assert.equal([...one.matchAll(/<li>/g)].length, 1);
    const empty = await buildArchive([]);
    assert.match(empty, /共 0 篇手记/);
    assert.match(empty, /第一篇正在路上/);
    assert.doesNotMatch(empty, /class="archive-year"|<ol/);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

test('RSS includes every post exactly once with absolute stable IDs and UTC dates', async () => {
  const posts = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
  const feed = await readFile(path.join(dist, 'feed.xml'), 'utf8');
  const { renderFeed, siteUrl } = await import('./feed.mjs');
  assert.equal(feed, renderFeed(posts));
  assert.match(feed, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
  assert.match(feed, /xmlns:atom="http:\/\/www.w3.org\/2005\/Atom"/);
  assert.ok(feed.includes(`<atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />`));
  const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => match[1]);
  assert.equal(items.length, posts.length);
  const ordered = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  for (const [index, post] of ordered.entries()) {
    const url = `${siteUrl}/notes/${post.slug}/`;
    assert.ok(items[index].includes(`<link>${url}</link>`));
    assert.ok(items[index].includes(`<guid isPermaLink="true">${url}</guid>`));
    assert.ok(items[index].includes(`<pubDate>${new Date(post.publishedAt ?? `${post.date}T00:00:00Z`).toUTCString()}</pubDate>`));
  }
  const ids = [...feed.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, posts.length);
  for (const [, url] of feed.matchAll(/<link>([^<]+)<\/link>/g)) {
    assert.equal(new URL(url).origin, siteUrl);
  }
});

test('RSS text escapes XML, replaces forbidden characters, and handles empty input', async () => {
  const { renderFeed } = await import('./feed.mjs');
  const text = `A & <tag> "quote" 'apostrophe' ]]> 中文 😀\u0000\ud800`;
  const escaped = 'A &amp; &lt;tag&gt; &quot;quote&quot; &apos;apostrophe&apos; ]]&gt; 中文 😀\uFFFD\uFFFD';
  const fixture = {slug: 'xml-test', date: '2026-10-14', title: text, summary: text, category: text};
  const feed = renderFeed([fixture]);
  for (const element of ['title', 'description', 'category']) {
    assert.ok(feed.includes(`<${element}>${escaped}</${element}>`));
  }
  assert.doesNotMatch(feed, /<tag>|\u0000|\ud800/u);
  assert.match(renderFeed([]), /<channel>[\s\S]*<\/channel>\n<\/rss>/);
  assert.doesNotMatch(renderFeed([]), /<item>|Invalid Date/);
  const sameDate = {...fixture, slug: 'a-first'};
  const newer = {...fixture, slug: 'newer', date: '2026-10-15'};
  const input = [fixture, sameDate, newer];
  const output = renderFeed(input);
  assert.ok(output.indexOf('/notes/newer/') < output.indexOf('/notes/a-first/'));
  assert.ok(output.indexOf('/notes/a-first/') < output.indexOf('/notes/xml-test/'));
  assert.deepEqual(input.map(post => post.slug), ['xml-test', 'a-first', 'newer']);
  assert.equal(renderFeed(input), output, 'Rebuilding must not change feed content or IDs');
});

test('every page exposes the feed to readers and feed MIME type is configured', async () => {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<head>[\s\S]*<link rel="alternate" type="application\/rss\+xml" title="韩立的工作手记 RSS" href="\/feed.xml">[\s\S]*<\/head>/);
    assert.match(html, /<footer[^>]*>[\s\S]*<a href="\/feed.xml" aria-label="订阅手记 RSS">订阅<\/a>[\s\S]*<\/footer>/);
  }
  const headers = await readFile(path.join(dist, '_headers'), 'utf8');
  assert.match(headers, /\/feed.xml\n  Content-Type: application\/rss\+xml; charset=utf-8/);
});

test('reading anchors are unique, repeatable and independent of other headings', async () => {
  const { sectionAnchors } = await import('./reading-navigation.mjs');
  const sections = ['检查', '检查', '检查-2', '检查', '<img " & >'].map(heading => ({heading, paragraphs:['内容']}));
  const result = sectionAnchors(sections);
  assert.equal(new Set(result.map(section => section.id)).size, sections.length);
  assert.deepEqual(sectionAnchors(sections), result);
  const inserted = sectionAnchors([{heading:'新章节', paragraphs:['内容']}, ...sections]);
  assert.deepEqual(inserted.slice(1), result);
  assert.deepEqual(sections.map(section => Object.keys(section)), sections.map(() => ['heading', 'paragraphs']));
  for (const section of result) {
    assert.match(section.id, /^section-[a-f0-9]{16}(?:-\d+)?$/);
  }
});

test('reading navigation resolves duplicate sections, escapes labels and handles article boundaries', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-reading-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), {recursive:true});
    }
    const [base] = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
    const sample = ['old', 'middle', 'new'].map((slug, index) => ({...base, slug, title:`标题 <${slug}> & "引号"`, date:`2026-10-${10 + index}`, sections:[{heading:'同名 <标题> & "引用"', paragraphs:['正文']}, {heading:'同名 <标题> & "引用"', paragraphs:['正文']}]}));
    const build = async (posts) => {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(posts));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
    };
    await build([sample[0]]);
    const single = await readFile(path.join(temp, 'dist/notes/old/index.html'), 'utf8');
    assert.doesNotMatch(single, /class="article-neighbors"|rel="prev"|rel="next"/);
    assert.match(single, /aria-labelledby="contents-title"/);
    assert.match(single, /id="article-top" tabindex="-1"/);
    assert.match(single, /href="#article-top"/);
    const ids = [...single.matchAll(/<h2 id="(section-[^"]+)" tabindex="-1">/g)].map(match => match[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    for (const id of ids) {
      assert.match(single, new RegExp(`href="#${id}"`));
    }
    assert.match(single, /同名 &lt;标题&gt; &amp; &quot;引用&quot;/);
    assert.doesNotMatch(single, /<标题>|<old>/);
    await build(sample);
    for (const [slug, prev, next] of [['new','middle',null], ['middle','old','new'], ['old',null,'middle']]) {
      const html = await readFile(path.join(temp, 'dist/notes', slug, 'index.html'), 'utf8');
      for (const [rel, expected] of [['prev',prev], ['next',next]]) {
        const actual = [...html.matchAll(new RegExp(`<a href="([^"]+)" rel="${rel}">`, 'g'))];
        assert.equal(actual.length, expected ? 1 : 0);
        if (expected) {
          assert.equal(actual[0][1], `/notes/${expected}/`);
          assert.ok((await stat(path.join(temp, 'dist', actual[0][1], 'index.html'))).isFile());
        }
      }
      assert.match(html, /标题 &lt;\w+&gt; &amp; &quot;引号&quot;/);
      assert.doesNotMatch(html, /<script\b/);
    }
    await build([]);
    assert.ok((await stat(path.join(temp, 'dist/index.html'))).isFile());
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

test('stylesheets use a content-derived URL and change only when CSS changes', async () => {
  const css = await readFile(path.join(root, 'public/style.css'));
  const expected = `style.${createHash('sha256').update(css).digest('hex').slice(0, 16)}.css`;
  assert.deepEqual(await readFile(path.join(dist, expected)), css);
  assert.deepEqual(await readFile(path.join(dist, 'style.css')), css);
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.ok(html.includes(`<link rel="stylesheet" href="/${expected}">`));
  }
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-css-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), {recursive:true});
    }
    const build = async () => {
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
      const html = await readFile(path.join(temp, 'dist/index.html'), 'utf8');
      return html.match(/rel="stylesheet" href="\/(style\.[a-f0-9]{16}\.css)"/)[1];
    };
    assert.equal(await build(), expected);
    assert.equal(await build(), expected);
    await writeFile(path.join(temp, 'public/style.css'), `${css}\n/* synthetic test change */\n`);
    const changed = await build();
    assert.notEqual(changed, expected);
    assert.ok((await stat(path.join(temp, 'dist', changed))).isFile());
    assert.equal(await build(), changed);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

