import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import{websitePages,paginateWebsiteDirectory,renderWebsitePage,renderWebsiteDirectory,websiteDirectoryAnchor}from'./source-websites.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
test('every website page returns to its exact numbered directory location',()=>{
 const pages=websitePages(posts),dirs=paginateWebsiteDirectory(pages);
 for(const page of pages){
  const dir=dirs.find(d=>d.websites.some(s=>s.host===page.host));
  assert.equal(page.directoryHref,`${dir.path}#${websiteDirectoryAnchor(page.host)}`);
  assert.ok(renderWebsitePage(page).includes(`href="${page.directoryHref}"`));
  assert.ok(renderWebsiteDirectory(dir).includes(`id="${websiteDirectoryAnchor(page.host)}" tabindex="-1"`));
 }
 assert.ok(pages.some(p=>p.directoryHref.includes('/page/2/')));
});
test('directory and per-site pagination support bounded direct page jumps',()=>{
 const dir={number:10,total:30,count:900,offset:270,path:'/sources/websites/page/10/',websites:[]};
 const html=renderWebsiteDirectory(dir);
 for(const n of [1,9,11,30])assert.ok(html.includes(n===1?'href="/sources/websites/"':`href="/sources/websites/page/${n}/"`));
 assert.match(html,/aria-current="page"/);assert.ok((html.match(/<a /g)||[]).length<15);
 const site=renderWebsitePage({host:'example.com',base:'/sources/websites/abc/',number:10,total:30,count:900,offset:270,sources:[]});
 assert.ok(site.includes('href="/sources/websites/abc/page/30/"'));
});
