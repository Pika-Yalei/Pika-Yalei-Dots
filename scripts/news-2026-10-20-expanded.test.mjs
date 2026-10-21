import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const posts = JSON.parse(readFileSync(new URL('../content/posts.json', import.meta.url), 'utf8'));
test('expanded October 20 archive retains its window and five substantial items per section', () => {
  const post = posts.find(item => item.slug === 'news-2026-10-20');
  assert.equal(post.publishedAt, '2026-10-20T05:55:54Z');
  assert.match(post.sections[0].paragraphs.join(' '), /2026-10-19 12:00 至 2026-10-20 12:00/);
  assert.match(post.sections[0].paragraphs.join(' '), /实际补充时间/);
  assert.equal(post.sections.length, 6);
  for (const section of post.sections.slice(1)) {
    assert.ok(section.paragraphs.length >= 5, section.heading);
    assert.ok(section.sources.length >= 5, section.heading);
    section.paragraphs.forEach((paragraph, index) => {
      assert.ok(paragraph.startsWith(`${index + 1}. `));
      assert.ok(paragraph.length >= 70);
      assert.ok(section.sources[index].url.startsWith('https://'));
    });
  }
});
