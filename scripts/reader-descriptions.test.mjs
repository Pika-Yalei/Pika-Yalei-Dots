import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderReaderSettings} from './reader-settings.mjs';
import {renderTopicFocus} from './topic-focus.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('native reading groups expose their limits and reset instructions as accessible descriptions',()=>{
 const news=posts.find(post=>post.category==='新闻回顾');
 const html=renderReaderSettings()+renderTopicFocus(news);
 for(const group of ['reader-controls','reader-palette','reader-layout','topic-focus']){
  assert.ok(html.includes(`<fieldset class="${group}" aria-describedby="${group}-help">`));
  assert.equal((html.match(new RegExp(`id="${group}-help"`,'g'))||[]).length,1);
  assert.match(html,new RegExp(`<p id="${group}-help">[^<]*不保存偏好`));
 }
 assert.doesNotMatch(html,/role="radio|tabindex=/);
});
test('every article resolves each reading group description once without dangling or duplicate ids',()=>{
 for(const post of posts){
  const html=readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
  for(const match of html.matchAll(/<fieldset class="[^"]+" aria-describedby="([^"]+)"/g)){
   assert.equal((html.match(new RegExp(`id="${match[1]}"`,'g'))||[]).length,1);
  }
  assert.ok(html.includes('aria-describedby="reader-controls-help"'));
 }
});
