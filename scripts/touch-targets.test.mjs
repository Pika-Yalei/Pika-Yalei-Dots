// Static contracts complement browser measurements; they are not a layout engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
const block = css.match(/@media screen\{\s*:is\(([^)]+)\)\{([^}]+)\}/);

test('discrete navigation reserves a 44px hit area in screen layouts', () => {
  assert.ok(block, 'screen-only touch target rule exists');
  const selectors = block[1].split(',');
  for (const selector of ['.site-header nav a', '.read-link', '.back-link', '.home-aside a', '.site-footer a', '.entry-meta a', '.breadcrumbs a', '.article-contents a', '.article-topics a', '.pagination a', '.archive-list a', '.article-neighbors a', '.related-notes li>a']) {
    assert.ok(selectors.includes(selector), selector);
  }
  for (const declaration of ['display:inline-block', 'min-width:44px', 'min-height:44px', 'max-width:100%', 'overflow-wrap:anywhere']) {
    assert.ok(block[2].includes(declaration), declaration);
  }
  assert.match(block[2], /padding:0\.625rem 0\.25rem/);
  assert.doesNotMatch(block[2], /(?:^|;)\s*(?:height|width|position|overflow|white-space)\s*:/);
});

test('target expansion excludes prose and does not create overlapping invisible hit areas', () => {
  assert.ok(block);
  assert.doesNotMatch(block[1], /\.prose|\.article-sources|::(?:before|after)/);
  assert.doesNotMatch(block[2], /position:\s*absolute|margin:\s*-/);
  assert.ok(css.indexOf(block[0]) < css.indexOf('@media print{'), 'print rules remain separate');
  assert.match(css, /\.site-header nav\{column-gap:12px\}/);
});
