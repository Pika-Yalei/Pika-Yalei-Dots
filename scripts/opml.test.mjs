import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { renderOpml } from './opml.mjs';
import { siteUrl } from './feed.mjs';
import { renderSubscribe } from './subscribe.mjs';
test('OPML bundles are separate, deterministic and contain only public RSS endpoints',()=>{
 assert.throws(()=>renderOpml('unknown'),RangeError);
 for(const [mode,count] of [['all',1],['topics',5]]){
  const xml=renderOpml(mode);assert.equal(xml,renderOpml(mode));assert.match(xml,/^<\?xml version="1.0" encoding="UTF-8"\?>/);assert.match(xml,/<opml version="2.0">/);
  const urls=[...xml.matchAll(/xmlUrl="([^"]+)"/g)].map(m=>m[1]);assert.equal(urls.length,count);assert.equal(new Set(urls).size,count);
  for(const u of urls){assert.equal(new URL(u).origin,siteUrl);assert.ok(u.endsWith('/feed.xml'));assert.ok(existsSync(new URL('../dist'+new URL(u).pathname,import.meta.url)));}
  assert.equal(readFileSync(new URL(`../dist/subscribe/${mode}.opml`,import.meta.url),'utf8'),xml);
 }
 assert.doesNotMatch(renderOpml('topics'),/xmlUrl="[^\"]+\.com\/feed.xml"/);
});
test('subscription help explains import choice without claiming account changes',()=>{
 const html=renderSubscribe();for(const text of ['all.opml','topics.opml','二选一','不会自动修改','导入 OPML'])assert.ok(html.includes(text));
 assert.match(readFileSync(new URL('../dist/_headers',import.meta.url),'utf8'),/\/subscribe\/\*\.opml\n  Content-Type: text\/x-opml; charset=utf-8/);
});
