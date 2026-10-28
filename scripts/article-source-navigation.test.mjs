import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSourceLinks, renderSectionContent } from './article-content.mjs';
import { websitePath } from './source-website-path.mjs';
import { websitePath as directoryPath } from './source-websites.mjs';
import { renderFeed } from './feed.mjs';
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const source = {url:'https://github.com/simonw/llm/pull/1771', label:'1. Original <source>'};

test('article citations distinguish original evidence from the internal website collection', () => {
  const html = renderSourceLinks([source], escape, true);
  assert.ok(html.includes(`href="${source.url}" rel="noreferrer">1. Original &lt;source&gt;</a>`));
  assert.match(html, /网站：github.com/);
  assert.ok(html.includes(`href="${websitePath('github.com')}"`));
  assert.match(html, /aria-label="查看本站引用的 github.com 材料">本站引用/);
  assert.equal(websitePath('github.com'), directoryPath('github.com'));
  assert.doesNotMatch(html, /target=|<script|onclick|<form/);
  assert.equal(renderSourceLinks([], escape, true), '');
  assert.throws(() => renderSourceLinks([{...source,url:'https://unreviewed.example/'}],escape,true), /Unreviewed/);
});

test('mapped and unmapped citations both expose navigation without mutating article data', () => {
  const section = {heading:'AI',paragraphs:['1. News'],sources:[source,{...source,label:'Supplement'}]};
  const before = JSON.stringify(section);
  const html = renderSectionContent(section, escape, true, '', true);
  assert.equal((html.match(/class="source-website-link"/g)||[]).length,2);
  assert.match(html,/补充来源/);
  assert.equal(JSON.stringify(section), before);
});

test('feed citations retain domain context but never acquire relative collection links', () => {
  const posts = JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
  const feed = renderFeed(posts.slice(0,1));
  assert.match(feed,/网站：/);
  assert.doesNotMatch(feed,/source-website-link|href=&quot;\/sources/);
});

test('every article citation collection link resolves to its exact hostname page', () => {
  const posts = JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
  for (const post of posts) {
    const html = readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
    for (const source of post.sections.flatMap(section => section.sources || [])) {
      const host = new URL(source.url).hostname;
      const href = websitePath(host);
      assert.ok(html.includes(`href="${href}"`));
      const target = readFileSync(new URL(`../dist${href}index.html`,import.meta.url),'utf8');
      assert.ok(target.includes(`<h1>${escape(host)} 的引用材料`));
    }
  }
});

test('source collection navigation stays legible on screen and is excluded from printed evidence', () => {
  const css = readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  assert.match(css,/\.source-origin\{[^}]*display:block[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.source-website-link\{[^}]*min-height:24px/);
  assert.match(css,/@media print\{[\s\S]*\.article-sources \.source-website-link\{display:none\}/);
});
