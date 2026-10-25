import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHeadlines, headlinePages, renderHeadlines, headlinePageSize } from './headlines.mjs';
import { newsItemAnchors } from './reading-navigation.mjs';
const post={slug:'sample',date:'2026-10-24',title:'简报',category:'新闻回顾',sections:[{heading:'AI',paragraphs:['非新闻说明',...Array.from({length:41},(_,i)=>`${i+1}. 标题${i}。事实。`)]},{heading:'补充说明',paragraphs:['1. 不索引。']}]};
test('headline index includes only numbered items in recognized news columns with exact targets',()=>{
 const before=structuredClone(post),entries=collectHeadlines([post]),anchors=newsItemAnchors(post.sections[0]);
 assert.equal(entries.length,41);assert.equal(entries[0].title,'标题0');
 entries.forEach((entry,index)=>assert.equal(entry.href,`/notes/sample/#${anchors[index+1]}`));
 assert.deepEqual(post,before);assert.deepEqual(collectHeadlines([{...post,category:'困难复盘'}]),[]);
});
test('headline pagination is bounded and complete, including empty and last pages',()=>{
 const pages=headlinePages([post]);assert.deepEqual(pages.map(p=>p.entries.length),[headlinePageSize,headlinePageSize,1]);
 assert.equal(new Set(pages.flatMap(p=>p.entries.map(e=>e.href))).size,41);
 assert.equal(pages[0].path,'/headlines/');assert.equal(pages[2].path,'/headlines/page/3/');
 assert.match(renderHeadlines(pages[1]),/显示第 21–40 条/);assert.match(renderHeadlines(pages[1]),/start="21"/);
 assert.doesNotMatch(renderHeadlines(pages[0]),/rel="prev"/);assert.doesNotMatch(renderHeadlines(pages[2]),/rel="next"/);
 assert.match(renderHeadlines(headlinePages([])[0]),/尚无可索引/);
});
test('headline labels escape markup and preserve canonical item identity',()=>{
 const input={...post,sections:[{heading:'AI',paragraphs:['1. <script> & "标题"。说明。']}]};
 const html=renderHeadlines(headlinePages([input])[0]);assert.match(html,/&lt;script&gt; &amp; &quot;标题&quot;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/条目数不等于独立事件数/);
});
