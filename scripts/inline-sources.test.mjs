import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionSourceGroups, renderSectionContent, articleText} from './article-content.mjs';
import {renderFeed} from './feed.mjs';
const url='https://github.com/simonw/llm/pull/1771';
const sources=[{label:'2. Second',url},{label:'1. First <source>',url},{label:'1. Cross-check',url},{label:'Unassigned',url}];
const section={heading:'AI',paragraphs:['1. First <item>','2. Second item'],sources};
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
test('explicit unique numbers place all matching citations directly after their item',()=>{
 const before=JSON.stringify(section);const {groups,remaining}=sectionSourceGroups(section,true);
 assert.deepEqual(groups.map(g=>g.sources.length),[2,1]);assert.deepEqual(remaining,[sources[3]]);assert.equal(JSON.stringify(section),before);
 const html=renderSectionContent(section,escape,true);
 assert.ok(html.indexOf('First &lt;source&gt;')<html.indexOf('<p>2. Second item'));
 assert.ok(html.indexOf('Second</a>')>html.indexOf('<p>2. Second item'));
 assert.equal((html.match(/href=/g)||[]).length,4);assert.match(html,/原记录未明确对应条目/);assert.doesNotMatch(html,/<item>|<source>/);
});
test('ambiguous numbers, unmatched labels and non-news content do not invent associations',()=>{
 for(const paragraphs of [['1. A','1. B'],['A','B']]){
  const mapped=sectionSourceGroups({...section,paragraphs},true);
  assert.equal(mapped.groups.flatMap(g=>g.sources).length,0);assert.equal(mapped.remaining.length,4);
 }
 const plain=sectionSourceGroups(section,false);assert.equal(plain.remaining.length,4);
 assert.doesNotMatch(renderSectionContent(section,escape,false),/source-mapping-note/);
});
test('current news has five columns only and all 54 source references follow the right item in site and feeds',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
 const post=posts.find(p=>p.slug==='news-2026-10-22');assert.equal(post.sections.length,5);
 assert.equal(post.sections.flatMap(s=>s.sources).length,54);
 const html=readFileSync(new URL('../dist/notes/news-2026-10-22/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/回顾范围与核验口径|source-mapping-note/);assert.match(html,/新闻窗口/);
 for(const section of post.sections){
  const {groups,remaining}=sectionSourceGroups(section,true);assert.equal(remaining.length,0);
  assert.ok(groups.every(g=>g.sources.length>0));
  for(const group of groups){const p=html.indexOf(`<p>${escape(group.text)}</p>`);assert.ok(p>=0);const end=html.indexOf('</ul>',p);assert.ok(end>p);for(const s of group.sources)assert.ok(html.slice(p,end).includes(escape(s.label)));}
 }
 const plain=articleText(post);assert.doesNotMatch(plain,/回顾范围与核验口径/);
 const first=post.sections[0];assert.ok(plain.indexOf(first.sources[0].url)<plain.indexOf(first.paragraphs[1]));
 const feed=renderFeed([post]);assert.ok(feed.indexOf(first.sources[0].url.replaceAll('&','&amp;amp;'))<feed.indexOf('2. PHP'));
});

test('citations follow the final continuation paragraph of an item, not just its heading',()=>{
 const fixture={heading:'AI',paragraphs:['1. Heading','事实：Details and analysis','2. Next','事实：Next details'],sources:sources.slice(0,3)};
 const {groups,remaining}=sectionSourceGroups(fixture,true);
 assert.deepEqual(groups.map(g=>g.sources.length),[0,2,0,1]);assert.equal(remaining.length,0);
});

test('legacy complete-title matches are exact and unique, never fuzzy guesses',()=>{
 const fixture={heading:'市场',paragraphs:['1. 完整新闻标题。事实','事实：续段','2. 别的新闻。事实'],sources:[{label:'完整新闻标题：原始来源',url},{label:'完整新闻：不是完全标题',url}]};
 const {groups,remaining}=sectionSourceGroups(fixture,true);assert.equal(groups[1].sources.length,1);assert.equal(remaining.length,1);
 const duplicate={...fixture,paragraphs:[...fixture.paragraphs,'3. 完整新闻标题。另一条']};assert.equal(sectionSourceGroups(duplicate,true).remaining.length,2);
});
test('all existing news references survive regrouping exactly once without changing source data',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
 for(const post of posts.filter(p=>p.category==='新闻回顾'))for(const section of post.sections){
  const before=JSON.stringify(section);const {groups,remaining}=sectionSourceGroups(section,true);
  const serialize=s=>JSON.stringify(s);
  assert.deepEqual([...groups.flatMap(g=>g.sources),...remaining].map(serialize).sort(),(section.sources??[]).map(serialize).sort());
  assert.equal(JSON.stringify(section),before);
 }
});
