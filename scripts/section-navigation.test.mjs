import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSectionNavigation } from './section-navigation.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
const sections = sectionAnchors([{heading:'AI'},{heading:'商业'},{heading:'股票市场'}]);
test('section navigation handles beginning, middle and end without wrapping', () => {
  const first = renderSectionNavigation(sections,0);
  assert.doesNotMatch(first,/上一栏/); assert.match(first,/下一栏：商业/);
  const middle = renderSectionNavigation(sections,1);
  assert.match(middle,/上一栏：AI/); assert.match(middle,/下一栏：股票市场/);
  assert.match(middle, new RegExp(`#${sections[0].id}`));
  assert.match(middle,/#contents-title/);
  assert.doesNotMatch(renderSectionNavigation(sections,2),/下一栏/);
});
test('single, empty and invalid indices omit unnecessary controls', () => {
  for (const [items,index] of [[[],0],[[sections[0]],0],[sections,-1],[sections,3],[sections,0.5]]) assert.equal(renderSectionNavigation(items,index),'');
});
test('navigation labels and fragment attributes escape untrusted strings', () => {
  const html = renderSectionNavigation([{heading:'<x>',id:'a"'},{heading:'<y>',id:'b"'}],0);
  assert.match(html,/&lt;x&gt;/); assert.match(html,/#b&quot;/); assert.doesNotMatch(html,/<x>|<y>/);
});
test('built article navigation targets exist and print hides controls', () => {
  const posts = JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
  for (const post of posts) {
    const html = readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
    assert.equal((html.match(/class="section-navigation"/g)||[]).length, post.sections.length > 1 ? post.sections.length : 0);
    assert.match(html,/id="contents-title" tabindex="-1"/);
  }
  assert.match(readFileSync(new URL('../public/style.css',import.meta.url),'utf8'),/\.section-navigation\{display:none\}/);
});
