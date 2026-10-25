import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { websitePages, websitePath, renderWebsiteDirectory, renderWebsitePage } from './source-websites.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('website pages group exact hosts and preserve every actual citation and backlink',()=>{
 const before=structuredClone(posts),pages=websitePages(posts);
 assert.deepEqual(posts,before);assert.ok(pages.length>0);
 for(const page of pages){
  assert.ok(page.sources.length<=30);
  for(const source of page.sources){assert.equal(new URL(source.url).hostname,page.host);assert.ok(renderWebsitePage(page).includes(source.references[0].href));}
 }
 const urls=pages.flatMap(p=>p.sources.map(s=>s.url));assert.equal(new Set(urls).size,urls.length);
 assert.deepEqual(websitePages([]),[]);assert.match(renderWebsiteDirectory([]),/尚无引用来源/);
});
test('website paths are safe and stable while labels are escaped',()=>{
 assert.match(websitePath('../bad?x'),/^\/sources\/websites\/[a-f0-9]{24}\/$/);
 const page={host:'<bad>',base:'/sources/websites/abc/',path:'/sources/websites/abc/',number:2,total:3,count:61,offset:30,sources:[]};
 const html=renderWebsitePage(page);assert.match(html,/&lt;bad&gt;/);assert.doesNotMatch(html,/<bad>/);
 assert.match(html,/href="\/sources\/websites\/abc\/" rel="prev"/);assert.match(html,/page\/3\/" rel="next"/);
});
