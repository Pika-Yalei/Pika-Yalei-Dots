import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedNotes, renderRelatedNotes} from './related-notes.mjs';
const note = (slug, date = '2026-10-17', category = '方法') => ({slug, date, category, title: slug, summary: '摘要'});
test('related notes exclude current and other topics, limit to two in stable order', () => {
  const current = note('current');
  const posts = [note('z'), current, note('x', '2026-10-18', '其他'), note('b'), note('a'), note('old', '2026-10-16')];
  const before = JSON.stringify(posts);
  assert.deepEqual(relatedNotes(posts, current).map(p => p.slug), ['a', 'b']);
  assert.equal(JSON.stringify(posts), before);
});
test('unique topic and empty notebook omit related navigation', () => {
  const current = note('current');
  assert.equal(renderRelatedNotes([], current), '');
  assert.equal(renderRelatedNotes([current], current), '');
});
test('related titles summaries and category are escaped', () => {
  const current = note('current', undefined, '<方法>');
  const html = renderRelatedNotes([{...note('other', undefined, '<方法>'), title: '<img>', summary: 'A & B'}], current);
  assert.ok(html.includes('&lt;img&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('&lt;方法&gt;'));
  assert.ok(html.includes('aria-labelledby="related-notes-title"'));
});
