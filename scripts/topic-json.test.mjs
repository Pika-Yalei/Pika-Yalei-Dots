import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTopicJson } from './topic-json.mjs';
import { collectTopics } from './topics.mjs';
import { sourceUrls } from './article-content.mjs';
const source=[...sourceUrls][0];
const post={slug:'example',date:'2026-10-24',publishedAt:'2026-10-25T01:00:00Z',publicationKind:'backfill',title:'标题',category:'新闻回顾',subtitle:'unrelated subtitle',closing:'unrelated closing',sections:[{heading:'AI',paragraphs:['1. <示例> & 消息。分析。'],sources:[{label:'1. 原文',url:source}]},{heading:'商业',paragraphs:['unrelated body']}]};
test('topic JSON publishes only its section with stable IDs and source-adjacent plain text',()=>{
 const before=structuredClone(post),feed=JSON.parse(renderTopicJson([post],'ai'));
 assert.equal(feed.version,'https://jsonfeed.org/version/1.1');assert.equal(feed.items.length,1);
 const item=feed.items[0];assert.equal(item.id,item.url);assert.match(item.url,/#section-/);
 assert.match(item.content_text,/<示例> & 消息/);assert.ok(item.content_text.includes(source));
 assert.match(item.content_text,/实际补发时间|补发时间/);assert.match(item.content_text,/AI 撰写/);
 assert.doesNotMatch(item.content_text,/unrelated/);assert.deepEqual(post,before);
});
test('five topics handle empty data, unknown IDs and publication ordering',()=>{
 for(const topic of collectTopics([]))assert.deepEqual(JSON.parse(renderTopicJson([],topic.id)).items,[]);
 assert.throws(()=>renderTopicJson([], '../bad'),/Unknown/);
 const older={...post,slug:'older',publishedAt:'2026-10-24T01:00:00Z'};
 const feed=JSON.parse(renderTopicJson([older,post],'ai'));assert.match(feed.items[0].url,/example/);
 assert.equal(renderTopicJson([older,post],'ai'),renderTopicJson([post,older],'ai'));
});
test('built topic JSON feeds are discoverable and match the renderer',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
 for(const topic of collectTopics([])){
  const base=new URL(`../dist/topics/${topic.id}/`,import.meta.url);
  assert.equal(readFileSync(new URL('feed.json',base),'utf8'),renderTopicJson(posts,topic.id));
  const html=readFileSync(new URL('index.html',base),'utf8');
  assert.ok(html.includes(`href="/topics/${topic.id}/feed.json"`));
 }
 assert.match(readFileSync(new URL('../dist/_headers',import.meta.url),'utf8'),/\/topics\/\*\/feed.json\n  Content-Type: application\/feed\+json/);
});
