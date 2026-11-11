import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderArticleStart, sectionAnchors } from './reading-navigation.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('article shortcut uses the first existing section and has no empty destination', () => {
  assert.equal(renderArticleStart([]), '');
  const sections = sectionAnchors([{heading: '首栏'}, {heading: '另一栏'}]);
  assert.equal(renderArticleStart(sections), `<p class="article-start"><a href="#${sections[0].id}">跳到正文 ↓</a></p>`);
  assert.doesNotMatch(renderArticleStart(sections), new RegExp(sections[1].id));
  assert.match(renderArticleStart([{id: 'a"<&'}]), /href="#a&quot;&lt;&amp;"/);
});

test('every built article bypasses the directory and settings to a unique focusable body heading', () => {
  for (const post of JSON.parse(read('../content/posts.json'))) {
    const html = read(`../dist/notes/${post.slug}/index.html`);
    const first = sectionAnchors(post.sections)[0];
    const shortcut = renderArticleStart(sectionAnchors(post.sections));
    assert.ok(html.includes(shortcut), post.slug);
    assert.equal((html.match(/class="article-start"/g)||[]).length, 1);
    assert.ok(html.indexOf(shortcut) < html.indexOf('class="article-contents"'));
    assert.ok(html.indexOf(shortcut) < html.indexOf('class="reader-settings"'));
    const target = `id="${first.id}" tabindex="-1"`;
    assert.equal(html.split(target).length - 1, 1);
    assert.ok(html.indexOf(target) > html.indexOf('<div class="prose">'));
  }
  assert.doesNotMatch(read('../dist/index.html'), /class="article-start"/);
});

test('shortcut wraps with large text and keeps inherited keyboard and high-contrast focus', () => {
  const css = read('../public/style.css');
  assert.match(css, /\.article-start a\{display:inline-block;min-width:44px;min-height:44px;max-width:100%;[^}]*overflow-wrap:anywhere;text-decoration:underline/);
  assert.match(css, /a:focus-visible\{outline:2px solid var\(--green\)/);
  assert.match(css, /\.prose h2\[id\]:focus[^}]*outline:2px solid Highlight/);
  assert.match(css, /@media print\{\s*\.archive-month-return\{display:none\}\s*\.article-start\{display:none\}/);
  // A previously selected topic cannot hide the section reached by the shortcut.
  const readerCSS = read('../public/reader-controls.css');
  for (const topic of ['ai', 'business', 'markets', 'china-policy', 'world']) {
    assert.ok(readerCSS.includes(`:not([data-news-topic="${topic}"]):not(:has(:target))`));
  }
});
