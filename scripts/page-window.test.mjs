import test from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow, renderPageWindow } from './page-window.mjs';
test('large archives have bounded endpoint and nearby navigation',()=>{
 for(let total of [1,2,5,50,10000]) for(let number of [1,Math.ceil(total/2),total]) {
  const result=pageWindow(number,total),pages=result.filter(n=>n!==null);
  assert.ok(result.length<=7);assert.equal(pages[0],1);assert.equal(pages.at(-1),total);assert.ok(pages.includes(number));assert.equal(new Set(pages).size,pages.length);
 }
 assert.deepEqual(pageWindow(50,100),[1,null,49,50,51,null,100]);
 for(const args of [[0,3],[4,3],[1,0],[1.5,3],[1,Infinity]]) assert.throws(()=>pageWindow(...args),RangeError);
});
test('navigation has one current page, labelled endpoints and escaped paths',()=>{
 const html=renderPageWindow(50,100,n=>`/page/${n}/?x="`);
 assert.equal((html.match(/aria-current/g)||[]).length,1);assert.match(html,/，首页/);assert.match(html,/，末页/);assert.match(html,/&quot;/);assert.doesNotMatch(html,/href="[^"]*""/);
});
