import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTopics, renderTopics, renderTopicNavigation } from './topics.mjs';
import { newsColumns } from './news-window.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
import { validateLinks } from './validate-links.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const post = {slug:'news', date:'2026-10-21', title:'新闻 <标题>', category:'新闻回顾', sections:[{heading:'回顾范围与发布说明'}, ...newsColumns.map(name => ({heading:`${name}｜公开报道`}))]};

test('five fixed topics collect only exact news columns, newest first without mutation', () => {
  const older = {...post, slug:'older', date:'2026-10-20'};
  const unrelated = {...post, slug:'work', category:'困难复盘'};
  const input = [older, unrelated, post];
  const before = JSON.stringify(input);
  const topics = collectTopics(input);
  assert.deepEqual(topics.map(topic => topic.name), newsColumns);
  for (const topic of topics) {
    assert.equal(topic.entries.length, 2);
    assert.deepEqual(topic.entries.map(entry => entry.date), ['2026-10-21', '2026-10-20']);
    assert.ok(topic.entries[0].href.startsWith('/notes/news/#section-'));
  }
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(collectTopics([...input].reverse()), topics);
  assert.equal(renderTopicNavigation(unrelated), '');
  const unmatched = {...post, sections:[{heading:'AI 新闻'}, {heading:'简介｜AI'}, {heading:'商业回顾'}]};
  assert.ok(collectTopics([unmatched]).every(topic => topic.entries.length === 0));
});

test('exact historical labels map to modern columns without changing section anchors', () => {
  const historical = {...post, sections: ['股票', '中国政治', '国际政治'].map(name => ({heading:`${name}｜旧标题`}))};
  const topics = collectTopics([historical]);
  for (const [index, section] of sectionAnchors(historical.sections).entries()) {
    assert.equal(topics[index + 2].entries[0].href, `/notes/news/#${section.id}`);
  }
  const inserted = {...post, sections:[{heading:'新的说明'}, ...post.sections]};
  assert.deepEqual(collectTopics([inserted]), collectTopics([post]));
  const repeated = {...post, sections:[post.sections[1], post.sections[1]]};
  assert.equal(new Set(collectTopics([repeated])[0].entries.map(entry => entry.href)).size, 2);
});

test('empty states and dynamic index text are escaped; contents use focusable targets', () => {
  const empty = renderTopics([]);
  assert.equal([...empty.matchAll(/暂时没有新闻章节/g)].length, 5);
  assert.match(empty, /0 个章节/);
  const malicious = {...post, slug:'x"<tag>', sections:[{heading:'AI｜<img src=x> & "quoted"'}]};
  const html = renderTopics([malicious]);
  assert.match(html, /AI｜&lt;img src=x&gt; &amp; &quot;quoted&quot;/);
  assert.match(html, /新闻 &lt;标题&gt;/);
  assert.match(html, /\/notes\/x&quot;&lt;tag&gt;\/#section-/);
  assert.doesNotMatch(html, /<img|<tag>/);
  for (const topic of collectTopics([])) {
    assert.ok(html.includes(`href="#${topic.id}"`));
    assert.ok(html.includes(`id="${topic.id}" tabindex="-1"`));
  }
});

test('real and empty builds publish topics, exact article targets, sitemap and navigation', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-topics-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) await cp(path.join(root, dir), path.join(temp, dir), {recursive:true});
    const posts = JSON.parse(await readFile(path.join(temp, 'content/posts.json'), 'utf8'));
    for (const input of [posts, []]) {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(input));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
      const html = await readFile(path.join(temp, 'dist/topics/index.html'), 'utf8');
      assert.ok(html.includes(renderTopics(input)));
      assert.match(await readFile(path.join(temp, 'dist/sitemap.xml'), 'utf8'), /\/topics\/<\/loc>/);
      assert.match(await readFile(path.join(temp, 'dist/index.html'), 'utf8'), /href="\/topics\/">新闻专题/);
      for (const topic of collectTopics(input)) for (const entry of topic.entries) {
        const [pathname, anchor] = entry.href.split('#');
        const article = await readFile(path.join(temp, 'dist', pathname, 'index.html'), 'utf8');
        assert.ok(article.includes(`id="${anchor}"`));
        assert.ok(article.includes(`href="/topics/#${topic.id}"`));
      }
      for (const post of input.filter(post => post.category !== '新闻回顾')) {
        assert.doesNotMatch(await readFile(path.join(temp, 'dist/notes', post.slug, 'index.html'), 'utf8'), /class="article-topics"/);
      }
      await validateLinks(path.join(temp, 'dist'));
    }
    assert.equal(collectTopics(posts).reduce((total, topic) => total + topic.entries.length, 0), posts.filter(post => post.category === '新闻回顾').length * 5);
  } finally { await rm(temp, {recursive:true, force:true}); }
});
