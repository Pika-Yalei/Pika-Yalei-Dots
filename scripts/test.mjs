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
  assert.equal(pages.length, posts.length + 3);
  for (const file of ['index.html','about/index.html','404.html', ...posts.map(p => `notes/${p.slug}/index.html`)]) {
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
