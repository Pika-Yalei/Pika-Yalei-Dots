import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newsItemAnchors, sectionAnchors } from './reading-navigation.mjs';
import { collectSources } from './source-index.mjs';
import { renderSectionContent } from './article-content.mjs';
const url = 'https://github.com/simonw/llm/pull/1771';
const section = {heading:'AI', paragraphs:['1. First。Details', 'Continuation', '2. Second。Details'], sources:[{label:'1. First',url}]};
test('news anchors remain stable when items are renumbered or analysis changes',()=>{
 const original = newsItemAnchors(section);
 assert.equal(original[1],null);
 assert.deepEqual(newsItemAnchors({...section,paragraphs:['5. First。Updated details','Continuation','8. Second。Updated']}),original);
 assert.equal(newsItemAnchors({...section,paragraphs:['3. New',...section.paragraphs]})[1],original[0]);
 assert.equal(new Set(newsItemAnchors({...section,paragraphs:['1. Same','2. Same']})).size,2);
 assert.notEqual(newsItemAnchors({...section,heading:'Business'})[0],original[0]);
});
test('mapped sources link to the news item while ambiguous sources retain section fallback',()=>{
 const anchored = sectionAnchors([section])[0];
 const post = {slug:'example',date:'2026-10-23',title:'Example',category:'新闻回顾',sections:[section]};
 assert.equal(collectSources([post])[0].references[0].href,`/notes/example/#${newsItemAnchors(section)[0]}`);
 const html = renderSectionContent(anchored,s=>s,true);
 assert.match(html,/class="news-item" id="news-[a-f0-9]+" tabindex="-1"/);
 assert.match(html,/aria-label="本条新闻链接：First"/);
 assert.ok(html.includes('<p>Continuation</p><ul class="article-sources">'));
 const ambiguous={...post,sections:[{...section,sources:[{label:'Unmapped',url}]}]};
 assert.equal(collectSources([ambiguous])[0].references[0].href,`/notes/example/#${anchored.id}`);
 assert.doesNotMatch(renderSectionContent(anchored,s=>s,false),/news-permalink/);
});
test('built daily news provides working item links without losing section anchors',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
 for(const post of posts.filter(p=>p.category==='新闻回顾')){
  const html=readFileSync(new URL(`../dist/notes/${post.slug}/index.html`,import.meta.url),'utf8');
  for(const section of sectionAnchors(post.sections)){
   assert.ok(html.includes(`id="${section.id}"`));
   for(const id of newsItemAnchors(section).filter(Boolean)){
    assert.ok(html.includes(`id="${id}" tabindex="-1"`));
    assert.ok(html.includes(`href="#${id}"`));
   }
  }
 }
});
