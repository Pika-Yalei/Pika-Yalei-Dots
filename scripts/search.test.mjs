import { renderCacheHeaders } from './cache-headers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { collectSearchEntries, renderSearch, fingerprintSearch } from './search.mjs';
import { collectHeadlines } from './headlines.mjs';
const posts = JSON.parse(readFileSync(new URL('../content/posts.json', import.meta.url)));
const script = readFileSync(new URL('../public/search.js', import.meta.url), 'utf8');
// Small intentionally network-free DOM harness: test native event handlers and DOM sinks,
// not browser layout or CSP implementation (those need deployment interaction checks).
class Node {
  constructor() { this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  fire(name, event = {}) { this.listeners[name]?.(event); }
  focus() { this.focused = true; }
  setAttribute(name, value) { this[name] = value; }
}
function boot(records) {
  const ids = Object.fromEntries(['search-browse','search-latest','search-date-error','search-scope','search-first','search-last','search-order','search-topic','search-print-context','search-data','search-ui','search-query','search-type','search-clear','search-status','search-results','search-controls','search-from','search-to','search-pagination','search-previous','search-next'].map(id => [id, new Node()]));
  ids['search-order'].value = 'newest';
  ids['search-scope'].value = 'summary';
  ids['search-type'].value = 'all';
  ids['search-topic'].value = 'all';
  ids['search-data'].content = {textContent:JSON.stringify(records)};
  ids['search-ui'].content = {cloneNode:() => ({querySelector:selector => ids[selector.slice(1)]})};
  const document = {getElementById:id => ids[id], createDocumentFragment:() => new Node(), createElement:() => new Node()};
  runInNewContext(script, {document});
  return ids;
}
test('index covers articles, individual headlines and every source label with stable URLs', () => {
  const entries = collectSearchEntries(posts);
  assert.equal(entries.filter(item => item.type === 'article').length, posts.length);
  assert.deepEqual(entries.filter(item => item.type === 'headline').map(item => item.href), collectHeadlines(posts).map(item => item.href));
  assert.equal(entries.filter(item => item.type === 'source').length, posts.flatMap(post => post.sections.flatMap(section => section.sources ?? [])).length);
  for (const item of entries.filter(item => item.type === 'source')) {
    assert.ok(item.detail.includes(new URL(item.href).hostname));
    assert.match(item.reference, /^\/notes\/[^/]+\/#(?:section|news)-/);
  }
  assert.deepEqual(collectSearchEntries([]), []);
});
test('public text stays inert even with template-closing payloads and entity tricks', () => {
  const payload = '</template><script>alert(1)</script><img src=x onerror=alert(1)>&quot;';
  const html = renderSearch([{slug:'safe',date:'2026-01-01',title:payload,summary:payload,sections:[]}]);
  assert.doesNotMatch(html, /<script|<img|onerror="/);
  assert.match(html, /&lt;\/template&gt;&lt;script&gt;/);
  assert.equal((html.match(/<\/template>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<form\b/);
  for (const href of ['/archive/','/headlines/','/sources/']) assert.ok(html.includes(`href="${href}"`));
});
test('runtime normalizes full-width/case/whitespace, AND matches, filters, clears and handles IME', () => {
  const nodes = boot([{type:'article', title:'ＡＩ Example',detail:'中文摘要',date:'2026-01-01',href:'/notes/example/'}, {type:'source',title:'AI source',detail:'example.com',date:'2026-01-01',href:'https://example.com',reference:'/notes/example/#section-1'}]);
  const query = nodes['search-query'], status = nodes['search-status'], results = nodes['search-results'];
  assert.match(status.textContent, /请输入/);
  query.value = '  ai\t中文  '; query.fire('input');
  assert.match(status.textContent, /共找到 1 条，显示 1 条/);
  assert.equal(results.children[0].children[0].children[0].href, '/notes/example/');
  query.value = 'AI'; nodes['search-type'].value = 'source'; nodes['search-type'].fire('change');
  assert.match(status.textContent, /共找到 1 条/);
  assert.equal(results.children[0].children[0].children[0].rel, 'noreferrer');
  query.fire('compositionstart'); query.value = 'missing'; query.fire('input');
  assert.match(status.textContent, /共找到 1 条/);
  query.fire('compositionend'); assert.match(status.textContent, /共找到 0 条/);
  nodes['search-clear'].fire('click');
  assert.equal(query.value, ''); assert.equal(nodes['search-type'].value, 'all'); assert.equal(query.focused, true);
  assert.match(status.textContent, /请输入/);
});
test('runtime paginates rendered results, counts all matches and never interprets markup or regex', () => {
  const payload = '<img src=x onerror=alert(1)> [.*]';
  const nodes = boot(Array.from({length:73}, () => ({type:'article',title:payload,detail:'',date:'2026-01-01',href:'/notes/example/'})));
  nodes['search-query'].value = '[.*]'; nodes['search-query'].fire('input');
  assert.match(nodes['search-status'].textContent, /共找到 73 条，显示 50 条/);
  const items = nodes['search-results'].children[0].children;
  assert.equal(items.length, 50); assert.equal(items[0].children[0].textContent, payload);
  assert.equal(nodes['search-pagination'].hidden, false);
  assert.equal(nodes['search-previous'].disabled, true);
  nodes['search-previous'].fire('click');
  assert.equal(nodes['search-results'].start, 1);
  nodes['search-next'].fire('click');
  assert.match(nodes['search-status'].textContent,/第 2 \/ 2 页，显示第 51–73 条/);
  assert.equal(nodes['search-results'].children[0].children.length,23);
  assert.equal(nodes['search-results'].start,51);
  assert.equal(nodes['search-next'].disabled,true);
  nodes['search-next'].fire('click');
  assert.equal(nodes['search-results'].start,51);
  nodes['search-previous'].fire('click');
  assert.equal(nodes['search-results'].start,1);
  nodes['search-next'].fire('click');
  nodes['search-type'].value='source'; nodes['search-type'].fire('change');
  assert.equal(nodes['search-results'].start,1);
  assert.equal(nodes['search-pagination'].hidden,true);
  nodes['search-clear'].fire('click');
  assert.equal(nodes['search-pagination'].hidden,true);
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie|location\.|history\./);
});
test('only reviewed bytes determine the script fingerprint and exact immutable route', () => {
  const bytes = Buffer.from(script), fingerprint = fingerprintSearch(new Map([['search.js',bytes]]));
  assert.equal(fingerprint, `search.${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.js`);
  assert.notEqual(fingerprintSearch(new Map([['search.js',Buffer.from(script+'\n')]])), fingerprint);
  assert.throws(() => fingerprintSearch(new Map()), /Missing/);
  assert.deepEqual(readFileSync(new URL(`../dist/${fingerprint}`, import.meta.url)), bytes);
  const html = readFileSync(new URL('../dist/search/index.html',import.meta.url),'utf8');
  assert.ok(html.includes(`<script src="/${fingerprint}" defer></script>`));
  const headers = readFileSync(new URL('../dist/_headers', import.meta.url),'utf8');
  assert.ok(headers.includes(`/${fingerprint}\n  Cache-Control: public, max-age=31536000, immutable`));
  const blocks = headers.split(/\n\s*\n/);
  const overrides = blocks.filter(block => block.includes("script-src 'self'"));
  assert.equal(overrides.length, 2);
  for (const block of overrides) {
    assert.match(block, /^\/search\/(?:index\.html)?\n  ! Content-Security-Policy\n/);
    assert.match(block, /default-src 'none'/); assert.match(block, /form-action 'none'/);
  }
  assert.doesNotMatch(blocks[0], /script-src/);
});

test('search cache routes reject non-reviewed script names without mutating callers', () => {
  const css = ['style.0123456789abcdef.css'];
  for (const invalid of ['private.0123456789abcdef.js', 'search.js', 'search.0123456789abcdef.js\n/*', {}, 123]) {
    assert.throws(() => renderCacheHeaders('', css, invalid), /fingerprinted search script/);
  }
  renderCacheHeaders('', css, 'search.0123456789abcdef.js');
  assert.deepEqual(css, ['style.0123456789abcdef.css']);
});
test('every indexed internal destination resolves to its original page and fragment', () => {
  for (const item of collectSearchEntries(posts)) for (const destination of [item.href, item.reference].filter(value => value?.startsWith('/'))) {
    const [pathname, fragment] = destination.split('#');
    const html = readFileSync(new URL(`../dist${pathname}index.html`, import.meta.url), 'utf8');
    if (fragment) assert.ok(html.includes(`id="${fragment}"`), destination);
  }
  const malicious = [{slug:'safe',date:'2026-01-01',title:'safe',summary:'safe',sections:[{heading:'safe',paragraphs:[],sources:[{label:'unsafe',url:'javascript:alert(1)'}]}]}];
  assert.throws(() => collectSearchEntries(malicious), /Unreviewed/);
});

test('source search uses explicit news mapping including continuation paragraphs, not guessed labels', () => {
  const url = posts.flatMap(post=>post.sections.flatMap(section=>section.sources??[]))[0].url;
  const post={slug:'mapping',date:'2026-01-01',title:'Mapping',summary:'summary',category:'新闻回顾',sections:[{heading:'AI',paragraphs:['1. First item。Facts.','Continuation.','2. Second item。Facts.'],sources:[{label:'1. Original',url},{label:'2. Other',url},{label:'Unmapped',url}]}]};
  const entries=collectSearchEntries([post]).filter(item=>item.type==='source');
  assert.match(entries[0].reference, /#news-/);
  assert.notEqual(entries[0].reference,entries[1].reference);
  assert.match(entries[0].detail,/First item/);
  assert.equal(entries[0].referenceLabel,'查看引用新闻条目');
  assert.match(entries[2].reference,/#section-/);
  assert.match(entries[2].referenceLabel,/未明确对应/);
  post.category='技术复盘';
  assert.ok(collectSearchEntries([post]).filter(item=>item.type==='source').every(item=>item.reference.includes('#section-')));
});

test('pagination controls keep native disabled state, labels and hidden empty state',()=>{
 const html=renderSearch([]);
 assert.match(html,/<nav id="search-pagination" aria-label="搜索结果分页" hidden>/);
 for(const id of ['first','previous','next','last'])assert.ok(html.includes(`id="search-${id}" type="button"`));
 const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
 assert.match(css,/#search-pagination\[hidden\]\{display:none\}/);
 assert.match(css,/#search-pagination:not\(\[hidden\]\)\{display:flex/);
 assert.match(css,/#search-pagination:not\(\[hidden\]\)\{[^}]*flex-wrap:wrap/);
 assert.match(css,/#search-pagination button:disabled\{cursor:default/);
});

test('pagination covers unique destinations once and resets after IME on a later page',()=>{
 const records=Array.from({length:73},(_,i)=>({type:'article',title:`Match ${i}`,detail:'',date:'2026-01-01',href:`/notes/item-${i}/`}));
 const nodes=boot(records),query=nodes['search-query'];
 query.value='match';query.fire('input');
 const first=nodes['search-results'].children[0].children.map(item=>item.children[0].href);
 nodes['search-next'].fire('click');
 const second=nodes['search-results'].children[0].children.map(item=>item.children[0].href);
 assert.deepEqual([...first,...second],records.map(item=>item.href));
 query.fire('compositionstart');query.value='match 0';query.fire('input');
 assert.equal(nodes['search-results'].start,51);
 query.fire('compositionend');assert.equal(nodes['search-results'].start,1);
 assert.match(nodes['search-status'].textContent,/共找到 8 条/);
});
test('exact page boundaries never expose an empty page',()=>{
 for(const count of [50,100]) {
  const nodes=boot(Array.from({length:count},()=>({type:'article',title:'Match',detail:'',date:'2026-01-01',href:'/notes/item/'})));
  nodes['search-query'].value='match';nodes['search-query'].fire('input');
  assert.equal(nodes['search-pagination'].hidden,count===50);
  if(count===100)nodes['search-next'].fire('click');
  assert.equal(nodes['search-next'].disabled,true);
  assert.equal(nodes['search-results'].children[0].children.length,50);
 }
});


test('inclusive review-date filters work without keywords and combine with text/type',()=>{
 const nodes=boot([{type:'article',title:'AI first',detail:'',date:'2026-10-30',href:'/notes/one/'},{type:'source',title:'AI middle',detail:'',date:'2026-10-31',href:'/notes/two/'},{type:'article',title:'AI last',detail:'',date:'2026-11-01',href:'/notes/three/'}]);
 nodes['search-from'].value='2026-10-31';nodes['search-from'].fire('change');
 assert.match(nodes['search-status'].textContent,/共找到 2 条/);
 nodes['search-to'].value='2026-10-31';nodes['search-to'].fire('change');
 assert.match(nodes['search-status'].textContent,/共找到 1 条/);
 nodes['search-type'].value='article';nodes['search-type'].fire('change');
 assert.match(nodes['search-status'].textContent,/共找到 0 条/);
 nodes['search-from'].value='2026-11-01';nodes['search-from'].fire('change');
 assert.match(nodes['search-status'].textContent,/起始日期不能晚于/);
 assert.equal(nodes['search-results'].children[0].children.length,0);
 nodes['search-clear'].fire('click');
 assert.equal(nodes['search-from'].value,'');assert.equal(nodes['search-to'].value,'');
 assert.match(nodes['search-status'].textContent,/请输入/);
});
test('date changes reset later pages and preserve native accessible date labels',()=>{
 const nodes=boot(Array.from({length:51},()=>({type:'article',title:'AI',detail:'',date:'2026-10-31',href:'/notes/one/'})));
 nodes['search-query'].value='AI';nodes['search-query'].fire('input');nodes['search-next'].fire('click');
 assert.equal(nodes['search-results'].start,51);
 nodes['search-to'].value='2026-10-31';nodes['search-to'].fire('change');
 assert.equal(nodes['search-results'].start,1);
 const html=renderSearch([]);for(const id of ['from','to']){assert.ok(html.includes(`for="search-${id}"`));assert.ok(html.includes(`id="search-${id}" type="date"`));}
});

test('explicit paging moves focus to the new range without stealing input focus',()=>{
 const nodes=boot(Array.from({length:51},()=>({type:'article',title:'AI',detail:'',date:'2026-01-01',href:'/notes/a/'})));
 const status=nodes['search-status'];assert.equal(status.focused,undefined);
 nodes['search-query'].value='AI';nodes['search-query'].fire('input');assert.equal(status.focused,undefined);
 nodes['search-next'].fire('click');assert.equal(status.focused,true);assert.match(status.textContent,/51–51/);
 status.focused=false;nodes['search-next'].fire('click');assert.equal(status.focused,false);
 nodes['search-previous'].fire('click');assert.equal(status.focused,true);
 status.focused=false;nodes['search-query'].fire('input');assert.equal(status.focused,false);
 assert.match(renderSearch([]),/id="search-status" tabindex="-1"/);
 assert.equal((renderSearch([]).match(/aria-controls="search-results"/g)||[]).length,5);
});

test('incomplete native dates block results instead of silently removing a boundary',()=>{
 const nodes=boot([{type:'article',title:'AI',detail:'',date:'2026-01-01',href:'/notes/a/'}]);
 nodes['search-query'].value='AI';nodes['search-query'].fire('input');
 const from=nodes['search-from'],to=nodes['search-to'];from.validity={badInput:true};from.value='';from.fire('input');
 assert.match(nodes['search-status'].textContent,/日期输入不完整或超出支持范围/);assert.equal(nodes['search-results'].children[0].children.length,0);assert.equal(from['aria-invalid'],'true');
 from.validity={badInput:false};from.value='2026-01-01';from.fire('change');assert.match(nodes['search-status'].textContent,/共找到 1 条/);assert.equal(from['aria-invalid'],'false');
 to.validity={badInput:true};to.fire('input');assert.equal(to['aria-invalid'],'true');assert.equal(nodes['search-pagination'].hidden,true);
 to.validity={badInput:false};to.value='2025-12-31';to.fire('change');assert.equal(from['aria-invalid'],'true');assert.equal(to['aria-invalid'],'true');
 to.value='2026-01-01';to.fire('input');assert.equal(from['aria-invalid'],'false');assert.equal(to['aria-invalid'],'false');
 assert.equal((renderSearch([]).match(/type="date" min="0001-01-01" max="9999-12-31" aria-describedby="search-help search-date-error"/g)||[]).length,2);

});

test('print snapshot tracks filters and page status without interpreting input as markup',()=>{
 const nodes=boot(Array.from({length:51},()=>({type:'source',title:'<tag>',detail:'',date:'2026-01-01',href:'https://example.com/?x=1&y=2'})));
 nodes['search-query'].value='<tag>';nodes['search-query'].fire('input');
 assert.match(nodes['search-print-context'].textContent,/关键词：<tag>/);assert.match(nodes['search-print-context'].textContent,/仅包含当前显示的一页/);
 nodes['search-next'].fire('click');assert.match(nodes['search-status'].textContent,/51–51/);
 nodes['search-from'].value='2026-01-01';nodes['search-from'].fire('input');assert.match(nodes['search-print-context'].textContent,/2026-01-01 至 不限/);
 nodes['search-clear'].fire('click');assert.match(nodes['search-print-context'].textContent,/关键词：未指定/);assert.match(nodes['search-status'].textContent,/请输入/);
 const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8'),at=css.indexOf('@media print{');
 assert.match(css.slice(at),/#search-controls\{display:none\}/);assert.match(css.slice(at),/#search-results a\[href\^="https:\/\/"\]::after/);
 assert.match(css.slice(at),/#search-results a\[href\^="\/"\]::after/);
});

test('native date segment keyup and blur recheck validity even when no input event fires',()=>{
 const n=boot([{type:'article',title:'AI',detail:'',date:'2026-01-01',href:'/notes/a/'}]);n['search-query'].value='AI';n['search-query'].fire('input');
 const from=n['search-from'];from.validity={badInput:true};from.value='';from.fire('keyup');
 assert.equal(from['aria-invalid'],'true');assert.match(n['search-status'].textContent,/日期输入不完整或超出支持范围/);assert.equal(n['search-results'].children[0].children.length,0);
 from.validity={badInput:false};from.value='2026-01-01';from.fire('blur');assert.equal(from['aria-invalid'],'false');assert.match(n['search-status'].textContent,/共找到 1 条/);
});

test('tabbing through unchanged date segments does not reset the result page',()=>{
 const n=boot(Array.from({length:51},()=>({type:'article',title:'AI',detail:'',date:'2026-01-01',href:'/notes/a/'})));n['search-query'].value='AI';n['search-query'].fire('input');n['search-next'].fire('click');
 n['search-from'].fire('keyup');n['search-from'].fire('blur');assert.equal(n['search-results'].start,51);
 n['search-from'].validity={badInput:true};n['search-from'].fire('keyup');assert.match(n['search-print-context'].textContent,/无效或未填完整/);
});

test('exact topic filtering composes with text, type and date, resets paging and clears',()=>{
 const records=[...Array.from({length:51},(_,i)=>({type:'headline',topics:['ai'],title:'AI'+i,detail:'',date:'2026-11-01',href:'/notes/a/'})),{type:'source',topics:['world'],title:'AI abroad',detail:'',date:'2026-11-01',href:'https://example.com'}, {type:'article',topics:[],title:'AI retrospective',detail:'',date:'2026-11-01',href:'/notes/r/'}];
 const n=boot(records);n['search-topic'].value='ai';n['search-topic'].fire('change');assert.match(n['search-status'].textContent,/共找到 51 条/);
 n['search-next'].fire('click');assert.equal(n['search-results'].start,51);
 n['search-topic'].value='world';n['search-topic'].fire('change');assert.equal(n['search-results'].start,1);assert.match(n['search-status'].textContent,/共找到 1 条/);
 n['search-query'].value='AI';n['search-query'].fire('input');n['search-type'].value='headline';n['search-type'].fire('change');assert.match(n['search-status'].textContent,/共找到 0 条/);
 assert.match(n['search-print-context'].textContent,/新闻栏目：国际政治与重大事件/);n['search-type'].value='all';n['search-from'].value='2026-11-02';n['search-from'].fire('input');assert.match(n['search-status'].textContent,/共找到 0 条/);
 n['search-clear'].fire('click');assert.equal(n['search-topic'].value,'all');assert.match(n['search-status'].textContent,/请输入/);
 assert.match(renderSearch([]),/for="search-topic"/);
});
test('topic metadata follows exact news sections including legacy names, not title keywords',()=>{
 const original=posts.find(p=>p.category==='新闻回顾');const samples=[{...original,slug:'fixture',sections:[{heading:'股票',paragraphs:['1. Example。Fact'],sources:original.sections.flatMap(s=>s.sources??[]).slice(0,1)}]}, {...original,slug:'retrospective',category:'工作复盘',sections:[{heading:'AI',paragraphs:['1. Example。Fact'],sources:[]}]}];
 const data=collectSearchEntries(samples);for(const r of data.filter(r=>r.href.startsWith('/notes/retrospective/')))assert.deepEqual(r.topics,[]);
 for(const r of data.filter(r=>r.href.startsWith('/notes/fixture/')||r.reference?.startsWith('/notes/fixture/')))assert.deepEqual(r.topics,['markets']);
 for(const r of collectSearchEntries(posts))assert.ok(r.topics.every(t=>['ai','business','markets','china-policy','world'].includes(t)));
});

test('content type alone browses matching records and paginates without requiring hidden criteria', () => {
  const records = Array.from({length: 63}, (_,index) => ({type:'headline', topics:['ai'], title:`Title ${index}`, detail:'',date:'2026-11-02',href:`/notes/example/#news-${index}`}));
  records.push({type:'article',topics:[],title:'Article',detail:'',date:'2026-11-02',href:'/notes/example/'});
  const nodes = boot(records);
  nodes['search-type'].value = 'headline'; nodes['search-type'].fire('change');
  assert.match(nodes['search-status'].textContent, /共找到 63 条/);
  nodes['search-next'].fire('click');
  assert.equal(nodes['search-results'].start, 51);
  nodes['search-type'].value = 'article'; nodes['search-type'].fire('change');
  assert.equal(nodes['search-results'].start, 1);
  assert.match(nodes['search-status'].textContent, /共找到 1 条/);
  nodes['search-type'].value = 'source'; nodes['search-type'].fire('change');
  assert.match(nodes['search-status'].textContent, /共找到 0 条/);
  nodes['search-clear'].fire('click');
  assert.match(nodes['search-status'].textContent, /请输入/);
});

test('extended native years cannot silently widen lexicographic date filters', () => {
  const nodes=boot([{type:'article',title:'AI',detail:'',date:'2026-11-02',href:'/notes/example/'}]);
  nodes['search-query'].value='AI'; nodes['search-query'].fire('input');
  nodes['search-from'].value='10000-01-01'; nodes['search-from'].validity={badInput:false,rangeOverflow:true}; nodes['search-from'].fire('input');
  assert.equal(nodes['search-from']['aria-invalid'],'true');
  assert.equal(nodes['search-results'].children[0].children.length,0);
  assert.match(nodes['search-status'].textContent,/0001–9999/);
  assert.match(nodes['search-print-context'].textContent,/无效或未填完整/);
  nodes['search-from'].validity={badInput:false}; nodes['search-from'].fire('change');
  assert.equal(nodes['search-from']['aria-invalid'],'true');
  nodes['search-from'].value='0001-01-01'; nodes['search-from'].fire('input');
  nodes['search-to'].value='9999-12-31'; nodes['search-to'].fire('input');
  assert.match(nodes['search-status'].textContent,/共找到 1 条/);
  assert.equal(nodes['search-from']['aria-invalid'],'false');
  nodes['search-to'].value='10000-12-31'; nodes['search-to'].fire('input');
  assert.equal(nodes['search-to']['aria-invalid'],'true');
  nodes['search-clear'].fire('click');
  assert.equal(nodes['search-to']['aria-invalid'],'false');
  assert.equal((renderSearch([]).match(/min="0001-01-01" max="9999-12-31"/g)||[]).length,2);
});


test('date ordering is stable, resets pagination, prints its context and clears to newest', () => {
 const records = Array.from({length:55}, (_,index)=>({type:'article',title:`Item ${index}`,detail:'',date:index<2?'2026-01-01':'2026-02-01',href:`/notes/item-${index}/`}));
 const nodes=boot(records), order=nodes['search-order'];
 nodes['search-type'].value='article';nodes['search-type'].fire('change');
 const first=()=>nodes['search-results'].children[0].children[0].children[0].href;
 assert.equal(first(),'/notes/item-2/');
 nodes['search-next'].fire('click');
 order.value='oldest';order.fire('change');
 assert.equal(nodes['search-results'].start,1);
 assert.equal(first(),'/notes/item-0/');
 assert.equal(nodes['search-results'].children[0].children[1].children[0].href,'/notes/item-1/');
 assert.match(nodes['search-print-context'].textContent,/回顾日期从旧到新/);
 nodes['search-clear'].fire('click');
 assert.equal(order.value,'newest');
 assert.match(nodes['search-status'].textContent,/请输入/);
 order.value='oldest';order.fire('change');
 assert.match(nodes['search-status'].textContent,/请输入/);
 assert.match(renderSearch([]),/label for="search-order"/);
});


test('first and last page shortcuts reach boundaries, preserve order and reset with filters', () => {
 const nodes = boot(Array.from({length:151},(_,i)=>({type:'article',title:`AI item ${i}`,detail:'',date:'2026-01-01',href:`/notes/item-${i}/`})));
 const first = nodes['search-first'],last = nodes['search-last'],results = nodes['search-results'],status = nodes['search-status'];
 assert.equal(nodes['search-pagination'].hidden,true);
 nodes['search-type'].value='article';nodes['search-type'].fire('change');
 assert.equal(first.disabled,true);assert.equal(last.disabled,false);
 first.fire('click');assert.equal(status.focused,undefined);
 last.fire('click');assert.equal(results.start,151);assert.equal(last.disabled,true);assert.equal(first.disabled,false);
 assert.match(status.textContent,/第 4 \/ 4 页/);assert.equal(status.focused,true);
 assert.equal(results.children[0].children[0].children[0].href,'/notes/item-150/');
 status.focused=false;last.fire('click');assert.equal(status.focused,false);
 first.fire('click');assert.equal(results.start,1);assert.equal(status.focused,true);assert.equal(first.disabled,true);
 last.fire('click');nodes['search-query'].value='item 150';nodes['search-query'].fire('input');
 assert.equal(results.start,1);assert.equal(nodes['search-pagination'].hidden,true);assert.equal(first.disabled,true);assert.equal(last.disabled,true);
 nodes['search-clear'].fire('click');assert.equal(first.disabled,true);assert.equal(last.disabled,true);
});
test('last page shortcut handles an exact page boundary without an empty page',()=>{
 const nodes=boot(Array.from({length:100},(_,i)=>({type:'article',title:`AI ${i}`,detail:'',date:'2026-01-01',href:`/notes/${i}/`})));
 nodes['search-type'].value='article';nodes['search-type'].fire('change');nodes['search-last'].fire('click');
 assert.equal(nodes['search-results'].start,51);assert.equal(nodes['search-results'].children[0].children.length,50);
 assert.equal(nodes['search-next'].disabled,true);assert.equal(nodes['search-last'].disabled,true);
});


test('source URL queries find all citations locally without indexing internal navigation paths', () => {
 const url='https://example.com/release/v1.2?name=AI&mode=public#result';
 const nodes=boot([
  {type:'source',title:'One citation',detail:'example.com',date:'2026-01-02',href:url,reference:'/notes/one/#news-1'},
  {type:'source',title:'Other citation',detail:'example.com',date:'2026-01-01',href:url,reference:'/notes/two/#news-1'},
  {type:'article',title:'One article',detail:'summary',date:'2026-01-02',href:'/notes/internal-only-path/'}
 ]);
 const query=nodes['search-query'],status=nodes['search-status'],results=nodes['search-results'];
 query.value=url;query.fire('input');assert.match(status.textContent,/共找到 2 条/);
 assert.deepEqual(results.children[0].children.map(item=>item.children[2].href),['/notes/one/#news-1','/notes/two/#news-1']);
 query.value='/RELEASE/V1.2?NAME=ai&MODE=public#RESULT';query.fire('input');assert.match(status.textContent,/共找到 2 条/);
 nodes['search-from'].value='2026-01-02';nodes['search-from'].fire('change');assert.match(status.textContent,/共找到 1 条/);
 nodes['search-clear'].fire('click');query.value='internal-only-path';query.fire('input');assert.match(status.textContent,/共找到 0 条/);
 query.value='https://unlisted.example/private';query.fire('input');assert.match(status.textContent,/共找到 0 条/);
 assert.match(renderSearch([]),/完整网址或网址片段/);
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|location\.|history\./);
});


test('Enter focuses fresh search results without consuming IME confirmation', () => {
  const nodes = boot([{type:'article', title:'Find me', detail:'', date:'2026-01-01', href:'/notes/found/'}]);
  const query = nodes['search-query'], status = nodes['search-status'];
  query.value = 'Find';
  let prevented = 0;
  const enter = {key:'Enter', preventDefault:() => prevented++};
  query.fire('keydown', {key:'ArrowDown'});
  query.fire('compositionstart'); query.fire('keydown', enter);
  assert.equal(status.focused, undefined);
  query.fire('compositionend');
  query.fire('keydown', {...enter, isComposing:true});
  query.fire('keydown', {...enter, keyCode:229});
  assert.equal(status.focused, undefined);
  assert.equal(prevented, 0);
  query.fire('keydown', enter);
  assert.equal(prevented, 1);
  assert.equal(status.focused, true);
  assert.match(status.textContent, /共找到 1 条/);
  query.value = 'missing'; query.fire('keydown', enter);
  assert.match(status.textContent, /共找到 0 条/);
  assert.match(renderSearch([]), /按 Enter 可跳到结果状态/);
});


test('news full text keeps continuation paragraphs with exactly their own item', () => {
  const post = {slug:'prose', date:'2026-11-01', title:'简报', summary:'概述', category:'新闻回顾', sections:[
    {heading:'AI', paragraphs:['说明不索引', '1. First。事实甲。', '影响甲。', '2. Second。事实乙。', '影响乙。']},
    {heading:'商业', paragraphs:['新章节说明', '1. Third。事实丙。']}
  ]};
  const before = structuredClone(post);
  const entries = collectSearchEntries([post]);
  assert.deepEqual(entries.filter(item => item.type === 'headline').map(item => item.body), [
    '1. First。事实甲。\n影响甲。', '2. Second。事实乙。\n影响乙。', '1. Third。事实丙。'
  ]);
  assert.deepEqual(post, before);
  assert.ok(entries.filter(item => item.type !== 'headline').every(item => item.body === undefined));
  const html = renderSearch([{...post, sections:[{heading:'AI', paragraphs:['1. Title。</template><script>unsafe</script>']}]}]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('optional news prose matching respects scope, filters, normalization and clear', () => {
  const records = [
    {type:'headline', topics:['ai'], title:'Title', detail:'AI', body:'ＡＢＣ 中文续段', date:'2026-11-01', href:'/notes/test/#news-one'},
    {type:'source', title:'Source', detail:'example.test', body:'中文续段', date:'2026-11-01', href:'https://example.test/'}
  ];
  const nodes = boot(records), query = nodes['search-query'], scope = nodes['search-scope'], status = nodes['search-status'];
  query.value = 'abc 中文续段'; query.fire('input');
  assert.match(status.textContent, /共找到 0 条/);
  scope.value = 'body'; scope.fire('change');
  assert.match(status.textContent, /共找到 1 条/);
  assert.equal(nodes['search-results'].children[0].children[0].children[0].href, '/notes/test/#news-one');
  assert.match(nodes['search-print-context'].textContent, /匹配范围：同时匹配新闻正文/);
  nodes['search-topic'].value = 'world'; nodes['search-topic'].fire('change');
  assert.match(status.textContent, /共找到 0 条/);
  query.value = '中文续段';
  nodes['search-topic'].value = 'all'; nodes['search-type'].value = 'source'; nodes['search-type'].fire('change');
  assert.match(status.textContent, /共找到 0 条/);
  nodes['search-clear'].fire('click');
  assert.equal(scope.value, 'summary');
  assert.match(nodes['search-print-context'].textContent, /匹配范围：标题、摘要与来源/);
  assert.match(renderSearch([]), /label for="search-scope"/);
});

test('changing news prose scope resets pagination and does not turn scope alone into a filter', () => {
  const nodes = boot(Array.from({length:73}, (_,index) => ({type:'headline',title:'Title',detail:'',body:'Body',date:'2026-11-01',href:`/notes/test/#${index}`})));
  const scope = nodes['search-scope'];
  scope.value = 'body'; scope.fire('change');
  assert.match(nodes['search-status'].textContent, /请输入/);
  nodes['search-query'].value = 'Body'; nodes['search-query'].fire('input');
  nodes['search-next'].fire('click'); assert.equal(nodes['search-results'].start, 51);
  scope.value = 'summary'; scope.fire('change');
  assert.equal(nodes['search-results'].start, 1);
  assert.match(nodes['search-status'].textContent, /共找到 0 条/);
});


test('full-text matches expose original matching paragraphs through optional native disclosures', () => {
 const body='1. Title。First fact.\nＡＩ <img src=x> detail.\nAnother unrelated paragraph.';
 const nodes=boot([{type:'headline',title:'Title',detail:'AI',date:'2026-01-01',href:'/notes/example/#news-1',body}]);
 nodes['search-query'].value='ai'; nodes['search-query'].fire('input');
 assert.equal(nodes['search-results'].children[0].children[0].children.length,2);
 nodes['search-scope'].value='body'; nodes['search-scope'].fire('change');
 const disclosure=nodes['search-results'].children[0].children[0].children[2];
 assert.equal(disclosure.className,'search-match-context');
 assert.equal(disclosure.children[0].textContent,'查看匹配正文');
 assert.equal(disclosure.children[1].textContent,'ＡＩ <img src=x> detail.');
 assert.equal(disclosure.children.length,2);
 assert.equal(disclosure.open,undefined);
 nodes['search-query'].value=''; nodes['search-type'].value='headline'; nodes['search-type'].fire('change');
 assert.equal(nodes['search-results'].children[0].children[0].children.length,2);
});


test('date errors sit beside date controls, identify invalid fields and clear after recovery', () => {
 const html=renderSearch([]);
 for(const id of ['search-from','search-to']) assert.match(html,new RegExp(`id="${id}"[^>]+aria-describedby="search-help search-date-error"[^>]+aria-errormessage="search-date-error"`));
 assert.match(html,/<p id="search-date-error" hidden><\/p><button id="search-latest"/);
 const nodes=boot([]),from=nodes['search-from'],to=nodes['search-to'],error=nodes['search-date-error'];
 assert.equal(error.hidden,true);
 from.validity={badInput:true}; from.fire('input');
 assert.match(error.textContent,/起始日期未填写完整/); assert.equal(error.hidden,false);
 assert.equal(from['aria-invalid'],'true'); assert.equal(to['aria-invalid'],'false');
 from.validity={}; from.value='2026-11-07'; to.value='2026-11-01'; to.fire('input');
 assert.match(error.textContent,/起始日期晚于结束日期/); assert.equal(to['aria-invalid'],'true');
 to.value='2026-11-08'; to.fire('change');
 assert.equal(error.hidden,true); assert.equal(error.textContent,'');
 assert.equal(from['aria-invalid'],'false'); assert.equal(to['aria-invalid'],'false');
});


test('quoted phrases require contiguous normalized text and combine with other terms',()=>{
 const records=[{type:'headline',title:'Open source model 开源 模型',detail:'Fast',body:'Original open source context.',date:'2026-11-01',href:'/notes/a/'},{type:'headline',title:'Open model with source 开源 其他 模型',detail:'Fast',body:'Other context',date:'2026-11-01',href:'/notes/b/'}];
 const nodes=boot(records),query=nodes['search-query'];
 query.value='open source';query.fire('input');assert.match(nodes['search-status'].textContent,/共找到 2 条/);
 query.value='"ＯＰＥＮ   SOURCE" fast';query.fire('input');assert.match(nodes['search-status'].textContent,/共找到 1 条/);
 assert.equal(nodes['search-results'].children[0].children[0].children[0].href,'/notes/a/');
 query.value='"open source" missing';query.fire('input');assert.match(nodes['search-status'].textContent,/共找到 0 条/);
 query.value='""';query.fire('input');assert.match(nodes['search-status'].textContent,/请输入/);
 query.value='"open';query.fire('input');assert.match(nodes['search-status'].textContent,/共找到 2 条/);
 query.value='"开源 模型" fast';query.fire('input');assert.match(nodes['search-status'].textContent,/共找到 1 条/);
 query.value='"open source"';nodes['search-scope'].value='body';nodes['search-scope'].fire('change');
 assert.equal(nodes['search-results'].children[0].children[0].children[2].children[1].textContent,'Original open source context.');
});


test('latest review-day shortcut uses indexed dates and preserves every other search filter',()=>{
 const records=[{type:'headline',topics:['ai'],title:'Model',detail:'Fast',date:'2026-11-01',href:'/notes/a/'},{type:'headline',topics:['ai'],title:'Model',detail:'Fast',date:'2026-11-07',href:'/notes/b/'}];
 const nodes=boot(records);
 assert.equal(nodes['search-latest'].textContent,'最新收录回顾日：2026-11-07');
 for(const [id,value] of [['query','model'],['scope','body'],['topic','ai'],['type','headline'],['order','oldest']]) nodes[`search-${id}`].value=value;
 nodes['search-latest'].fire('click');
 assert.equal(nodes['search-from'].value,'2026-11-07');assert.equal(nodes['search-to'].value,'2026-11-07');
 for(const [id,value] of [['query','model'],['scope','body'],['topic','ai'],['type','headline'],['order','oldest']]) assert.equal(nodes[`search-${id}`].value,value);
 assert.match(nodes['search-status'].textContent,/共找到 1 条/);
 assert.equal(nodes['search-results'].children[0].children[0].children[0].href,'/notes/b/');
 nodes['search-clear'].fire('click');assert.equal(nodes['search-from'].value,'');assert.equal(nodes['search-to'].value,'');
 const empty=boot([]);assert.equal(empty['search-latest'].disabled,true);empty['search-latest'].fire('click');assert.equal(empty['search-from'].value,'');
 assert.match(renderSearch([]),/不代表今天、实际发布时间或实时新闻/);
});

test('fallback date fields reject impossible calendar days and century leap errors', () => {
  const nodes = boot([{type:'article',title:'date',detail:'',date:'2026-01-01',href:'/notes/date/'}]);
  const from = nodes['search-from'];
  for (const value of ['2026-02-30', '1900-02-29', '2026-04-31', '0000-01-01', '2026-13-01']) {
    from.value = value; from.fire('input');
    assert.equal(from['aria-invalid'], 'true', value);
    assert.equal(nodes['search-results'].children[0].children.length, 0);
  }
  for (const value of ['2000-02-29', '0001-01-01', '9999-12-31']) {
    from.value = value; from.fire('input');
    assert.equal(from['aria-invalid'], 'false', value);
  }
});

test('full-text results retain a safe print copy independently of disclosure state', () => {
  const nodes = boot([{type:'headline',title:'A',detail:'',body:'matching <tag> paragraph\nother',date:'2026-01-01',href:'/notes/a/'}]);
  nodes['search-query'].value='matching';
  nodes['search-scope'].value='body'; nodes['search-scope'].fire('change');
  const children = nodes['search-results'].children[0].children[0].children;
  const print = children.find(node => node.className === 'search-print-match');
  assert.equal(print.children.length, 1);
  assert.equal(print.children[0].textContent, 'matching <tag> paragraph');
  const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.search-print-match\{display:none\}/);
  assert.match(css, /@media print\{[\s\S]*?\.search-match-context\{display:none\}\s*\.search-print-match\{display:block/);
});

test('explicit browse-all mode paginates all types, supports filtering and exits on clear', () => {
  const nodes = boot(Array.from({length:73}, (_,i) => ({type:i%2 ? 'article':'source',title:'entry',detail:'',date:'2026-01-01',href:'/notes/a/'})));
  nodes['search-query'].value='missing';
  nodes['search-from'].value='9999-01-01';
  nodes['search-browse'].fire('click');
  assert.equal(nodes['search-query'].value, '');
  assert.equal(nodes['search-from'].value, '');
  assert.match(nodes['search-status'].textContent, /共找到 73 条/);
  assert.equal(nodes['search-status'].focused, true);
  nodes['search-next'].fire('click');
  assert.equal(nodes['search-results'].start, 51);
  nodes['search-type'].value='article'; nodes['search-type'].fire('change');
  assert.match(nodes['search-status'].textContent, /共找到 36 条/);
  nodes['search-browse'].fire('click');
  assert.match(nodes['search-status'].textContent, /共找到 73 条/);
  assert.equal(nodes['search-results'].start, 1);
  nodes['search-clear'].fire('click');
  assert.match(nodes['search-status'].textContent, /请输入/);
  assert.equal(nodes['search-results'].children[0].children.length, 0);
});

test('Chinese paired quotes search contiguous phrases and preserve mixed terms', () => {
  const records = [
    {type:'article',title:'open source 人工智能 商业动态',detail:'',date:'2026-11-10',href:'/one/'},
    {type:'article',title:'open other source 人工 智能 商业',detail:'',date:'2026-11-10',href:'/two/'}
  ];
  const nodes = boot(records);
  for (const value of ['“open source”', '「open source」', '“open source', '「open source', '“open source” 人工', '「商业动态」', '“” 「」 人工智能']) {
    nodes['search-query'].value = value; nodes['search-query'].fire('input');
    assert.match(nodes['search-status'].textContent, /共找到 1 条/);
    assert.equal(nodes['search-results'].children[0].children[0].children[0].href, '/one/');
  }
  nodes['search-query'].value = '“open source” 不存在'; nodes['search-query'].fire('input');
  assert.match(nodes['search-status'].textContent, /共找到 0 条/);
});

test('result breakdown counts all matched pages by type and clears on invalid filters', () => {
  const records = Array.from({length:52}, (_,i)=>({type:'headline', title:`AI ${i}`,detail:'',date:'2026-11-10',href:`/notes/a/#news-${i}`}));
  records.push({type:'article',title:'AI briefing',detail:'',date:'2026-11-10',href:'/notes/a/'});
  for(let i=0;i<2;i++) records.push({type:'source',title:'AI source',detail:'',date:'2026-11-10',href:'https://example.org/'});
  const n=boot(records); n['search-query'].value='AI'; n['search-query'].fire('input');
  assert.match(n['search-status'].textContent,/文章 1 篇，新闻条目 52 条，引用来源 2 处/);
  assert.match(n['search-status'].textContent,/共找到 55 条，显示 50 条/);
  n['search-next'].fire('click');
  assert.match(n['search-status'].textContent,/文章 1 篇，新闻条目 52 条，引用来源 2 处/);
  assert.match(n['search-status'].textContent,/显示 5 条/);
  n['search-type'].value='source'; n['search-type'].fire('change');
  assert.match(n['search-status'].textContent,/文章 0 篇，新闻条目 0 条，引用来源 2 处/);
  n['search-from'].value='2026-02-30'; n['search-from'].fire('input');
  assert.doesNotMatch(n['search-status'].textContent,/分类合计/);
  n['search-clear'].fire('click'); assert.doesNotMatch(n['search-status'].textContent,/分类合计/);
  n['search-query'].value='missing'; n['search-query'].fire('input');
  assert.match(n['search-status'].textContent,/文章 0 篇，新闻条目 0 条，引用来源 0 处/);
});
