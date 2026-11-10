import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:root});
function pages(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? pages(file) : file.endsWith('.html') ? [file] : [];
  });
}
test('search is reachable in primary navigation on every page and current only on search', () => {
  for (const file of pages(path.join(root, 'dist'))) {
    const html = readFileSync(file, 'utf8');
    const nav = html.match(/<nav aria-label="主导航">([\s\S]*?)<\/nav>/)[1];
    assert.equal((nav.match(/href="\/search\/"/g) ?? []).length, 1);
    assert.match(nav, /<a href="\/search\/"(?: aria-current="page")?>搜索<\/a>/);
    assert.equal(nav.includes('href="/search/" aria-current="page"'), file === path.join(root,'dist/search/index.html'));
  }
});
test('primary navigation preserves wrapping and target size for the added search link', () => {
  const css = readFileSync(path.join(root, 'public/style.css'), 'utf8');
  assert.match(css, /\.site-header,\.site-header nav,\.section-label\{flex-wrap:wrap\}/);
  assert.match(css, /\.site-header nav\{max-width:100%\}/);
  assert.match(css, /\.site-header nav a/);
});
