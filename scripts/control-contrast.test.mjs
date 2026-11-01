import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const style=readFileSync(new URL('../public/style.css',import.meta.url),'utf8'),reader=readFileSync(new URL('../public/reader-controls.css',import.meta.url),'utf8');
function lum(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test('control outlines exceed 3:1 in automatic and manually chosen palettes',()=>{
 for(const css of [style,reader])for(const [paper,border] of [['#f7f5ef','#738364'],['#1c211c','#9eae8c']]){assert.ok(css.includes(`--control-border:${border}`));const [a,b]=[lum(paper),lum(border)].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>=3);}
 assert.match(style,/--control-border:ButtonText/);
});
test('only actual controls use stronger edges while decorative dividers are preserved',()=>{
 assert.match(style,/#search-controls input[^\n]+border:1px solid var\(--control-border\)/);
 for(const cls of ['reader-controls','reader-layout','topic-focus'])assert.match(reader,new RegExp(`\\.${cls} label\\{[^}]*border:1px solid var\\(--control-border\\)`));
 assert.match(style,/--line:#d9dccf;/);assert.match(style,/\.site-header\{[^}]*var\(--line\)/);
});
