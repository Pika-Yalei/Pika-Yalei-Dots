// Dependency-free CSS contracts. These do not measure browser layout or replace
// checking 320 CSS-pixel viewports and enlarged default fonts in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../public/style.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
// Printed type intentionally uses physical point sizes, independent of the
// reader's screen preference. Remove that block before checking screen rules.
const printStart = css.indexOf('@media print{');
assert.notEqual(printStart, -1);
let printEnd = css.indexOf('{', printStart) + 1;
let depth = 1;
for (; printEnd < css.length && depth; printEnd += 1) {
  if (css[printEnd] === '{') depth += 1;
  if (css[printEnd] === '}') depth -= 1;
}
assert.equal(depth, 0);
const screen = css.slice(0, printStart) + css.slice(printEnd);

test('screen type follows the reader’s default font without setting a fixed root size', () => {
  const sizes = [...screen.matchAll(/\bfont(?:-size)?\s*:\s*([^;}]+)/g)].map(([, value]) => value);
  assert.ok(sizes.length > 30, 'Check all screen type, including compact metadata');
  for (const value of sizes) {
    assert.doesNotMatch(value, /\d(?:px|pt|pc|in|cm|mm)\b/, value);
    assert.match(value, /\drem\b/, value);
  }
  assert.doesNotMatch(screen, /(?:^|[{}])\s*(?::root|html)\s*\{[^}]*font-size:/);
  assert.match(screen, /font-size:clamp\(2\.375rem,4\.5vw,3\.5rem\)/);
  assert.match(screen, /\.prose\s*\{[^}]*font-size:1\.0625rem/);
  assert.match(screen, /font:italic 1\.75rem var\(--serif\)/);
});

test('responsive breakpoints and number columns grow with preferred text size', () => {
  const breakpoints = [...screen.matchAll(/\((?:min|max)-width:([^)]+)\)/g)].map(([, value]) => value);
  assert.ok(breakpoints.includes('43.75em'));
  assert.ok(breakpoints.includes('93.75em'));
  assert.ok(breakpoints.every(value => /em$/.test(value)));
  assert.match(screen, /grid-template-columns:5rem minmax\(0,1fr\)/);
  assert.match(screen, /grid-template-columns:2\.25rem minmax\(0,1fr\)/);
  // The character inside the brand stamp must not outgrow its frame.
  for (const [, declarations] of screen.matchAll(/\.brand-mark\s*\{([^}]+)\}/g)) {
    for (const [, dimension] of declarations.matchAll(/(?:width|height):([^;]+)/g)) {
      assert.match(dimension, /^[\d.]+em$/);
    }
  }
});

test('surrounding chrome can wrap and shrink without hiding oversized text', () => {
  assert.match(screen, /\.site-header,\.site-header nav,\.section-label\s*\{flex-wrap:wrap\}/);
  assert.match(screen, /\.brand,\.site-header nav,\.hero>div,\.home-aside>p,\.site-footer>span\s*\{min-width:0;overflow-wrap:anywhere\}/);
  assert.match(screen, /\.brand,\.site-header nav\s*\{max-width:100%\}/);
  assert.match(screen, /\.brand>span:last-child\s*\{min-width:0\}/);
  assert.match(screen, /\.brand-mark,\.aside-symbol\s*\{flex-shrink:0\}/);
  assert.doesNotMatch(screen, /(?:\.site-wrap|\.site-header|\.site-footer|\.hero|\.brand|\.site-header nav)\s*\{[^}]*(?:overflow(?:-x|-y)?:\s*(?:hidden|clip)|text-overflow:|(?:^|;)height:)/);
});
