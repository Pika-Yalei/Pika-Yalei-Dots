import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderReaderLayout } from './reader-layout.mjs';
test('independent native checkboxes are reversible, labelled and off by default', () => {
  const html=renderReaderLayout();
  assert.match(html,/<legend>阅读版式<\/legend>/);
  assert.equal((html.match(/<label><input type="checkbox"/g)||[]).length,3);
  for (const name of ['reader-narrow','reader-spaced','reader-sans']) assert.match(html,new RegExp(`name="${name}"`));
  assert.doesNotMatch(html,/checked|onclick|script|style=/);
  assert.match(html,/取消勾选即可恢复/);
});
test('layout is progressive enhancement, screen-only and constrained to prose', () => {
  const css=readFileSync(new URL('../public/reader-controls.css',import.meta.url),'utf8');
  assert.match(css,/\.reader-layout\{display:none\}/);
  assert.match(css,/@supports selector\(:has\(input:checked\)\)/);
  assert.match(css,/\.article-reader:has\(input\[name="reader-narrow"\]:checked\) \.prose\{max-width:28em;margin-inline:auto\}/);
  assert.match(css,/\.article-reader:has\(input\[name="reader-spaced"\]:checked\) \.prose p\{line-height:2.2;margin-block:1.5em\}/);
  assert.match(css,/@media print\{\.reader-layout\{display:none\}\}/);
  assert.doesNotMatch(css,/overflow:hidden|height:100vh/);
});
test('each article has a single layout control without changing home or feed', () => {
  const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
  for(const post of posts){
    const html=readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
    assert.equal((html.match(/class="reader-layout"/g)||[]).length,1);
  }
  for(const file of ['index.html','feed.xml','feed.json']) assert.doesNotMatch(readFileSync(new URL(`../dist/${file}`,import.meta.url),'utf8'),/reader-layout/);
});


test('optional sans-serif reading uses existing system fonts only within screen prose',()=>{
 const html=renderReaderLayout();
 assert.match(html,/name="reader-sans">无衬线正文/);
 assert.match(html,/系统黑体，不下载字体/);
 const css=readFileSync(new URL('../public/reader-controls.css',import.meta.url),'utf8');
 assert.match(css,/@media screen\{[^}]*reader-narrow[\s\S]*?reader-sans[^}]*font-family:var\(--sans\)/);
 assert.match(css,/\.article-reader:has\(input\[name="reader-sans"\]:checked\) \.prose\{font-family:var\(--sans\)\}/);
 assert.doesNotMatch(css,/@font-face|https?:|reader-sans[^}]*!important/);
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
 for(const post of posts){
  const built=readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
  assert.equal((built.match(/name="reader-sans"/g)||[]).length,1);
  assert.doesNotMatch(built,/name="reader-sans"[^>]*checked/);
 }
});
