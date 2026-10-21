import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const posts = JSON.parse(readFileSync(new URL('../content/posts.json', import.meta.url), 'utf8'));
for (const day of [14, 15, 16, 17]) {
  test(`October ${day} archive preserves its window and contains five sourced items in each fixed section`, () => {
    const post = posts.find(p => p.slug === `news-2026-10-${day}`);
    assert.equal(post.publishedAt, '2026-10-20T05:55:54Z');
    assert.ok(post.sections[0].paragraphs.join(' ').includes(`2026-10-${day - 1} 12:00 至 2026-10-${day} 12:00`));
    assert.match(post.sections[0].paragraphs.join(' '), /实际补充时间/);
    assert.equal(post.sections.length, 6);
    const categories = ['AI', '商业', '股票', '中国政治', '国际政治'];
    post.sections.slice(1).forEach((section, i) => assert.ok(section.heading.startsWith(categories[i] + '｜')));
    for (const section of post.sections.slice(1)) {
      assert.ok(section.paragraphs.length >= 5, section.heading);
      section.paragraphs.forEach((paragraph, index) => {
        assert.ok(paragraph.startsWith(`${index + 1}. `));
        assert.ok(paragraph.length >= 50);
        assert.ok(section.sources[index].url.startsWith('https://'));
      });
    }
  });
}
