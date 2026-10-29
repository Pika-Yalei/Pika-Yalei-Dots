import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTopicFocus, topicFocusSections } from './topic-focus.mjs';
import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';
import { renderSectionContent } from './article-content.mjs';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const news = sections => ({category:'新闻回顾', slug:'test', date:'2026-10-29', sections});

test('empty/non-news have no focus controls; missing columns are disabled', () => {
  assert.equal(renderTopicFocus(news([])), '');
  assert.equal(renderTopicFocus({...news([{heading:'AI',paragraphs:[]}]),category:'技术'}), '');
  const html = renderTopicFocus(news([{heading:'AI',paragraphs:[]}]));
  assert.equal((html.match(/type="radio" name="news-focus"/g)||[]).length,6);
  assert.equal((html.match(/ checked/g)||[]).length,1);
  assert.equal((html.match(/ disabled/g)||[]).length,4);
  assert.match(html,/value="all" checked/);
  assert.match(html,/链接定位的栏目会额外显示/);
  assert.doesNotMatch(html,/script|onclick|tabindex|style=/);
});

test('legacy headings use exact matching without changing IDs, order or content', () => {
  const post = news(['AI｜旧标题', '商业', '股票', '中国政治', '国际政治', '<img src=x>'].map(heading => ({heading,paragraphs:['1. 测试。事实。']})));
  const sections = sectionAnchors(post.sections);
  const focused = topicFocusSections(post,sections);
  assert.deepEqual(focused.map(s=>s.focusTopic),['ai','business','markets','china-policy','world','other']);
  for(let i=0;i<sections.length;i++) {
    const {focusTopic,...rest} = focused[i];
    assert.deepEqual(rest,sections[i]);
    assert.deepEqual(newsItemAnchors(rest),newsItemAnchors(sections[i]));
  }
  assert.doesNotMatch(renderTopicFocus(post),/<img|src=x/);
});

test('built news keeps every original section, item and source alongside composable reader controls', () => {
  for(const post of JSON.parse(read('content/posts.json'))) {
    const html=read(`dist/notes/${post.slug}/index.html`);
    const enabled=post.category==='新闻回顾' && renderTopicFocus(post)!=='';
    assert.equal((html.match(/class="topic-focus"/g)||[]).length,Number(enabled));
    assert.match(html,/class="reader-layout"/);
    assert.match(html,/name="reader-size"/);
    const sections=sectionAnchors(post.sections);
    for(const section of sections) {
      assert.ok(html.includes(`<h2 id="${section.id}" tabindex="-1">`));
      const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      assert.ok(html.includes(renderSectionContent(section,escape,post.category==='新闻回顾','',true)));
    }
    assert.doesNotMatch(read(`dist/notes/${post.slug}/article.txt`),/news-focus|data-news-topic|topic-focus/);
  }
  for(const file of ['feed.xml','feed.json','index.html']) assert.doesNotMatch(read(`dist/${file}`),/news-focus|data-news-topic|topic-focus/);
});

test('filter CSS is progressive screen-only, preserves every deep-linked section and native accessibility', () => {
  const css=read('public/reader-controls.css').split('/* No :has means')[1];
  assert.match(css,/\.topic-focus\{display:none\}/);
  assert.match(css,/@supports selector\(section:has\(:target\)\)\{\s+@media screen\{/);
  for(const id of ['ai','business','markets','china-policy','world']) {
    assert.ok(css.includes(`.article-reader:has(input[name="news-focus"][value="${id}"]:checked) .prose>section:not([data-news-topic="${id}"]):not(:has(:target))`));
  }
  assert.doesNotMatch(css,/value="all"|url\(|@import|overflow:hidden/);
  assert.match(css,/min-height:44px;min-width:44px/);
  assert.match(css,/input:focus-visible/);
  assert.match(css,/@media print\{\.topic-focus\{display:none\}\}/);
  assert.match(css,/forced-colors:active/);
});
