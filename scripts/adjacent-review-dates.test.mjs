import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAdjacent } from './reading-navigation.mjs';
const post=(slug,date)=>({slug,date,title:`Title ${slug}`});
test('adjacent links preserve caller order while same-day articles use neutral labels',()=>{
 const posts=[post('a','2026-11-07'),post('b','2026-11-07'),post('c','2026-11-07')];
 const original=JSON.stringify(posts),html=renderAdjacent(posts,1);
 assert.match(html,/href="\/notes\/c\/" rel="prev"/);
 assert.match(html,/href="\/notes\/a\/" rel="next"/);
 assert.equal((html.match(/同回顾日手记/g)||[]).length,2);
 assert.equal((html.match(/回顾日 <time datetime="2026-11-07">2026-11-07<\/time>/g)||[]).length,2);
 assert.doesNotMatch(html,/较早|较新|发布时间/);
 assert.equal(JSON.stringify(posts),original);
});
test('different-day neighbors include exact review dates and correct chronological labels',()=>{
 const posts=[post('new','2026-11-08'),post('middle','2026-11-07'),post('old','2026-11-06')];
 const html=renderAdjacent(posts,1);
 assert.match(html,/上一篇 · 较早的手记 · 回顾日 <time datetime="2026-11-06">/);
 assert.match(html,/下一篇 · 较新的手记 · 回顾日 <time datetime="2026-11-08">/);
 assert.doesNotMatch(renderAdjacent(posts,0),/rel="next"/);
 assert.doesNotMatch(renderAdjacent(posts,2),/rel="prev"/);
 assert.equal(renderAdjacent([posts[0]],0),'');
 assert.equal(renderAdjacent([],0),'');
 const escaped=renderAdjacent([posts[0],{...posts[1],title:'<script>',date:'bad"<value>'}],0);
 assert.doesNotMatch(escaped,/<script>|bad"<value>/);
 assert.match(escaped,/&lt;script&gt;/);
});
