import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNewsOutline } from './news-outline.mjs';
import { newsItemAnchors } from './reading-navigation.mjs';

const section = paragraphs => ({heading:'AI｜今日', paragraphs});

test('outline is omitted for missing, unnumbered and single-item content', () => {
  for (const input of [{heading:'AI'}, section([]), section(['介绍']), section(['1. 一条。分析。','续文'])]) {
    assert.equal(renderNewsOutline(input), '');
  }
});

test('native disclosure preserves numbered first sentences and skips continuation prose', () => {
  const html = renderNewsOutline(section(['介绍','1. 首条新闻。事实和分析。','补充限定','2. 次条新闻。更多事实。']));
  assert.match(html, /^<details class="news-outline"><summary>本栏速览（2条）<\/summary>/);
  assert.match(html, /<nav aria-label="AI｜今日新闻速览"><ul>/);
  assert.match(html, />1\. 首条新闻<\/a>/);
  assert.match(html, />2\. 次条新闻<\/a>/);
  assert.doesNotMatch(html, /介绍|补充限定|事实和分析|更多事实|<script|onclick|tabindex|role=/);
});

test('every outline link exactly matches the existing stable body anchor including duplicates', () => {
  const input = section(['1. 同名。第一条事实。','续文','2. 同名。第二条事实。','3. 另一条']);
  const targets = [...renderNewsOutline(input).matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(targets, newsItemAnchors(input).filter(Boolean));
  assert.equal(new Set(targets).size, 3);
  assert.match(targets[1], /-2$/);
});

test('labels and navigation names escape markup without creating attributes or elements', () => {
  const input = {heading:'AI " onclick="bad <img> &', paragraphs:['1. <script>alert(1)</script> & "quoted"。尾句。', "2. 'second' <svg>"]};
  const html = renderNewsOutline(input);
  assert.match(html, /aria-label="AI &quot; onclick=&quot;bad &lt;img&gt; &amp;新闻速览"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quoted&quot;/);
  assert.match(html, /&#39;second&#39; &lt;svg&gt;/);
  assert.doesNotMatch(html, /<script>|<img>|<svg>| onclick="/);
});

test('rendering is deterministic and leaves the section and source records untouched', () => {
  const input = {...section(['1. One。Context。','2. Two。Context。']),sources:[{label:'1. Source',url:'https://example.com/'}]};
  const before = JSON.stringify(input);
  const first = renderNewsOutline(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(renderNewsOutline(input), first);
  assert.doesNotMatch(first, /example\.com|Source/);
});

test('analysis changes and unrelated item insertions do not change existing targets', () => {
  const input = section(['1. First。Old detail。','2. Second。Old detail。']);
  const revised = section(['1. New item。Detail。','2. First。New detail。','3. Second。New detail。']);
  const targets = value => [...renderNewsOutline(value).matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(targets(revised).slice(1), targets(input));
});
