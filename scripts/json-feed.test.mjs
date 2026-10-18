import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderJsonFeed } from './json-feed.mjs';
const post = { slug: 'one', date: '2026-10-18', title: '标题', summary: '摘要', subtitle: '副标题', category: '分类', sections: [{ heading: '章节', paragraphs: ['正文'] }], closing: '小结' };
test('JSON Feed exposes complete public plain-text articles and stable IDs', () => {
  const feed = JSON.parse(renderJsonFeed([post]));
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(feed.language, 'zh-CN');
  const item = feed.items[0];
  assert.equal(item.id, item.url);
  assert.equal(item.date_published, '2026-10-18T00:00:00Z');
  assert.deepEqual(item.tags, ['分类']);
  for (const text of ['副标题','章节','正文','小结','AI 撰写']) assert.ok(item.content_text.includes(text));
  assert.equal(item.content_html, undefined);
  assert.equal(JSON.parse(renderJsonFeed([{...post,title:'new'}])).items[0].id,item.id);
});
test('JSON serialization preserves quotes, Unicode, newlines and markup as text', () => {
  const title = '"中文😀\\\n<em>text</em>';
  assert.equal(JSON.parse(renderJsonFeed([{...post,title}])).items[0].title,title);
});
test('JSON Feed ordering is deterministic and does not mutate input', () => {
  const input=[{...post,slug:'z'}, {...post,slug:'a'}, {...post,slug:'old',date:'2020-01-01'}];
  const before=structuredClone(input);
  assert.deepEqual(JSON.parse(renderJsonFeed(input)).items.map(i=>i.id.split('/').at(-2)),['a','z','old']);
  assert.deepEqual(input,before);
  assert.deepEqual(JSON.parse(renderJsonFeed([])).items,[]);
});
test('build includes discovery, footer and the feed MIME type', async () => {
  const build = await readFile(new URL('./build.mjs',import.meta.url),'utf8');
  const headers = await readFile(new URL('../public/_headers',import.meta.url),'utf8');
  assert.match(build,/type="application\/feed\+json"[^>]+href="\/feed.json"/);
  assert.match(build,/aria-label="订阅手记 JSON Feed"/);
  assert.match(headers,/\/feed.json\n  Content-Type: application\/feed\+json; charset=utf-8/);
});
