import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateReadingMinutes, readingMinutes, readingTimeText, readingTimeExplanation } from './reading-time.mjs';

test('empty, short, punctuation and whitespace text has a one-minute minimum', () => {
  for (const text of ['', ' \n\t', '，。！？—…😀', '你好！', 'Hello, world.']) {
    assert.equal(estimateReadingMinutes(text), 1);
  }
});

test('Chinese and English use independent rates with exact boundaries', () => {
  for (const [text, minutes] of [
    ['字'.repeat(300), 1], ['字'.repeat(301), 2], ['字'.repeat(6000), 20],
    ['word '.repeat(200), 1], ['word '.repeat(201), 2], ['word '.repeat(4000), 20],
    ['字'.repeat(150) + 'word '.repeat(100), 1],
    ['字'.repeat(150) + 'word '.repeat(101), 2],
    ['𠀀'.repeat(301), 2], ['2026 '.repeat(201), 2],
    ["don't state-of-the-art ".repeat(100), 1],
    ['cafe\u0301 '.repeat(200), 1],
  ]) assert.equal(estimateReadingMinutes(text), minutes);
});

test('punctuation separates words and URLs do not inflate reading time', () => {
  assert.equal(estimateReadingMinutes('hello,world!'.repeat(101)), 2);
  assert.equal(estimateReadingMinutes('字'.repeat(300) + ' https://example.com/' + 'path/'.repeat(1000)), 1);
  assert.equal(estimateReadingMinutes('https://example.com/。' + '字'.repeat(301)), 2);
  assert.equal(estimateReadingMinutes('字'.repeat(300) + '\nHTTPS://example.com/a?query=long#section'), 1);
});

test('article estimates ignore legacy values, summaries and citation lists', () => {
  const post = { title: '', subtitle: '', sections: [{heading: '', paragraphs: ['字'.repeat(600)]}], closing: '', readingMinutes: 99 };
  assert.equal(readingMinutes(post), 2);
  assert.equal(readingTimeText(post), '约 2 分钟阅读');
  assert.equal(readingMinutes({...post, summary: '字'.repeat(9000), readingMinutes: 1,
    sections: [{...post.sections[0], sources: [{label: '字'.repeat(9000), url: 'https://example.com/'}]}]}), 2);
  assert.equal(readingMinutes({...post, title:'字', subtitle:'字', closing:'字'}), 3);
  assert.equal(readingMinutes({...post, sections:[{heading:'字', paragraphs:['字'.repeat(600)]}]}), 3);
});

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'notebook-reading-time-'));
after(() => rm(fixture, {recursive:true, force:true}));
for (const dir of ['scripts', 'public', 'content']) await cp(path.join(root, dir), path.join(fixture, dir), {recursive:true});
const posts = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
// Stale editorial values cannot leak into either current or paginated output.
await writeFile(path.join(fixture, 'content/posts.json'), JSON.stringify(posts.map(post => ({...post, readingMinutes:999}))));
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:fixture});

test('article and paginated index use the same estimate and explain assumptions', async () => {
  const { paginatePosts } = await import('./pagination.mjs');
  for (const page of paginatePosts(posts.sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)))) {
    const index = await readFile(path.join(fixture, 'dist', page.path, 'index.html'), 'utf8');
    assert.doesNotMatch(index, /999 分钟阅读/);
    for (const post of page.posts) {
      assert.ok(index.includes(readingTimeText(post)));
      const article = await readFile(path.join(fixture, 'dist/notes', post.slug, 'index.html'), 'utf8');
      assert.ok(article.includes(`<span>${readingTimeText(post)}</span>`));
      assert.ok(article.includes(readingTimeExplanation));
      assert.doesNotMatch(article, /999 分钟阅读|<script\b/);
    }
  }
});

test('feed exports keep the original article content without legacy timing metadata', async () => {
  const { articleText } = await import('./article-content.mjs');
  const feed = JSON.parse(await readFile(path.join(fixture, 'dist/feed.json'), 'utf8'));
  for (const post of posts) {
    assert.equal(feed.items.find(item => item.url.endsWith(`/notes/${post.slug}/`)).content_text, articleText(post));
  }
  assert.doesNotMatch(await readFile(path.join(fixture, 'dist/feed.xml'), 'utf8'), /999 分钟阅读/);
});
