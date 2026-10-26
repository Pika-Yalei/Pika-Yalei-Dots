import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPlainText } from './plain-text.mjs';
import { articleText } from './article-content.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
test('plain text preserves every article body, citation and original publication context',()=>{
 for(const post of posts){
  const before=structuredClone(post),text=renderPlainText(post);
  assert.ok(text.endsWith(articleText(post)+'\n'));
  assert.ok(text.includes(`/notes/${post.slug}/\n`));
  for(const section of post.sections)for(const source of section.sources??[])assert.ok(text.includes(source.url));
  assert.deepEqual(post,before);
 }
});
test('plain-text downloads match the generated copies and have explicit safe MIME type',()=>{
 const headers=readFileSync(new URL('../dist/_headers',import.meta.url),'utf8');
 assert.match(headers,/\/notes\/\*\/article.txt\n  Content-Type: text\/plain; charset=utf-8/);
 for(const post of posts){
  const base=new URL(`../dist/notes/${post.slug}/`,import.meta.url);
  assert.equal(readFileSync(new URL('article.txt',base),'utf8'),renderPlainText(post));
  assert.ok(readFileSync(new URL('index.html',base),'utf8').includes(`download="${post.slug}.txt"`));
 }
});
