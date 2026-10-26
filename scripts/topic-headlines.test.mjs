import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHeadlines, headlinePages, topicHeadlinePages, allHeadlinePages, renderHeadlines } from './headlines.mjs';
import { collectTopics } from './topics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const makePost=(count,slug='sample')=>({slug,date:'2026-10-24',title:'新闻 <script> & "标题"',category:'新闻回顾',sections:['AI','商业','股票','中国政治','国际政治'].map(heading=>({heading:`${heading}｜<tag> & "旧栏目"`,paragraphs:Array.from({length:count},(_,i)=>`${i+1}. 新闻 <img> & "标题${i}"。事实。`)}))});

test('all five columns paginate items at every boundary without omissions, duplicates or input mutation',()=>{
 for(const count of [0,1,19,20,21,40,41]){
  const posts=[makePost(count)],before=JSON.stringify(posts),all=collectHeadlines(posts),pages=topicHeadlinePages(posts);
  assert.equal(JSON.stringify(posts),before);
  for(const topic of collectTopics([])){
   const group=pages.filter(page=>page.topicId===topic.id);
   assert.equal(group.length,Math.max(1,Math.ceil(count/20)));
   assert.deepEqual(group.flatMap(page=>page.entries),all.filter(entry=>entry.topicId===topic.id));
   assert.equal(new Set(group.flatMap(page=>page.entries.map(entry=>entry.href))).size,count);
   for(const page of group){
    assert.ok(page.entries.length<=20);
    assert.equal(page.path,page.number===1?`/headlines/${topic.id}/`:`/headlines/${topic.id}/page/${page.number}/`);
    const html=renderHeadlines(page);
    assert.equal(html.includes('rel="prev"'),page.number>1);
    assert.equal(html.includes('rel="next"'),page.number<page.total);
    assert.ok(html.includes(`href="/headlines/${topic.id}/" aria-current="page"`));
    assert.match(html,/href="\/headlines\/">全部/);
    assert.doesNotMatch(html,/page\/1\//);
    if(count===0)assert.doesNotMatch(html,/显示第|class="pagination"/);
   }
  }
  assert.equal(pages.flatMap(page=>page.entries).length,all.length);
 }
 assert.equal(topicHeadlinePages([]).length,5);
});

test('topic mapping, ordering, repeated headings and escaping retain original item identities',()=>{
 const post=makePost(2);
 post.sections.push({...post.sections[2],paragraphs:['1. 同名章节的另一条新闻。事实。','2. 同名章节的第二条新闻。事实。']});
 const input=[post,makePost(1,'a-first')],all=collectHeadlines(input),pages=topicHeadlinePages(input);
 assert.deepEqual(pages,topicHeadlinePages([...input].reverse()));
 assert.equal(new Set(all.map(entry=>entry.href)).size,all.length);
 assert.equal(pages.find(page=>page.topicId==='markets').count,5);
 assert.equal(pages[0].entries[0].href,all[0].href);
 const html=renderHeadlines(pages[0]);
 assert.match(html,/&lt;img&gt; &amp; &quot;/);
 assert.match(html,/&lt;tag&gt; &amp; &quot;/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<img>|<tag>|<script>/);
 assert.equal(headlinePages(input)[0].path,'/headlines/');
 assert.equal(headlinePages(input).at(-1).path,'/headlines/');
 assert.ok(topicHeadlinePages([{...post,category:'困难复盘'}]).every(page=>page.count===0));
});

test('real and empty builds publish every topic item page, canonical URL and exact article fragment',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'topic-headlines-'));
 try{
  for(const dir of ['scripts','public','content'])await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
  const posts=JSON.parse(await readFile(path.join(root,'content/posts.json'),'utf8'));
  for(const input of [posts,[]]){
   await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(input));
   execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
   const sitemap=await readFile(path.join(temp,'dist/sitemap.xml'),'utf8');
   const paths=new Set(allHeadlinePages(input).map(page=>page.path));
   for(const page of allHeadlinePages(input)){
    const html=await readFile(path.join(temp,'dist',page.path,'index.html'),'utf8');
    assert.ok(sitemap.includes(`${page.path}</loc>`));
    assert.ok(html.includes(`rel="canonical" href="https://pika-yalei-dots.yaleizhang.com${page.path}"`));
    for(const [,href] of html.matchAll(/href="(\/headlines\/[^"#]*)"/g))assert.ok(paths.has(href),href);
    for(const entry of page.entries){
     const [pathname,fragment]=entry.href.split('#');
     assert.ok(html.includes(`href="${entry.href}"`));
     const article=await readFile(path.join(temp,'dist',pathname,'index.html'),'utf8');
     assert.ok(article.includes(`id="${fragment}"`),entry.href);
    }
   }
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
