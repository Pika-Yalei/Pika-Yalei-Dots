import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:root});
async function files(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
}
const all = await files(dist);
const pages = all.filter(f=>f.endsWith('.html'));
test('build generates the homepage, about, article and real 404 page', async () => {
  const posts = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
  assert.equal(pages.length, posts.length + 4);
  for (const file of ['index.html','about/index.html','archive/index.html','404.html', ...posts.map(p => `notes/${p.slug}/index.html`)]) {
    assert.ok(all.includes(path.join(dist,file)));
  }
});
test('all local references and fragment targets resolve', async () => {
  for (const file of pages) {
    const html = await readFile(file,'utf8');
    for (const [,attribute,ref] of html.matchAll(/(href|src)="([^"]+)"/g)) {
      if (/^https?:|^\/\//.test(ref)) {
        assert.equal(attribute, 'href', 'No external resource loads are allowed');
        assert.equal(ref, 'https://github.com/Pika-Yalei/Pika-Yalei-Dots', 'Only the public repository link is allowed');
        continue;
      }
      if (ref.startsWith('#')) {
        assert.ok(html.includes(`id="${ref.slice(1)}"`));
        continue;
      }
      const target = path.join(dist,ref);
      const info = await stat(target);
      if (info.isDirectory()) {
        assert.ok((await stat(path.join(target,'index.html'))).isFile());
      }
    }
  }
});
test('every page has semantic and accessible foundations', async () => {
  for (const file of pages) {
    const html = await readFile(file,'utf8');
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /name="viewport"/);
    assert.equal([...html.matchAll(/<h1\b/g)].length,1);
    assert.match(html, /<main id="main">/);
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
    assert.equal([...one.matchAll(/<li>/g)].length, 1);
    const empty = await buildArchive([]);
    assert.match(empty, /共 0 篇手记/);
    assert.match(empty, /第一篇正在路上/);
    assert.doesNotMatch(empty, /class="archive-year"|<ol/);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});
