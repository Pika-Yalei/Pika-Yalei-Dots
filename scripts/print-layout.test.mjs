// Structural print regressions; physical pagination still needs browser/PDF verification.
// Run with node --test scripts/print-layout.test.mjs.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const css = await readFile(path.join(root, 'public/style.css'), 'utf8');
const printBlocks = [];
for (const match of css.matchAll(/@media\s+print\s*\{/g)) {
  let depth = 1;
  let end = match.index + match[0].length;
  const start = end;
  for (; end < css.length && depth; end += 1) {
    if (css[end] === '{') depth += 1;
    if (css[end] === '}') depth -= 1;
  }
  assert.equal(depth, 0, 'Print rules must be balanced');
  printBlocks.push(css.slice(start, end - 1));
}
const print = printBlocks.join('\n');
const fixture = await mkdtemp(path.join(tmpdir(), 'notebook-print-layout-'));
after(() => rm(fixture, { recursive: true, force: true }));
for (const dir of ['scripts', 'public', 'content']) {
  await cp(path.join(root, dir), path.join(fixture, dir), { recursive: true });
}
const [base] = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
const longText = `BEGIN-${'longword'.repeat(300)}-END`;
const post = {
  ...base, slug: 'print-fixture', title: longText, closing: longText,
  sections: Array.from({ length: 12 }, (_, index) => ({
    heading: `Section ${index + 1}`, paragraphs: [longText, '正文内容。'.repeat(80)],
  })),
};
await writeFile(path.join(fixture, 'content/posts.json'), JSON.stringify([post]));
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture });

test('print keeps the AI disclosure and site authorship visible', async () => {
  assert.equal(printBlocks.length, 1, 'Keep print overrides in one auditable block');
  assert.match(print, /\.article-disclosure\s*\{[^}]*display:\s*block/);
  assert.match(print, /\.site-footer\s*\{[^}]*display:\s*block/);
  for (const [, selectors, declarations] of print.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.article-disclosure|\.site-footer/.test(selectors)) {
      assert.doesNotMatch(declarations, /display:\s*none|visibility:\s*hidden/);
    }
  }
  const html = await readFile(path.join(fixture, 'dist/notes', post.slug, 'index.html'), 'utf8');
  assert.match(html, /<p class="article-disclosure">AI 撰写 · 通用观察，不涉及真实私人事件<\/p>/);
  for (const file of ['index.html', 'archive/index.html', 'about/index.html', '404.html']) {
    const page = await readFile(path.join(fixture, 'dist', file), 'utf8');
    assert.match(page, /<footer[^>]*>[\s\S]*AI 助手韩立[\s\S]*<\/footer>/);
  }
});

test('print headings stay with following text and paragraphs retain context', () => {
  assert.match(print, /h1,h2,h3,\.section-label\s*\{[^}]*break-after:\s*avoid-page/);
  assert.match(print, /h1,h2,h3,\.section-label\s*\{[^}]*page-break-after:\s*avoid/);
  assert.match(print, /\.article-header\s*\{[^}]*break-after:\s*avoid-page/);
  assert.match(print, /p\s*\{[^}]*orphans:\s*3;[^}]*widows:\s*3/);
  assert.match(print, /\.prose\s*\{[^}]*font-size:\s*12pt/);
});

test('long printed content can wrap and fragment rather than being clipped', async () => {
  assert.match(print, /\.article-shell\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(print, /\.entry,\.archive-list li,\.entry h2 a\s*\{[^}]*display:\s*block/);
  assert.doesNotMatch(print, /overflow(?:-x|-y)?:\s*(?:hidden|clip)|[;{]\s*(?:max-)?height:\s*\d|text-overflow:\s*ellipsis|break-inside:\s*avoid/);
  const html = await readFile(path.join(fixture, 'dist/notes', post.slug, 'index.html'), 'utf8');
  assert.equal([...html.matchAll(/<section><h2/g)].length, post.sections.length);
  assert.equal(html.split(`<p>${longText}</p>`).length - 1, post.sections.length);
  assert.ok(html.includes(`<div class="closing-note">${longText}</div>`));
});
