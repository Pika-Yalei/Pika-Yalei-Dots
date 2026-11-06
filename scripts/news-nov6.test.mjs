import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups, isReviewedSource} from './article-content.mjs';

const posts = JSON.parse(readFileSync(new URL('../content/posts.json', import.meta.url)));
test('November 6 briefing has five independently sourced columns in its exact news window', () => {
  const post = posts.find(post => post.slug === 'news-2026-11-06');
  assert.ok(post);
  assert.equal(post.title, '2026-11-06｜24 小时新闻简报');
  assert.deepEqual(post.sections.map(section => section.heading), ['AI', '商业', '股票市场', '中国政治与政策', '国际政治与重大事件']);
  assert.deepEqual(post.sections.map(section => section.paragraphs.filter(text => /^\d+\. /.test(text)).length), [5, 5, 5, 5, 5]);
  for (const section of post.sections) {
    const grouped = sectionSourceGroups(section, true);
    assert.equal(grouped.remaining.length, 0);
    for (const item of grouped.groups.filter(item => /^\d+\. /.test(item.text))) {
      assert.ok(item.sources.length > 0);
      assert.ok(item.sources.every(source => isReviewedSource(source.url)));
    }
  }
  assert.deepEqual(post.newsWindow, {start:'2026-11-05T02:50:00Z', end:'2026-11-06T02:50:00Z'});
  assert.ok(Date.parse(post.publishedAt) >= Date.parse(post.newsWindow.end));
  assert.match(post.sections[0].paragraphs.join(''), /部分获批 Daybreak Red/);
  assert.match(post.sections[0].paragraphs.join(''), /仍为测试版/);
  assert.match(post.sections[0].paragraphs.join(''), /旧版 FSDP 检查点不能直接恢复训练/);
  assert.ok(post.sections[2].paragraphs.every(text => text.includes('币种')));
});
