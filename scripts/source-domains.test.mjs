import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paginateSources, sourceAnchor, sourcePageSize, renderSourcePage } from './source-index.mjs';
const sources = Array.from({length:sourcePageSize+2},(_,i)=>({url:`https://${i<sourcePageSize?'first.example':'last.example'}/${i}`,label:`Source ${i}`,references:[]}));
test('domain navigation counts exact URLs and locates their first page and stable anchor',()=>{
 const pages=paginateSources(sources);
 assert.deepEqual(pages[0].domains.map(d=>[d.host,d.count]),[['first.example',40],['last.example',2]]);
 assert.equal(pages[0].domains[1].href,`/sources/page/2/#${sourceAnchor(sources[40].url)}`);
 assert.deepEqual(pages[0].domains,pages[1].domains);
 assert.equal(sourceAnchor(sources[0].url),sourceAnchor(sources[0].url));
 assert.notEqual(sourceAnchor(sources[0].url),sourceAnchor(sources[1].url));
});
test('native details is compact, keyboard-operable and includes focusable targets on deep pages',()=>{
 const pages=paginateSources(sources);
 const first=renderSourcePage(pages[0]),next=renderSourcePage(pages[1]);
 assert.match(first,/<details class="source-domains" id="source-domains"><summary>/);
 assert.ok(first.includes(pages[0].domains[1].href));
 assert.ok(next.includes('href="/sources/#source-domains"'));
 assert.ok(next.includes(`id="${sourceAnchor(sources[40].url)}" tabindex="-1"`));
 assert.doesNotMatch(first+next,/<script|onclick|<form/);
 assert.doesNotMatch(renderSourcePage(paginateSources([])[0]),/source-domains/);
});
test('live build lists domains once and all navigation targets exist in generated source pages',()=>{
 const html=readFileSync(new URL('../dist/sources/index.html',import.meta.url),'utf8');
 const details=html.match(/<details class="source-domains"[\s\S]*?<\/details>/)[0];
 for(const [,href] of details.matchAll(/href="([^"]+)"/g)){
  const [page,id]=href.split('#');
  const target=readFileSync(new URL(`../dist${page}index.html`,import.meta.url),'utf8');
  assert.ok(target.includes(`id="${id}" tabindex="-1"`));
 }
});

test('a website spread across pages exposes every occupied page without pretending to filter',()=>{
 const same=sources.map(source=>({...source,url:source.url.replace('last.example','first.example')}));
 const page=paginateSources(same)[0];assert.deepEqual(page.domains[0].pages.map(p=>p.number),[1,2]);
 const html=renderSourcePage(page);assert.match(html,/first.example，第 2 页/);assert.ok(html.includes(page.domains[0].pages[1].href));
});
