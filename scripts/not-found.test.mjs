import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNotFound } from './not-found.mjs';

test('missing pages offer the three newest notes in deterministic order without mutating input', () => {
  const posts = [
    {slug:'old', date:'2025-01-01', title:'Old'},
    {slug:'z', date:'2026-01-01', title:'Z'},
    {slug:'a', date:'2026-01-01', title:'A'},
    {slug:'new', date:'2026-02-01', title:'New'}
  ];
  const snapshot = structuredClone(posts);
  const html = renderNotFound(posts);
  assert.deepEqual([...html.matchAll(/href="\/notes\/([^/]+)\/"/g)].map(match => match[1]), ['new','a','z']);
  assert.deepEqual(posts, snapshot);
  assert.match(html, /datetime="2026-02-01">2026.02.01/);
  assert.match(html, /aria-labelledby="recent-notes"/);
});
test('empty sites still give useful home and archive exits without an empty section', () => {
  const html = renderNotFound([]);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/archive\/"/);
  assert.doesNotMatch(html, /recent-notes|<ul/);
  assert.equal([...html.matchAll(/<h1>/g)].length, 1);
});
test('suggested titles stay text and cannot inject HTML', () => {
  const html = renderNotFound([{slug:'safe', date:'2026-10-16', title:'<img src=x> & "Title"'}]);
  assert.match(html, /&lt;img src=x&gt; &amp; &quot;Title&quot;/);
  assert.doesNotMatch(html, /<img/);
});
