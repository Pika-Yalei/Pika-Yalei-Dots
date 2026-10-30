import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderReaderSettings } from './reader-settings.mjs';
import { renderReaderPalette } from './reader-palette.mjs';
import { renderReaderLayout } from './reader-layout.mjs';
import { renderReaderControls } from './reader-controls.mjs';
import { renderTopicFocus } from './topic-focus.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const settings = renderReaderSettings();

test('native settings disclosure is initially closed and contains only the three appearance groups', () => {
  assert.match(settings, /^<details class="reader-settings"><summary>阅读设置：配色、版式、字号<\/summary>/);
  assert.match(settings, /<\/details>$/);
  assert.equal((settings.match(/<details/g)||[]).length, 1);
  assert.equal((settings.match(/<summary/g)||[]).length, 1);
  for (const render of [renderReaderPalette, renderReaderLayout, renderReaderControls]) assert.ok(settings.includes(render()));
  assert.equal((settings.match(/<fieldset/g)||[]).length, 3);
  assert.match(settings, /收起不会重置/);
  assert.doesNotMatch(settings, /<details[^>]*\bopen\b|aria-expanded|role=|tabindex=|class="prose"|news-focus|<section|\bid=/);
  assert.equal((settings.match(/ checked/g)||[]).length, 2);
  assert.match(settings, /name="reader-palette" value="auto" checked/);
  assert.match(settings, /name="reader-size" value="default" checked/);
});

test('every article keeps topic controls and prose outside the collapsed panel but within reader scope', () => {
  for (const post of JSON.parse(read('../content/posts.json'))) {
    const html = read(`../dist/notes/${post.slug}/index.html`);
    const expected = `<div class="article-reader">${renderTopicFocus(post)}${settings}<div class="prose">`;
    assert.ok(html.includes(expected), post.slug);
    assert.equal((html.match(/class="reader-settings"/g)||[]).length, 1);
    const start = html.indexOf('<details class="reader-settings">');
    const end = html.indexOf('</details>', start) + '</details>'.length;
    assert.equal(html.slice(start, end), settings);
    assert.ok(end <= html.indexOf('<div class="prose">'));
  }
  for (const file of ['index.html', 'feed.xml', 'feed.json', 'calendar/index.html']) assert.doesNotMatch(read(`../dist/${file}`), /reader-settings/);
});

test('disclosure preserves native keyboard semantics and indicators, no-has fallback and print', () => {
  const css = read('../public/reader-controls.css');
  const block = css.split('/* Compact, native disclosure')[1];
  assert.match(block, /\.reader-settings\{display:none\}/);
  assert.match(block, /@supports selector\(:has\(input:checked\)\)\{\s+@media screen\{/);
  assert.match(block, /\.reader-settings>summary\{min-height:44px;/);
  assert.match(block, /\.reader-settings>summary:focus-visible\{outline:2px solid var\(--green\)/);
  assert.match(block, /@media print\{\.reader-settings\{display:none\}\}/);
  assert.match(block, /forced-colors:active/);
  assert.doesNotMatch(block, /list-style|::marker|appearance:none|display:flex|display:grid|forced-color-adjust/);
  // Preference selectors continue matching hidden checked descendants after closing.
  const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1]);
  for (const selector of selectors.filter(selector => selector.includes('.article-reader:has('))) {
    assert.doesNotMatch(selector, /reader-settings|\[open\]/);
  }
});

test('grouping does not introduce persistence, executable content, external requests or submitted forms', () => {
  assert.doesNotMatch(settings, /<script|<form|on\w+=|localStorage|sessionStorage|document\.cookie|https?:|style=/i);
});
