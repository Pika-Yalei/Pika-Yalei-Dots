import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePosts } from './validate-posts.mjs';
import { articleText, publishedAt, publicationText, renderSourceLinks, sourceUrls } from './article-content.mjs';
import { renderFeed } from './feed.mjs';
import { renderJsonFeed } from './json-feed.mjs';
const url = 'https://github.com/simonw/llm/pull/1771';
const source = {label: '公开 PR <script> & "来源"', url};
const post = () => ({slug: 'retrospective', date: '2026-10-14', publishedAt: '2026-10-20T06:00:00Z', title: '回顾', subtitle: '副标题', category: '新闻回顾', summary: '摘要', readingMinutes: 3, sections: [{heading: '来源', paragraphs: ['正文'], sources: [source]}], closing: '小结'});
const decodeXml = text => text.replace(/&(amp|lt|gt|quot|apos);/g, (_, key) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]));

test('backfill timestamp is exact, real UTC and separately exposed from review date', () => {
  validatePosts([post()]);
  assert.equal(publishedAt(post()), '2026-10-20T06:00:00Z');
  assert.match(publicationText(post()), /回顾日期：2026-10-14；补发时间：2026-10-20 14:00:00（北京时间）/);
  for (const value of [null, '', '2026-10-20', '2026-02-30T00:00:00Z', '2026-10-20T24:00:00Z', '2026-10-20T06:00:00+00:00']) {
    assert.throws(() => validatePosts([{...post(), publishedAt:value}]), /publishedAt/);
  }
});
test('only exact reviewed HTTPS sources with no credentials or extra fields are accepted', () => {
  assert.ok(sourceUrls.has(url));
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', '//github.com/simonw/llm/pull/1771', 'http://github.com/simonw/llm/pull/1771', 'https://user:pass@github.com/simonw/llm/pull/1771', `${url}?token=unreviewed`, 'https://unreviewed.example/news', '\n'+url]) {
    const fixture = post(); fixture.sections[0].sources[0] = {...source,url:value};
    assert.throws(() => validatePosts([fixture]), /sources\[0\]\.url/);
    assert.throws(() => renderFeed([fixture]), /Unreviewed source URL/);
  }
  for (const sources of [null, [], [{...source, privateNote:'not allowed'}], [{url, label:' '}]]) {
    const fixture=post(); fixture.sections[0].sources=sources;
    assert.throws(() => validatePosts([fixture]), /sources/);
  }
});
test('RSS and JSON retain source URLs, honest publication metadata and safe escaping', () => {
  const fixture=post();
  const feed=renderFeed([fixture]);
  assert.match(feed, /<pubDate>Tue, 20 Oct 2026 06:00:00 GMT<\/pubDate>/);
  const html=decodeXml(feed.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)[1]);
  assert.ok(html.includes(`href="${url}" rel="noreferrer"`));
  assert.match(html, /&lt;script&gt; &amp; &quot;来源&quot;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /不是当日即时刊发/);
  const item=JSON.parse(renderJsonFeed([fixture])).items[0];
  assert.equal(item.date_published, fixture.publishedAt);
  assert.equal(item.content_text, articleText(fixture));
  assert.ok(item.content_text.includes(url));
  assert.ok(item.content_text.includes(source.label));
});
