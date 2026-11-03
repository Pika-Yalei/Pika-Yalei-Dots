import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderContents,sectionAnchors} from './reading-navigation.mjs';
import {renderWebsiteDirectory,websiteDirectoryAnchor} from './source-websites.mjs';
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const target='#contents-title:focus,.category-list>li[id^="website-"][tabindex="-1"]:focus';
function mediaBlocks(prefix){
 const blocks=[];let start=0;
 while((start=css.indexOf(prefix,start))!==-1){let i=css.indexOf('{',start)+1,depth=1,end=i;for(;depth&&end<css.length;end++){if(css[end]==='{')depth++;if(css[end]==='}')depth--;}assert.equal(depth,0);blocks.push(css.slice(i,end-1));start=end;}
 return blocks.join('\n');
}
test('return destinations remain stable native focus targets',()=>{
 const contents=renderContents(sectionAnchors([{heading:'AI'}]));
 assert.match(contents,/<h2 id="contents-title" tabindex="-1">/);
 const host='example.com',anchor=websiteDirectoryAnchor(host);
 const html=renderWebsiteDirectory({number:1,total:1,count:1,offset:0,websites:[{host,path:'/sources/websites/example/',count:1}]});
 assert.ok(html.includes(`<li id="${anchor}" tabindex="-1">`));
 assert.doesNotMatch(html,/tabindex="0"/);
});
test('only focused return targets receive screen outlines and scroll clearance',()=>{
 const screen=mediaBlocks('@media screen{');
 assert.ok(screen.includes(`${target}{outline:2px solid var(--green);outline-offset:7px}`));
 assert.ok(screen.includes('#contents-title,.category-list>li[id^="website-"][tabindex="-1"]{scroll-margin-top:24px}'));
 assert.doesNotMatch(screen,/#contents-title\{[^}]*outline:/);
});
test('target indicators respect forced colors and disappear from paper',()=>{
 assert.ok(mediaBlocks('@media screen and (forced-colors:active)').includes(`${target}{outline:2px solid Highlight;outline-offset:7px}`));
 assert.ok(mediaBlocks('@media print').includes(`${target}{outline:none}`));
});
test('already covered calendar and source entry indicators remain available',()=>{
 const calendar=readFileSync(new URL('../public/news-calendar.css',import.meta.url),'utf8');
 assert.match(calendar,/\.calendar-entries h2:focus\{outline:2px solid var\(--green\)/);
 assert.match(css,/\.source-entry:focus\{outline:2px solid var\(--green\)/);
});
