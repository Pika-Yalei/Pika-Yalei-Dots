import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSources, renderSourceIndex } from './source-index.mjs';
const url='https://github.com/simonw/llm/pull/1771';
const post={slug:'example',date:'2026-10-21',title:'标题 <script>',sections:[{heading:'来源 & 证据',paragraphs:['正文'],sources:[{label:'公开 <来源>',url},{label:'重复',url}]}]};
test('source index deduplicates exact URLs and links back to stable section anchors',()=>{
  const entries=collectSources([post,{...post,slug:'second',date:'2026-10-20'}]);
  assert.equal(entries.length,1); assert.equal(entries[0].references.length,2);
  assert.match(entries[0].references[0].href,/^\/notes\/example\/#section-[a-f0-9]{16}$/);
  const html=renderSourceIndex([post]);
  assert.match(html,/公开 &lt;来源&gt;/); assert.match(html,/标题 &lt;script&gt;/);
  assert.match(html,/github.com/); assert.doesNotMatch(html,/<script>/);
});
test('source index is useful without citations and refuses unreviewed URLs',()=>{
  assert.match(renderSourceIndex([]),/尚无可列出的引用来源/);
  assert.throws(()=>collectSources([{...post,sections:[{heading:'H',sources:[{label:'bad',url:'https://unknown.example/'}]}]}]),/Unreviewed/);
});
