// Structural contracts; physical print layout still needs browser/PDF checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderPrintSource } from './print-source.mjs';
import { siteUrl } from './feed.mjs';

async function htmlPages(directory) {
  const pages = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await htmlPages(file));
    else if (entry.name.endsWith('.html')) pages.push(file);
  }
  return pages;
}

test('print source contains the shared canonical address as visible text and a link', () => {
  const url = `${siteUrl}/notes/print-fixture/`;
  assert.equal(renderPrintSource('print-fixture'), `<p class="print-source">原文地址：<a href="${url}">${url}</a></p>`);
});

test('print source encodes untrusted slug delimiters and escapes the HTML layer', () => {
  const slug = `中文/\"><script>alert('x')</script>?q=&value=#part`;
  const safeUrl = `${siteUrl}/notes/${encodeURIComponent(slug)}/`.replaceAll("'", '&#39;');
  const html = renderPrintSource(slug);
  assert.equal(html, `<p class="print-source">原文地址：<a href="${safeUrl}">${safeUrl}</a></p>`);
  assert.doesNotMatch(html, /<script|onclick|\?q=|#part/);
  assert.match(html, /%2F/);
  assert.match(html, /&#39;/);
});

test('every article keeps one print source after its AI disclosure; other pages and feeds omit it', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-print-source-'));
  try {
    for (const directory of ['scripts', 'public', 'content']) {
      await cp(new URL(`../${directory}`, import.meta.url), path.join(temp, directory), {recursive:true});
    }
    const posts = JSON.parse(await readFile(path.join(temp, 'content/posts.json'), 'utf8'));
    for (const input of [posts, []]) {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(input));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
      const output = path.join(temp, 'dist');
      let articleCount = 0;
      for (const file of await htmlPages(output)) {
        const html = await readFile(file, 'utf8');
        const relative = path.relative(output, file).split(path.sep).join('/');
        const post = input.find(post => relative === `notes/${post.slug}/index.html`);
        if (post) {
          articleCount += 1;
          assert.equal([...html.matchAll(/class="print-source"/g)].length, 1);
          assert.ok(html.includes(`<p class="article-disclosure">AI 撰写 · 基于公开来源，不涉及私人对话或未公开资料</p>${renderPrintSource(post.slug)}`));
          assert.ok(html.includes(`<time datetime="${post.date}">`));
        } else {
          assert.doesNotMatch(html, /class="print-source"/);
        }
      }
      assert.equal(articleCount, input.length);
      for (const feed of ['feed.xml', 'feed.json']) {
        assert.doesNotMatch(await readFile(path.join(output, feed), 'utf8'), /print-source|原文地址：/);
      }
    }
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

test('CSS hides the source on screen and prints a fully wrapping, unclipped URL', async () => {
  const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  const printStart = css.indexOf('@media print{');
  assert.notEqual(printStart, -1);
  assert.match(css.slice(0, printStart), /\.print-source\s*\{\s*display:\s*none\s*\}/);
  const start = printStart + '@media print{'.length;
  let end = start, depth = 1;
  for (; end < css.length && depth; end += 1) {
    if (css[end] === '{') depth += 1;
    if (css[end] === '}') depth -= 1;
  }
  assert.equal(depth, 0);
  const print = css.slice(start, end - 1);
  const rule = print.match(/\.print-source\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule);
  assert.match(rule, /display:\s*block/);
  assert.match(rule, /overflow-wrap:\s*anywhere/);
  assert.match(rule, /white-space:\s*normal/);
  assert.doesNotMatch(rule, /overflow(?:-x|-y)?:\s*(?:hidden|clip)|text-overflow:\s*ellipsis|(?:^|;)\s*(?:max-)?height:/);
  assert.match(print, /\.article-disclosure\s*\{[^}]*display:\s*block/);
  assert.equal([...css.matchAll(/\.print-source\s*\{/g)].length, 2, 'Keep the screen/print visibility contract explicit');
});
