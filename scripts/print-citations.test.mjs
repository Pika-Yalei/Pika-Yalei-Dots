import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSourceLinks, sourceUrls } from './article-content.mjs';
const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
test('printed source links expose their actual destination only in print', () => {
  const before = css.slice(0, css.indexOf('@media print{'));
  assert.doesNotMatch(before, /\.article-sources a::after/);
  assert.match(css, /@media print\{[\s\S]*\.article-sources a::after\{content:" \(" attr\(href\) "\)";[^}]*overflow-wrap:anywhere;word-break:break-word/);
  assert.match(css, /\.article-sources li\{margin-bottom:8pt\}/);
});
test('print destinations use the unchanged reviewed link, not a shortened label', () => {
  for (const url of sourceUrls) {
    const rendered = renderSourceLinks([{url, label:'公开来源'}], escape);
    assert.ok(rendered.includes(`href="${escape(url)}"`));
    assert.match(rendered, />公开来源<\/a>/);
    assert.doesNotMatch(rendered, /style=|onclick=/);
  }
  assert.equal(renderSourceLinks([], escape), '');
});
