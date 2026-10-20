// Dependency-free CSS contract checks, not a substitute for Windows browser QA.
// Run with node --test scripts/forced-colors.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../public/style.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
const matches = [...css.matchAll(/@media\s+screen\s+and\s*\(forced-colors:\s*active\)\s*\{/g)];
assert.equal(matches.length, 1, 'Keep high-contrast screen overrides in one auditable block');
const start = matches[0].index + matches[0][0].length;
let end = start;
let depth = 1;
for (; end < css.length && depth; end += 1) {
  if (css[end] === '{') depth += 1;
  if (css[end] === '}') depth -= 1;
}
assert.equal(depth, 0, 'High-contrast rules must be balanced');
const block = css.slice(start, end - 1);
const rules = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, declarations]) => ({
  selectors: selectors.split(',').map(selector => selector.trim()),
  declarations: Object.fromEntries(declarations.split(';').filter(part => part.trim()).map(part => {
    const colon = part.indexOf(':');
    return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
  })),
}));
function style(selector) {
  return Object.assign({}, ...rules.filter(rule => rule.selectors.includes(selector)).map(rule => rule.declarations));
}

test('high contrast uses native system colors without disabling user overrides', () => {
  assert.doesNotMatch(css, /forced-color-adjust\s*:\s*none/i);
  assert.deepEqual(style(':root'), {
    '--paper': 'Canvas', '--ink': 'CanvasText', '--muted': 'CanvasText',
    '--line': 'CanvasText', '--green': 'CanvasText', '--wash': 'Canvas',
    '--selection': 'Highlight', '--selection-ink': 'HighlightText',
    '--note-muted': 'CanvasText', '--note-rule': 'CanvasText',
    '--index': 'CanvasText', '--separator': 'CanvasText',
  });
  assert.deepEqual(style('::selection'), { background: 'Highlight', color: 'HighlightText' });
});

test('links and the current page retain distinct non-color indicators', () => {
  assert.equal(style(':root a:any-link')['text-decoration-line'], 'underline');
  assert.equal(style(':root a:any-link').color, 'LinkText');
  assert.equal(style(':root a:visited').color, 'VisitedText');
  const current = style(':root nav a[aria-current="page"]');
  assert.equal(current['text-decoration-style'], 'double');
  assert.equal(current['text-decoration-thickness'], '2px');
  assert.equal(current['box-shadow'], 'none');
});

test('keyboard and fragment focus retain visible system-color outlines', () => {
  for (const selector of [':root a:focus-visible', '#main:focus', '.prose h2[id]:focus', '#article-top:focus']) {
    assert.equal(style(selector).outline, '2px solid Highlight', selector);
    assert.equal(style(selector)['outline-offset'], '7px', selector);
  }
  for (const selector of [':root .skip', ':root .skip:focus']) {
    assert.equal(style(selector).background, 'Canvas');
    assert.equal(style(selector).color, 'LinkText');
    assert.equal(style(selector).outline, '2px solid Highlight');
  }
});

test('note and quote boundaries survive removed backgrounds without layout changes', () => {
  assert.equal(style('.margin-note').outline, '1px solid CanvasText');
  assert.equal(style('.closing-note')['border-left-color'], 'CanvasText');
  assert.equal(style('.article-contents')['border-color'], 'CanvasText');
  // Only paint properties are allowed: do not alter widths, wrapping, or mobile visibility.
  const paintProperties = new Set([
    'color', 'background', 'outline', 'outline-offset', 'border-left-color', 'border-color',
    'text-decoration-line', 'text-decoration-style', 'text-decoration-thickness', 'box-shadow',
  ]);
  for (const rule of rules) {
    for (const property of Object.keys(rule.declarations)) {
      assert.ok(property.startsWith('--') || paintProperties.has(property), `Unexpected layout property: ${property}`);
    }
  }
});
