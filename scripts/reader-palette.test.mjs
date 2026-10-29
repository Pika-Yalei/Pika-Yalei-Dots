import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderReaderPalette } from './reader-palette.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../public/reader-controls.css');
const paletteCss = css.slice(css.indexOf('/* Page-local palette:')).split('/* No :has means')[0];
const palettes = Object.fromEntries(['light', 'dark'].map(mode => {
  const selector = `.article-reader:has(input[name="reader-palette"][value="${mode}"]:checked)`;
  const declarations = paletteCss.slice(paletteCss.indexOf(selector) + selector.length + 1).split('}')[0];
  return [mode, Object.fromEntries([...declarations.matchAll(/(--[a-z-]+):(#[0-9a-f]{6})/g)].map(([, k, v]) => [k, v]))];
}));
function luminance(hex) {
  return hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
}
function ratio(a, b) { const [hi, lo] = [luminance(a), luminance(b)].sort((a,b) => b-a); return (hi+.05)/(lo+.05); }
test('native labelled radio group defaults to system, with an explicit reset choice', () => {
  const html = renderReaderPalette();
  assert.match(html, /<legend>阅读配色<\/legend>/);
  assert.equal((html.match(/<label><input type="radio" name="reader-palette"/g)||[]).length, 3);
  assert.equal((html.match(/ checked/g)||[]).length, 1);
  assert.match(html, /value="auto" checked/);
  assert.match(html, /选择“跟随系统”恢复/);
  assert.doesNotMatch(html, /tabindex|onclick|script|style=/);
});
test('paint is confined to screen reading region and defers to forced colors', () => {
  assert.match(paletteCss, /\.reader-palette\{display:none\}/);
  assert.match(paletteCss, /@supports selector\(:has\(input:checked\)\)/);
  assert.match(paletteCss, /@media screen and \(forced-colors:none\)/);
  assert.match(paletteCss, /@media print\{\.reader-palette\{display:none\}\}/);
  assert.match(paletteCss, /min-width:44px;min-height:44px/);
  assert.match(paletteCss, /input:focus-visible/);
  assert.doesNotMatch(paletteCss, /:root|body\{|value="auto"|forced-color-adjust|url\(/);
  for (const mode of ['light', 'dark']) {
    assert.match(paletteCss, new RegExp(`color-scheme:${mode};`));
    assert.equal(Object.keys(palettes[mode]).length, 12);
  }
  // Palette selection cannot change font size, width, or spacing modes.
  for (const rule of paletteCss.matchAll(/\.article-reader[^{}]+\{([^}]+)\}/g)) {
    for (const property of rule[1].split(';').map(d => d.split(':')[0])) {
      assert.ok(property.startsWith('--') || ['color-scheme', 'background', 'color'].includes(property), property);
    }
  }
});
for (const [mode, colors] of Object.entries(palettes)) test(`${mode} prose, citations, links, selection and boundaries have sufficient contrast`, () => {
  for (const bg of ['--paper', '--wash']) {
    for (const fg of ['--ink', '--muted', '--green', '--note-muted', '--index', '--separator']) {
      assert.ok(ratio(colors[fg], colors[bg]) >= 4.5, `${mode}: ${fg}/${bg}`);
    }
    for (const fg of ['--line', '--green', '--note-rule']) assert.ok(ratio(colors[fg], colors[bg]) >= 3, `${mode}: boundary ${fg}/${bg}`);
  }
  assert.ok(ratio(colors['--selection-ink'], colors['--selection']) >= 4.5);
});
test('article build contains one palette alongside both existing controls, never in feeds or index', () => {
  const posts = JSON.parse(read('../content/posts.json'));
  for (const post of posts) {
    const html = read(`../dist/notes/${post.slug}/index.html`);
    assert.equal((html.match(/class="reader-palette"/g)||[]).length, 1);
    assert.match(html, /<div class="article-reader"><fieldset class="reader-palette">/);
    for (const name of ['reader-size', 'reader-narrow', 'reader-spaced']) assert.ok(html.includes(`name="${name}"`));
  }
  for (const file of ['index.html', 'feed.xml', 'feed.json']) assert.doesNotMatch(read(`../dist/${file}`), /reader-palette/);
});
test('page-local preference adds no persistence, executable client code or requests', () => {
  assert.doesNotMatch(renderReaderPalette() + paletteCss, /localStorage|sessionStorage|document\.cookie|<script|https?:|url\(/i);
});
