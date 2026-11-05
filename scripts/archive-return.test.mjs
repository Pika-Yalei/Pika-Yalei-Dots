import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderArchive } from './archive.mjs';

const post = (slug, date) => ({slug, date, title: slug});
const posts = [post('new', '2026-11-01'), post('older', '2026-10-01'), post('oldest', '2025-12-01')];

test('each archive month ends with a native return to one focusable month directory', () => {
  const html = renderArchive(posts);
  assert.equal((html.match(/id="archive-months-title"/g) || []).length, 1);
  assert.match(html, /<h2 id="archive-months-title" tabindex="-1">/);
  const months = [...html.matchAll(/<section class="archive-month"[\s\S]*?<\/section>/g)].map(match => match[0]);
  assert.equal(months.length, 3);
  for (const month of months) {
    assert.equal((month.match(/href="#archive-months-title"/g) || []).length, 1);
    assert.match(month, /<\/ol><p class="archive-month-return"><a class="back-link" href="#archive-months-title">↑ 返回月份目录<\/a><\/p><\/section>$/);
  }
  assert.doesNotMatch(html, /onclick|<script|tabindex="0"/);
});

test('archive with no month chooser has no dangling return link', () => {
  for (const entries of [[], [posts[0]], [posts[0], post('same-month', '2026-11-02')]]) {
    assert.doesNotMatch(renderArchive(entries), /archive-month-return|archive-months-title/);
  }
});

test('return links preserve historical article order and destination URLs', () => {
  const html = renderArchive([...posts].reverse());
  assert.deepEqual([...html.matchAll(/href="(\/notes\/[^\"]+)"/g)].map(match => match[1]), ['/notes/new/', '/notes/older/', '/notes/oldest/']);
  for (const month of ['2026-11', '2026-10', '2025-12']) {
    assert.ok(html.includes(`href="#month-${month}"`));
    assert.ok(html.includes(`id="month-${month}"`));
    assert.ok(html.includes(`href="/archive/${month}/"`));
  }
});

test('return focus is visible with spacing, forced colors and no printed control', () => {
  const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
  const rules = css.slice(css.indexOf('/* Long date archives'), css.indexOf('/* Printed copies keep'));
  assert.ok(css.indexOf('#archive-months-title:focus{outline:2px solid Highlight;outline-offset:7px}') > css.indexOf('#archive-months-title:focus{outline:2px'));
  assert.match(rules, /@media screen\{\s*#archive-months-title\{scroll-margin-top:24px\}/);
  assert.match(rules, /#archive-months-title:focus\{outline:2px solid var\(--green\);outline-offset:7px\}/);
  assert.match(css, /@media screen and \(forced-colors:active\)\{\s*#archive-months-title:focus\{outline:2px solid Highlight;outline-offset:7px\}/);
  assert.match(css, /@media print\{\s*\.archive-month-return\{display:none\}/);
  // Reuse the established back-link hit area instead of creating overlapping targets.
  assert.match(css, /:is\([^)]*\.back-link[^)]*\)\{[^}]*min-width:44px;[^}]*min-height:44px/);
});
