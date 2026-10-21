import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFeedPosts } from './feed-order.mjs';
import { renderFeed, renderCategoryFeed } from './feed.mjs';
import { renderJsonFeed } from './json-feed.mjs';
const make=(slug,date,publishedAt)=>({slug,date,publishedAt,title:slug,subtitle:'副标题',summary:'摘要',category:'新闻',sections:[{heading:'内容',paragraphs:['公开内容']}],closing:'结束'});
test('late backfills appear before older publications in all subscription formats',()=>{
 const recent=make('recent','2026-10-21','2026-10-21T01:00:00Z');
 const backfill=make('backfill','2026-10-14','2026-10-21T02:00:00Z');
 const posts=[recent,backfill]; const before=JSON.stringify(posts);
 assert.deepEqual(orderFeedPosts(posts).map(p=>p.slug),['backfill','recent']);
 for(const xml of [renderFeed(posts),renderCategoryFeed({name:'新闻',path:'/category/',posts})]) assert.ok(xml.indexOf('<title>backfill</title>')<xml.indexOf('<title>recent</title>'));
 assert.deepEqual(JSON.parse(renderJsonFeed(posts)).items.map(p=>p.title),['backfill','recent']);
 assert.equal(JSON.stringify(posts),before);
});
test('legacy dates and equal publication timestamps retain stable deterministic ordering',()=>{
 const a=make('a','2026-10-20','2026-10-21T01:00:00Z');
 const b=make('b','2026-10-20','2026-10-21T01:00:00Z');
 const old=make('old','2026-10-19',undefined);
 assert.deepEqual(orderFeedPosts([b,old,a]).map(p=>p.slug),['a','b','old']);
 assert.deepEqual(orderFeedPosts([]),[]);
});
