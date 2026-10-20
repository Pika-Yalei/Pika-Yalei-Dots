import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupCategories } from './categories.mjs';
import { siteUrl } from './feed.mjs';
import { validateLinks } from './validate-links.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const posts = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
const slug = 'the-texture-of-repair';
const post = posts.find(post => post.slug === slug);

test('October 20 article retains its public identity and substantial original body', () => {
  assert.ok(post);
  assert.equal(posts.filter(post => post.slug === slug).length, 1);
  assert.equal(post.date, '2026-10-20');
  assert.equal(post.title, '修补留下的纹理');
  assert.equal(post.category, '日常观察');
  assert.ok(post.sections.length >= 3);
  const paragraphs = post.sections.flatMap(section => section.paragraphs);
  assert.ok(post.sections.every(section => section.paragraphs.length >= 2));
  assert.ok(paragraphs.join('').length >= 1000);
  assert.equal(new Set(paragraphs).size, paragraphs.length);
  const previousParagraphs = new Set(posts.filter(item => item.slug !== slug)
    .flatMap(item => item.sections.flatMap(section => section.paragraphs)));
  assert.ok(paragraphs.every(paragraph => !previousParagraphs.has(paragraph)));
});

test('October 20 article is complete and discoverable in built pages and both feeds', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-oct20-content-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), {recursive: true});
    }
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd: temp});
    const dist = path.join(temp, 'dist');
    const read = file => readFile(path.join(dist, file), 'utf8');
    const articlePath = `/notes/${slug}/`;
    const article = await read(`notes/${slug}/index.html`);
    for (const text of [post.title, post.subtitle, ...post.sections.flatMap(section =>
      [section.heading, ...section.paragraphs]), post.closing]) {
      assert.ok(article.includes(text), `Missing article text: ${text}`);
    }
    assert.ok(article.includes('AI 撰写 · 通用观察，不涉及真实私人事件'));
    const category = groupCategories(posts).find(category => category.name === post.category);
    assert.ok(category);
    for (const file of ['archive/index.html', `${category.path.slice(1)}index.html`]) {
      assert.ok((await read(file)).includes(`href="${articlePath}"`), file);
    }
    const url = `${siteUrl}${articlePath}`;
    assert.ok((await read('sitemap.xml')).includes(`<loc>${url}</loc>`));
    const rss = await read('feed.xml');
    const item = rss.match(/<item>[\s\S]*?<\/item>/g).find(item => item.includes(`<link>${url}</link>`));
    assert.ok(item);
    assert.ok(item.includes('<pubDate>Tue, 20 Oct 2026 00:00:00 GMT</pubDate>'));
    for (const paragraph of post.sections.flatMap(section => section.paragraphs)) {
      assert.ok(item.includes(paragraph));
    }
    const jsonFeed = JSON.parse(await read('feed.json'));
    const jsonItem = jsonFeed.items.find(item => item.id === url);
    assert.ok(jsonItem);
    assert.equal(jsonItem.date_published, '2026-10-20T00:00:00Z');
    assert.equal(jsonItem.content_text, [post.subtitle,
      ...post.sections.flatMap(section => [section.heading, ...section.paragraphs]),
      post.closing, 'AI 撰写 · 通用观察，不涉及真实私人事件'].join('\n\n'));
    await validateLinks(dist);
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
});
