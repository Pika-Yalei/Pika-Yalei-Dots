import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCategories } from './categories.mjs';
import { paginateCategories, renderCategoryPage } from './category-pagination.mjs';
import { renderSitemap } from './sitemap.mjs';
const posts = Array.from({length:13},(_,index)=>({slug:`note-${index}`,date:`2026-10-${String(index+1).padStart(2,'0')}`,title:`笔记 ${index}`,category:'公开方法',sections:[]}));
test('category pagination is bounded, complete, stable and does not mutate input',()=>{
 const input=groupCategories(posts), before=structuredClone(input), pages=paginateCategories(input);
 assert.deepEqual(pages.map(p=>p.posts.length),[6,6,1]);
 assert.deepEqual(pages.flatMap(p=>p.posts),input[0].posts);
 assert.deepEqual(input,before);
 assert.equal(pages[0].path,input[0].path);
 assert.equal(pages[2].path,`${input[0].path}page/3/`);
 assert.deepEqual(paginateCategories([]),[]);
});
test('category pages retain full feed, ordinal range and accessible neighboring links',()=>{
 const pages=paginateCategories(groupCategories(posts));
 const html=renderCategoryPage(pages[1]);
 assert.match(html,/共 13 篇手记/);assert.match(html,/显示第 7–12 篇/);assert.match(html,/start="7"/);
 assert.ok(html.includes(`href="${pages[0].path}feed.xml"`));
 assert.ok(html.includes(`href="${pages[0].path}" rel="prev"`));
 assert.ok(html.includes(`href="${pages[2].path}" rel="next"`));
 assert.doesNotMatch(renderCategoryPage(pages[0]),/rel="prev"/);
 assert.doesNotMatch(renderCategoryPage(pages[2]),/rel="next"/);
 for(const page of pages)assert.ok(renderSitemap(posts).includes(page.path));
});
