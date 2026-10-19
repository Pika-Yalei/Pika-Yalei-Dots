import test from 'node:test';
import assert from 'node:assert/strict';
import {renderArchive} from './archive.mjs';

const post = (slug, date, title = slug) => ({slug, date, title});
const navigation = html => html.match(/<nav class="article-contents"[^>]*>[\s\S]*?<\/nav>/)?.[0];

test('archive month navigation sorts across years, includes counts and leaves input untouched', () => {
  const posts = [
    post('previous-october', '2025-10-31'),
    post('z', '2026-10-19'),
    post('february', '2026-02-01'),
    post('a', '2026-10-19'),
    post('newest', '2026-10-20')
  ];
  const before = JSON.stringify(posts);
  const html = renderArchive(posts);
  const nav = navigation(html);
  assert.ok(nav);
  assert.match(nav, /aria-labelledby="archive-months-title"><h2 id="archive-months-title">按月份跳转<\/h2><ol>/);
  assert.deepEqual([...nav.matchAll(/href="([^"]+)">([^<]+)<\/a>/g)].map(([, href, label]) => [href, label]), [
    ['#month-2026-10', '2026 年 10 月 · 3 篇'],
    ['#month-2026-02', '2026 年 2 月 · 1 篇'],
    ['#month-2025-10', '2025 年 10 月 · 1 篇']
  ]);
  assert.ok(html.indexOf(nav) < html.indexOf('<section class="archive-year"'));
  assert.deepEqual([...html.matchAll(/href="\/notes\/([^/]+)\/"/g)].map(([, slug]) => slug), ['newest', 'a', 'z', 'february', 'previous-october']);
  assert.equal(JSON.stringify(posts), before);
  assert.equal(renderArchive([...posts].reverse()), html);
});

test('every month jump has exactly one keyboard-focusable heading target', () => {
  const html = renderArchive([
    post('new', '2026-01-01'), post('old', '2025-12-31'), post('older', '2025-01-01')
  ]);
  const links = [...navigation(html).matchAll(/href="#([^"]+)"/g)].map(([, id]) => id);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of links) {
    assert.equal(ids.filter(value => value === id).length, 1);
    assert.ok(html.includes(`<h3 tabindex="-1" id="${id}">`));
    assert.ok(html.includes(`aria-labelledby="${id}"`));
  }
  assert.doesNotMatch(html, /<script|\bonclick=|tabindex="[0-9]+"/);
});

test('empty and single-month archives omit unnecessary month navigation', () => {
  for (const posts of [[], [post('one', '2026-10-01')], [post('one', '2026-10-01'), post('two', '2026-10-31')]]) {
    const html = renderArchive(posts);
    assert.equal(navigation(html), undefined);
    assert.doesNotMatch(html, /archive-months-title|href="#month-/);
    assert.ok(html.includes(`共 ${posts.length} 篇手记`));
  }
  const empty = renderArchive([]);
  assert.match(empty, /第一篇正在路上/);
  assert.doesNotMatch(empty, /<section|<ol|<h3/);
});

test('archive retains escaped article titles and dates alongside static month links', () => {
  const html = renderArchive([post('example', '2026-10-01', '<img src=x> & "标题"'), post('older', '2026-09-01')]);
  assert.match(html, /&lt;img src=x&gt; &amp; &quot;标题&quot;/);
  assert.match(html, /<time datetime="2026-10-01">2026\.10\.01<\/time>/);
  assert.doesNotMatch(html, /<img|<script/);
});
