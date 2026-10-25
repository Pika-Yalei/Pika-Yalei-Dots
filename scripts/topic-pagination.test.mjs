import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTopics, paginateTopics, renderTopicPage, renderTopics, topicPageSize } from './topics.mjs';

const makePosts = count => Array.from({length:count}, (_, index) => ({
  slug:`news-${String(index).padStart(3, '0')}`, date:'2026-10-24', title:`新闻 ${index}`,
  category:'新闻回顾', sections:[{heading:'AI｜测试'}, {heading:'商业｜测试'}]
}));

test('topic pages have bounded entries, one canonical first page and no lost or repeated chapters', () => {
  for (const count of [0, 1, topicPageSize, topicPageSize + 1, topicPageSize * 2, topicPageSize * 2 + 1]) {
    const posts = makePosts(count);
    const pages = paginateTopics(posts);
    for (const topic of collectTopics(posts)) {
      const topicPages = pages.filter(page => page.id === topic.id);
      assert.equal(topicPages.length, Math.max(1, Math.ceil(topic.entries.length / topicPageSize)));
      assert.deepEqual(topicPages.flatMap(page => page.entries), topic.entries);
      assert.equal(topicPages[0].path, `/topics/${topic.id}/`);
      for (const page of topicPages) {
        assert.ok(page.entries.length <= topicPageSize);
        assert.equal(page.count, topic.entries.length);
        assert.equal(page.offset, (page.number - 1) * topicPageSize);
        assert.equal(page.path, page.number === 1 ? `/topics/${topic.id}/` : `/topics/${topic.id}/page/${page.number}/`);
      }
    }
  }
});

test('date and slug ordering is stable and pagination never mutates input', () => {
  const posts = makePosts(9).reverse();
  posts[0].date = '2026-10-23';
  const before = JSON.stringify(posts);
  const pages = paginateTopics(posts);
  assert.equal(JSON.stringify(posts), before);
  assert.deepEqual(pages, paginateTopics([...posts].reverse()));
  assert.equal(pages[0].entries[0].title, '新闻 0');
  assert.equal(pages.filter(page => page.id === 'ai').at(-1).entries.at(-1).date, '2026-10-23');
});

test('overview keeps old anchors and limits visible chapters per topic', () => {
  const html = renderTopics(makePosts(20));
  assert.equal([...html.matchAll(/<time /g)].length, topicPageSize * 2);
  assert.match(html, /id="ai" tabindex="-1"/);
  assert.match(html, /href="\/topics\/ai\/">查看AI全部 20 个章节/);
  assert.doesNotMatch(html, /page\/1\//);
});

test('all page navigation resolves locally, handles empty pages and distinguishes current page', () => {
  const pages = paginateTopics(makePosts(20));
  const paths = new Set([...pages.map(page => page.path), ...pages.flatMap(page => [`/topics/${page.id}/feed.xml`, `/topics/${page.id}/feed.json`])]);
  for (const page of pages) {
    const html = renderTopicPage(page);
    for (const [, href] of html.matchAll(/href="(\/topics\/[^"#]+)"/g)) assert.ok(paths.has(href), href);
    assert.ok(html.includes(`href="/topics/#${page.id}"`));
    assert.equal(html.includes('rel="prev"'), page.number > 1);
    assert.equal(html.includes('rel="next"'), page.number < page.total);
    assert.equal(html.includes('aria-current="page">第'), page.total > 1);
    assert.doesNotMatch(html, /page\/1\//);
  }
  const empty = renderTopicPage(paginateTopics([])[0]);
  assert.match(empty, /暂时没有新闻章节/);
  assert.doesNotMatch(empty, /显示第|class="pagination"/);
});

test('topic pages escape content and keep exact historical article fragment URLs', () => {
  const posts = makePosts(1);
  posts[0].title = '<script> & "quoted"';
  posts[0].sections[0].heading = 'AI｜<img src=x>';
  const page = paginateTopics(posts)[0];
  const html = renderTopicPage(page);
  assert.match(html, /AI｜&lt;img src=x&gt;/);
  assert.match(html, /&lt;script&gt; &amp; &quot;quoted&quot;/);
  assert.doesNotMatch(html, /<script>|<img /);
  assert.ok(html.includes(`href="${page.entries[0].href}"`));
});
