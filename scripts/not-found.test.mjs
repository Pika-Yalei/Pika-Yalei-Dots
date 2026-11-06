import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.doesNotMatch(html, /recent-notes|class="archive-list"/);
  assert.equal([...html.matchAll(/<h1>/g)].length, 1);
});
test('suggested titles stay text and cannot inject HTML', () => {
  const html = renderNotFound([{slug:'safe', date:'2026-10-16', title:'<img src=x> & "Title"'}]);
  assert.match(html, /&lt;img src=x&gt; &amp; &quot;Title&quot;/);
  assert.doesNotMatch(html, /<img/);
});


test('missing pages offer explicit keyword and date recovery without scripts or leaking the failed URL', () => {
  for (const posts of [[], [{slug:'safe', date:'2026-11-01', title:'Safe'}]]) {
    const html = renderNotFound(posts);
    assert.match(html, /<nav class="prose" aria-labelledby="recovery-title"><h2 id="recovery-title">/);
    assert.match(html, /href="\/search\/">按关键词搜索文章/);
    assert.match(html, /href="\/calendar\/">按回顾日期查看新闻/);
    assert.match(html, /href="\/sources\/">按引用来源查找/);
    assert.doesNotMatch(html, /<script|<form|\?q=|localStorage|document\.referrer/);
  }
});


test('built recovery routes all resolve without assuming the missing page location', () => {
  const html = readFileSync(new URL('../dist/404.html', import.meta.url), 'utf8');
  const panel = html.match(/<nav class="prose" aria-labelledby="recovery-title">[\s\S]*?<\/nav>/)[0];
  const hrefs = [...panel.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(hrefs, ['/search/', '/calendar/', '/sources/']);
  for (const href of hrefs) assert.match(readFileSync(new URL(`../dist${href}index.html`, import.meta.url), 'utf8'), /<h1/);
});
