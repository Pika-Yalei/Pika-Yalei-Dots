import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePosts } from './validate-posts.mjs';
import { newsColumns, newsWindowText } from './news-window.mjs';
import { articleText } from './article-content.mjs';
import { renderFeed } from './feed.mjs';
const fixture=()=>({slug:'news-example',date:'2026-10-21',title:'2026-10-21｜24 小时新闻简报',subtitle:'窗口',summary:'摘要',category:'新闻回顾',readingMinutes:3,publishedAt:'2026-10-21T03:01:00Z',publicationKind:'original',newsWindow:{start:'2026-10-20T03:00:00Z',end:'2026-10-21T03:00:00Z'},sections:[{heading:'回顾范围',paragraphs:['说明']},...newsColumns.map(heading=>({heading,paragraphs:['本期暂缺可靠新增。']}))],closing:'小结'});
test('structured news windows preserve exact Beijing times in article and RSS',()=>{
 const post=fixture();validatePosts([post]);
 assert.match(newsWindowText(post),/2026-10-20 11:00:00 至 2026-10-21 11:00:00/);
 assert.match(articleText(post),/新闻窗口/);assert.match(renderFeed([post]),/新闻窗口/);
});
test('news windows reject malformed dates, extra fields, wrong duration, future cutoff and wrong columns',()=>{
 for(const window of [null,[],{start:'bad',end:'bad'},{...fixture().newsWindow,private:'no'},{start:'2026-10-20T04:00:00Z',end:'2026-10-21T03:00:00Z'},{start:'2026-02-30T03:00:00Z',end:'2026-03-01T03:00:00Z'}]) assert.throws(()=>validatePosts([{...fixture(),newsWindow:window}]),/newsWindow/);
 for(const patch of [{date:'2026-10-20'}, {publishedAt:'2026-10-21T02:59:59Z'},{title:'错标题'},{category:'其他'},{sections:fixture().sections.slice(0,-1)}]) assert.throws(()=>validatePosts([{...fixture(),...patch}]),/newsWindow/);
 const post=fixture();[post.sections[1],post.sections[2]]=[post.sections[2],post.sections[1]];assert.throws(()=>validatePosts([post]),/fixed order/);
});
test('legacy articles remain valid without a new window and are not rewritten',()=>{
 const {newsWindow,...legacy}=fixture();validatePosts([legacy]);assert.equal(newsWindowText(legacy),'');
});

test('concise news may start directly with the five columns',()=>{ const p=fixture();p.sections=p.sections.slice(1);validatePosts([p]);assert.match(articleText(p),/新闻窗口/); });
