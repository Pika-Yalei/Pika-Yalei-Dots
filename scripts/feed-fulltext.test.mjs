import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderFeed, siteUrl } from './feed.mjs';

// Decode exactly one XML entity layer, as an RSS parser does before handing
// content:encoded to its HTML renderer. Never recursively decode text entities.
const decodeXml = value => value.replace(/&(amp|lt|gt|quot|apos);/g,
  (_, entity) => ({amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"}[entity]));
const contents = feed => [...feed.matchAll(/<content:encoded>([\s\S]*?)<\/content:encoded>/g)]
  .map(match => decodeXml(match[1]));
const fixture = {
  slug: 'full-article', date: '2026-10-16', title: '文章标题', category: '手记',
  summary: '保留的简短摘要', subtitle: '开篇副标题',
  sections: [{heading:'第一节', paragraphs:['第一段', '第二段']},
    {heading:'第二节', paragraphs:['第三段']}], closing: '结束语'
};

test('full-text RSS declares the standard content namespace and preserves article order', () => {
  const feed = renderFeed([fixture]);
  assert.match(feed, /xmlns:content="http:\/\/purl.org\/rss\/1.0\/modules\/content\/"/);
  assert.deepEqual(contents(feed), [
    '<p>开篇副标题</p>\n<h2>第一节</h2>\n<p>第一段</p>\n<p>第二段</p>\n<h2>第二节</h2>\n<p>第三段</p>\n<p>结束语</p>\n<p>AI 撰写 · 通用观察，不涉及真实私人事件</p>'
  ]);
  assert.ok(feed.includes(`<description>${fixture.summary}</description>`));
  assert.ok(feed.includes(`<guid isPermaLink="true">${siteUrl}/notes/full-article/</guid>`));
  assert.ok(feed.includes('<pubDate>Fri, 16 Oct 2026 00:00:00 GMT</pubDate>'));
});

test('both XML and HTML layers keep hostile article text inert and valid', () => {
  const hostile = `<script>alert("x")</script><img src=x onerror='bad'> &lt;svg&gt; ]]> & 中文 😀\u0000\ud800`;
  const post = {...fixture, subtitle: hostile, closing: hostile,
    sections: [{heading:hostile, paragraphs:[hostile]}]};
  const feed = renderFeed([post]);
  assert.doesNotMatch(feed, /<!\[CDATA\[|\]\]>|<script|<img|\u0000|\ud800/u);
  const [html] = contents(feed);
  assert.doesNotMatch(html, /<script|<img|<svg|\u0000|\ud800/u);
  const safe = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=&apos;bad&apos;&gt; &amp;lt;svg&amp;gt; ]]&gt; &amp; 中文 😀\uFFFD\uFFFD';
  assert.equal(html, `<p>${safe}</p>\n<h2>${safe}</h2>\n<p>${safe}</p>\n<p>${safe}</p>\n<p>AI 撰写 · 通用观察，不涉及真实私人事件</p>`);
});

test('published articles include every section and remain deterministic without mutations', async () => {
  const posts = JSON.parse(await readFile(new URL('../content/posts.json', import.meta.url), 'utf8'));
  const before = structuredClone(posts);
  const feed = renderFeed(posts);
  assert.equal(renderFeed([...posts].reverse()), feed);
  assert.deepEqual(posts, before);
  const ordered = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const articles = contents(feed);
  assert.equal(articles.length, posts.length);
  for (const [index, post] of ordered.entries()) {
    const text = decodeXml(articles[index].replace(/<\/?(?:p|h2)>/g, ''));
    for (const value of [post.subtitle, ...post.sections.flatMap(s => [s.heading, ...s.paragraphs]), post.closing]) {
      assert.ok(text.includes(value));
    }
  }
});

test('empty feeds and legacy summary-only inputs remain supported', () => {
  assert.deepEqual(contents(renderFeed([])), []);
  const {subtitle, sections, closing, ...summaryOnly} = fixture;
  const feed = renderFeed([summaryOnly]);
  assert.doesNotMatch(feed, /undefined|null|Invalid Date/);
  assert.deepEqual(contents(feed), ['<p>AI 撰写 · 通用观察，不涉及真实私人事件</p>']);
  assert.ok(feed.includes(`<description>${fixture.summary}</description>`));
});
