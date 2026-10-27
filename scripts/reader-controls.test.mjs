import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderReaderControls } from './reader-controls.mjs';

test('reader controls are a native named radio group with one default selection', () => {
  const html = renderReaderControls();
  assert.match(html, /<fieldset class="reader-controls">/);
  assert.match(html, /<legend>阅读字号<\/legend>/);
  assert.equal((html.match(/type="radio" name="reader-size"/g) || []).length, 3);
  assert.equal((html.match(/ checked/g) || []).length, 1);
  for (const value of ['default', 'large', 'larger']) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(html, /value="default" checked/);
  assert.equal((html.match(/<label><input/g) || []).length, 3);
  assert.match(html, /不保存偏好/);
  assert.doesNotMatch(html, /script|onclick|tabindex|style=/);
});

test('CSS-only enhancement falls back safely and preserves native focus and touch targets', async () => {
  const css = await readFile(new URL('../public/reader-controls.css', import.meta.url), 'utf8');
  assert.match(css, /\.reader-controls\{display:none\}/);
  assert.match(css, /@supports selector\(:has\(input:checked\)\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /input:focus-visible/);
  assert.match(css, /forced-colors:active/);
  assert.doesNotMatch(css, /url\(|@import|position:fixed/);
});

test('only article prose is resized on screen; default and print retain original typography', async () => {
  const css = await readFile(new URL('../public/reader-controls.css', import.meta.url), 'utf8');
  assert.match(css, /@media screen\{/);
  assert.match(css, /\.article-reader:has\(input\[name="reader-size"\]\[value="large"\]:checked\) \.prose\{font-size:1.25rem\}/);
  assert.match(css, /\.article-reader:has\(input\[name="reader-size"\]\[value="larger"\]:checked\) \.prose\{font-size:1.5rem\}/);
  assert.doesNotMatch(css, /\[value="default"\]/);
  assert.match(css, /@media print\{\.reader-controls\{display:none\}\}/);
});

test('built articles include one scoped reader group and stylesheet, without scripts', async () => {
  const posts = JSON.parse(await readFile(new URL('../content/posts.json', import.meta.url), 'utf8'));
  for (const post of posts) {
    const html = await readFile(new URL(`../dist/notes/${post.slug}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /href="\/reader-controls.css"/);
    assert.equal((html.match(/class="reader-controls"/g) || []).length, 1);
    assert.match(html, /<div class="article-reader"><fieldset class="reader-controls">/);
    assert.match(html, /<\/fieldset><div class="prose">/);
    assert.doesNotMatch(html, /<script/);
  }
  const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /reader-controls/);
});
