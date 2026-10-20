// Palette arithmetic and CSS contracts do not replace real-browser visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../public/style.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
function mediaBlock(query) {
  const start = css.indexOf(query);
  assert.notEqual(start, -1, query);
  let end = css.indexOf('{', start) + 1;
  const body = end;
  let depth = 1;
  while (end < css.length && depth) {
    if (css[end] === '{') depth++;
    if (css[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return css.slice(body, end - 1);
}
const darkQuery = '@media screen and (prefers-color-scheme:dark)';
const dark = mediaBlock(darkQuery);
const print = mediaBlock('@media print');
const forced = mediaBlock('@media screen and (forced-colors:active)');
const rootDeclarations = text => text.match(/:root\{([^}]+)\}/)[1];
const palette = text => Object.fromEntries([...rootDeclarations(text).matchAll(/(--[a-z-]+):(#[0-9a-f]{6});?/g)].map(([, key, value]) => [key, value]));
const lightPalette = palette(css);
const darkPalette = palette(dark);
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [name, colors] of [['light', lightPalette], ['dark', darkPalette]]) {
  test(name + ' text colors meet WCAG AA normal-text contrast', () => {
    // Muted disclosures/metadata, small accent links, numbered indexes, and note captions.
    const pairs = [
      ['--ink', '--paper'], ['--muted', '--paper'], ['--green', '--paper'],
      ['--index', '--paper'], ['--separator', '--paper'],
      ['--ink', '--wash'], ['--green', '--wash'], ['--note-muted', '--wash'],
      ['--selection-ink', '--selection'], ['--paper', '--ink'],
    ];
    for (const [foreground, background] of pairs) {
      const contrast = ratio(colors[foreground], colors[background]);
      assert.ok(contrast >= 4.5, name + ' ' + foreground + '/' + background + ': ' + contrast.toFixed(2));
    }
  });
  test(name + ' focus indicators and note rules contrast with their surfaces', () => {
    for (const [foreground, background] of [['--green', '--paper'], ['--green', '--wash'], ['--note-rule', '--wash']]) {
      assert.ok(ratio(colors[foreground], colors[background]) >= 3, name + ' ' + foreground + '/' + background);
    }
  });
}

test('dark mode changes only palette tokens and native color scheme on screens', () => {
  assert.equal([...css.matchAll(/prefers-color-scheme/g)].length, 1);
  assert.match(rootDeclarations(css), /color-scheme:light;/);
  assert.match(rootDeclarations(dark), /color-scheme:dark;/);
  assert.deepEqual(Object.keys(darkPalette).sort(), Object.keys(lightPalette).sort());
  assert.equal(dark.trim(), ':root{' + rootDeclarations(dark) + '}');
  for (const declaration of rootDeclarations(dark).split(';').filter(Boolean)) {
    assert.match(declaration, /^(?:--[a-z-]+:#[0-9a-f]{6}|color-scheme:dark)$/);
  }
  // New paint should use tokens rather than bypassing the theme on a component.
  const withoutRoots = css.replace(/:root\{[^}]*\}/g, '');
  assert.doesNotMatch(withoutRoots, /#[0-9a-f]{3,8}\b/i);
  assert.match(css, /::selection\{background:var\(--selection\);color:var\(--selection-ink\)\}/);
  assert.match(css, /\.skip\{[^}]*background:var\(--ink\);color:var\(--paper\)/);
  assert.match(css, /\.skip:focus\{[^}]*color:var\(--paper\)/);
});

test('print stays light and forced colors override all authored palette tokens', () => {
  assert.ok(css.indexOf(darkQuery) < css.indexOf('@media print'));
  assert.ok(css.indexOf(darkQuery) < css.indexOf('@media screen and (forced-colors:active)'));
  assert.match(print, /color-scheme:light;/);
  assert.match(print, /body\{background:white;color:black\}/);
  assert.match(print, /--paper:#fff;--wash:#fff;/);
  for (const key of Object.keys(darkPalette)) {
    assert.match(rootDeclarations(forced), new RegExp(key + ':(?:Canvas|CanvasText|Highlight|HighlightText)(?:;|$)'));
  }
  assert.doesNotMatch(css, /forced-color-adjust\s*:\s*none/);
});

test('every page declares both color schemes before stylesheet loading', async () => {
  // Existing metadata fixture builds all page types, including the 404.
  const build = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
  assert.equal([...build.matchAll(/<meta name="color-scheme" content="light dark">/g)].length, 1);
  assert.ok(build.indexOf('name="color-scheme"') < build.indexOf('rel="stylesheet"'));
  assert.doesNotMatch(build, /localStorage|sessionStorage|document\.cookie|<script\b/i);
});
